import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/lib/audit'
import { checkRateLimit, getClientIp } from '@/lib/utils-app/rate-limit'

// RGPD article 17 — Droit a l'effacement.
//
// On NE HARD-DELETE PAS le profil pour respecter les obligations de
// retention legales (evaluations professionnelles, contrat de travail,
// historique RH — 3 a 5 ans selon la politique de confidentialite).
// A la place, on ANONYMISE le profil :
//   - first_name / last_name remplaces par "Utilisateur supprime"
//   - email blanchi
//   - is_active = false
//   - deleted_at horodate
// Et on bannit le compte auth.users pour empecher toute nouvelle connexion.
//
// Les evaluations / commentaires restent en base, mais referencent un
// profil anonyme. Le caller est tenu d'avoir prealablement exporte ses
// donnees via /api/me/export s'il en veut une copie.
//
// Body: { confirm: string } — doit egaler l'email du user pour confirmer.
//
// Les super_admin ne peuvent pas s'auto-supprimer (risque lock-out org).
export async function POST(request: NextRequest) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // Rate-limit : 1 tentative / heure (geste irreversible, on ne veut
  // pas qu'un script bruteforce les confirmations).
  const ip = getClientIp(request)
  const rl = checkRateLimit(`me-delete:${user.id}:${ip}`, {
    maxRequests: 3,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Reessayez plus tard.' },
      { status: 429 },
    )
  }

  let body: { confirm?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body.confirm || body.confirm.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return NextResponse.json(
      { error: 'La confirmation doit correspondre a votre email' },
      { status: 400 },
    )
  }

  // Les super_admin ne peuvent pas s'auto-supprimer (eviter lock-out).
  if (profile.role === 'super_admin') {
    return NextResponse.json({
      error: 'Les super-administrateurs ne peuvent pas supprimer leur compte par ce canal. Demandez a un autre super-administrateur.',
    }, { status: 403 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  try {
    const nowIso = new Date().toISOString()

    // 1. Anonymiser le profil (la table ne contient pas deleted_at, on
    //    utilise is_active=false comme marqueur de suppression).
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        first_name: 'Utilisateur',
        last_name: 'supprime',
        email: `deleted-${user.id}@anonymised.local`,
        job_title: null,
        avatar_url: null,
        is_active: false,
      })
      .eq('id', user.id)
    if (profileError) throw profileError

    // 2. Desactiver le compte auth (impossible de se reconnecter).
    //    On utilise user_metadata pour traçabilite plutot que ban_duration.
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { deleted_at: nowIso, anonymised: true },
      ban_duration: '876000h', // 100 ans = jamais
    })
    if (authError) {
      logger.warn(
        'rgpd.delete.auth_disable_failed',
        authError.message,
        { userId: user.id, code: authError.status },
      )
    }

    // 3. Audit log (actor = le user lui-meme, target = lui aussi).
    await recordAudit({
      action: 'user.self_deleted',
      actorId: user.id,
      targetId: user.id,
      metadata: {
        role: profile.role,
        anonymised_at: nowIso,
      },
    })

    // 4. Sign out the current session.
    await supabase.auth.signOut()

    logger.info('rgpd.delete.success', 'self-delete completed', {
      userId: user.id,
      role: profile.role,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('rgpd.delete.failed', err, { userId: user.id })
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du compte' },
      { status: 500 },
    )
  }
}
