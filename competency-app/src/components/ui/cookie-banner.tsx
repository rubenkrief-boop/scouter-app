'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Cookie } from 'lucide-react'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setVisible(true)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem('cookie-consent', 'accepted')
    localStorage.setItem('cookie-consent-date', new Date().toISOString())
    setVisible(false)
  }

  function handleRefuse() {
    localStorage.setItem('cookie-consent', 'refused')
    localStorage.setItem('cookie-consent-date', new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="h-6 w-6 text-rose-500 shrink-0 mt-1 sm:mt-0" />
        <div className="flex-1 text-sm text-slate-600">
          <p>
            Ce site utilise uniquement des <strong>cookies strictement necessaires</strong> au
            fonctionnement de l'application (authentification et session utilisateur).
            Aucun cookie publicitaire ou de suivi n'est utilise.{' '}
            <Link href="/legal/confidentialite" className="text-rose-600 hover:underline">
              En savoir plus
            </Link>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefuse}
          >
            Refuser
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 hover:bg-rose-700"
            onClick={handleAccept}
          >
            Accepter
          </Button>
        </div>
      </div>
    </div>
  )
}
