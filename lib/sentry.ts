import * as Sentry from '@sentry/nextjs'

export function captureRouteError(
  error: unknown,
  context?: {
    userId?: string
    teamId?: string
    route?: string
    extra?: Record<string, unknown>
  }
) {
  Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId })
    if (context?.teamId) scope.setTag('teamId', context.teamId)
    if (context?.route) scope.setTag('route', context.route)
    if (context?.extra) scope.setExtras(context.extra)
    Sentry.captureException(error)
  })
}
