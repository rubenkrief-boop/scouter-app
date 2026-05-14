"""Promote orphan formation_inscriptions to full profiles.

Lit les inscriptions orphan (profile_id IS NULL), genere un email
prenom.nom@vivason.fr normalise, et :
  - en mode --dry-run : affiche les 262 emails generes, detecte les
    conflits avec auth.users existant + les collisions email-meme-string
  - en mode --apply   : cree les auth.users + profiles via l'admin API
    Supabase, puis relie les inscriptions au nouveau profile_id

Normalisation email :
  prenom + '.' + nom -> lowercase -> retire accents (NFKD ASCII) ->
  espaces remplaces par '.' -> caracteres non [a-z0-9.-] supprimes ->
  points consecutifs compresses -> + '@vivason.fr'

Mapping rôle / statut :
  type='Audio'      -> job_title = 'Audioprothesiste'
  type='Assistante' -> job_title = 'Assistant'
  statut='Succursale' -> role = 'worker',         statut = 'succursale'
  statut='Franchise'  -> role = 'formation_user', statut = 'franchise'

is_active = false (l'admin active manuellement apres revue).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib import error, request


SUPABASE_PROJECT_REF = "llnvvhhamjzltxvayopb"
PROJECT_URL = "https://llnvvhhamjzltxvayopb.supabase.co"
UA = "Mozilla/5.0 Chrome/130.0"
EMAIL_DOMAIN = "vivason.fr"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in Path(".env.local").read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        if s.startswith('"') and s.endswith('"'):
            s = s[1:-1]
        k, v = s.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def normalize_email_local(prenom: str, nom: str) -> str:
    """prenom + '.' + nom, sans accents, en minuscules, [a-z0-9.-]."""
    raw = f"{prenom.strip()} {nom.strip()}"
    # 1. NFKD pour decomposer les accents, garder seulement ASCII
    decomposed = unicodedata.normalize("NFKD", raw)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    # 2. lowercase
    s = ascii_only.lower()
    # 3. espaces -> .
    s = s.replace(" ", ".")
    # 4. supprimer tout sauf [a-z0-9.-]
    s = re.sub(r"[^a-z0-9.\-]", "", s)
    # 5. compresser points consecutifs et trim
    s = re.sub(r"\.+", ".", s).strip(".")
    return s


def sql(env: dict[str, str], query: str) -> list[dict]:
    req = request.Request(
        f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {env['SUPABASE_PAT']}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except error.HTTPError as e:
        print(f"[SQL ERROR {e.code}] {e.read().decode()[:400]}", file=sys.stderr)
        raise


def fetch_orphans(env: dict[str, str]) -> list[dict]:
    """Liste deduplee des (nom, prenom, type, statut, centre) orphan."""
    query = """
    WITH orphans AS (
      SELECT DISTINCT
        lower(trim(prenom)) AS prenom_norm,
        lower(trim(nom))    AS nom_norm,
        (array_agg(prenom ORDER BY created_at DESC))[1] AS prenom,
        (array_agg(nom    ORDER BY created_at DESC))[1] AS nom,
        mode() WITHIN GROUP (ORDER BY type)   AS type_dominant,
        mode() WITHIN GROUP (ORDER BY statut) AS statut_dominant,
        mode() WITHIN GROUP (ORDER BY centre) AS centre_dominant
      FROM public.formation_inscriptions
      WHERE profile_id IS NULL
        AND prenom IS NOT NULL AND nom IS NOT NULL
        AND trim(prenom) <> '' AND trim(nom) <> ''
      GROUP BY 1, 2
    )
    SELECT prenom, nom, type_dominant AS type, statut_dominant AS statut,
           centre_dominant AS centre
    FROM orphans
    ORDER BY prenom, nom;
    """
    return sql(env, query)


def fetch_existing_emails(env: dict[str, str]) -> set[str]:
    """Tous les emails auth.users existants (lowercase)."""
    rows = sql(env, "SELECT lower(email) AS email FROM auth.users WHERE email IS NOT NULL;")
    return {r["email"] for r in rows}


def fetch_locations(env: dict[str, str]) -> dict[str, str]:
    """Map lowercase(name) -> location_id pour le matching centre."""
    rows = sql(env, "SELECT id, name FROM public.locations;")
    return {r["name"].strip().lower(): r["id"] for r in rows if r.get("name")}


def build_plan(env: dict[str, str]) -> dict:
    """Genere le plan complet : qui creer, qui dedupliquer."""
    orphans = fetch_orphans(env)
    existing_emails = fetch_existing_emails(env)
    locations_map = fetch_locations(env)

    seen_emails: dict[str, dict] = {}  # email -> first orphan to claim it
    to_create: list[dict] = []
    dedup_via_existing_auth: list[dict] = []
    dedup_within_batch: list[dict] = []

    for o in orphans:
        local = normalize_email_local(o["prenom"], o["nom"])
        if not local:
            continue
        email = f"{local}@{EMAIL_DOMAIN}"

        statut_low = (o.get("statut") or "").lower()
        statut_db = "franchise" if statut_low == "franchise" else "succursale"
        role_db = "formation_user" if statut_db == "franchise" else "worker"

        type_norm = (o.get("type") or "").lower()
        job_title = "Audioprothesiste" if type_norm == "audio" else "Assistant"

        centre_raw = (o.get("centre") or "").strip()
        location_id = locations_map.get(centre_raw.lower()) if centre_raw else None

        record = {
            "prenom": o["prenom"],
            "nom": o["nom"],
            "email": email,
            "role": role_db,
            "statut": statut_db,
            "job_title": job_title,
            "centre_raw": centre_raw or None,
            "location_id": location_id,
        }

        if email in existing_emails:
            dedup_via_existing_auth.append(record)
        elif email in seen_emails:
            dedup_within_batch.append({
                "current": record,
                "collides_with": seen_emails[email],
            })
        else:
            seen_emails[email] = record
            to_create.append(record)

    return {
        "to_create": to_create,
        "dedup_existing_auth": dedup_via_existing_auth,
        "dedup_within_batch": dedup_within_batch,
        "total_orphans_uniques": len(orphans),
    }


def print_summary(plan: dict) -> None:
    tc = plan["to_create"]
    de = plan["dedup_existing_auth"]
    dw = plan["dedup_within_batch"]
    print("==== PLAN ====")
    print(f"  Orphelins uniques detectes      : {plan['total_orphans_uniques']}")
    print(f"  A creer (auth + profile)        : {len(tc)}")
    print(f"    - workers (Succursale)        : {sum(1 for r in tc if r['role'] == 'worker')}")
    print(f"    - formation_user (Franchise)  : {sum(1 for r in tc if r['role'] == 'formation_user')}")
    print(f"    - avec location matchee       : {sum(1 for r in tc if r['location_id'])}")
    print(f"    - sans location               : {sum(1 for r in tc if not r['location_id'])}")
    print(f"  Lies a auth.users existant      : {len(de)}")
    print(f"  Collisions intra-batch          : {len(dw)}")
    print()
    if dw:
        print("==== COLLISIONS INTRA-BATCH (meme email genere par 2 personnes differentes) ====")
        for c in dw[:20]:
            r = c["current"]
            o = c["collides_with"]
            print(f"  {r['prenom']} {r['nom']:25s} -> {r['email']}  (deja pris par {o['prenom']} {o['nom']})")
        if len(dw) > 20:
            print(f"  ... +{len(dw) - 20} autres")
        print()
    if de:
        print("==== LIAISONS AVEC AUTH.USERS EXISTANT (deduplication automatique) ====")
        for r in de[:20]:
            print(f"  {r['prenom']} {r['nom']:25s} -> {r['email']} (deja un compte auth)")
        if len(de) > 20:
            print(f"  ... +{len(de) - 20} autres")
        print()
    print("==== ECHANTILLON A CREER (10 premiers) ====")
    for r in tc[:10]:
        loc = f"loc:{r['location_id'][:8]}..." if r["location_id"] else f"centre:'{r['centre_raw']}'"
        print(f"  {r['email']:50s} role={r['role']:15s} statut={r['statut']:11s} job={r['job_title']:18s} {loc}")


def supabase_admin_create_user(env: dict[str, str], email: str, user_metadata: dict) -> dict:
    """Cree un compte auth.users via l'admin API."""
    body = {
        "email": email,
        "email_confirm": True,
        "user_metadata": user_metadata,
        # Pas de password : ils utiliseront Google OAuth (le mot de passe
        # est de toute facon inutilisable car personne ne le connait).
        "password": "no-password-google-oauth-only-" + email.split("@")[0],
    }
    req = request.Request(
        f"{PROJECT_URL}/auth/v1/admin/users",
        data=json.dumps(body).encode(),
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def apply_plan(env: dict[str, str], plan: dict) -> None:
    """Cree les auth.users + profiles, relie les inscriptions."""
    created = 0
    failed = 0
    for r in plan["to_create"]:
        try:
            user = supabase_admin_create_user(env, r["email"], {
                "first_name": r["prenom"],
                "last_name": r["nom"],
                "role": r["role"],
                "source": "promote_inscriptions",
            })
            user_id = user["id"]
            # Le profile a ete cree par le trigger handle_new_user.
            # On le met a jour avec tous les champs deduits.
            upd_sql = f"""
            UPDATE public.profiles
            SET first_name = $tag${r['prenom']}$tag$,
                last_name  = $tag${r['nom']}$tag$,
                role       = '{r['role']}'::user_role,
                statut     = '{r['statut']}',
                job_title  = $tag${r['job_title']}$tag$,
                location_id = {f"'{r['location_id']}'" if r['location_id'] else 'NULL'},
                is_active  = false
            WHERE id = '{user_id}';

            UPDATE public.formation_inscriptions
            SET profile_id = '{user_id}'
            WHERE profile_id IS NULL
              AND lower(trim(prenom)) = lower(trim($tag${r['prenom']}$tag$))
              AND lower(trim(nom))    = lower(trim($tag${r['nom']}$tag$));
            """
            sql(env, upd_sql)
            created += 1
            if created % 25 == 0:
                print(f"  ... cree {created}/{len(plan['to_create'])}")
            # Throttle leger pour ne pas saturer l'API auth
            time.sleep(0.1)
        except error.HTTPError as e:
            body = e.read().decode()[:200]
            print(f"[ERREUR] {r['email']} : HTTP {e.code} {body}", file=sys.stderr)
            failed += 1
        except Exception as e:  # noqa
            print(f"[ERREUR] {r['email']} : {e}", file=sys.stderr)
            failed += 1

    # Lier aussi les dedup_existing_auth (profiles deja la, juste lier les inscriptions)
    relinked = 0
    for r in plan["dedup_existing_auth"]:
        try:
            link_sql = f"""
            UPDATE public.formation_inscriptions
            SET profile_id = (SELECT id FROM auth.users WHERE lower(email) = '{r['email'].lower()}' LIMIT 1)
            WHERE profile_id IS NULL
              AND lower(trim(prenom)) = lower(trim($tag${r['prenom']}$tag$))
              AND lower(trim(nom))    = lower(trim($tag${r['nom']}$tag$));
            """
            sql(env, link_sql)
            relinked += 1
        except Exception as e:  # noqa
            print(f"[ERREUR relink] {r['email']} : {e}", file=sys.stderr)

    print(f"\n==== APPLY TERMINE ====")
    print(f"  Profils crees       : {created}")
    print(f"  Erreurs creation    : {failed}")
    print(f"  Inscriptions relies : {relinked}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Effectue la creation reelle (sans ce flag : dry-run).")
    args = parser.parse_args()

    env = load_env()
    plan = build_plan(env)
    print_summary(plan)

    if args.apply:
        print("\n=== APPLY MODE — creation en cours... ===")
        apply_plan(env, plan)
    else:
        print("\n=== DRY RUN — aucune ecriture en base. Pour appliquer : --apply ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
