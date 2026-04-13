'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Pencil, Trash2, Save, X, Upload, Mic2, Headphones,
  Eye, ToggleLeft, ToggleRight,
} from 'lucide-react'
import type {
  FormationSession, FormationProgrammeSettingWithCount, FormationProgrammeFile, FormationType,
} from '@/lib/types'
import {
  upsertFormationProgrammeSetting, deleteFormationProgrammeSetting,
  toggleSessionRegistration,
} from '@/lib/actions/formations'
import type { ShowMessageFn } from '../hooks/use-admin-message'
import { useProgrammesFileUpload } from '../hooks/use-programmes-file-upload'

// ============================================
// Section: Programmes (capacite, fichiers, salles)
// ============================================

const PROGRAMME_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'Format rotatif']

export function ProgrammesSection({
  sessions,
  programmeSettings,
  programmeFiles,
  showMessage,
}: {
  sessions: FormationSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  programmeFiles: FormationProgrammeFile[]
  showMessage: ShowMessageFn
}) {
  const [selectedSession, setSelectedSession] = useState<string>(sessions[0]?.id || '')
  const [isPending, startTransition] = useTransition()
  const { uploading, handleFileUpload, handleFileDelete } = useProgrammesFileUpload(selectedSession, showMessage)
  const [addingType, setAddingType] = useState<FormationType | null>(null)
  const [addProgramme, setAddProgramme] = useState('')
  const [addMaxSucc, setAddMaxSucc] = useState('')
  const [addMaxFranchise, setAddMaxFranchise] = useState('')
  const [addSalle, setAddSalle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMaxSucc, setEditMaxSucc] = useState('')
  const [editMaxFranchise, setEditMaxFranchise] = useState('')
  const [editSalle, setEditSalle] = useState('')
  const router = useRouter()

  const session = sessions.find(s => s.id === selectedSession)
  const sessionSettings = programmeSettings.filter(s => s.session_id === selectedSession)
  const sessionFiles = programmeFiles.filter(f => f.session_id === selectedSession)

  const audioFile = sessionFiles.find(f => f.type === 'Audio')
  const assistanteFile = sessionFiles.find(f => f.type === 'Assistante')
  const audioSettings = sessionSettings.filter(s => s.type === 'Audio')
  const assistanteSettings = sessionSettings.filter(s => s.type === 'Assistante')

  function handleToggleRegistration() {
    if (!session) return
    startTransition(async () => {
      const result = await toggleSessionRegistration(selectedSession, !session.registration_open)
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', session.registration_open ? 'Inscriptions fermees' : 'Inscriptions ouvertes')
        router.refresh()
      }
    })
  }

  function handleAddSetting(type: FormationType) {
    if (!addProgramme) return
    startTransition(async () => {
      const result = await upsertFormationProgrammeSetting({
        session_id: selectedSession,
        type,
        programme: addProgramme,
        max_succ: parseInt(addMaxSucc) || 0,
        max_franchise: parseInt(addMaxFranchise) || 0,
        salle: addSalle || undefined,
      })
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', `Programme ${addProgramme} (${type}) configure`)
        setAddingType(null)
        setAddProgramme('')
        setAddMaxSucc('')
        setAddMaxFranchise('')
        setAddSalle('')
        router.refresh()
      }
    })
  }

  function handleSaveEdit(setting: FormationProgrammeSettingWithCount) {
    startTransition(async () => {
      const result = await upsertFormationProgrammeSetting({
        session_id: setting.session_id,
        type: setting.type,
        programme: setting.programme,
        max_succ: parseInt(editMaxSucc) || 0,
        max_franchise: parseInt(editMaxFranchise) || 0,
        salle: editSalle || undefined,
      })
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', 'Mis a jour')
        setEditingId(null)
        router.refresh()
      }
    })
  }

  function handleDeleteSetting(id: string) {
    if (!confirm('Supprimer cette configuration ?')) return
    startTransition(async () => {
      const result = await deleteFormationProgrammeSetting(id)
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', 'Configuration supprimee')
        router.refresh()
      }
    })
  }

  function getCapacityColor(current: number, max: number) {
    if (max === 0) return 'text-muted-foreground'
    const pct = current / max
    if (pct >= 1) return 'text-red-600'
    if (pct >= 0.7) return 'text-orange-500'
    return 'text-emerald-600'
  }

  function renderFileCard(type: FormationType, file: FormationProgrammeFile | undefined) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-2">
          {type === 'Audio' ? (
            <Mic2 className="h-4 w-4 text-cyan-500" />
          ) : (
            <Headphones className="h-4 w-4 text-orange-500" />
          )}
          <span className="text-sm font-medium">Programme {type}</span>
        </div>
        {file ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground max-w-[200px] truncate">{file.file_name}</span>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Eye className="h-3 w-3 mr-1" /> Voir
              </Button>
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-500 hover:text-red-600"
              onClick={() => handleFileDelete(type)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(type, f)
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" className="h-7" asChild disabled={!!uploading}>
              <span>
                <Upload className="h-3 w-3 mr-1" />
                {uploading === type ? 'Upload...' : 'Uploader'}
              </span>
            </Button>
          </label>
        )}
      </div>
    )
  }

  function renderSettingsTable(type: FormationType, settings: FormationProgrammeSettingWithCount[]) {
    const existingProgrammes = settings.map(s => s.programme)
    const availableProgrammes = PROGRAMME_OPTIONS.filter(p => !existingProgrammes.includes(p))

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            {type === 'Audio' ? <Mic2 className="h-3.5 w-3.5 text-cyan-500" /> : <Headphones className="h-3.5 w-3.5 text-orange-500" />}
            Capacites {type}
          </h4>
          {availableProgrammes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setAddingType(type)
                setAddProgramme(availableProgrammes[0])
                setAddMaxSucc('20')
                setAddMaxFranchise('10')
                setAddSalle('')
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-1.5 px-2">Programme</th>
                <th className="text-center py-1.5 px-1" colSpan={2}>
                  <span className="text-blue-600">Succursale</span>
                </th>
                <th className="text-center py-1.5 px-1" colSpan={2}>
                  <span className="text-purple-600">Franchise</span>
                </th>
                <th className="text-left py-1.5 px-2">Salle</th>
                <th className="text-right py-1.5 px-2">Actions</th>
              </tr>
              <tr className="border-b text-[10px] text-muted-foreground/70">
                <th />
                <th className="text-center py-1 px-1">Max</th>
                <th className="text-center py-1 px-1">Inscrits</th>
                <th className="text-center py-1 px-1">Max</th>
                <th className="text-center py-1 px-1">Inscrits</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {settings.map(s => {
                const isEditing = editingId === s.id
                const succColor = getCapacityColor(s.current_count_succ, s.max_succ)
                const franchiseColor = getCapacityColor(s.current_count_franchise, s.max_franchise)

                return (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-xs">{s.programme}</Badge>
                    </td>
                    {/* Succursale */}
                    <td className="text-center py-2 px-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          value={editMaxSucc}
                          onChange={e => setEditMaxSucc(e.target.value)}
                          className="h-7 w-14 text-center text-xs mx-auto"
                        />
                      ) : (
                        <span className="text-xs">{s.max_succ === 0 ? '\u221E' : s.max_succ}</span>
                      )}
                    </td>
                    <td className={`text-center py-2 px-1 font-semibold text-xs ${succColor}`}>
                      {s.current_count_succ}
                    </td>
                    {/* Franchise */}
                    <td className="text-center py-2 px-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          value={editMaxFranchise}
                          onChange={e => setEditMaxFranchise(e.target.value)}
                          className="h-7 w-14 text-center text-xs mx-auto"
                        />
                      ) : (
                        <span className="text-xs">{s.max_franchise === 0 ? '\u221E' : s.max_franchise}</span>
                      )}
                    </td>
                    <td className={`text-center py-2 px-1 font-semibold text-xs ${franchiseColor}`}>
                      {s.current_count_franchise}
                    </td>
                    {/* Salle */}
                    <td className="py-2 px-2">
                      {isEditing ? (
                        <Input
                          value={editSalle}
                          onChange={e => setEditSalle(e.target.value)}
                          placeholder="Ex: Salle B2"
                          className="h-7 text-xs w-28"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{s.salle || '\u2014'}</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="text-right py-2 px-2">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleSaveEdit(s)} disabled={isPending}>
                            <Save className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setEditingId(s.id)
                              setEditMaxSucc(String(s.max_succ))
                              setEditMaxFranchise(String(s.max_franchise))
                              setEditSalle(s.salle || '')
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={() => handleDeleteSetting(s.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* Add row */}
              {addingType === type && (
                <tr className="border-b border-border/50 bg-muted/30">
                  <td className="py-2 px-2">
                    <Select value={addProgramme} onValueChange={setAddProgramme}>
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProgrammes.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="text-center py-2 px-1">
                    <Input
                      type="number"
                      min={0}
                      value={addMaxSucc}
                      onChange={e => setAddMaxSucc(e.target.value)}
                      placeholder="Succ"
                      className="h-7 w-14 text-center text-xs mx-auto"
                    />
                  </td>
                  <td />
                  <td className="text-center py-2 px-1">
                    <Input
                      type="number"
                      min={0}
                      value={addMaxFranchise}
                      onChange={e => setAddMaxFranchise(e.target.value)}
                      placeholder="Franc"
                      className="h-7 w-14 text-center text-xs mx-auto"
                    />
                  </td>
                  <td />
                  <td className="py-2 px-2">
                    <Input
                      value={addSalle}
                      onChange={e => setAddSalle(e.target.value)}
                      placeholder="Salle"
                      className="h-7 text-xs w-28"
                    />
                  </td>
                  <td className="text-right py-2 px-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleAddSetting(type)} disabled={isPending}>
                        <Save className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAddingType(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {settings.length === 0 && addingType !== type && (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted-foreground text-xs">
                    Aucune configuration de programme
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Session selector + registration toggle */}
      <div className="flex items-center gap-3">
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.label} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {session && (
          <Button
            variant={session.registration_open ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleRegistration}
            disabled={isPending}
            className={session.registration_open ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {session.registration_open ? (
              <><ToggleRight className="h-4 w-4 mr-1.5" /> Inscriptions ouvertes</>
            ) : (
              <><ToggleLeft className="h-4 w-4 mr-1.5" /> Inscriptions fermees</>
            )}
          </Button>
        )}
      </div>

      {!selectedSession ? (
        <p className="text-sm text-muted-foreground text-center py-8">Selectionnez une session</p>
      ) : (
        <div className="space-y-6">
          {/* File uploads */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Fichiers programme</CardTitle>
              <p className="text-xs text-muted-foreground">
                Uploadez un fichier pour creer automatiquement le programme
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderFileCard('Audio', audioFile)}
              {renderFileCard('Assistante', assistanteFile)}
            </CardContent>
          </Card>

          {/* Capacity settings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Capacites & Salles</CardTitle>
              <p className="text-xs text-muted-foreground">
                Definissez le nombre de places max par succursale et par franchise
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderSettingsTable('Audio', audioSettings)}
              <Separator />
              {renderSettingsTable('Assistante', assistanteSettings)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
