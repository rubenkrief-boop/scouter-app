'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import type { ShowMessageFn } from './hooks/use-admin-message'

// ============================================
// Seed Button
// ============================================

export function SeedButton({ showMessage }: { showMessage: ShowMessageFn }) {
  const [loading, setLoading] = useState(false)

  const handleSeed = async () => {
    if (!confirm('Importer les données de formation depuis le fichier seed ? Les données existantes avec le même code seront mises à jour.')) return

    setLoading(true)
    try {
      const res = await fetch('/api/formations/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showMessage('success', `Import terminé : ${data.results.sessions} sessions, ${data.results.ateliers} ateliers, ${data.results.inscriptions} inscriptions, ${data.results.linked} profils liés`)
        window.location.reload()
      } else {
        showMessage('error', data.error || 'Erreur lors de l\'import')
      }
    } catch {
      showMessage('error', 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSeed} disabled={loading}>
      <Upload className="h-4 w-4 mr-1" />
      {loading ? 'Import...' : 'Importer seed'}
    </Button>
  )
}
