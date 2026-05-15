import { redirect } from 'next/navigation'

// L'entree sidebar "Mes formations" (worker, resp_audiologie) pointe ici.
// Le contenu reel est servi par /formations qui affiche WorkerFormationsView
// pour les non-admins, donc on redirige pour eviter un doublon de logique.
export default function MyProfileFormationsPage() {
  redirect('/formations')
}
