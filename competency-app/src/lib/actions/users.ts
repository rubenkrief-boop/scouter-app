'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile, UserRole } from '@/lib/types'

export async function getUsers(): Promise<Profile[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return []
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('users.getUsers', error)
    return []
  }

  return (data ?? []) as Profile[]
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Acces refuse. Role super_admin requis.' }
  }

  // Validate the role value
  const validRoles: UserRole[] = ['super_admin', 'skill_master', 'manager', 'resp_audiologie', 'worker', 'formation_user', 'gerant_franchise']
  if (!validRoles.includes(role as UserRole)) {
    return { error: 'Rôle invalide.' }
  }

  // Lire l'ancien role pour capturer dans l'audit log la transition.
  const { data: previous } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ role: role as UserRole })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  await recordAudit({
    action: 'user.role_changed',
    actorId: user.id,
    targetId: userId,
    metadata: { previous_role: previous?.role ?? null, new_role: role },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

export async function toggleUserActive(userId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Acces refuse. Role super_admin requis.' }
  }

  // Get current state + role
  const { data: targetUser } = await supabase
    .from('profiles')
    .select('is_active, role')
    .eq('id', userId)
    .single()

  if (!targetUser) {
    return { error: 'Utilisateur introuvable.' }
  }

  const newActive = !targetUser.is_active

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: newActive })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  // If deactivating a manager, unassign their team members
  if (!newActive && targetUser.role === 'manager') {
    await supabase
      .from('profiles')
      .update({ manager_id: null })
      .eq('manager_id', userId)
  }

  await recordAudit({
    action: newActive ? 'user.reactivated' : 'user.deactivated',
    actorId: user.id,
    targetId: userId,
    metadata: { role: targetUser.role },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

export async function createUser(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Acces refuse. Role super_admin requis.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const role = (formData.get('role') as UserRole) || 'worker'

  if (!email || !password || !first_name || !last_name) {
    return { error: 'Email, mot de passe, prenom et nom sont requis.' }
  }

  // Validate the role value
  const validRoles: UserRole[] = ['super_admin', 'skill_master', 'manager', 'resp_audiologie', 'worker', 'formation_user', 'gerant_franchise']
  if (!validRoles.includes(role)) {
    return { error: 'Rôle invalide.' }
  }

  // Use admin client to create user via Supabase Admin API
  const adminClient = createAdminClient()

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name,
      last_name,
      role,
    },
  })

  if (createError) {
    return { error: createError.message }
  }

  if (!newUser.user) {
    return { error: 'Erreur lors de la creation de l\'utilisateur.' }
  }

  // The profile should be created automatically by a database trigger,
  // but ensure the role is set correctly
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ role, first_name, last_name })
    .eq('id', newUser.user.id)

  if (updateError) {
    logger.error('users.createUser', updateError, { stage: 'profile_update' })
  }

  await recordAudit({
    action: 'user.created',
    actorId: user.id,
    targetId: newUser.user.id,
    metadata: { role, email_domain: (email.split('@').pop() ?? '') },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
