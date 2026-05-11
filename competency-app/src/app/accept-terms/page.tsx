import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ScrollText, Shield, FileText, ExternalLink } from 'lucide-react'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { recordLegalAcceptance } from '@/lib/actions/legal-acceptance'
import { LEGAL_VERSION, LEGAL_DATE } from '@/lib/legal'

// Page d'acceptation des CGU au premier login (ou apres bump de version).
// Pas de protected layout sur ce path : l'utilisateur authentifie mais
// n'ayant pas accepte est redirige ICI par (protected)/layout.tsx, et
// doit cocher + valider pour acceder a l'app.
//
// L'acceptation est horodatee dans profiles.legal_accepted_version/_at,
// + une entree audit_logs (preuve, art. 1366 Code Civil).
export default async function AcceptTermsPage() {
  const { user, profile } = await getAuthProfile()

  // Non authentifie -> direction login
  if (!user || !profile) {
    redirect('/auth/login')
  }

  // Deja accepte la version courante -> direction dashboard
  if (profile.legal_accepted_version === LEGAL_VERSION) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-100 px-8 py-5">
          <div className="flex items-center gap-3">
            <ScrollText className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-slate-900">
              Conditions generales d&apos;utilisation
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Version {LEGAL_VERSION} — applicable au {LEGAL_DATE}
          </p>
        </div>

        <div className="px-8 py-6 space-y-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            Avant d&apos;utiliser SCOUTER, merci de prendre connaissance et d&apos;accepter
            nos documents legaux. Ils encadrent l&apos;usage de la plateforme et le
            traitement de vos donnees professionnelles (evaluations, formations,
            visites).
          </p>

          <div className="space-y-2">
            <LegalLink
              href="/legal/cgu"
              icon={<FileText className="h-4 w-4" />}
              label="Conditions generales d'utilisation"
            />
            <LegalLink
              href="/legal/confidentialite"
              icon={<Shield className="h-4 w-4" />}
              label="Politique de confidentialite"
            />
            <LegalLink
              href="/legal/mentions-legales"
              icon={<FileText className="h-4 w-4" />}
              label="Mentions legales"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
            <p>
              <strong>Tracabilite :</strong> en cliquant sur &laquo; J&apos;accepte &raquo;,
              votre validation sera horodatee et conservee dans votre profil
              (Article 1366 du Code civil). Vous pouvez a tout moment exporter
              vos donnees personnelles ou demander leur suppression depuis votre
              profil.
            </p>
          </div>

          <form action={recordLegalAcceptance} className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="agreed"
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">
                J&apos;ai lu et j&apos;accepte les CGU, la politique de confidentialite
                et les mentions legales de SCOUTER (version {LEGAL_VERSION}).
              </span>
            </label>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Acceder a l&apos;application
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function LegalLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
    </Link>
  )
}
