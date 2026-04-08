import { describe, it, expect } from 'vitest'
import {
  relLocation,
  relLocationName,
  relJobProfile,
  relManager,
  readAvatarUrl,
  relArray,
  relResultQualifiers,
} from './relations'

describe('relation unwrappers', () => {
  describe('relLocation', () => {
    it('returns null for null/undefined', () => {
      expect(relLocation(null)).toBeNull()
      expect(relLocation(undefined)).toBeNull()
    })

    it('returns null for primitives', () => {
      expect(relLocation('nope')).toBeNull()
      expect(relLocation(42)).toBeNull()
    })

    it('returns the object when given a single-object relation', () => {
      const raw = { id: 'loc-1', name: 'ROUEN', city: 'Rouen', zone_id: null }
      const out = relLocation(raw)
      expect(out).not.toBeNull()
      expect(out?.name).toBe('ROUEN')
    })

    it('unwraps a single-element array (PostgREST sometimes wraps to-one as [obj])', () => {
      const raw = [{ id: 'loc-2', name: 'PARIS', city: 'Paris', zone_id: null }]
      expect(relLocation(raw)?.name).toBe('PARIS')
    })

    it('returns null for an empty array', () => {
      expect(relLocation([])).toBeNull()
    })
  })

  describe('relLocationName', () => {
    it('extracts name from an object', () => {
      expect(relLocationName({ name: 'LYON' })?.name).toBe('LYON')
    })
    it('returns null on bad input', () => {
      expect(relLocationName(null)).toBeNull()
      expect(relLocationName(123)).toBeNull()
    })
  })

  describe('relJobProfile', () => {
    it('returns id and name when present', () => {
      const out = relJobProfile({ id: 'jp-1', name: 'Audio Senior' })
      expect(out?.id).toBe('jp-1')
      expect(out?.name).toBe('Audio Senior')
    })

    it('handles the array-wrapped variant', () => {
      expect(relJobProfile([{ id: 'jp-2', name: 'Assistante' }])?.name).toBe('Assistante')
    })
  })

  describe('relManager', () => {
    it('returns first_name and last_name', () => {
      const mgr = relManager({ first_name: 'Jean', last_name: 'Dupont' })
      expect(mgr?.first_name).toBe('Jean')
      expect(mgr?.last_name).toBe('Dupont')
    })
    it('returns null for non-objects', () => {
      expect(relManager(null)).toBeNull()
    })
  })

  describe('readAvatarUrl', () => {
    it('returns the avatar_url string', () => {
      expect(readAvatarUrl({ avatar_url: 'https://cdn/avatar.png' })).toBe('https://cdn/avatar.png')
    })
    it('returns null when avatar_url is missing or not a string', () => {
      expect(readAvatarUrl({})).toBeNull()
      expect(readAvatarUrl({ avatar_url: 42 })).toBeNull()
      expect(readAvatarUrl(null)).toBeNull()
    })
  })

  describe('relArray', () => {
    it('returns the array unchanged when given an array', () => {
      expect(relArray<number>([1, 2, 3])).toEqual([1, 2, 3])
    })
    it('returns [] for non-arrays', () => {
      expect(relArray(null)).toEqual([])
      expect(relArray({ not: 'array' })).toEqual([])
      expect(relArray(undefined)).toEqual([])
    })
  })

  describe('relResultQualifiers', () => {
    it('returns the array when it is one', () => {
      const arr = [{ qualifier_id: 'q1', answer: 'yes' }]
      expect(relResultQualifiers(arr)).toEqual(arr)
    })
    it('returns empty array otherwise', () => {
      expect(relResultQualifiers(null)).toEqual([])
      expect(relResultQualifiers('nope')).toEqual([])
    })
  })
})
