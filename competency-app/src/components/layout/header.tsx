'use client'

import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/utils-app/roles'
import type { UserRole } from '@/lib/types'

interface HeaderProps {
  title: string
  description?: string
  userRole?: UserRole
  children?: React.ReactNode
}

export function Header({ title, description, userRole, children }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {userRole && (
              <Badge variant="secondary" className={ROLE_COLORS[userRole]}>
                {ROLE_LABELS[userRole]}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  )
}
