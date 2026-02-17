'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { ROLE_LABELS } from '@/lib/utils-app/roles'
import type { UserRole } from '@/lib/types'
import {
  COLUMN_MAP,
  TEMPLATE_HEADERS,
  parseAndValidateRows,
  type ImportRowValidated,
  type ImportResponse,
} from '@/lib/utils-app/excel-import'

type Stage = 'upload' | 'preview' | 'importing' | 'results'

interface ExcelImportDialogProps {
  locations: { id: string; name: string }[]
}

export function ExcelImportDialog({ locations }: ExcelImportDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('upload')
  const [rows, setRows] = useState<ImportRowValidated[]>([])
  const [importResponse, setImportResponse] = useState<ImportResponse | null>(null)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const validRows = rows.filter(r => r.errors.length === 0)
  const errorRows = rows.filter(r => r.errors.length > 0)

  function reset() {
    setStage('upload')
    setRows([])
    setImportResponse(null)
    setProgress(0)
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) reset()
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      toast.error('Format invalide. Veuillez utiliser un fichier .xlsx')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet)

        if (rawRows.length === 0) {
          toast.error('Le fichier ne contient aucune donnée')
          return
        }

        // Check that we can map at least email and name columns
        const headers = Object.keys(rawRows[0]).map(h => h.trim().toLowerCase())
        const mappedFields = new Set(
          headers.map(h => COLUMN_MAP[h]).filter(Boolean)
        )

        const requiredFields = ['first_name', 'last_name', 'email'] as const
        const missingFields = requiredFields.filter(f => !mappedFields.has(f))

        if (missingFields.length > 0) {
          toast.error(`Colonnes manquantes : ${missingFields.join(', ')}. Vérifiez les en-têtes du fichier.`)
          return
        }

        // Validate rows (locations will be auto-created server-side if they don't exist)
        const validated = parseAndValidateRows(rawRows)
        const locationNames = new Set(locations.map(l => l.name.toLowerCase().trim()))
        for (const row of validated) {
          if (row.data.location && !locationNames.has(row.data.location.toLowerCase().trim())) {
            row.warnings.push(`Lieu "${row.data.location}" sera créé automatiquement`)
          }
        }

        setRows(validated)
        setStage('preview')
      } catch {
        toast.error('Erreur lors de la lecture du fichier')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [locations])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['Jean', 'Dupont', 'jean.dupont@email.com', 'worker', 'Audioprothésiste', 'Paris', 'manager@email.com'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modèle')
    XLSX.writeFile(wb, 'modele_import_utilisateurs.xlsx')
  }

  async function handleImport() {
    setStage('importing')
    setProgress(10)

    const dataToSend = validRows.map(r => r.data)

    try {
      setProgress(30)
      const res = await fetch('/api/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: dataToSend }),
      })

      setProgress(80)

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de l\'import')
        setStage('preview')
        return
      }

      const response: ImportResponse = await res.json()
      setImportResponse(response)
      setProgress(100)
      setStage('results')

      if (response.summary.created > 0) {
        toast.success(`${response.summary.created} utilisateur(s) créé(s)`)
      }
      if (response.summary.failed > 0) {
        toast.error(`${response.summary.failed} échec(s)`)
      }
    } catch {
      toast.error('Erreur réseau lors de l\'import')
      setStage('preview')
    }
  }

  function handleClose() {
    setIsOpen(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importer Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {stage === 'upload' && 'Importer des utilisateurs'}
            {stage === 'preview' && 'Aperçu des données'}
            {stage === 'importing' && 'Import en cours...'}
            {stage === 'results' && 'Résultats de l\'import'}
          </DialogTitle>
        </DialogHeader>

        {/* Stage 1: Upload */}
        {stage === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragging ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium">
                Glissez-déposez un fichier .xlsx ici
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ou cliquez pour sélectionner un fichier
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Colonnes attendues : Prénom, Nom, Email, Rôle, Emploi, Lieu, Manager (email)
              </p>
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-1">
                <Download className="h-3 w-3" />
                Télécharger le modèle
              </Button>
            </div>
          </div>
        )}

        {/* Stage 2: Preview */}
        {stage === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {validRows.length} valide(s)
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {errorRows.length} erreur(s)
                </Badge>
              )}
              {rows.filter(r => r.warnings.length > 0).length > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  {rows.filter(r => r.warnings.length > 0).length} avertissement(s)
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Lieu</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="w-[140px]">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.rowIndex}
                      className={
                        row.errors.length > 0 ? 'bg-red-50' :
                        row.warnings.length > 0 ? 'bg-amber-50' : ''
                      }
                    >
                      <TableCell className="text-muted-foreground text-xs">{row.rowIndex}</TableCell>
                      <TableCell>{row.data.first_name}</TableCell>
                      <TableCell>{row.data.last_name}</TableCell>
                      <TableCell className="text-sm">{row.data.email}</TableCell>
                      <TableCell>
                        {ROLE_LABELS[row.data.role as UserRole] || row.data.role}
                      </TableCell>
                      <TableCell className="text-sm">{row.data.location || '-'}</TableCell>
                      <TableCell className="text-sm">{row.data.manager || '-'}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <div className="flex items-start gap-1">
                            <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <span className="text-xs text-red-600">{row.errors.join(', ')}</span>
                          </div>
                        ) : row.warnings.length > 0 ? (
                          <div className="flex items-start gap-1">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span className="text-xs text-amber-600">{row.warnings.join(', ')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-600">Valide</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={reset}>
                Annuler
              </Button>
              <div className="flex items-center gap-2">
                {errorRows.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Seules les {validRows.length} ligne(s) valide(s) seront importées
                  </p>
                )}
                <Button
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Importer {validRows.length} utilisateur(s)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 3: Importing */}
        {stage === 'importing' && (
          <div className="space-y-4 py-8">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              Création des comptes en cours...
            </p>
          </div>
        )}

        {/* Stage 4: Results */}
        {stage === 'results' && importResponse && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {importResponse.summary.created} créé(s)
              </Badge>
              {importResponse.summary.failed > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {importResponse.summary.failed} échec(s)
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Résultat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResponse.results.map((result) => (
                    <TableRow
                      key={result.rowIndex}
                      className={result.success ? '' : 'bg-red-50'}
                    >
                      <TableCell className="text-muted-foreground text-xs">{result.rowIndex}</TableCell>
                      <TableCell>{result.email}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">Créé</span>
                            {result.warning && (
                              <span className="text-xs text-amber-600">({result.warning})</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600">{result.error}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose} className="bg-rose-600 hover:bg-rose-700">
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
