'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Home, Users, BookOpen, Layers, ClipboardCheck,
  User, LogOut, Sliders, Briefcase, MapPin, Settings, PieChart, GraduationCap, Calendar, Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/utils-app/roles'
import { logout } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useBranding } from '@/components/providers/branding-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import Image from 'next/image'

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
    roles: ['super_admin', 'skill_master', 'manager', 'resp_audiologie', 'worker', 'formation_user'],
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
    roles: ['super_admin', 'skill_master', 'manager', 'resp_audiologie'],
    section: 'Administration',
  },
  {
    label: 'Paramètres',
    href: '/admin/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Administration',
  },
  // Métier - Skill master
  {
    label: 'Compétences',
    href: '/skill-master/library',
    icon: <Layers className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Métier',
  },
  {
    label: 'Qualifiers',
    href: '/skill-master/qualifiers',
    icon: <Sliders className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Métier',
  },
  {
    label: 'Profils de poste',
    href: '/skill-master/job-profiles',
    icon: <Briefcase className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master'],
    section: 'Métier',
  },
  // Opérationnel
  {
    label: 'Collaborateurs',
    href: '/workers',
    icon: <Users className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master', 'manager', 'resp_audiologie'],
    section: 'Opérationnel',
  },
  {
    label: 'Évaluations',
    href: '/evaluator/evaluations',
    icon: <ClipboardCheck className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master', 'manager', 'resp_audiologie'],
    section: 'Opérationnel',
  },
  {
    label: 'Formations',
    href: '/formations',
    icon: <GraduationCap className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master', 'manager', 'resp_audiologie', 'formation_user'],
    section: 'Opérationnel',
  },
  {
    label: 'Visites',
    href: '/visits',
    icon: <Calendar className="h-5 w-5" />,
    roles: ['super_admin', 'skill_master', 'manager', 'resp_audiologie'],
    section: 'Opérationnel',
  },
  // Mon espace - Worker
  {
    label: 'Mon profil',
    href: '/my-profile',
    icon: <User className="h-5 w-5" />,
    roles: ['worker', 'resp_audiologie'],
    section: 'Mon espace',
  },
  {
    label: 'Mes évaluations',
    href: '/my-profile/evaluations',
    icon: <ClipboardCheck className="h-5 w-5" />,
    roles: ['worker', 'resp_audiologie'],
    section: 'Mon espace',
  },
  {
    label: 'Mes formations',
    href: '/my-profile/formations',
    icon: <BookOpen className="h-5 w-5" />,
    roles: ['worker', 'resp_audiologie'],
    section: 'Mon espace',
  },
  {
    label: 'Collègues',
    href: '/colleagues',
    icon: <Users className="h-5 w-5" />,
    roles: ['worker', 'resp_audiologie'],
    section: 'Mon espace',
  },
]

interface AppSidebarProps {
  userRole: UserRole
  userName: string
}

/**
 * Actual nav content — shared between the desktop aside and the mobile Sheet.
 */
function SidebarBody({
  userRole,
  userName,
  onNavigate,
}: {
  userRole: UserRole
  userName: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const branding = useBranding()

  const filteredItems = navItems.filter(item =>
    userRole === 'super_admin' || item.roles.includes(userRole)
  )
  // Precompute which items should show a section header (super_admin only),
  // done before render to avoid mutating variables during render.
  const sectionVisibility: boolean[] = []
  {
    let lastSection: string | undefined
    for (const item of filteredItems) {
      const show = userRole === 'super_admin' && !!item.section && item.section !== lastSection
      sectionVisibility.push(show)
      if (item.section) lastSection = item.section
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex flex-col items-center gap-3">
        {branding.logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt="Logo entreprise"
              className="max-w-[180px] max-h-[80px] object-contain"
            />
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <span>propulsé par</span>
              <Image src="/logo-full.png" alt="SCOUTER" width={90} height={45} className="object-contain opacity-50" />
            </div>
          </>
        ) : (
          <Image
            src="/logo-full.png"
            alt="SCOUTER"
            width={240}
            height={120}
            className="object-contain"
          />
        )}
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const showSection = sectionVisibility[idx]

          return (
            <div key={item.href}>
              {showSection && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 mt-5 mb-2 px-3">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:translate-x-0.5'
                )}
                style={isActive && branding.accentColor ? {
                  backgroundColor: branding.accentColor + '15',
                  borderLeft: `3px solid ${branding.accentColor}`,
                } : isActive ? {
                  borderLeft: '3px solid hsl(var(--primary))',
                } : undefined}
              >
                <span aria-hidden="true" className={cn('transition-transform duration-200', isActive && 'scale-110')}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </div>
          )
        })}
      </nav>

      <Separator />

      {/* User info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-primary/10">
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
    </div>
  )
}

export function AppSidebar({ userRole, userName }: AppSidebarProps) {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    if (isMobile) queueMicrotask(() => setOpen(false))
  }, [pathname, isMobile])

  if (isMobile) {
    return (
      <>
        {/* Top bar with hamburger — only on mobile */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-2 border-b border-sidebar-border bg-sidebar/95 backdrop-blur px-3 py-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ouvrir le menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBody
                userRole={userRole}
                userName={userName}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Image src="/logo-full.png" alt="SCOUTER" width={100} height={32} className="object-contain" />
        </div>
        {/* Spacer so main content is not hidden under the fixed top bar */}
        <div aria-hidden="true" className="h-12 md:hidden" />
      </>
    )
  }

  return (
    <aside className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 shadow-sm">
      <SidebarBody userRole={userRole} userName={userName} />
    </aside>
  )
}
