import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServerClient } from '@supabase/ssr'

// Routes that bypass rate limiting entirely
const BYPASS_ROUTES = ['/api/stripe/webhook']

// Strict tier: auth & onboarding
const STRICT_PATTERNS = ['/api/auth/', '/api/onboarding/']

// Quick AI: single review generation (POST only)
const QUICK_AI_PATTERNS = ['/generate', '/regenerate', '/stream']

// Large AI: bulk/expensive operations (POST only)
const LARGE_AI_PATTERNS = ['/bulk-generate', '/insights/run', '/competitive-runs']

function getTier(pathname: string, method: string) {
  if (STRICT_PATTERNS.some((p) => pathname.startsWith(p))) return 'strict'
  if (method === 'POST' && LARGE_AI_PATTERNS.some((p) => pathname.endsWith(p))) return 'large-ai'
  if (method === 'POST' && QUICK_AI_PATTERNS.some((p) => pathname.endsWith(p))) return 'quick-ai'
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return 'write'
  return 'read'
}

const TIER_CONFIGS = {
  strict: { limit: 10, window: '60 s' as const, prefix: 'rl:strict' },
  'quick-ai': { limit: 40, window: '60 s' as const, prefix: 'rl:quick-ai' },
  'large-ai': { limit: 5, window: '60 s' as const, prefix: 'rl:large-ai' },
  write: { limit: 30, window: '60 s' as const, prefix: 'rl:write' },
  read: { limit: 60, window: '60 s' as const, prefix: 'rl:read' },
}

function createLimiter(tier: keyof typeof TIER_CONFIGS) {
  const config = TIER_CONFIGS[tier]
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: config.prefix,
    analytics: true,
  })
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
  const limiter = createLimiter(tier)

  // Key by user ID if authenticated, otherwise by IP
  const userId = await getUserId(request)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
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
