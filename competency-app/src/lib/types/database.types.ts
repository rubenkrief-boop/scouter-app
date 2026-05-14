export type UserRole = 'super_admin' | 'skill_master' | 'manager' | 'resp_audiologie' | 'worker' | 'formation_user' | 'gerant_franchise'

export type Statut = 'succursale' | 'franchise'

export type QualifierType = 'single_choice' | 'multiple_choice'

export type EvaluationStatus = 'draft' | 'in_progress' | 'completed'

export interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  job_title: string | null
  avatar_url: string | null
  is_active: boolean
  manager_id: string | null
  location_id: string | null
  /** 'succursale' = reseau Vivason succursale (acces plateforme complete) ;
   *  'franchise' = centre franchise (typiquement acces formations uniquement).
   *  Decouple du role pour pouvoir croiser job_title x statut dans les
   *  listes formations. Cf. migration 00028. */
  statut: Statut
  /** Version des CGU acceptees par l'utilisateur. Vide = jamais acceptees,
   *  prompt au prochain login (cf. src/lib/legal.ts pour la version courante). */
  legal_accepted_version: string | null
  /** Horodatage UTC de l'acceptation des CGU. A des fins de preuve. */
  legal_accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  name: string
  address: string | null
  city: string | null
  postal_code: string | null
  zone_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================
// Visits / Déplacements
// ============================================

export type VisitStatus = 'planned' | 'completed' | 'cancelled'

