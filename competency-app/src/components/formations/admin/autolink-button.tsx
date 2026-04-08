'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Link2 } from 'lucide-react'
import { autoLinkInscriptions } from '@/lib/actions/formations'
import type { ShowMessageFn } from './hooks/use-admin-message'

// ============================================
// Auto-link Button
// ============================================

export function AutoLinkButton({ showMessage }: { showMessage: ShowMessageFn }) {
  const [loading, setLoading] = useState(false)

  const handleLink = async () => {
    setLoading(true)
    try {
      const result = await autoLinkInscriptions()
      showMessage('success', `${result.linked} inscription(s) liée(s) aux profils`)
      if (result.linked > 0) window.location.reload()
    } catch {
      showMessage('error', 'Erreur lors du lien automatique')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLink} disabled={loading}>
      <Link2 className="h-4 w-4 mr-1" />
      {loading ? 'Liaison...' : 'Auto-lier profils'}
    </Button>
  )
}
