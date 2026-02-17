import { createClient } from '@/lib/supabase/server'

export interface ChartColors {
  actual: string
  expected: string
}

const DEFAULT_COLORS: ChartColors = {
  actual: '#8b5cf6',
  expected: '#9ca3af',
}

export async function getChartColors(): Promise<ChartColors> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'chart_colors')
      .single()

    if (data?.value) {
      return { ...DEFAULT_COLORS, ...(data.value as Partial<ChartColors>) }
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_COLORS
}
