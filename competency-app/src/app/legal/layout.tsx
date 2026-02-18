import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour a l'application
        </Link>
        {children}
        <div className="mt-12 pt-6 border-t text-sm text-muted-foreground flex gap-6">
          <Link href="/legal/mentions-legales" className="hover:underline">Mentions legales</Link>
          <Link href="/legal/confidentialite" className="hover:underline">Politique de confidentialite</Link>
          <Link href="/legal/cgu" className="hover:underline">CGU</Link>
        </div>
      </div>
    </div>
  )
}
