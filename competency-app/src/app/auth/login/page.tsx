'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { useBranding } from '@/components/providers/branding-provider'

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const branding = useBranding()
  const errorParam = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    domain_not_allowed: 'Seuls les comptes @vivason.fr sont autorisés.',
    could_not_verify: 'Erreur de vérification. Veuillez réessayer.',
  }

  const error = loginError || (errorParam ? errorMessages[errorParam] || 'Une erreur est survenue.' : null)

  async function handleGoogleLogin() {
    setLoading(true)
    setLoginError(null)

    try {
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            hd: 'vivason.fr',
          },
        },
      })

      if (oauthError) {
        setLoginError(oauthError.message)
        setLoading(false)
      }
    } catch (err) {
      console.error('OAuth error:', err)
      setLoginError('Erreur de connexion. Veuillez réessayer.')
      setLoading(false)
    }
  }

  return (
    <Card
      className="w-full max-w-md"
      style={branding.accentColor ? { borderTop: `3px solid ${branding.accentColor}` } : undefined}
    >
      <CardHeader className="flex flex-col items-center pt-8 pb-2">
        {branding.logoUrl ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt="Logo entreprise"
              className="max-w-[300px] max-h-[150px] object-contain"
            />
            <Image src="/logo-full.png" alt="SCOUTER" width={120} height={60} className="object-contain opacity-40" />
          </div>
        ) : (
          <Image
            src="/logo-full.png"
            alt="SCOUTER - Mesure des compétences"
            width={400}
            height={200}
            priority
            className="object-contain"
          />
        )}
        <CardDescription className="mt-2">Connectez-vous avec votre compte VivaSon</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
            {error}
          </div>
        )}
        <Button
          onClick={handleGoogleLogin}
          className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm"
          disabled={loading}
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading ? 'Connexion en cours...' : 'Se connecter avec Google'}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Réservé aux collaborateurs VivaSon (@vivason.fr)
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center pt-8 pb-2">
          <Image
            src="/logo-full.png"
            alt="SCOUTER"
            width={400}
            height={200}
            className="object-contain"
          />
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  )
}
