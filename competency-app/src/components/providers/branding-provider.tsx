'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface CompanyBranding {
  logoUrl: string | null
  accentColor: string | null
}

const DEFAULT_BRANDING: CompanyBranding = {
  logoUrl: null,
  accentColor: null,
}

const BrandingContext = createContext<CompanyBranding & { refresh: () => void }>({
  ...DEFAULT_BRANDING,
  refresh: () => {},
})

export function useBranding() {
  return useContext(BrandingContext)
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING)

  const fetchBranding = useCallback(() => {
    fetch('/api/settings?key=company_branding')
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          setBranding({ ...DEFAULT_BRANDING, ...data.value })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchBranding()
  }, [fetchBranding])

  // Apply accent color as CSS custom property
  useEffect(() => {
    const el = document.documentElement
    if (branding.accentColor) {
      el.style.setProperty('--company-accent', branding.accentColor)
      el.style.setProperty('--company-accent-light', branding.accentColor + '15')
    } else {
      el.style.removeProperty('--company-accent')
      el.style.removeProperty('--company-accent-light')
    }
  }, [branding.accentColor])

  return (
    <BrandingContext.Provider value={{ ...branding, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}
