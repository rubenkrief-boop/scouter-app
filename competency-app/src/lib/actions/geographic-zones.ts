'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import type { GeographicZone } from '@/lib/types'

const REVALIDATE_PATH = '/admin/settings'

export async function getGeographicZones(): Promise<GeographicZone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('geographic_zones')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching zones:', error)
    return []
  }
  return (data ?? []) as GeographicZone[]
}

export async function createGeographicZone(data: {
  name: string
  freq_days_manager: number
  freq_days_resp: number
  color?: string
}) {
  const { profile } = await getAuthProfile()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Accès refusé' }
  }

  if (!data.name?.trim()) return { error: 'Le nom est requis' }
  if (data.freq_days_manager < 1) return { error: 'Fréquence manager invalide' }
  if (data.freq_days_resp < 1) return { error: 'Fréquence resp invalide' }

  const supabase = await createClient()
  const { error } = await supabase.from('geographic_zones').insert({
    name: data.name.trim(),
    freq_days_manager: data.freq_days_manager,
    freq_days_resp: data.freq_days_resp,
    color: data.color || '#3B82F6',
  })

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateGeographicZone(id: string, data: {
  name?: string
  freq_days_manager?: number
  freq_days_resp?: number
  color?: string
  sort_order?: number
}) {
  const { profile } = await getAuthProfile()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Accès refusé' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('geographic_zones')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteGeographicZone(id: string) {
  const { profile } = await getAuthProfile()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Accès refusé' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('geographic_zones')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
