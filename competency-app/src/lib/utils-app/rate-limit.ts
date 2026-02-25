/**
 * Rate limiter simple en mémoire pour les routes API.
 * Limite le nombre de requêtes par IP sur une fenêtre de temps donnée.
 *
 * Note : fonctionne par instance serverless. Sur Vercel, chaque
 * cold start repart à zéro, ce qui est acceptable pour bloquer
 * les abus les plus courants (brute force, spam).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Nettoyage périodique pour éviter les fuites mémoire
const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

interface RateLimitConfig {
  /** Nombre max de requêtes autorisées dans la fenêtre */
  maxRequests: number
  /** Durée de la fenêtre en secondes */
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Vérifie si une requête est autorisée selon le rate limit.
 *
 * @param identifier - Clé unique (ex: IP + route)
 * @param config - Configuration du rate limit
 * @returns Résultat avec allowed, remaining, et resetAt
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(identifier)

  // Pas d'entrée ou fenêtre expirée : on repart à zéro
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowSeconds * 1000
    store.set(identifier, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  // Fenêtre encore active
  entry.count++
  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Extrait l'adresse IP du client depuis les headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Crée une Response 429 Too Many Requests.
 */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: 'Trop de requêtes. Réessayez dans quelques instants.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  )
}
