'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, GraduationCap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  enrollMyWorkerTeam,
  type FranchiseTeamMember,
  type TeamMemberInscription,
  type ProgrammeAtelierMapping,
} from '@/lib/actions/formations'
import type {
  FormationSession,
  FormationProgrammeSettingWithCount,
  FormationType,
  FormationAtelierWithSession,
} from '@/lib/types'

interface Props {
  team: FranchiseTeamMember[]
  sessions: FormationSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  existingInscriptions?: TeamMemberInscription[]
  ateliers?: FormationAtelierWithSession[]
  progAtelierMappings?: ProgrammeAtelierMapping[]
}

/**
 * Variante succursale de FranchiseTeamEnroll : un manager (ou super_admin /
 * skill_master) inscrit en lot ses workers (statut succursale) a une
 * formation. Les workers ne peuvent pas s'auto-inscrire, c'est leur
 * manager qui s'en occupe.
 */
export function ManagerWorkerEnroll({ team, sessions, programmeSettings, existingInscriptions = [], ateliers = [], progAtelierMappings = [] }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [type, setType] = useState<FormationType>('Audio')
  const [programme, setProgramme] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const availableProgrammes = useMemo(() => {
    if (!sessionId) return []
    return programmeSettings
      .filter((s) => s.session_id === sessionId && s.type === type)
      .map((s) => s.programme)
      .sort()
  }, [sessionId, type, programmeSettings])

  const filteredTeam = useMemo(() => {
    return team.filter((m) => {
      if (!m.is_active) return false
      const jt = (m.job_title ?? '').toLowerCase()
      if (type === 'Audio') {
        return !jt || jt.includes('audio')
      }
      return !jt || jt.includes('assist')
    })
  }, [team, type])

  // Map profile_id -> programme deja inscrit (1 seul programme par session+type)
  const alreadyEnrolledMap = useMemo(() => {
    const m = new Map<string, string>()
    if (!sessionId) return m
    for (const ins of existingInscriptions) {
      if (!ins.profile_id) continue
      if (ins.session_id === sessionId && ins.type === type) {
        m.set(ins.profile_id, ins.programme)
      }
    }
    return m
  }, [existingInscriptions, sessionId, type])

  function reset() {
    setSessionId('')
    setType('Audio')
    setProgramme('')
    setSelectedIds(new Set())
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function toggleAll() {
    const selectables = filteredTeam.filter((m) => !alreadyEnrolledMap.has(m.id))
    if (selectedIds.size === selectables.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectables.map((m) => m.id)))
    }
  }

  function handleSubmit() {
    if (!sessionId || !programme || selectedIds.size === 0) {
      toast.error('Choisissez la session, le programme et au moins un collaborateur')
      return
    }
    startTransition(async () => {
      const result = await enrollMyWorkerTeam({
        session_id: sessionId,
        type,
        programme,
        profile_ids: Array.from(selectedIds),
      })
      if (!result.success && result.error) {
        toast.error(result.error)
        return
      }
      const okCount = result.results.filter((r) => r.ok).length
      const failures = result.results.filter((r) => !r.ok)
      if (failures.length === 0) {
        toast.success(`${okCount} collaborateur${okCount > 1 ? 's' : ''} inscrit${okCount > 1 ? 's' : ''}`)
      } else {
        toast.warning(
          `${okCount} inscrit${okCount > 1 ? 's' : ''}, ${failures.length} en échec : ${failures.slice(0, 3).map((f) => f.error).join(' • ')}${failures.length > 3 ? ' …' : ''}`,
        )
      }
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Mon équipe succursale — {team.length} collaborateur{team.length > 1 ? 's' : ''}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Vos collaborateurs ne peuvent pas s&apos;auto-inscrire aux formations.
          Sélectionnez-les ici pour les inscrire en lot à une session.
        </p>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun collaborateur n&apos;est rattaché à vos centres pour l&apos;instant.
            Vérifiez vos affectations dans <code>/admin/centre-managers</code>.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 max-h-48 overflow-y-auto space-y-1">
              {team.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.first_name} {m.last_name}</span>
                    {m.job_title && <Badge variant="outline" className="text-[10px]">{m.job_title}</Badge>}
                    {!m.is_active && <Badge variant="secondary" className="text-[10px]">inactif</Badge>}
                  </div>
                  <span className="text-muted-foreground text-xs">{m.location_name ?? '—'}</span>
                </div>
              ))}
            </div>
            <Button
              onClick={() => setOpen(true)}
              disabled={team.filter((m) => m.is_active).length === 0 || sessions.length === 0}
              className="w-full"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              Inscrire mon équipe à une formation
            </Button>
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Aucune session avec inscriptions ouvertes actuellement.
              </p>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inscrire mes collaborateurs à une formation</DialogTitle>
            <DialogDescription>
              Sélectionnez la session, le programme et les collaborateurs à inscrire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setProgramme('') }}>
                <SelectTrigger><SelectValue placeholder="Choisir une session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as FormationType); setProgramme('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Audio">Audio</SelectItem>
                  <SelectItem value="Assistante">Assistante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select
                value={programme}
                onValueChange={setProgramme}
                disabled={availableProgrammes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={availableProgrammes.length === 0 ? 'Choisir d\'abord session + type' : 'Choisir un programme'} />
                </SelectTrigger>
                <SelectContent>
                  {availableProgrammes.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Apercu du contenu du programme selectionne */}
              {programme && sessionId && (() => {
                const ids = new Set(
                  progAtelierMappings
                    .filter((m) => m.session_id === sessionId && m.type === type && m.programme === programme)
                    .map((m) => m.atelier_id),
                )
                const list = ateliers.filter((a) => ids.has(a.id)).sort((a, b) => a.sort_order - b.sort_order)
                if (list.length === 0) return null
                return (
                  <div className="rounded-md border bg-muted/30 p-3 mt-2 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contenu de {programme} ({list.length} atelier{list.length > 1 ? 's' : ''})
                    </p>
                    <ul className="space-y-1 text-xs">
                      {list.map((a) => (
                        <li key={a.id} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{a.nom}</p>
                            <p className="text-muted-foreground">
                              {a.formateur && <>par {a.formateur}</>}
                              {a.formateur && a.duree && ' · '}
                              {a.duree}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Collaborateurs à inscrire ({selectedIds.size} sélectionnés)</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll} disabled={filteredTeam.length === 0}>
                  {selectedIds.size === filteredTeam.length ? 'Tout déselectionner' : 'Tout sélectionner'}
                </Button>
              </div>
              <div className="rounded-lg border max-h-56 overflow-y-auto p-2 space-y-1">
                {filteredTeam.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    Aucun collaborateur actif compatible avec ce type.
                  </p>
                ) : (
                  filteredTeam.map((m) => {
                    const alreadyProg = alreadyEnrolledMap.get(m.id)
                    const disabled = !!alreadyProg
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 px-2 py-1 rounded ${
                          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                          checked={selectedIds.has(m.id) && !disabled}
                          disabled={disabled}
                          onChange={() => !disabled && toggleOne(m.id)}
                        />
                        <span className="text-sm">{m.first_name} {m.last_name}</span>
                        {m.job_title && <span className="text-xs text-muted-foreground">— {m.job_title}</span>}
                        {alreadyProg && (
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            Déjà inscrit en {alreadyProg}
                          </Badge>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !sessionId || !programme || selectedIds.size === 0}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Inscrire {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
