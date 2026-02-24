import { z } from 'zod'

// --- Zod schema ---
export const locationImportRowSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  postal_code: z.string().optional().default(''),
})

export type LocationImportRow = z.infer<typeof locationImportRowSchema>

// --- Validated row wrapper ---
export interface LocationImportRowValidated {
  rowIndex: number
  data: LocationImportRow
  errors: string[]
  warnings: string[]
}

// --- API response types ---
export interface LocationImportResult {
  rowIndex: number
  name: string
  success: boolean
  error?: string
  warning?: string
}

export interface LocationImportResponse {
  results: LocationImportResult[]
  summary: {
    total: number
    created: number
    skipped: number
    failed: number
  }
}

// --- Column mapping (FR + EN) ---
export const LOCATION_COLUMN_MAP: Record<string, keyof LocationImportRow> = {
  'nom': 'name',
  'name': 'name',
  'nom du lieu': 'name',
  'lieu': 'name',
  'centre': 'name',
  'adresse': 'address',
  'address': 'address',
  'ville': 'city',
  'city': 'city',
  'code postal': 'postal_code',
  'postal_code': 'postal_code',
  'cp': 'postal_code',
  'zip': 'postal_code',
  'zipcode': 'postal_code',
  'code_postal': 'postal_code',
}

export const LOCATION_TEMPLATE_HEADERS = ['Nom', 'Adresse', 'Ville', 'Code postal']

// --- Parse and validate ---
export function parseAndValidateLocationRows(
  rawRows: Record<string, unknown>[]
): LocationImportRowValidated[] {
  const seenNames = new Set<string>()

  return rawRows.map((raw, index) => {
    // Map raw columns to fields
    const mapped: Record<string, string> = {}
    for (const [header, value] of Object.entries(raw)) {
      const key = LOCATION_COLUMN_MAP[header.trim().toLowerCase()]
      if (key) {
        mapped[key] = String(value ?? '').trim()
      }
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Validate with Zod
    const result = locationImportRowSchema.safeParse(mapped)
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(issue.message)
      }
    }

    // Detect in-file duplicates by name (case-insensitive)
    const normalizedName = (mapped.name || '').toLowerCase().trim()
    if (normalizedName && seenNames.has(normalizedName)) {
      errors.push('Nom en doublon dans le fichier')
    }
    if (normalizedName) {
      seenNames.add(normalizedName)
    }

    return {
      rowIndex: index + 1,
      data: result.success ? result.data : {
        name: mapped.name || '',
        address: mapped.address || '',
        city: mapped.city || '',
        postal_code: mapped.postal_code || '',
      },
      errors,
      warnings,
    }
  })
}
