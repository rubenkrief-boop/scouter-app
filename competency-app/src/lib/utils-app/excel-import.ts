import { z } from 'zod'

const VALID_ROLES = ['super_admin', 'skill_master', 'manager', 'worker'] as const

export const ROLE_ALIASES: Record<string, string> = {
  'administrateur': 'super_admin',
  'admin': 'super_admin',
  'super_admin': 'super_admin',
  'skill_master': 'skill_master',
  'skill master': 'skill_master',
  'manager': 'manager',
  'worker': 'worker',
  'collaborateur': 'worker',
  // Backward compatibility
  'audioprothesiste': 'worker',
  'audioprothésiste': 'worker',
  'evaluateur': 'skill_master',
  'évaluateur': 'skill_master',
  'evaluator': 'skill_master',
}

export const importRowSchema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  last_name: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  role: z.enum(VALID_ROLES, { message: `Rôle invalide. Valeurs acceptées: ${VALID_ROLES.join(', ')}` }),
  job_title: z.string().optional().default(''),
  location: z.string().optional().default(''),
  manager: z.string().optional().default(''),
})

export type ImportRow = z.infer<typeof importRowSchema>

export interface ImportRowValidated {
  rowIndex: number
  data: ImportRow
  errors: string[]
  warnings: string[]
}

export interface ImportResult {
  rowIndex: number
  email: string
  success: boolean
  error?: string
  warning?: string
}

export interface ImportResponse {
  results: ImportResult[]
  summary: {
    total: number
    created: number
    failed: number
  }
}

// Mapping colonnes Excel -> champs (FR et EN supportés)
export const COLUMN_MAP: Record<string, keyof ImportRow> = {
  'prenom': 'first_name',
  'prénom': 'first_name',
  'first_name': 'first_name',
  'firstname': 'first_name',
  'nom': 'last_name',
  'last_name': 'last_name',
  'lastname': 'last_name',
  'email': 'email',
  'e-mail': 'email',
  'mail': 'email',
  'role': 'role',
  'rôle': 'role',
  'emploi': 'job_title',
  'poste': 'job_title',
  'job_title': 'job_title',
  'job': 'job_title',
  'lieu': 'location',
  'location': 'location',
  'lieu d\'exercice': 'location',
  'centre': 'location',
  'manager': 'manager',
  'responsable': 'manager',
  'email manager': 'manager',
}

export const TEMPLATE_HEADERS = ['Prénom', 'Nom', 'Email', 'Rôle', 'Emploi', 'Lieu', 'Manager (email)']

export function normalizeRole(value: string): string {
  const normalized = value.trim().toLowerCase()
  return ROLE_ALIASES[normalized] || value.trim().toLowerCase()
}

export function parseAndValidateRows(rawRows: Record<string, unknown>[]): ImportRowValidated[] {
  return rawRows.map((raw, index) => {
    // Map raw columns to our fields
    const mapped: Record<string, string> = {}
    for (const [header, value] of Object.entries(raw)) {
      const key = COLUMN_MAP[header.trim().toLowerCase()]
      if (key) {
        mapped[key] = String(value ?? '').trim()
      }
    }

    // Normalize role
    if (mapped.role) {
      mapped.role = normalizeRole(mapped.role)
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Validate with Zod
    const result = importRowSchema.safeParse(mapped)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(issue.message)
      }
    }

    // Validate manager email format if provided
    if (mapped.manager && mapped.manager !== '') {
      const emailCheck = z.string().email().safeParse(mapped.manager)
      if (!emailCheck.success) {
        errors.push('Email du manager invalide')
      }
    }

    return {
      rowIndex: index + 1,
      data: result.success ? result.data : {
        first_name: mapped.first_name || '',
        last_name: mapped.last_name || '',
        email: mapped.email || '',
        role: mapped.role as ImportRow['role'] || 'worker',
        job_title: mapped.job_title || '',
        location: mapped.location || '',
        manager: mapped.manager || '',
      },
      errors,
      warnings,
    }
  })
}
