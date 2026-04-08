import { describe, it, expect } from 'vitest'
import {
  CreateUserSchema,
  UpdateUserSchema,
  CreateLocationSchema,
  UsersImportBodySchema,
} from './api'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('CreateUserSchema', () => {
  const base = {
    email: 'alice@example.com',
    password: 'hunter2hunter2',
    first_name: 'Alice',
    last_name: 'Martin',
    role: 'manager' as const,
  }

  it('accepts a minimal valid payload', () => {
    expect(CreateUserSchema.safeParse(base).success).toBe(true)
  })

  it('accepts nullable manager_id / location_id', () => {
    expect(CreateUserSchema.safeParse({ ...base, manager_id: null, location_id: null }).success).toBe(true)
    expect(CreateUserSchema.safeParse({ ...base, manager_id: '', location_id: '' }).success).toBe(true)
    expect(CreateUserSchema.safeParse({ ...base, manager_id: VALID_UUID }).success).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(CreateUserSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects short passwords', () => {
    expect(CreateUserSchema.safeParse({ ...base, password: 'short' }).success).toBe(false)
  })

  it('rejects empty first/last names', () => {
    expect(CreateUserSchema.safeParse({ ...base, first_name: '' }).success).toBe(false)
    expect(CreateUserSchema.safeParse({ ...base, last_name: '' }).success).toBe(false)
  })

  it('rejects unknown roles', () => {
    expect(CreateUserSchema.safeParse({ ...base, role: 'admin' }).success).toBe(false)
  })

  it('rejects malformed uuids', () => {
    expect(CreateUserSchema.safeParse({ ...base, manager_id: 'not-a-uuid' }).success).toBe(false)
  })
})

describe('UpdateUserSchema', () => {
  it('requires at least one field besides userId', () => {
    expect(UpdateUserSchema.safeParse({ userId: VALID_UUID }).success).toBe(false)
  })

  it('accepts a single-field update', () => {
    expect(UpdateUserSchema.safeParse({ userId: VALID_UUID, is_active: false }).success).toBe(true)
  })

  it('rejects invalid userId', () => {
    expect(UpdateUserSchema.safeParse({ userId: 'nope', is_active: false }).success).toBe(false)
  })
})

describe('CreateLocationSchema', () => {
  it('accepts name-only', () => {
    expect(CreateLocationSchema.safeParse({ name: 'ROUEN' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(CreateLocationSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('UsersImportBodySchema', () => {
  it('accepts a single row', () => {
    expect(UsersImportBodySchema.safeParse({ rows: [{ email: 'a@b.c' }] }).success).toBe(true)
  })

  it('rejects empty payload', () => {
    expect(UsersImportBodySchema.safeParse({ rows: [] }).success).toBe(false)
  })

  it('rejects excessively large payloads', () => {
    const rows = Array.from({ length: 5001 }, () => ({ email: 'x@y.z' }))
    expect(UsersImportBodySchema.safeParse({ rows }).success).toBe(false)
  })
})