export interface GeographicZone {
  id: string
  name: string
  freq_days_admin: number
  freq_days_manager: number
  freq_days_resp: number
  target_visits_admin: number
  target_visits_manager: number
  target_visits_resp: number
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Visit {
  id: string
  location_id: string
  created_by: string
  start_date: string
  end_date: string
  status: VisitStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VisitWithRelations extends Visit {
  location?: Location & { zone?: GeographicZone | null }
  creator?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'role'>
}

export interface PlannerLocation {
  id: string
  profile_id: string
  location_id: string
  created_at: string
}

export interface ProfileWithRelations extends Profile {
  manager?: Profile | null
  location?: Location | null
}

export interface Module {
  id: string
  parent_id: string | null
  code: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ModuleWithChildren extends Module {
  children?: ModuleWithChildren[]
  competencies?: Competency[]
}

export interface Competency {
  id: string
  module_id: string
  name: string
  description: string | null
  external_id: string | null
  sort_order: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Qualifier {
  id: string
  name: string
  qualifier_type: QualifierType
  sort_order: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QualifierOption {
  id: string
  qualifier_id: string
  label: string
  value: number
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
}

export interface QualifierWithOptions extends Qualifier {
  qualifier_options: QualifierOption[]
}

export interface JobProfile {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface JobProfileCompetency {
  id: string
  job_profile_id: string
  module_id: string
  expected_score: number
  created_at: string
  updated_at: string
}

export interface JobProfileCompetencySetting {
  id: string
  job_profile_id: string
  competency_id: string
  weight: number
  expected_score: number
  created_at: string
  updated_at: string
}

export interface JobProfileQualifier {
  id: string
  job_profile_id: string
  qualifier_id: string
  created_at: string
  updated_at: string
}

export interface ModuleQualifier {
  id: string
  module_id: string
  qualifier_id: string
  created_at: string
  updated_at: string
}

export interface CompetencyQualifier {
  id: string
  competency_id: string
  qualifier_id: string
  created_at: string
  updated_at: string
}

export interface Evaluation {
  id: string
  evaluator_id: string
  audioprothesiste_id: string
  job_profile_id: string | null
  title: string | null
  notes: string | null
  status: EvaluationStatus
  is_continuous: boolean
  evaluated_at: string | null
  created_at: string
  updated_at: string
}

export interface EvaluationWithRelations extends Evaluation {
  evaluator?: Profile
  audioprothesiste?: Profile
  job_profile?: JobProfile | null
}

export interface EvaluationResult {
  id: string
  evaluation_id: string
  competency_id: string
  created_at: string
  updated_at: string
}

export interface EvaluationResultQualifier {
  id: string
  evaluation_result_id: string
  qualifier_id: string
  qualifier_option_id: string
  created_at: string
}

export interface EvaluationSnapshot {
  id: string
  evaluation_id: string
  snapshot_by: string
  scores: Record<string, Record<string, string>>
  module_scores: ModuleScore[] | null
  created_at: string
}

export interface EvaluationSnapshotWithAuthor extends EvaluationSnapshot {
  author?: { first_name: string; last_name: string }
}

export interface SnapshotHistoryEntry {
  snapshot_id: string
  snapshot_date: string
  snapshot_by_name: string
  module_scores: ModuleScore[] | null
}

export interface EvaluationComment {
  id: string
  evaluation_id: string
  author_id: string
  content: string
  created_at: string
}

export interface EvaluationCommentWithAuthor extends EvaluationComment {
  author?: { first_name: string; last_name: string; role: string }
}

export interface WorkerComment {
  id: string
  worker_id: string
  author_id: string
  content: string
  created_at: string
}

export interface WorkerCommentWithAuthor extends WorkerComment {
  author?: { first_name: string; last_name: string; role: string }
}

export interface AudioprothesisteAssignment {
  id: string
  audioprothesiste_id: string
  job_profile_id: string
  assigned_evaluator_id: string | null
  created_at: string
  updated_at: string
}

// Radar chart data
export interface RadarDataPoint {
  module: string
  actual: number
  expected: number
  fullMark: number
  moduleColor?: string
  moduleIcon?: string
}

export interface ModuleScore {
  module_id: string
  module_code: string
  module_name: string
  actual_score: number
  total_possible: number
  completion_pct: number
}

// === FORMATIONS ===

export type FormationType = 'Audio' | 'Assistante'
export type FormationEtat = 'Terminé' | 'En cours' | 'Pas commencé'
export type FormationStatut = 'Succursale' | 'Franchise'

export interface FormationSession {
  id: string
  code: string
  label: string
  date_info: string | null
  sort_order: number
  is_active: boolean
  registration_open: boolean
  created_at: string
  updated_at: string
}

export interface FormationAtelier {
  id: string
  session_id: string
  nom: string
  formateur: string | null
  duree: string | null
  type: FormationType
  etat: FormationEtat
  programmes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FormationInscription {
  id: string
  session_id: string
  profile_id: string | null
  nom: string
  prenom: string
  type: FormationType
  statut: FormationStatut
  programme: string
  centre: string | null
  dpc: boolean
  created_at: string
  updated_at: string
}

export interface FormationInscriptionWithSession extends FormationInscription {
  session: FormationSession
}

export interface FormationAtelierWithSession extends FormationAtelier {
  session: FormationSession
}

export interface FormationProgrammeAtelier {
  id: string
  session_id: string
  type: FormationType
  programme: string
  atelier_id: string
}

export interface FormationProgrammeFile {
  id: string
  session_id: string
  type: FormationType
  file_url: string
  file_name: string
  created_at: string
  updated_at: string
}

export interface FormationProgrammeSetting {
  id: string
  session_id: string
  type: FormationType
  programme: string
  max_succ: number
  max_franchise: number
  salle: string | null
  created_at: string
  updated_at: string
}

export interface FormationProgrammeSettingWithCount extends FormationProgrammeSetting {
  current_count: number
  current_count_succ: number
  current_count_franchise: number
}

// Database type for Supabase client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      locations: {
        Row: Location
        Insert: Omit<Location, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Location, 'id' | 'created_at'>>
      }
      modules: {
        Row: Module
        Insert: Omit<Module, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Module, 'id' | 'created_at'>>
      }
      competencies: {
        Row: Competency
        Insert: Omit<Competency, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Competency, 'id' | 'created_at'>>
      }
      qualifiers: {
        Row: Qualifier
        Insert: Omit<Qualifier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Qualifier, 'id' | 'created_at'>>
      }
      qualifier_options: {
        Row: QualifierOption
        Insert: Omit<QualifierOption, 'id' | 'created_at'>
        Update: Partial<Omit<QualifierOption, 'id' | 'created_at'>>
      }
      job_profiles: {
        Row: JobProfile
        Insert: Omit<JobProfile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<JobProfile, 'id' | 'created_at'>>
      }
      job_profile_competencies: {
        Row: JobProfileCompetency
        Insert: Omit<JobProfileCompetency, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<JobProfileCompetency, 'id' | 'created_at'>>
      }
      job_profile_competency_settings: {
        Row: JobProfileCompetencySetting
        Insert: Omit<JobProfileCompetencySetting, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<JobProfileCompetencySetting, 'id' | 'created_at'>>
      }
      evaluations: {
        Row: Evaluation
        Insert: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Evaluation, 'id' | 'created_at'>>
      }
      evaluation_results: {
        Row: EvaluationResult
        Insert: Omit<EvaluationResult, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EvaluationResult, 'id' | 'created_at'>>
      }
      evaluation_result_qualifiers: {
        Row: EvaluationResultQualifier
        Insert: Omit<EvaluationResultQualifier, 'id' | 'created_at'>
        Update: Partial<Omit<EvaluationResultQualifier, 'id' | 'created_at'>>
      }
      audioprothesiste_assignments: {
        Row: AudioprothesisteAssignment
        Insert: Omit<AudioprothesisteAssignment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AudioprothesisteAssignment, 'id' | 'created_at'>>
      }
      evaluation_comments: {
        Row: EvaluationComment
        Insert: Omit<EvaluationComment, 'id' | 'created_at'>
        Update: never // Immutable
      }
      worker_comments: {
        Row: WorkerComment
        Insert: Omit<WorkerComment, 'id' | 'created_at'>
        Update: never // Immutable
      }
      module_qualifiers: {
        Row: ModuleQualifier
        Insert: Omit<ModuleQualifier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ModuleQualifier, 'id' | 'created_at'>>
      }
      competency_qualifiers: {
        Row: CompetencyQualifier
        Insert: Omit<CompetencyQualifier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CompetencyQualifier, 'id' | 'created_at'>>
      }
      evaluation_snapshots: {
        Row: EvaluationSnapshot
        Insert: Omit<EvaluationSnapshot, 'id' | 'created_at'>
        Update: never // Immutable
      }
      formation_sessions: {
        Row: FormationSession
        Insert: Omit<FormationSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FormationSession, 'id' | 'created_at'>>
      }
      formation_ateliers: {
        Row: FormationAtelier
        Insert: Omit<FormationAtelier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FormationAtelier, 'id' | 'created_at'>>
      }
      formation_inscriptions: {
        Row: FormationInscription
        Insert: Omit<FormationInscription, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FormationInscription, 'id' | 'created_at'>>
      }
      formation_programme_ateliers: {
        Row: FormationProgrammeAtelier
        Insert: Omit<FormationProgrammeAtelier, 'id'>
        Update: Partial<Omit<FormationProgrammeAtelier, 'id'>>
      }
      formation_programme_files: {
        Row: FormationProgrammeFile
        Insert: Omit<FormationProgrammeFile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FormationProgrammeFile, 'id' | 'created_at'>>
      }
      formation_programme_settings: {
        Row: FormationProgrammeSetting
        Insert: Omit<FormationProgrammeSetting, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FormationProgrammeSetting, 'id' | 'created_at'>>
      }
    }
    Functions: {
      get_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
      get_module_scores: {
        Args: { p_evaluation_id: string }
        Returns: ModuleScore[]
      }
      get_batch_module_scores: {
        Args: { p_evaluation_ids: string[] }
        Returns: (ModuleScore & { evaluation_id: string })[]
      }
      get_snapshot_history: {
        Args: { p_evaluation_id: string }
        Returns: SnapshotHistoryEntry[]
      }
    }
    Enums: {
      user_role: UserRole
      qualifier_type: QualifierType
    }
  }
}
