import { createClient } from '@/lib/supabase/server'

export interface CompanyBranding {
  logoUrl: string | null
  accentColor: string | null
}

const DEFAULT_BRANDING: CompanyBranding = {
  logoUrl: null,
  accentColor: null,
}

export async function getCompanyBranding(): Promise<CompanyBranding> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'company_branding')
      .single()

    if (data?.value) {
      return { ...DEFAULT_BRANDING, ...(data.value as Partial<CompanyBranding>) }
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_BRANDING
}
