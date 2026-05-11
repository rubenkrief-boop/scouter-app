// Redacts PII from arbitrary log payloads before they reach console / Sentry.
// Goal: keep enough info for debugging (UUIDs, status codes, scopes) while
// masking anything a reasonable RGPD review would flag.
//
// Strategy:
//   1. Walk the value recursively (objects, arrays).
//   2. For known sensitive KEY names (case-insensitive), replace the value.
//   3. For all string values, apply pattern-based masking (emails, IPs).
//   4. Never throw — on any error, return the original input unchanged so a
//      bug in the redactor doesn't cause logs to be lost.

const FULLY_REDACT_KEYS = new Set([
  'password',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'session',
  'service_role_key',
])

const PARTIAL_MASK_KEYS = new Set([
  'email',
  'phone',
  'tel',
  'phone_number',
  'mobile',
  'ip',
  'ip_address',
  'x-forwarded-for',
  'name',
  'firstname',
  'lastname',
  'first_name',
  'last_name',
  'full_name',
  'fullname',
  'display_name',
  'displayname',
  'patient_name',
  'patientname',
  'date_of_birth',
  'dob',
  'birthdate',
  'address',
  'street',
  'postal_code',
  'zip',
  'city',
])

function maskEmail(value: string): string {
  const at = value.indexOf('@')
  if (at <= 0) return '***'
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  const visible = local.charAt(0)
  return `${visible}***@${domain}`
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `***${digits.slice(-2)}`
}

function maskIp(value: string): string {
  if (value.includes(':')) {
    const parts = value.split(':')
    return `${parts[0]}:${parts[1] ?? ''}:****`
  }
  const parts = value.split('.')
  if (parts.length !== 4) return '***'
  return `${parts[0]}.${parts[1]}.X.X`
}

function maskName(value: string): string {
  return value
    .split(/\s+/)
    .map(word => (word.length === 0 ? word : `${word.charAt(0)}***`))
    .join(' ')
    .trim()
}

function maskByKey(key: string, value: unknown): unknown {
  const lower = key.toLowerCase()

  if (FULLY_REDACT_KEYS.has(lower)) return '[REDACTED]'

  if (PARTIAL_MASK_KEYS.has(lower)) {
    if (typeof value !== 'string') return '[REDACTED]'
    if (lower === 'email') return maskEmail(value)
    if (lower === 'phone' || lower === 'tel' || lower === 'phone_number' || lower === 'mobile') {
      return maskPhone(value)
    }
    if (lower === 'ip' || lower === 'ip_address' || lower === 'x-forwarded-for') {
      return maskIp(value)
    }
    if (
      lower === 'date_of_birth' ||
      lower === 'dob' ||
      lower === 'birthdate' ||
      lower === 'address' ||
      lower === 'street' ||
      lower === 'postal_code' ||
      lower === 'zip' ||
      lower === 'city'
    ) {
      return '[REDACTED]'
    }
    return maskName(value)
  }

  return undefined
}

const EMAIL_RE = /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
const IPV4_RE = /\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b/g

function maskFreeformString(value: string): string {
  return value
    .replace(EMAIL_RE, (_m, first, _rest, domain) => `${first}***@${domain}`)
    .replace(IPV4_RE, (_m, a, b) => `${a}.${b}.X.X`)
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > 8) return '[depth limit]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return maskFreeformString(value)
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskFreeformString(value.message),
    }
  }
  if (Array.isArray(value)) return value.map(item => redactValue(item, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const masked = maskByKey(k, v)
      out[k] = masked !== undefined ? masked : redactValue(v, depth + 1)
    }
    return out
  }
  return '[unsupported]'
}

export function redact<T>(value: T): T {
  try {
    return redactValue(value, 0) as T
  } catch {
    return value
  }
}
