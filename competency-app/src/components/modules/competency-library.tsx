'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Module, Competency } from '@/lib/types'

interface ModuleNode extends Module {
  children: ModuleNode[]
}

interface CompetencyLibraryProps {
  modules: (Module & { competencies: { count: number }[] })[]
}

function buildTree(modules: Module[]): ModuleNode[] {
  const map = new Map<string, Module[]>()
  modules.forEach(m => {
    const pid = m.parent_id ?? 'root'
    if (!map.has(pid)) map.set(pid, [])
    map.get(pid)!.push(m)
  })

  function getChildren(parentId: string | null): ModuleNode[] {
    const children = map.get(parentId ?? 'root') ?? []
    return children.map(m => ({
      ...m,
      children: getChildren(m.id),
    }))
  }

  return getChildren(null)
}

interface TreeNodeProps {
  module: ModuleNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}

function TreeNode({ module, depth, selectedId, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = module.children.length > 0
  const isSelected = selectedId === module.id

  return (
    <div>
      <button
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
          isSelected ? 'bg-rose-50 text-rose-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => {
          onSelect(module.id)
          if (hasChildren) setExpanded(!expanded)
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
        ) : (
          <span className="w-4" />
        )}
        <span className="mr-1">{module.icon}</span>
        <span className="truncate">{module.code} - {module.name}</span>
      </button>
      {expanded && module.children.map(child => (
        <TreeNode
          key={child.id}
          module={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function CompetencyLibrary({ modules }: CompetencyLibraryProps) {
  const router = useRouter()
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [loadingComps, setLoadingComps] = useState(false)
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false)
  const [isEditModuleOpen, setIsEditModuleOpen] = useState(false)
  const [isAddCompOpen, setIsAddCompOpen] = useState(false)
  const [isEditCompOpen, setIsEditCompOpen] = useState(false)
  const [editingComp, setEditingComp] = useState<Competency | null>(null)
  const [moduleLoading, setModuleLoading] = useState(false)

  const tree = buildTree(modules)
  const selectedModule = modules.find(m => m.id === selectedModuleId)

  useEffect(() => {
    if (!selectedModuleId) return
    setLoadingComps(true)
    const supabase = createClient()
    supabase
      .from('competencies')
      .select('*')
      .eq('module_id', selectedModuleId)
      .order('sort_order')
      .then(({ data }) => {
        setCompetencies(data ?? [])
        setLoadingComps(false)
      })
  }, [selectedModuleId])

  // ========== MODULE HANDLERS ==========

  async function handleAddModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setModuleLoading(true)
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('modules').insert({
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      icon: formData.get('icon') as string || null,
      color: formData.get('color') as string || null,
      parent_id: selectedModuleId || null,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      is_active: true,
    })

    if (error) {
      toast.error('Erreur lors de la creation du module')
    } else {
      toast.success('Module cree')
    }

    setIsAddModuleOpen(false)
    setModuleLoading(false)
    router.refresh()
  }

  async function handleEditModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedModuleId) return
    setModuleLoading(true)
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('modules').update({
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      icon: formData.get('icon') as string || null,
      color: formData.get('color') as string || null,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
    }).eq('id', selectedModuleId)

    if (error) {
      toast.error('Erreur lors de la modification')
    } else {
      toast.success('Module modifie')
    }

    setIsEditModuleOpen(false)
    setModuleLoading(false)
    router.refresh()
  }

  async function handleDeactivateModule() {
    if (!selectedModuleId || !selectedModule) return
    const hasChildren = modules.some(m => m.parent_id === selectedModuleId)
    const msg = hasChildren
      ? `Desactiver le module "${selectedModule.name}" et tous ses sous-modules ? Il ne sera plus visible dans les evaluations.`
      : `Desactiver le module "${selectedModule.name}" ? Il ne sera plus visible dans les evaluations.`
    if (!confirm(msg)) return

    const supabase = createClient()

    // Deactivate the module
    await supabase.from('modules').update({ is_active: false }).eq('id', selectedModuleId)

    // Also deactivate child modules
    if (hasChildren) {
      const childIds = modules.filter(m => m.parent_id === selectedModuleId).map(m => m.id)
      if (childIds.length > 0) {
        await supabase.from('modules').update({ is_active: false }).in('id', childIds)
      }
    }

    toast.success('Module desactive')
    setSelectedModuleId(null)
    setCompetencies([])
    router.refresh()
  }

  // ========== COMPETENCY HANDLERS ==========

  async function handleAddCompetency(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedModuleId) return
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { data } = await supabase
      .from('competencies')
      .insert({
        module_id: selectedModuleId,
        name: formData.get('name') as string,
        description: formData.get('description') as string || null,
        external_id: formData.get('external_id') as string || null,
        sort_order: parseInt(formData.get('sort_order') as string) || 0,
        is_active: true,
      })
      .select()
      .single()

    if (data) {
      setCompetencies([...competencies, data])
      setIsAddCompOpen(false)
      toast.success('Competence ajoutee')
    }
  }

  async function handleEditCompetency(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingComp) return
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('competencies').update({
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      external_id: formData.get('external_id') as string || null,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
    }).eq('id', editingComp.id)

    if (error) {
      toast.error('Erreur lors de la modification')
    } else {
      setCompetencies(competencies.map(c =>
        c.id === editingComp.id
          ? {
              ...c,
              name: formData.get('name') as string,
              description: formData.get('description') as string || null,
              external_id: formData.get('external_id') as string || null,
              sort_order: parseInt(formData.get('sort_order') as string) || 0,
            }
          : c
      ))
      toast.success('Competence modifiee')
    }

    setIsEditCompOpen(false)
    setEditingComp(null)
  }

  async function handleDeleteCompetency(id: string) {
    if (!confirm('Supprimer cette competence ?')) return
    const supabase = createClient()
    await supabase.from('competencies').delete().eq('id', id)
    setCompetencies(competencies.filter(c => c.id !== id))
    toast.success('Competence supprimee')
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)]">
      {/* Left: Module Tree */}
      <Card className="w-72 shrink-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Modules</h3>
            <Dialog open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouveau module</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddModule} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Code *</Label>
                      <Input name="code" required placeholder="Ex: 24" />
                    </div>
                    <div className="space-y-2">
                      <Label>Ordre</Label>
                      <Input name="sort_order" type="number" defaultValue="0" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input name="name" required placeholder="Ex: Nouveau Module" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input name="description" placeholder="Description optionnelle" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Icone (emoji)</Label>
                      <Input name="icon" placeholder="Ex: 🔊" maxLength={4} />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <Input name="color" type="color" defaultValue="#E91E63" />
                    </div>
                  </div>
                  {selectedModuleId && (
                    <p className="text-sm text-muted-foreground">
                      Sous-module de : {selectedModule?.name}
                    </p>
                  )}
                  <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={moduleLoading}>
                    Creer
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-260px)] p-2">
            {tree.map(module => (
              <TreeNode
                key={module.id}
                module={module}
                depth={0}
                selectedId={selectedModuleId}
                onSelect={setSelectedModuleId}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Right: Module Detail + Competency Table */}
      <div className="flex-1">
        {selectedModule ? (
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {selectedModule.icon} {selectedModule.code} - {selectedModule.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {competencies.length} competence(s)
                    {selectedModule.color && (
                      <span
                        className="inline-block w-3 h-3 rounded-full ml-2 align-middle"
                        style={{ backgroundColor: selectedModule.color }}
                      />
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Edit Module */}
                  <Dialog open={isEditModuleOpen} onOpenChange={setIsEditModuleOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Modifier le module</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleEditModule} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Code *</Label>
                            <Input name="code" required defaultValue={selectedModule.code} />
                          </div>
                          <div className="space-y-2">
                            <Label>Ordre</Label>
                            <Input name="sort_order" type="number" defaultValue={selectedModule.sort_order} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input name="name" required defaultValue={selectedModule.name} />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input name="description" defaultValue={selectedModule.description ?? ''} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Icone (emoji)</Label>
                            <Input name="icon" defaultValue={selectedModule.icon ?? ''} maxLength={4} placeholder="Ex: 🔊" />
                          </div>
                          <div className="space-y-2">
                            <Label>Couleur</Label>
                            <Input name="color" type="color" defaultValue={selectedModule.color ?? '#E91E63'} />
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={moduleLoading}>
                          Enregistrer
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Deactivate Module */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-orange-500 hover:text-orange-700"
                    onClick={handleDeactivateModule}
                    title="Desactiver ce module"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>

                  {/* Add Competency */}
                  <Dialog open={isAddCompOpen} onOpenChange={setIsAddCompOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-rose-600 hover:bg-rose-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter competence
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nouvelle competence</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddCompetency} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input name="name" required placeholder="Ex: Courbe Osseuse" />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input name="description" placeholder="Description optionnelle" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>ID Externe</Label>
                            <Input name="external_id" placeholder="ID optionnel" />
                          </div>
                          <div className="space-y-2">
                            <Label>Ordre</Label>
                            <Input name="sort_order" type="number" defaultValue={competencies.length + 1} />
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">
                          Creer
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Competencies Table */}
              {loadingComps ? (
                <div className="p-8 text-center text-muted-foreground">Chargement...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordre</TableHead>
                      <TableHead>Competence</TableHead>
                      <TableHead>ID Ext.</TableHead>
                      <TableHead>Derniere modification</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competencies.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell className="text-muted-foreground">{comp.sort_order}</TableCell>
                        <TableCell className="font-medium">{comp.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{comp.external_id ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(comp.updated_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingComp(comp)
                                setIsEditCompOpen(true)
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteCompetency(comp.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {competencies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Aucune competence dans ce module
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selectionnez un module pour voir ses competences
          </div>
        )}
      </div>

      {/* Edit Competency Dialog (rendered outside the table for state management) */}
      <Dialog open={isEditCompOpen} onOpenChange={(open) => {
        setIsEditCompOpen(open)
        if (!open) setEditingComp(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la competence</DialogTitle>
          </DialogHeader>
          {editingComp && (
            <form onSubmit={handleEditCompetency} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input name="name" required defaultValue={editingComp.name} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={editingComp.description ?? ''} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID Externe</Label>
                  <Input name="external_id" defaultValue={editingComp.external_id ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label>Ordre</Label>
                  <Input name="sort_order" type="number" defaultValue={editingComp.sort_order} />
                </div>
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">
                Enregistrer
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
