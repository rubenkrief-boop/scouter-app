import type { FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { normalizeName } from '@/lib/utils'

// ============================================
// Color mappings
// ============================================

export const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-100 text-orange-800 border-orange-200',
  m23: 'bg-pink-100 text-pink-800 border-pink-200',
  s23: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  m24: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  s24: 'bg-purple-100 text-purple-800 border-purple-200',
  m25: 'bg-green-100 text-green-800 border-green-200',
  s25: 'bg-amber-100 text-amber-800 border-amber-200',
  m26: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

export const PROG_COLORS: Record<string, string> = {
  P1: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  P2: 'bg-orange-100 text-orange-800 border-orange-200',
  P3: 'bg-green-100 text-green-800 border-green-200',
  P4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Format rotatif': 'bg-purple-100 text-purple-800 border-purple-200',
}

// ============================================
// Doublons: Exclusions & Equivalences (from HTML prototype)
// ============================================

// Ateliers NEVER considered doublons (content differs per session)
// Values must be normalized (no spaces, no accents, lowercase) to match normalizeName() output
export const EXCLUSIONS = ['backoffice', 'bestpractices', 'customerprofiling']

// Ateliers semantically equivalent across sessions
export const EQUIVALENCES: { keywords: string[]; type: 'Audio' | 'Assistante' | 'both' }[] = [
  { keywords: ['secours'],       type: 'both' },
  { keywords: ['autophonation'], type: 'Audio' },
  { keywords: ['réglementat'],   type: 'both' },
  { keywords: ['manager 2'],     type: 'Audio' },
  { keywords: ['manager 2'],     type: 'Assistante' },
  { keywords: ['wizville'],      type: 'both' },
  { keywords: ['oney'],          type: 'both' },
  { keywords: ['renouvellement'], type: 'Audio' },
]

// ============================================
// Shared types
// ============================================

export interface GroupedParticipant {
  nom: string
  prenom: string
  centre: string | null
  dpc: boolean
  profile_id: string | null
  sessions: { session: import('@/lib/types').FormationSession; programme: string; type: string; statut: string; inscriptionId: string }[]
  types: Set<string>
  statuts: Set<string>
  atelierCount: number
}

export type SortKey = 'nom' | 'prenom' | 'type' | 'statut' | 'programme'
export type SortDir = 'asc' | 'desc'

// ============================================
// Helper: normalized person key (prenom|nom)
// ============================================

export function groupByNormalizedName(prenom: string, nom: string): string {
  return `${normalizeName(prenom)}|${normalizeName(nom)}`
}

// ============================================
// Helper: get ateliers for a participant in a session
// ============================================

export function getAteliersForParticipant(
  sessionId: string,
  type: string,
  programme: string,
  ateliers: FormationAtelierWithSession[],
  progMappings: ProgrammeAtelierMapping[]
): FormationAtelierWithSession[] {
  const isRotatif = programme === 'Format rotatif'

  if (isRotatif) {
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  const mappedAtelierIds = new Set(
    progMappings
      .filter(m => m.session_id === sessionId && m.type === type && m.programme === programme)
      .map(m => m.atelier_id)
  )

  if (mappedAtelierIds.size === 0) {
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  return ateliers.filter(a => mappedAtelierIds.has(a.id))
}

// ============================================
// Helper: get participants for an atelier
// ============================================

export function getParticipantsForAtelier(
  atelier: FormationAtelierWithSession,
  inscriptions: FormationInscriptionWithSession[],
  progMappings: ProgrammeAtelierMapping[]
): FormationInscriptionWithSession[] {
  const sessionInscriptions = inscriptions.filter(
    i => i.session_id === atelier.session_id && i.type === atelier.type
  )

  if (atelier.programmes === 'Format rotatif' || !atelier.programmes) {
    return sessionInscriptions
  }

  // Find which programmes include this atelier
  const atelierMappings = progMappings.filter(
    m => m.atelier_id === atelier.id && m.session_id === atelier.session_id && m.type === atelier.type
  )
  const mappedProgrammes = new Set(atelierMappings.map(m => m.programme))

  if (mappedProgrammes.size === 0) {
    return sessionInscriptions
  }

  return sessionInscriptions.filter(i => mappedProgrammes.has(i.programme))
}

// ============================================
// Helper: Doublon atelier grouping (matching HTML logic)
// ============================================

export function groupeAtelier(nomAtelier: string, type: string, sid: string): string {
  const n = normalizeName(nomAtelier)

  // Exclusions: unique key per session (never matches cross-session)
  for (const excl of EXCLUSIONS) {
    if (n.includes(excl)) {
      return `${n}_exclu|${type}_${sid}_${nomAtelier}`
    }
  }

  // Equivalences: group by keyword
  for (const eq of EQUIVALENCES) {
    if (eq.type === 'both' || eq.type === type) {
      if (eq.keywords.every(kw => n.includes(normalizeName(kw)))) {
        return `equiv|${eq.keywords.join('_')}|${eq.type === 'both' ? type : eq.type}`
      }
    }
  }

  // Default: normalized name + type
  return `${n}|${type}`
}
