import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SEED_SESSIONS, SEED_PROG_ATELIERS_MAP } from '@/lib/data/formations-seed'
import { normalizeName } from '@/lib/utils'

export async function POST() {
  try {
    const supabase = await createClient()

    // Check auth — only super_admin can seed
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const results = {
      sessions: 0,
      ateliers: 0,
      inscriptions: 0,
      programmeAteliers: 0,
      errors: [] as string[],
    }

    // 1. Insert sessions
    for (const session of SEED_SESSIONS) {
      const { data: insertedSession, error: sessionError } = await supabase
        .from('formation_sessions')
        .upsert(
          {
            code: session.code,
            label: session.label,
            date_info: session.date_info,
            sort_order: session.sort_order,
            is_active: true,
          },
          { onConflict: 'code' }
        )
        .select('id, code')
        .single()

      if (sessionError) {
        results.errors.push(`Session ${session.code}: ${sessionError.message}`)
        continue
      }

      results.sessions++
      const sessionId = insertedSession.id

      // 2. Insert ateliers for this session
      const atelierIdMap: Record<string, string> = {} // nom -> id (for programme mapping)

      for (const type of ['audio', 'assistante'] as const) {
        const dbType = type === 'audio' ? 'Audio' : 'Assistante'
        const ateliersList = session.ateliers[type]

        for (let idx = 0; idx < ateliersList.length; idx++) {
          const atelier = ateliersList[idx]
          const { data: insertedAtelier, error: atelierError } = await supabase
            .from('formation_ateliers')
            .insert({
              session_id: sessionId,
              nom: atelier.nom,
              formateur: atelier.formateur || null,
              duree: atelier.duree || null,
              type: dbType,
              etat: atelier.etat,
              programmes: atelier.programmes || null,
              sort_order: idx,
            })
            .select('id, nom')
            .single()

          if (atelierError) {
            results.errors.push(`Atelier "${atelier.nom}" (${session.code}): ${atelierError.message}`)
          } else {
            results.ateliers++
            atelierIdMap[atelier.nom] = insertedAtelier.id
          }
        }
      }

      // 3. Insert participants/inscriptions for this session
      for (const participant of session.participants) {
        const { error: inscError } = await supabase
          .from('formation_inscriptions')
          .upsert(
            {
              session_id: sessionId,
              nom: participant.nom,
              prenom: participant.prenom,
              type: participant.type,
              statut: participant.statut,
              programme: participant.programme,
              centre: participant.centre || null,
              dpc: participant.dpc,
            },
            { onConflict: 'session_id,nom,prenom,type' }
          )

        if (inscError) {
          results.errors.push(`Inscription "${participant.prenom} ${participant.nom}" (${session.code}): ${inscError.message}`)
        } else {
          results.inscriptions++
        }
      }

      // 4. Insert programme-atelier mappings
      const sessionMap = SEED_PROG_ATELIERS_MAP[session.code]
      if (sessionMap) {
        for (const [type, programmes] of Object.entries(sessionMap)) {
          if (!programmes) continue
          for (const [programme, atelierNames] of Object.entries(programmes)) {
            for (const atelierName of atelierNames) {
              const atelierId = atelierIdMap[atelierName]
              if (!atelierId) {
                results.errors.push(`Programme mapping: atelier "${atelierName}" not found for ${session.code}/${type}/${programme}`)
                continue
              }

              const { error: mapError } = await supabase
                .from('formation_programme_ateliers')
                .upsert(
                  {
                    session_id: sessionId,
                    type: type as 'Audio' | 'Assistante',
                    programme,
                    atelier_id: atelierId,
                  },
                  { onConflict: 'session_id,type,programme,atelier_id' }
                )

              if (mapError) {
                results.errors.push(`Programme mapping ${session.code}/${type}/${programme}/${atelierName}: ${mapError.message}`)
              } else {
                results.programmeAteliers++
              }
            }
          }
        }
      }
    }

    // 5. Auto-link inscriptions to profiles
    const { data: unlinked } = await supabase
      .from('formation_inscriptions')
      .select('id, nom, prenom')
      .is('profile_id', null)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('is_active', true)

    let linked = 0
    if (unlinked && profiles) {
      for (const insc of unlinked) {
        const key = normalizeName(insc.prenom) + normalizeName(insc.nom)
        const match = profiles.find(
          (p) => normalizeName(p.first_name) + normalizeName(p.last_name) === key
        )
        if (match) {
          await supabase
            .from('formation_inscriptions')
            .update({ profile_id: match.id })
            .eq('id', insc.id)
          linked++
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        ...results,
        linked,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
