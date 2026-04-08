/**
 * Helpers to safely unwrap Supabase relation fields.
 *
 * Supabase PostgREST returns related rows as either an object (1-1 / to-one)
 * or an array (1-N / to-many) depending on the FK cardinality. The generated
 * types don't always reflect that correctly, so we narrow from `unknown` at
 * the call site instead of sprinkling `as any` everywhere.
 */

import type {
  Location,
  JobProfile,
  Profile,
  EvaluationResultQualifier,
  GeographicZone,
} from './database.types'

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Unwraps a relation that may come back as a single object, an array
 * (PostgREST sometimes wraps to-one as [obj]), or null.
 */
function unwrapOne(v: unknown): Record<string, unknown> | null {
  if (Array.isArray(v)) {
    const first = v[0]
    return isObject(first) ? first : null
  }
  return isObject(v) ? v : null
}

/** Location relation with optional joined zone. */
export type LocationRel = Pick<Location, 'id' | 'name' | 'city' | 'zone_id'> & {
  zone?: GeographicZone | null
}

export function relLocation(v: unknown): LocationRel | null {
  const o = unwrapOne(v)
  if (!o) return null
  return o as unknown as LocationRel
}

/** Minimal location shape (only `name` is guaranteed to be read). */
export type LocationName = Pick<Location, 'name'>

export function relLocationName(v: unknown): LocationName | null {
  const o = unwrapOne(v)
  if (!o) return null
  return o as unknown as LocationName
}

/** Job profile relation (only id+name typically selected). */
export type JobProfileRel = Pick<JobProfile, 'id' | 'name'>

export function relJobProfile(v: unknown): JobProfileRel | null {
  const o = unwrapOne(v)
  if (!o) return null
  return o as unknown as JobProfileRel
}

/** Manager relation (small subset of Profile). */
export type ManagerRel = Pick<Profile, 'first_name' | 'last_name'>

export function relManager(v: unknown): ManagerRel | null {
  const o = unwrapOne(v)
  if (!o) return null
  return o as unknown as ManagerRel
}

/** Avatar/URL lookup for profile rows where the type may not expose the column. */
export function readAvatarUrl(v: unknown): string | null {
  if (!isObject(v)) return null
  const a = v.avatar_url
  return typeof a === 'string' ? a : null
}

/** Narrow an unknown relation that should be an array of rows. */
export function relArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** Typed helper for evaluation_result_qualifiers nested arrays. */
export function relResultQualifiers(v: unknown): EvaluationResultQualifier[] {
  return Array.isArray(v) ? (v as EvaluationResultQualifier[]) : []
}
