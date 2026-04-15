'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, GraduationCap, Users, Calendar, FileText,
} from 'lucide-react'
import Link from 'next/link'
import type {
  FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession,
  FormationProgrammeSettingWithCount, FormationProgrammeFile,
} from '@/lib/types'
import type { TeamProfile } from '@/lib/actions/formations'
import { useAdminMessage } from './hooks/use-admin-message'
import { SeedButton } from './seed-button'
import { AutoLinkButton } from './autolink-button'
import { SessionsSection } from './sections/sessions-section'
import { AteliersSection } from './sections/ateliers-section'
import { InscriptionsSection } from './sections/inscriptions-section'
import { ProgrammesSection } from './sections/programmes-section'

interface FormationsAdminProps {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  programmeFiles: FormationProgrammeFile[]
  isSuperAdmin: boolean
  isManager: boolean
  currentUserId: string
  teamProfiles: TeamProfile[]
}

export function FormationsAdmin({ sessions, ateliers, inscriptions, programmeSettings, programmeFiles, isSuperAdmin, isManager, currentUserId, teamProfiles }: FormationsAdminProps) {
  const [activeSection, setActiveSection] = useState<'sessions' | 'ateliers' | 'inscriptions' | 'programmes'>('sessions')
  const { message, showMessage } = useAdminMessage()

  const sections = [
    { id: 'sessions' as const, label: 'Sessions', icon: Calendar, count: sessions.length },
    { id: 'ateliers' as const, label: 'Ateliers', icon: GraduationCap, count: ateliers.length },
    { id: 'inscriptions' as const, label: 'Inscriptions', icon: Users, count: inscriptions.length },
    { id: 'programmes' as const, label: 'Programmes', icon: FileText, count: programmeSettings.length },
  ]

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/formations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <SeedButton showMessage={showMessage} />
          )}
          <AutoLinkButton showMessage={showMessage} />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-border">
        {sections.map(sec => {
          const Icon = sec.icon
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeSection === sec.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {sec.label}
              <Badge variant="secondary" className="text-[10px] ml-1">{sec.count}</Badge>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeSection === 'sessions' && (
        <SessionsSection sessions={sessions} showMessage={showMessage} />
      )}
      {activeSection === 'ateliers' && (
        <AteliersSection ateliers={ateliers} sessions={sessions} showMessage={showMessage} />
      )}
      {activeSection === 'inscriptions' && (
        <InscriptionsSection inscriptions={inscriptions} sessions={sessions} showMessage={showMessage} isManager={isManager} teamProfiles={teamProfiles} />
      )}
      {activeSection === 'programmes' && (
        <ProgrammesSection
          sessions={sessions}
          programmeSettings={programmeSettings}
          programmeFiles={programmeFiles}
          showMessage={showMessage}
        />
      )}
    </div>
  )
}
