import { describe, it, expect } from 'vitest'
import { cn, normalizeName } from './utils'

describe('normalizeName', () => {
  it('lowercases the input', () => {
    expect(normalizeName('HELLO')).toBe('hello')
  })

  it('strips French accents', () => {
    expect(normalizeName('Céline')).toBe('celine')
    expect(normalizeName('Hélène')).toBe('helene')
    expect(normalizeName('François')).toBe('francois')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeName('Jean  Pierre')).toBe('jeanpierre')
    expect(normalizeName('  Anne  Marie  ')).toBe('annemarie')
  })

  it('matches variants that only differ by case, accents, or spaces', () => {
    const ref = normalizeName('Céline MAUDUIT')
    expect(normalizeName('celine mauduit')).toBe(ref)
    expect(normalizeName('CELINE  MAUDUIT')).toBe(ref)
    expect(normalizeName('Céline Mauduit')).toBe(ref)
  })

  it('keeps hyphens (not stripped by the current implementation)', () => {
    expect(normalizeName('Jean-Pierre')).toBe('jean-pierre')
  })

  it('returns an empty string for empty input', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName('   ')).toBe('')
  })
})

describe('cn (class merge)', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('dedupes conflicting tailwind classes (twMerge)', () => {
    // twMerge keeps the last conflicting class
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('supports conditional objects from clsx', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })
})
