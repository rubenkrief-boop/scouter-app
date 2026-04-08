import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, setLoggerSink, type LogLevel } from './logger'

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV
  let sink: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Force a non-test env so the console sink actually writes
    vi.stubEnv('NODE_ENV', 'development')
    sink = vi.fn()
    setLoggerSink(sink)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    process.env.NODE_ENV = originalEnv
  })

  it('forwards info calls to the sink with the right level and context', () => {
    logger.info('test.info', 'hello', { foo: 1 })
    expect(sink).toHaveBeenCalledWith('info', 'test.info', 'hello', { foo: 1 })
  })

  it('forwards warn calls', () => {
    logger.warn('test.warn', 'careful')
    expect(sink).toHaveBeenCalledWith('warn', 'test.warn', 'careful', undefined)
  })

  it('forwards error calls with arbitrary unknown payload', () => {
    const err = new Error('boom')
    logger.error('test.err', err, { id: 42 })
    expect(sink).toHaveBeenCalledWith('error', 'test.err', err, { id: 42 })
  })

  it('accepts non-Error payloads at error level', () => {
    logger.error('test.err', 'string error')
    expect(sink).toHaveBeenCalledWith('error', 'test.err', 'string error', undefined)
  })

  it('debug is also forwarded', () => {
    logger.debug('test.debug', 'trace')
    expect(sink).toHaveBeenCalledWith('debug', 'test.debug', 'trace', undefined)
  })

  it('custom sink can intercept every level', () => {
    const calls: Array<[LogLevel, string]> = []
    setLoggerSink((level, ctx) => {
      calls.push([level, ctx])
    })
    logger.info('ctx', 'a')
    logger.warn('ctx', 'b')
    logger.error('ctx', 'c')
    expect(calls).toEqual([
      ['info', 'ctx'],
      ['warn', 'ctx'],
      ['error', 'ctx'],
    ])
  })
})
