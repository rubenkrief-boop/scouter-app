'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import type { QualifierWithOptions, QualifierOption } from '@/lib/types'
import Link from 'next/link'

interface QualifierEditorProps {
  qualifier: QualifierWithOptions
}

export function QualifierEditor({ qualifier }: QualifierEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(qualifier.name)
  const [qualifierType, setQualifierType] = useState(qualifier.qualifier_type)
  const [sortOrder, setSortOrder] = useState(qualifier.sort_order)
  const [options, setOptions] = useState<QualifierOption[]>(
    (qualifier.qualifier_options ?? []).sort((a, b) => a.sort_order - b.sort_order)
  )
  const [loading, setLoading] = useState(false)
  const [newOption, setNewOption] = useState({ label: '', value: '0', icon: '', sort_order: options.length + 1 })

  async function handleSaveQualifier() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('qualifiers')
      .update({ name, qualifier_type: qualifierType, sort_order: sortOrder })
      .eq('id', qualifier.id)
    setLoading(false)
    router.refresh()
  }

  async function handleAddOption() {
    if (!newOption.label) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('qualifier_options')
      .insert({
        qualifier_id: qualifier.id,
        label: newOption.label,
        value: parseFloat(newOption.value),
        icon: newOption.icon || null,
        sort_order: newOption.sort_order,
      })
      .select()
      .single()

    if (!error && data) {
      setOptions([...options, data])
      setNewOption({ label: '', value: '0', icon: '', sort_order: options.length + 2 })
    }
  }

  async function handleDeleteOption(optionId: string) {
    if (!confirm('Supprimer cette option ?')) return
    const supabase = createClient()
    await supabase.from('qualifier_options').delete().eq('id', optionId)
    setOptions(options.filter(o => o.id !== optionId))
  }

  async function handleUpdateOption(optionId: string, field: string, value: string | number) {
    const supabase = createClient()
    await supabase
      .from('qualifier_options')
      .update({ [field]: value })
      .eq('id', optionId)
    setOptions(options.map(o => o.id === optionId ? { ...o, [field]: value } : o))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/skill-master/qualifiers" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Retour aux qualifiers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Informations du qualifier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={qualifierType} onValueChange={(v) => setQualifierType(v as 'single_choice' | 'multiple_choice')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">Choix unique</SelectItem>
                  <SelectItem value="multiple_choice">Choix multiple</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordre</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value))} />
            </div>
          </div>
          <Button onClick={handleSaveQualifier} disabled={loading} className="bg-rose-600 hover:bg-rose-700">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Options</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordre</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead>Icône</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((option) => (
                <TableRow key={option.id}>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-16"
                      defaultValue={option.sort_order}
                      onBlur={(e) => handleUpdateOption(option.id, 'sort_order', parseInt(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={option.label}
                      onBlur={(e) => handleUpdateOption(option.id, 'label', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      defaultValue={option.value}
                      onBlur={(e) => handleUpdateOption(option.id, 'value', parseFloat(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={option.icon ?? ''}
                      placeholder="arrow-up"
                      onBlur={(e) => handleUpdateOption(option.id, 'icon', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteOption(option.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* New option row */}
              <TableRow className="bg-slate-50">
                <TableCell>
                  <Input
                    type="number"
                    className="w-16"
                    value={newOption.sort_order}
                    onChange={(e) => setNewOption({ ...newOption, sort_order: parseInt(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Nouvelle option..."
                    value={newOption.label}
                    onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-24"
                    value={newOption.value}
                    onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="icône"
                    value={newOption.icon}
                    onChange={(e) => setNewOption({ ...newOption, icon: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleAddOption}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
