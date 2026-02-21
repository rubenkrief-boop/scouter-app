import type { UserRole } from '@/lib/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Administrateur',
  skill_master: 'Skill Master',
  manager: 'Manager',
  worker: 'Collaborateur',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800',
  skill_master: 'bg-purple-100 text-purple-800',
  manager: 'bg-orange-100 text-orange-800',
  worker: 'bg-green-100 text-green-800',
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === 'super_admin'
}

export function canAccessSkillMaster(role: UserRole): boolean {
  return role === 'super_admin' || role === 'skill_master'
}

export function canAccessManager(role: UserRole): boolean {
  return role === 'super_admin' || role === 'manager'
}

export function canAccessEvaluator(role: UserRole): boolean {
  return role === 'super_admin' || role === 'manager' || role === 'skill_master'
}

export function canEvaluate(role: UserRole): boolean {
  return role === 'super_admin' || role === 'manager' || role === 'skill_master'
}

export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/admin/users'
    case 'skill_master':
      return '/skill-master/library'
    case 'manager':
      return '/evaluator/evaluations'
    case 'worker':
      return '/my-profile'
    default:
      return '/dashboard'
  }
}
