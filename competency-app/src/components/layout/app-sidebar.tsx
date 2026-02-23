'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Users, BookOpen, Layers, ClipboardCheck,
  BarChart3, User, LogOut, Sliders, Briefcase, MapPin, Settings, PieChart
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/utils-app/roles'
import { logout } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: UserRole[]
  section?: string
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master', 'manager', 'worker'],
  },
  // Administration
  {
    label: 'Utilisateurs',
    href: '/admin/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['super_admin'],
    section: 'Administration',
  },
  {
    label: "Lieux d'exercice",
    href: '/admin/locations',
    icon: <MapPin className="h-5 w-5" />,
    roles: ['super_admin'],
    section: 'Administration',
  },
  {
    label: 'Statistiques',
    href: '/statistics',
    icon: <PieChart className="h-5 w-5" />,
    roles: ['super_admin', 'manager'],
    section: 'Administration',
  },
  {
    label: 'Paramètres',
    href: '/admin/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Administration',
  },
  // Skill Master
  {
    label: 'Qualifiers',
    href: '/skill-master/qualifiers',
    icon: <Sliders className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Skill Master',
  },
  {
    label: 'Bibliothèque',
    href: '/skill-master/library',
    icon: <BookOpen className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Skill Master',
  },
  {
    label: 'Profils métier',
    href: '/skill-master/job-profiles',
    icon: <Briefcase className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Skill Master',
  },
  // Évaluations
  {
    label: 'Collaborateurs',
    href: '/workers',
    icon: <Users className="h-5 w-5" />,
    roles: ['super_admin', 'manager', 'skill_master'],
    section: 'Évaluation',
  },
  {
    label: 'Évaluations',
    href: '/evaluator/evaluations',
    icon: <ClipboardCheck className="h-5 w-5" />,
    roles: ['super_admin', 'manager', 'skill_master'],
    section: 'Évaluation',
  },
  // Audioprothésiste
  {
    label: 'Mon profil',
    href: '/my-profile',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['worker'],
    section: 'Mon espace',
  },
  {
    label: 'Mes évaluations',
    href: '/my-profile/evaluations',
    icon: <Layers className="h-5 w-5" />,
    roles: ['worker'],
    section: 'Mon espace',
  },
  {
    label: 'Collègues',
    href: '/colleagues',
    icon: <Users className="h-5 w-5" />,
    roles: ['worker'],
    section: 'Mon espace',
  },
]

interface AppSidebarProps {
  userRole: UserRole
  userName: string
  userEmail: string
}

export function AppSidebar({ userRole, userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname()

  // Super admin sees ALL items, others see only their role's items
  const filteredItems = navItems.filter(item =>
    userRole === 'super_admin' || item.roles.includes(userRole)
  )

  // Group items by section for super_admin display
  let lastSection: string | undefined

  return (
    <aside className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
          <img src="/logo-icon.png" alt="Scouter" className="h-8 w-8 object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary tracking-wider leading-tight">SCOUTER</h1>
          <p className="text-[10px] text-sidebar-foreground/50">Mesure des compétences</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const showSection = userRole === 'super_admin' && item.section && item.section !== lastSection
          if (item.section) lastSection = item.section

          return (
            <div key={item.href}>
              {showSection && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mt-4 mb-1 px-3">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </div>
          )
        })}
      </nav>

      <Separator />

      {/* User info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[userRole]}</p>
          </div>
        </div>
        <form action={logout}>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" type="submit">
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </form>
        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-[10px] text-muted-foreground/60">
            <Link href="/legal/mentions-legales" className="hover:underline">Mentions</Link>
            <Link href="/legal/cgu" className="hover:underline">CGU</Link>
            <Link href="/legal/confidentialite" className="hover:underline">RGPD</Link>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
