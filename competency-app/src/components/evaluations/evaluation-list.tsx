'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, BarChart3, Search, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface EvaluationItem {
  id: string
  created_at: string
  evaluated_at?: string | null
  audioprothesiste?: { first_name?: string | null; last_name?: string | null } | null
  evaluator?: { first_name?: string | null; last_name?: string | null } | null
  job_profile?: { name?: string | null } | null
}

interface EvaluationListProps {
  evaluations: EvaluationItem[]
}

export function EvaluationList({ evaluations }: EvaluationListProps) {
  const [search, setSearch] = useState('')

  const filtered = evaluations.filter((evaluation) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const collabName = `${evaluation.audioprothesiste?.first_name ?? ''} ${evaluation.audioprothesiste?.last_name ?? ''}`.toLowerCase()
      const evalName = `${evaluation.evaluator?.first_name ?? ''} ${evaluation.evaluator?.last_name ?? ''}`.toLowerCase()
      const profileName = (evaluation.job_profile?.name ?? '').toLowerCase()
      if (!collabName.includes(q) && !evalName.includes(q) && !profileName.includes(q)) {
        return false
      }
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un collaborateur, evaluateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} evaluation{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Profil metier</TableHead>
                <TableHead>Evaluateur</TableHead>
                <TableHead>Derniere mise a jour</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((evaluation) => (
                <TableRow key={evaluation.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Link href={`/evaluator/evaluations/${evaluation.id}/results`} className="font-medium text-primary hover:underline">
                      {evaluation.audioprothesiste?.first_name} {evaluation.audioprothesiste?.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {evaluation.job_profile?.name ?? '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {evaluation.evaluator?.first_name} {evaluation.evaluator?.last_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {evaluation.evaluated_at
                        ? new Date(evaluation.evaluated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(evaluation.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                      }
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/evaluator/evaluations/${evaluation.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 hover:bg-primary/10">
                          <Pencil className="h-3.5 w-3.5" />
                          Evaluer
                        </Button>
                      </Link>
                      <Link href={`/evaluator/evaluations/${evaluation.id}/results`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 hover:bg-primary/10">
                          <BarChart3 className="h-3.5 w-3.5" />
                          Resultats
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {search.trim()
                      ? 'Aucune evaluation ne correspond a votre recherche'
                      : 'Aucune evaluation'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
