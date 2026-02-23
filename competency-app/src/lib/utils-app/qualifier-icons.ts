import {
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Circle,
  Star,
  Award,
  Zap,
  AlertTriangle,
  Clock,
  Ban,
  ThumbsUp,
  ThumbsDown,
  type LucideIcon,
} from 'lucide-react'

export interface IconOption {
  name: string
  icon: LucideIcon
  label: string
  color?: string
}

export const AVAILABLE_ICONS: IconOption[] = [
  { name: 'arrow-up', icon: ArrowUp, label: 'Flèche haut', color: 'text-green-600' },
  { name: 'arrow-down', icon: ArrowDown, label: 'Flèche bas', color: 'text-red-600' },
  { name: 'minus', icon: Minus, label: 'Stable', color: 'text-gray-500' },
  { name: 'trending-up', icon: TrendingUp, label: 'Tendance hausse', color: 'text-emerald-600' },
  { name: 'trending-down', icon: TrendingDown, label: 'Tendance baisse', color: 'text-orange-600' },
  { name: 'check', icon: Check, label: 'Validé', color: 'text-green-600' },
  { name: 'x', icon: X, label: 'Non validé', color: 'text-red-600' },
  { name: 'circle', icon: Circle, label: 'Neutre', color: 'text-gray-400' },
  { name: 'star', icon: Star, label: 'Étoile', color: 'text-yellow-500' },
  { name: 'award', icon: Award, label: 'Récompense', color: 'text-violet-600' },
  { name: 'zap', icon: Zap, label: 'Expert', color: 'text-amber-500' },
  { name: 'alert-triangle', icon: AlertTriangle, label: 'Attention', color: 'text-amber-600' },
  { name: 'clock', icon: Clock, label: 'En cours', color: 'text-blue-500' },
  { name: 'ban', icon: Ban, label: 'Interdit', color: 'text-red-500' },
  { name: 'thumbs-up', icon: ThumbsUp, label: 'Positif', color: 'text-green-500' },
  { name: 'thumbs-down', icon: ThumbsDown, label: 'Négatif', color: 'text-red-500' },
]

const ICON_MAP: Record<string, IconOption> = {}
AVAILABLE_ICONS.forEach((item) => {
  ICON_MAP[item.name] = item
})

// Backward compatibility: "equal" maps to "minus"
ICON_MAP['equal'] = ICON_MAP['minus']

export function getIconOption(name: string | null | undefined): IconOption | null {
  if (!name) return null
  return ICON_MAP[name] ?? null
}

export function getIconComponent(name: string | null | undefined): LucideIcon | null {
  const option = getIconOption(name)
  return option?.icon ?? null
}

export function getIconColor(name: string | null | undefined): string {
  const option = getIconOption(name)
  return option?.color ?? 'text-gray-500'
}
