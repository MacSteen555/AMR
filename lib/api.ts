/**
 * API client utilities for frontend
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || ''

export interface ApiError {
  error: string
  details?: any
}

/**
 * Makes an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Always include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Handle 401 - redirect to login
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  // Handle errors
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(error.error || 'An error occurred')
  }

  return response.json()
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' })
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data?: any,
  idempotencyKey?: string
): Promise<T> {
  const headers: Record<string, string> = {}
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }

  return apiRequest<T>(endpoint, {
    method: 'POST',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * PATCH request
 */
export async function apiPatch<T>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' })
}

/**
 * Streams a draft reply from the SSE endpoint.
 * Calls onDelta with each text chunk as it arrives,
 * and onDone with the final saved review object.
 */
export async function streamDraft(
  reviewId: string,
  options: {
    previousDraft?: string
    mode?: 'generate' | 'regenerate'
    onDelta: (text: string) => void
    onDone: (review: any) => void
    onError?: (error: string) => void
  },
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/reviews/${reviewId}/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      previous_draft: options.previousDraft,
      mode: options.mode || 'generate',
    }),
  })

  if (response.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ error: 'Stream failed' }))
    throw new Error(err.error || 'Stream failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6))
        if (payload.error) {
          options.onError?.(payload.error)
          return
        }
        if (payload.delta) {
          options.onDelta(payload.delta)
        }
        if (payload.done && payload.review) {
          options.onDone(payload.review)
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}



