import type { UserRole } from '@/lib/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Administrateur',
  skill_master: 'Skill Master',
  manager: 'Manager',
  resp_audiologie: 'Resp. Audiologie',
  worker: 'Collaborateur',
  formation_user: 'Utilisateur Formations',
  gerant_franchise: 'Gérant franchisé',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800',
  skill_master: 'bg-purple-100 text-purple-800',
  manager: 'bg-orange-100 text-orange-800',
  resp_audiologie: 'bg-teal-100 text-teal-800',
  worker: 'bg-green-100 text-green-800',
  formation_user: 'bg-blue-100 text-blue-800',
  gerant_franchise: 'bg-cyan-100 text-cyan-800',
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === 'super_admin'
}

export function canAccessSkillMaster(role: UserRole): boolean {
  return role === 'super_admin' || role === 'skill_master'
}

export function canAccessEvaluator(role: UserRole): boolean {
  return role === 'super_admin' || role === 'manager' || role === 'skill_master' || role === 'resp_audiologie'
}

export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/admin/users'
    case 'skill_master':
      return '/skill-master/library'
    case 'manager':
      return '/evaluator/evaluations'
    case 'resp_audiologie':
      return '/evaluator/evaluations'
    case 'worker':
      return '/my-profile'
    case 'formation_user':
      return '/formations'
    case 'gerant_franchise':
      return '/formations'
    default:
      return '/dashboard'
  }
}
