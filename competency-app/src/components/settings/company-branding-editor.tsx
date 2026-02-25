'use client'

import { useState, useEffect, useRef } from 'react'
import { Save, RotateCcw, Upload, Trash2, Building2, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useBranding } from '@/components/providers/branding-provider'
import Image from 'next/image'

interface BrandingState {
  logoUrl: string | null
  accentColor: string | null
}

const DEFAULT_BRANDING: BrandingState = {
  logoUrl: null,
  accentColor: null,
}

export function CompanyBrandingEditor() {
  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { refresh } = useBranding()

  useEffect(() => {
    fetch('/api/settings?key=company_branding')
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          setBranding({ ...DEFAULT_BRANDING, ...data.value })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleLogoUpload(file: File) {
    if (!file) return

    // Validate client-side
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type de fichier non supporté. Utilisez PNG, JPG, SVG ou WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 2 Mo).')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        // Add cache-busting query param
        const logoUrl = data.logoUrl + '?t=' + Date.now()
        setBranding(prev => ({ ...prev, logoUrl }))
        toast.success('Logo uploadé avec succès')
        refresh()
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Erreur lors de l\'upload')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setUploading(false)
  }

  async function handleLogoDelete() {
    setUploading(true)
    try {
      const res = await fetch('/api/settings/logo', { method: 'DELETE' })
      if (res.ok) {
        setBranding(prev => ({ ...prev, logoUrl: null }))
        toast.success('Logo supprimé')
        refresh()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setUploading(false)
  }

  async function handleSaveColor() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'company_branding',
          value: branding,
        }),
      })
      if (res.ok) {
        toast.success('Couleur enregistrée')
        refresh()
      } else {
        toast.error('Erreur lors de l\'enregistrement')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setSaving(false)
  }

  function handleResetColor() {
    setBranding(prev => ({ ...prev, accentColor: null }))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleLogoUpload(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  if (!loaded) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Identité entreprise
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez le logo et la couleur d&apos;accent de votre entreprise
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo de l&apos;entreprise</CardTitle>
            <CardDescription>PNG, JPG, SVG ou WebP. Max 2 Mo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo preview or upload zone */}
            {branding.logoUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-6 bg-muted/50 rounded-lg border border-dashed border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logoUrl}
                    alt="Logo entreprise"
                    className="max-w-[250px] max-h-[120px] object-contain"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Remplacer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogoDelete}
                    disabled={uploading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  {uploading ? 'Upload en cours...' : 'Glissez un logo ici ou cliquez pour parcourir'}
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoUpload(file)
                e.target.value = ''
              }}
            />
          </CardContent>
        </Card>

        {/* Accent Color */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Couleur d&apos;accent
            </CardTitle>
            <CardDescription>Appliquée subtilement sur la sidebar et la page de connexion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Label className="w-32">Couleur</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.accentColor || '#3b82f6'}
                  onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {branding.accentColor || 'Non définie'}
                </span>
              </div>
            </div>

            {/* Mini preview */}
            {branding.accentColor && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground mb-3">Aperçu</p>
                <div className="flex flex-col gap-2">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
                    style={{
                      backgroundColor: branding.accentColor + '15',
                      borderLeft: `3px solid ${branding.accentColor}`,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: branding.accentColor }}
                    />
                    Item actif de la sidebar
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    Item inactif
                  </div>
                </div>
                <div
                  className="mt-3 p-3 rounded-md bg-card border"
                  style={{ borderTop: `3px solid ${branding.accentColor}` }}
                >
                  <p className="text-xs text-muted-foreground">Carte de connexion</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleSaveColor} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button variant="outline" onClick={handleResetColor}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined preview */}
      {(branding.logoUrl || branding.accentColor) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu sidebar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-64 bg-sidebar border border-sidebar-border rounded-lg p-4 space-y-4">
              {/* Logo area */}
              <div className="flex flex-col items-center gap-2">
                {branding.logoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logoUrl}
                      alt="Logo entreprise"
                      className="max-w-[160px] max-h-[70px] object-contain"
                    />
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                      <span>propulsé par</span>
                      <Image src="/logo-full.png" alt="SCOUTER" width={75} height={38} className="object-contain opacity-50" />
                    </div>
                  </>
                ) : (
                  <Image src="/logo-full.png" alt="SCOUTER" width={200} height={100} className="object-contain" />
                )}
              </div>

              {/* Mock nav items */}
              <div className="space-y-1">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
                  style={branding.accentColor ? {
                    backgroundColor: branding.accentColor + '15',
                    borderLeft: `3px solid ${branding.accentColor}`,
                  } : { backgroundColor: 'var(--sidebar-accent)' }}
                >
                  Dashboard
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground">
                  Utilisateurs
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground">
                  Évaluations
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
