import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIp } from './rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the budget', () => {
    const key = `test-allow-${Math.random()}`
    const r1 = checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    const r2 = checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    const r3 = checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('blocks the request after the budget is exhausted', () => {
    const key = `test-block-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    const r4 = checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    expect(r4.allowed).toBe(false)
    expect(r4.remaining).toBe(0)
  })

  it('resets after the window expires', () => {
    const key = `test-reset-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    expect(checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 }).allowed).toBe(false)

    // Advance past the window
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    const afterReset = checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 })
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(2)
  })

  it('keeps separate budgets for different identifiers', () => {
    const key1 = `test-sep-a-${Math.random()}`
    const key2 = `test-sep-b-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key1, { maxRequests: 3, windowSeconds: 60 })
    expect(checkRateLimit(key1, { maxRequests: 3, windowSeconds: 60 }).allowed).toBe(false)
    expect(checkRateLimit(key2, { maxRequests: 3, windowSeconds: 60 }).allowed).toBe(true)
  })
})

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('https://example.com/api', { headers })
  }

  it('prefers x-forwarded-for and takes the first entry', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '9.9.9.9' })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it("returns 'unknown' when no header is present", () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
