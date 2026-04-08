/**
 * Structured logger for SCOUTER.
 *
 * Usage:
 *   logger.error('evaluations.getEvaluation', err, { evaluationId })
 *   logger.warn('formations.autoLink', 'no match found', { name })
 *   logger.info('visits.create', 'visit created', { visitId })
 *
 * The context string should follow the convention `<module>.<action>`
 * so logs can be filtered by feature. In production, the implementation
 * can be swapped to forward to Sentry / Logtail / Datadog without
 * touching call sites.
 */

type LogMetadata = Record<string, unknown>

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerSink {
  (level: LogLevel, context: string, message: unknown, metadata?: LogMetadata): void
}

const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

function formatError(err: unknown): { message: string; stack?: string; cause?: unknown } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack, cause: (err as Error & { cause?: unknown }).cause }
  }
  if (typeof err === 'string') return { message: err }
  try {
    return { message: JSON.stringify(err) }
  } catch {
    return { message: String(err) }
  }
}

const consoleSink: LoggerSink = (level, context, message, metadata) => {
  if (isTest) return // silence tests by default
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${context}]`
  const payload = level === 'error' ? formatError(message) : message
  const args: unknown[] = [prefix, payload]
  if (metadata && Object.keys(metadata).length > 0) args.push(metadata)

  switch (level) {
    case 'debug':
      if (!isProd) console.debug(...args)
      break
    case 'info':
      console.log(...args)
      break
    case 'warn':
      console.warn(...args)
      break
    case 'error':
      console.error(...args)
      break
  }
}

// Active sink — can be swapped at boot for Sentry / server telemetry.
let activeSink: LoggerSink = consoleSink

export function setLoggerSink(sink: LoggerSink) {
  activeSink = sink
}

export const logger = {
  debug(context: string, message: string, metadata?: LogMetadata) {
    activeSink('debug', context, message, metadata)
  },
  info(context: string, message: string, metadata?: LogMetadata) {
    activeSink('info', context, message, metadata)
  },
  warn(context: string, message: string, metadata?: LogMetadata) {
    activeSink('warn', context, message, metadata)
  },
  error(context: string, error: unknown, metadata?: LogMetadata) {
    activeSink('error', context, error, metadata)
  },
}
