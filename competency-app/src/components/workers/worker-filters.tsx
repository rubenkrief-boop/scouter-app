'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, MapPin } from 'lucide-react'
import { useCallback, useState, useTransition } from 'react'

interface LocationOption {
  id: string
  name: string
}

interface WorkerFiltersProps {
  locations: LocationOption[]
  currentQuery?: string
  currentLocation?: string
}

export function WorkerFilters({ locations, currentQuery, currentLocation }: WorkerFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(currentQuery ?? '')

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }, [router, searchParams])

  return (
    <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
      {/* Search */}
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault()
          updateParams('q', query)
        }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => updateParams('q', query)}
          placeholder="Rechercher par nom, email ou poste..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </form>

      {/* Location filter */}
      {locations.length > 0 && (
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={currentLocation ?? ''}
            onChange={(e) => updateParams('location', e.target.value)}
            className="pl-10 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">Tous les centres</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      )}

      {isPending && (
        <div className="flex items-center text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-1.5" />
          Filtrage...
        </div>
      )}
    </div>
  )
}
