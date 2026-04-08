/**
 * Sentry — client-side config.
 * DSN is read from NEXT_PUBLIC_SENTRY_DSN. When empty, Sentry is a no-op.
 * Fill NEXT_PUBLIC_SENTRY_DSN in .env.local once the project exists on sentry.io.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    debug: false,
  })
}
