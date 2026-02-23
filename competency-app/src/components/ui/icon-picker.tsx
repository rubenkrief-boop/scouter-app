'use client'

import { useState, useRef, useEffect } from 'react'
import { AVAILABLE_ICONS, getIconOption } from '@/lib/utils-app/qualifier-icons'
import { CircleOff } from 'lucide-react'

interface IconPickerProps {
  value: string | null
  onChange: (icon: string | null) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const selected = getIconOption(value)

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center gap-1.5 h-9 min-w-[80px] px-2 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        {selected ? (
          <>
            <selected.icon className={`h-4 w-4 ${selected.color ?? ''}`} />
            <span className="text-xs text-muted-foreground truncate max-w-[60px]">{selected.label}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Aucune</span>
        )}
      </button>

      {/* Dropdown grid */}
      {open && (
        <div className="absolute z-50 mt-1 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-[280px] left-0">
          <p className="text-[10px] text-muted-foreground mb-2 px-1 font-medium uppercase tracking-wide">Choisir une icône</p>
          <div className="grid grid-cols-5 gap-1">
            {/* No icon option */}
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${!value ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300' : ''}`}
              title="Aucune icône"
            >
              <CircleOff className="h-4 w-4 text-gray-400" />
              <span className="text-[9px] text-muted-foreground leading-none">Aucune</span>
            </button>

            {AVAILABLE_ICONS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => { onChange(item.name); setOpen(false) }}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${value === item.name ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300' : ''}`}
                title={item.label}
              >
                <item.icon className={`h-4 w-4 ${item.color ?? ''}`} />
                <span className="text-[9px] text-muted-foreground leading-none truncate w-full text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
