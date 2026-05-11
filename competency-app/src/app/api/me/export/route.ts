import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/utils-app/rate-limit'

// RGPD article 20 — Droit a la portabilite des donnees.
// Retourne un JSON contenant toutes les donnees personnelles que l'utilisateur
// connecte peut revendiquer dans Scouter :
//
//   - Toujours : son profil
//   - Si worker / resp_audiologie : evaluations dont il est l'evalue
//                                   (+ results + qualifier answers),
//                                   commentaires nominaux a son sujet,
//                                   inscriptions formations
//   - Si manager / skill_master / super_admin : evaluations creees par lui,
//                                                visites creees par lui,
//                                                commentaires ecrits par lui
//
// Le RGPD demande "les donnees personnelles qui le concernent", on inclut
// les deux faces : ce qu'il a fait + ce qui a ete fait sur lui.
export async function GET(request: Request) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // Rate-limit : 3 exports / heure / user (un export pese sur la DB)
  const ip = getClientIp(request)
  const rl = checkRateLimit(`me-export:${user.id}:${ip}`, {
    maxRequests: 3,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop d\'exports en peu de temps. Reessayez plus tard.' },
      { status: 429 },
    )
  }

  const supabase = await createClient()

  try {
    const exported: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      profile: {
        id: profile.id,
        email: user.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        job_title: profile.job_title,
        location_id: profile.location_id,
        manager_id: profile.manager_id,
        is_active: profile.is_active,
        created_at: profile.created_at,
      },
    }

    // Donnees recues / subies : evaluations OU le user est l'evalue
    // (independant du role : meme un manager peut avoir ete evalue avant
    // promotion).
    const [
      { data: evaluationsAboutMe },
      { data: workerCommentsAboutMe },
      { data: formationInscriptions },
    ] = await Promise.all([
      supabase
        .from('evaluations')
        .select(`
          *,
          evaluator:profiles!evaluator_id(first_name, last_name, email),
          job_profile:job_profiles(name),
          results:evaluation_results(
            *,
            qualifier_answers:evaluation_result_qualifiers(*)
          )
        `)
        .eq('audioprothesiste_id', user.id),
      supabase
        .from('worker_comments')
        .select('*, author:profiles!author_id(first_name, last_name)')
        .eq('worker_id', user.id),
      supabase
        .from('formation_inscriptions')
        .select('*')
        .eq('profile_id', user.id),
    ])

    exported.evaluations_about_me = evaluationsAboutMe ?? []
    exported.comments_about_me = workerCommentsAboutMe ?? []
    exported.formation_inscriptions = formationInscriptions ?? []

    // Donnees produites : actions effectuees par le user (evaluations
    // creees, commentaires ecrits, visites planifiees).
    if (['manager', 'skill_master', 'super_admin', 'resp_audiologie'].includes(profile.role)) {
      const [
        { data: evaluationsCreated },
        { data: commentsWritten },
        { data: visitsCreated },
      ] = await Promise.all([
        supabase
          .from('evaluations')
          .select(`
            *,
            audioprothesiste:profiles!audioprothesiste_id(first_name, last_name)
          `)
          .eq('evaluator_id', user.id),
        supabase
          .from('worker_comments')
          .select('*, worker:profiles!worker_id(first_name, last_name)')
          .eq('author_id', user.id),
        supabase
          .from('visits')
          .select('*, location:locations(name, city)')
          .eq('created_by', user.id),
      ])
      exported.evaluations_created = evaluationsCreated ?? []
      exported.comments_written = commentsWritten ?? []
      exported.visits_created = visitsCreated ?? []
    }

    const filename = `scouter-export-${user.id}-${Date.now()}.json`
    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    logger.error('rgpd.export.failed', err, { userId: user.id })
    return NextResponse.json(
      { error: 'Erreur lors de la generation de l\'export' },
      { status: 500 },
    )
  }
}
