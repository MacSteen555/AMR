import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServerClient } from '@supabase/ssr'

// Routes that bypass rate limiting entirely
const BYPASS_ROUTES = ['/api/stripe/webhook', '/api/cron/']

// Strict tier: auth & onboarding (matched with startsWith)
const STRICT_PREFIX_PATTERNS = ['/api/auth/', '/api/onboarding/']

// Strict tier (endsWith matching)
const STRICT_SUFFIX_PATTERNS = ['/invites']

// Sync tier: review syncing & competitor scraping (matched with includes/endsWith)
const SYNC_PATTERNS = ['/reviews/sync']

// Quick AI: single review generation (POST only)
const QUICK_AI_PATTERNS = ['/generate', '/regenerate', '/stream']

// Large AI: bulk/expensive operations (POST only)
const LARGE_AI_PATTERNS = ['/bulk-generate', '/insights/run']

// Contact/feedback emails: very strict to prevent spam
const CONTACT_PATTERNS = ['/api/contact', '/api/feature-request']

function getTier(pathname: string, method: string) {
  if (method === 'POST' && CONTACT_PATTERNS.some((p) => pathname.startsWith(p))) return 'contact'
  if (STRICT_PREFIX_PATTERNS.some((p) => pathname.startsWith(p))) return 'strict'
  if (method === 'POST' && STRICT_SUFFIX_PATTERNS.some((p) => pathname.endsWith(p))) return 'strict'
  if (SYNC_PATTERNS.some((p) => pathname.endsWith(p))) return 'sync'
  if (method === 'POST' && LARGE_AI_PATTERNS.some((p) => pathname.endsWith(p))) return 'large-ai'
  if (method === 'POST' && QUICK_AI_PATTERNS.some((p) => pathname.endsWith(p))) return 'quick-ai'
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return 'write'
  return 'read'
}

const TIER_CONFIGS = {
  contact: { limit: 1, window: '60 s' as const, prefix: 'rl:contact' },
  strict: { limit: 5, window: '60 s' as const, prefix: 'rl:strict' },
  sync: { limit: 3, window: '60 s' as const, prefix: 'rl:sync' },
  'quick-ai': { limit: 40, window: '60 s' as const, prefix: 'rl:quick-ai' },
  'large-ai': { limit: 5, window: '60 s' as const, prefix: 'rl:large-ai' },
  write: { limit: 30, window: '60 s' as const, prefix: 'rl:write' },
  read: { limit: 60, window: '60 s' as const, prefix: 'rl:read' },
}

// Module-scope Redis client + rate limiters — reused across warm invocations on Vercel edge
let _limiters: Record<string, Ratelimit> | null = null

function getLimiters(): Record<string, Ratelimit> {
  if (_limiters) return _limiters
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  _limiters = Object.fromEntries(
    Object.entries(TIER_CONFIGS).map(([tier, config]) => [
      tier,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.limit, config.window),
        prefix: config.prefix,
        analytics: true,
      }),
    ])
  )
  return _limiters
}

async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {},
        },
      }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect old /locations/:id/... URLs to new ?location= pattern
  const locationMatch = pathname.match(/^\/locations\/([^/]+)\/(reviews|insights)/)
  if (locationMatch) {
    const [, locationId, section] = locationMatch
    const url = request.nextUrl.clone()
    url.pathname = '/location-redirect'
    url.searchParams.set('locationId', locationId)
    url.searchParams.set('section', section)
    return NextResponse.redirect(url)
  }

  const bareLocationMatch = pathname.match(/^\/locations\/([^/]+)$/)
  if (bareLocationMatch) {
    const url = request.nextUrl.clone()
    url.pathname = '/location-redirect'
    url.searchParams.set('locationId', bareLocationMatch[1])
    url.searchParams.set('section', 'reviews')
    return NextResponse.redirect(url)
  }

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Bypass specific routes
  if (BYPASS_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Skip rate limiting if Redis is not configured (local dev)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.next()
  }

  const tier = getTier(pathname, request.method) as keyof typeof TIER_CONFIGS
  const limiter = getLimiters()[tier]

  // Key by user ID if authenticated, otherwise by IP
  const userId = await getUserId(request)
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const key = userId ? `user:${userId}` : `ip:${ip}`

  const { success, limit, remaining, reset } = await limiter.limit(key)

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(limit))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  return response
}

export const config = {
  matcher: '/api/:path*',
}
