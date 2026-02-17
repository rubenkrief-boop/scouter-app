'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, BarChart3, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  completed: 'Terminee',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
}

const ACTION_LABELS: Record<string, string> = {
  draft: 'Commencer',
  in_progress: 'Reprendre',
  completed: 'Modifier',
}

interface EvaluationListProps {
  evaluations: any[]
}

export function EvaluationList({ evaluations }: EvaluationListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = evaluations.filter((evaluation) => {
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      const collabName = `${evaluation.audioprothesiste?.first_name ?? ''} ${evaluation.audioprothesiste?.last_name ?? ''}`.toLowerCase()
      const evalName = `${evaluation.evaluator?.first_name ?? ''} ${evaluation.evaluator?.last_name ?? ''}`.toLowerCase()
      const profileName = (evaluation.job_profile?.name ?? '').toLowerCase()
      if (!collabName.includes(q) && !evalName.includes(q) && !profileName.includes(q)) {
        return false
      }
    }
    // Status filter
    if (statusFilter !== 'all' && evaluation.status !== statusFilter) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Search & Filter bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un collaborateur, evaluateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'draft', 'in_progress', 'completed'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              className={statusFilter === status ? 'bg-rose-600 hover:bg-rose-700' : ''}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'Tous' : STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} / {evaluations.length} evaluation{evaluations.length > 1 ? 's' : ''}
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
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((evaluation) => (
                <TableRow key={evaluation.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/evaluator/evaluations/${evaluation.id}`} className="font-medium text-rose-600 hover:underline">
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
                    <Badge variant="secondary" className={STATUS_COLORS[evaluation.status] ?? ''}>
                      {STATUS_LABELS[evaluation.status] ?? evaluation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {evaluation.evaluated_at
                      ? new Date(evaluation.evaluated_at).toLocaleDateString('fr-FR')
                      : new Date(evaluation.created_at).toLocaleDateString('fr-FR')
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/evaluator/evaluations/${evaluation.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <Pencil className="h-3 w-3 mr-1" />
                          {ACTION_LABELS[evaluation.status] ?? 'Modifier'}
                        </Button>
                      </Link>
                      <Link href={`/evaluator/evaluations/${evaluation.id}/results`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          Resultats
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {search.trim() || statusFilter !== 'all'
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
