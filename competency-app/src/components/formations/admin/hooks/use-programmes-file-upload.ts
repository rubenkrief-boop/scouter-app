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
      } else {
        showMessage('success', `Fichier ${type} uploadé`)
        router.refresh()
      }
    } catch {
      showMessage('error', 'Erreur réseau')
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
        showMessage('success', `Fichier ${type} supprimé`)
        router.refresh()
      }
    } catch {
      showMessage('error', 'Erreur réseau')
    }
  }

  return { uploading, handleFileUpload, handleFileDelete }
}
