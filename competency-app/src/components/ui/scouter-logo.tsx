import { cn } from '@/lib/utils'

interface ScouterLogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function ScouterIcon({ sizeClass }: { sizeClass: string }) {
  return (
    <div className={cn('relative flex-shrink-0', sizeClass)}>
      {/* Scouter body */}
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Main visor body */}
        <rect x="8" y="20" width="60" height="55" rx="12" fill="#3a3a3a" stroke="#555" strokeWidth="2" />
        {/* Lens glow background */}
        <circle cx="38" cy="47" r="22" fill="#1a0000" />
        <circle cx="38" cy="47" r="18" fill="#8b0000" />
        {/* Lens gradient glow */}
        <circle cx="38" cy="47" r="14" fill="url(#lensGlow)" />
        {/* Lens reflection */}
        <ellipse cx="32" cy="40" rx="6" ry="4" fill="rgba(255,255,255,0.2)" />
        {/* Side arm */}
        <path d="M68 35 L88 30 C92 29 95 32 95 36 L95 58 C95 62 92 65 88 64 L68 60 Z" fill="#6b6b6b" stroke="#555" strokeWidth="1.5" />
        {/* Side arm detail */}
        <rect x="78" y="40" width="10" height="14" rx="2" fill="#c0392b" opacity="0.8" />
        {/* Top detail */}
        <rect x="20" y="16" width="20" height="6" rx="3" fill="#555" />
        <defs>
          <radialGradient id="lensGlow" cx="0.4" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#ff4444" />
            <stop offset="50%" stopColor="#cc0000" />
            <stop offset="100%" stopColor="#660000" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
}

export function ScouterLogo({ variant = 'full', size = 'md', className }: ScouterLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  const textSizes = {
    sm: { title: 'text-sm', subtitle: 'text-[8px]' },
    md: { title: 'text-lg', subtitle: 'text-[10px]' },
    lg: { title: 'text-3xl', subtitle: 'text-sm' },
  }

  if (variant === 'icon') {
    return <ScouterIcon sizeClass={iconSizes[size]} />
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ScouterIcon sizeClass={iconSizes[size]} />
      <div>
        <h1 className={cn(textSizes[size].title, 'font-bold tracking-wider leading-tight text-foreground')}>
          SCOUTER
        </h1>
        <p className={cn(textSizes[size].subtitle, 'text-muted-foreground')}>
          Mesure des compétences
        </p>
      </div>
    </div>
  )
}
