'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FormationType } from '@/lib/types'
import type { ShowMessageFn } from './use-admin-message'

export function useProgrammesFileUpload(
  selectedSession: string,
  showMessage: ShowMessageFn
) {
  const [uploading, setUploading] = useState<string | null>(null) // 'Audio' | 'Assistante' | null
  const router = useRouter()

  async function handleFileUpload(type: FormationType, file: File) {
    setUploading(type)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_id', selectedSession)
    formData.append('type', type)

    try {
      const res = await fetch('/api/formations/programme-file', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        showMessage('error', json.error || 'Erreur upload')
      } else if (json.imported) {
        // Excel import with programme-atelier mappings
        const { programmes, mappings, unmatched } = json.imported
        let msg = `Fichier ${type} importe : ${programmes.join(', ')} (${mappings} ateliers lies)`
        if (unmatched && unmatched.length > 0) {
          msg += ` — ${unmatched.length} atelier(s) non trouves : ${unmatched.join(', ')}`
        }
        showMessage('success', msg)
        router.refresh()
      } else {
        showMessage('success', `Fichier ${type} uploade`)
        router.refresh()
      }
    } catch {
      showMessage('error', 'Erreur reseau')
    } finally {
      setUploading(null)
    }
  }

  async function handleFileDelete(type: FormationType) {
    if (!confirm(`Supprimer le fichier programme ${type} ?`)) return
    try {
      const res = await fetch(
        `/api/formations/programme-file?session_id=${selectedSession}&type=${type}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        showMessage('error', 'Erreur suppression')
      } else {
        showMessage('success', `Fichier ${type} supprime`)
        router.refresh()
      }
    } catch {
      showMessage('error', 'Erreur reseau')
    }
  }

  return { uploading, handleFileUpload, handleFileDelete }
}
