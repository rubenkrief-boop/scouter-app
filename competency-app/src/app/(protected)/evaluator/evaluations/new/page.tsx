import { redirect } from 'next/navigation'

// La creation d'evaluation se fait maintenant depuis la fiche collaborateur
// via le bouton "Modifier les scores" (evaluation continue)
export default function NewEvaluationPage() {
  redirect('/workers')
}
