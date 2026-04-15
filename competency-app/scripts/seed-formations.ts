import { createClient } from '@supabase/supabase-js'
import { SEED_SESSIONS, SEED_PROG_ATELIERS_MAP } from '../src/lib/data/formations-seed'

const supabase = createClient(
  'https://llnvvhhamjzltxvayopb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsbnZ2aGhhbWp6bHR4dmF5b3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE1NTM1NywiZXhwIjoyMDg1NzMxMzU3fQ.weWpEVOF7OINFqZyl4sKZMja5z60SXEQUunGrnK2LF4',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function seed() {
  const results = { sessions: 0, ateliers: 0, inscriptions: 0, programmeAteliers: 0, errors: [] as string[] }

  console.log(`🚀 Seeding ${SEED_SESSIONS.length} sessions...`)

  for (const session of SEED_SESSIONS) {
    // 1. Upsert session
    const { data: ins, error: sErr } = await supabase
      .from('formation_sessions')
      .upsert({ code: session.code, label: session.label, date_info: session.date_info, sort_order: session.sort_order, is_active: true }, { onConflict: 'code' })
      .select('id, code')
      .single()

    if (sErr) { results.errors.push(`Session ${session.code}: ${sErr.message}`); continue }
    results.sessions++
    const sessionId = ins.id
    console.log(`  ✅ Session ${session.code} (${session.label})`)

    // 2. Insert ateliers
    const atelierIdMap: Record<string, string> = {}
    for (const type of ['audio', 'assistante'] as const) {
      const dbType = type === 'audio' ? 'Audio' : 'Assistante'
      for (let idx = 0; idx < session.ateliers[type].length; idx++) {
        const a = session.ateliers[type][idx]
        const { data: aIns, error: aErr } = await supabase
          .from('formation_ateliers')
          .insert({ session_id: sessionId, nom: a.nom, formateur: a.formateur || null, duree: a.duree || null, type: dbType, etat: a.etat, programmes: a.programmes || null, sort_order: idx })
          .select('id, nom')
          .single()
        if (aErr) { results.errors.push(`Atelier "${a.nom}": ${aErr.message}`) }
        else { results.ateliers++; atelierIdMap[a.nom] = aIns.id }
      }
    }

    // 3. Insert participants (batch by 50)
    if (session.participants.length > 0) {
      const rows = session.participants.map(p => ({
        session_id: sessionId, nom: p.nom, prenom: p.prenom, type: p.type,
        statut: p.statut, programme: p.programme, centre: p.centre || null, dpc: p.dpc,
      }))

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50)
        const { error: iErr } = await supabase
          .from('formation_inscriptions')
          .upsert(batch, { onConflict: 'session_id,nom,prenom,type', count: 'exact' })
        if (iErr) { results.errors.push(`Inscriptions batch ${session.code} [${i}]: ${iErr.message}`) }
        else { results.inscriptions += batch.length }
      }
      console.log(`     📋 ${session.participants.length} participants`)
    }

    // 4. Programme-atelier mappings
    const sessionMap = SEED_PROG_ATELIERS_MAP[session.code]
    if (sessionMap) {
      for (const [type, programmes] of Object.entries(sessionMap)) {
        if (!programmes) continue
        for (const [programme, atelierNames] of Object.entries(programmes)) {
          for (const name of atelierNames) {
            const atelierId = atelierIdMap[name]
            if (!atelierId) { results.errors.push(`Mapping: "${name}" not found for ${session.code}`); continue }
            const { error: mErr } = await supabase
              .from('formation_programme_ateliers')
              .upsert({ session_id: sessionId, type, programme, atelier_id: atelierId }, { onConflict: 'session_id,type,programme,atelier_id' })
            if (mErr) { results.errors.push(`Mapping ${session.code}/${type}/${programme}/${name}: ${mErr.message}`) }
            else { results.programmeAteliers++ }
          }
        }
      }
    }
  }

  // 5. Auto-link inscriptions to profiles
  console.log('\n🔗 Auto-linking inscriptions to profiles...')
  const { data: unlinked } = await supabase.from('formation_inscriptions').select('id, nom, prenom').is('profile_id', null)
  const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true)

  let linked = 0
  if (unlinked && profiles) {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')
    for (const insc of unlinked) {
      const key = normalize(insc.prenom) + normalize(insc.nom)
      const match = profiles.find(p => normalize(p.first_name) + normalize(p.last_name) === key)
      if (match) {
        await supabase.from('formation_inscriptions').update({ profile_id: match.id }).eq('id', insc.id)
        linked++
      }
    }
  }

  console.log(`\n✅ SEED TERMINÉ:`)
  console.log(`   Sessions:    ${results.sessions}`)
  console.log(`   Ateliers:    ${results.ateliers}`)
  console.log(`   Inscriptions: ${results.inscriptions}`)
  console.log(`   Prog-Atelier: ${results.programmeAteliers}`)
  console.log(`   Profils liés: ${linked}`)
  if (results.errors.length > 0) {
    console.log(`\n⚠️  ${results.errors.length} erreur(s):`)
    results.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`))
    if (results.errors.length > 10) console.log(`   ... et ${results.errors.length - 10} autres`)
  }
}

seed().catch(e => console.error('Fatal:', e))
