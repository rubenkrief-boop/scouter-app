/**
 * Zod schemas for API route body validation.
 *
 * These schemas are used in `src/app/api/**` handlers to validate
 * untrusted request bodies before they reach the database layer.
 *
 * Keep them in sync with the DB schema / types in `src/lib/types`.
 */

import { z } from 'zod'

// ----------------------------------------------------------------------------
// Shared primitives
// ----------------------------------------------------------------------------

export const UuidSchema = z.string().uuid({ message: 'identifiant invalide' })

export const UserRoleEnum = z.enum([
  'super_admin',
  'skill_master',
  'manager',
  'resp_audiologie',
  'worker',
  'formation_user',
  'gerant_franchise',
])

export const StatutEnum = z.enum(['succursale', 'franchise'])

// Accept uuid or empty/null to allow "unset" semantics in PATCH
const NullableUuid = z
  .union([UuidSchema, z.literal(''), z.null()])
  .transform((v) => (v === '' ? null : v))
  .optional()

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

export const CreateUserSchema = z.object({
  email: z.string().email({ message: 'email invalide' }).max(254),
  password: z
    .string()
    .min(8, { message: 'le mot de passe doit contenir au moins 8 caractères' })
    .max(128),
  first_name: z.string().min(1, { message: 'prénom requis' }).max(100),
  last_name: z.string().min(1, { message: 'nom requis' }).max(100),
  role: UserRoleEnum,
  manager_id: NullableUuid,
  location_id: NullableUuid,
  job_profile_id: NullableUuid,
  job_title: z.string().max(100).optional().nullable(),
  statut: StatutEnum.optional(),
})
export type CreateUserInput = z.infer<typeof CreateUserSchema>

export const UpdateUserSchema = z
  .object({
    userId: UuidSchema,
    role: UserRoleEnum.optional(),
    manager_id: NullableUuid,
    location_id: NullableUuid,
    is_active: z.boolean().optional(),
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    job_title: z.string().max(100).optional().nullable(),
    job_profile_id: NullableUuid,
    statut: StatutEnum.optional(),
    email: z.string().email({ message: 'email invalide' }).max(254).optional(),
  })
  .refine(
    (d) =>
      d.role !== undefined ||
      d.manager_id !== undefined ||
      d.location_id !== undefined ||
      d.is_active !== undefined ||
      d.first_name !== undefined ||
      d.last_name !== undefined ||
      d.job_title !== undefined ||
      d.job_profile_id !== undefined ||
      d.statut !== undefined ||
      d.email !== undefined,
    { message: 'aucun champ à mettre à jour' }
  )
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

// Single row used by the Excel import endpoint. The client-side parser already
// emits this shape (see `src/lib/utils-app/excel-import.ts`), but the API
// re-validates every row row-by-row, so here we only validate the envelope.
export const UsersImportBodySchema = z.object({
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, { message: 'aucune donnée à importer' })
    .max(5000, { message: 'trop de lignes (max 5000)' }),
})
export type UsersImportBody = z.infer<typeof UsersImportBodySchema>

// ----------------------------------------------------------------------------
// Locations
// ----------------------------------------------------------------------------

export const CreateLocationSchema = z.object({
  name: z.string().min(1, { message: 'nom requis' }).max(200),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
})
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>

export const UpdateLocationSchema = z
  .object({
    locationId: UuidSchema,
    name: z.string().min(1).max(200).optional(),
    address: z.string().max(500).nullable().optional(),
    city: z.string().max(200).nullable().optional(),
    postal_code: z.string().max(20).nullable().optional(),
    is_active: z.boolean().optional(),
    zone_id: z.union([UuidSchema, z.null()]).optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.address !== undefined ||
      d.city !== undefined ||
      d.postal_code !== undefined ||
      d.is_active !== undefined ||
      d.zone_id !== undefined,
    { message: 'aucun champ à mettre à jour' }
  )
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>

export const LocationsImportBodySchema = z.object({
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, { message: 'aucune donnée à importer' })
    .max(5000, { message: 'trop de lignes (max 5000)' }),
})
export type LocationsImportBody = z.infer<typeof LocationsImportBodySchema>

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

export const UpdateSettingSchema = z.object({
  key: z.string().min(1).max(100),
  // value can be any JSON-serialisable shape; we just require it to be defined
  value: z.unknown().refine((v) => v !== undefined, {
    message: 'value requis',
  }),
})
export type UpdateSettingInput = z.infer<typeof UpdateSettingSchema>

// ----------------------------------------------------------------------------
// Workers / Job profiles
// ----------------------------------------------------------------------------

export const JobProfileAssignmentSchema = z.object({
  jobProfileId: UuidSchema,
})
export type JobProfileAssignmentInput = z.infer<typeof JobProfileAssignmentSchema>

// ----------------------------------------------------------------------------
// Formations
// ----------------------------------------------------------------------------

export const FormationProgrammeTypeEnum = z.enum(['Audio', 'Assistante'])
export type FormationProgrammeType = z.infer<typeof FormationProgrammeTypeEnum>

// ----------------------------------------------------------------------------
// File upload limits (reused by multipart routes)
// ----------------------------------------------------------------------------

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const

export const LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
] as const

export const PROGRAMME_FILE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const

export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
export const PROGRAMME_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
