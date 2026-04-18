'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, List } from 'lucide-react'

// Lightweight collapse wrapper for the dense per-month visit list.
// Collapsed by default to keep the page focused on the fresque.
export function CollapsibleList({ count, children }: { count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={() => setOpen(o => !o)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <List className="h-4 w-4" />
          {open ? 'Masquer la liste detaillee' : 'Afficher la liste detaillee'}
          {typeof count === 'number' && (
            <span className="text-xs text-muted-foreground">({count} visite{count > 1 ? 's' : ''})</span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      {open && <div>{children}</div>}
    </div>
  )
}
