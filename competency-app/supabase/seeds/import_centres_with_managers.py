"""Import des centres Vivason avec attribution automatique des managers/gérants.

Source : 260513_VivaSon_ListeCentres.xlsx, onglet 'INFOS CENTRES'.

Structure attendue :
  - L3 : header 'SUCCURSALE | ADRESSE | CP | VILLE | Manager'
  - L4..LN : succursales (statut=succursale)
  - L(N+2) : header 'FRANCHISE | ADRESSE | CP | VILLE | Franchisé'
  - L(N+3)..LM : franchises (statut=franchise)

Pour chaque centre :
  1. Upsert dans public.locations (matching insensible casse sur le nom)
  2. Pour chaque manager/gérant listé (séparés par ' / ' si plusieurs) :
     - Email = prenom.nom@vivason.fr (normalisation NFKD + lowercase)
     - Trouver le profil par email ; sinon le créer (auth + profile)
     - Promouvoir :
        * role = 'manager' (succ) ou 'gerant_franchise' (franchise)
        * statut = 'succursale' / 'franchise'
        * location_id = ce centre (si pas déjà set — multi-centres gardent
          leur premier centre comme principal)
  3. Pour chaque salarié (formation_user) avec location_id = ce centre :
     - manager_id = ID du PREMIER gérant listé (les centres à 2 gérants
       sont à réajuster manuellement après si besoin)
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

import openpyxl


XLSX_PATH = "C:/Users/Ruben/Desktop/Projet IA/Assets/260513_VivaSon_ListeCentres.xlsx"
SHEET_NAME = "INFOS CENTRES"

SUPABASE_PROJECT_REF = "llnvvhhamjzltxvayopb"
PROJECT_URL = "https://llnvvhhamjzltxvayopb.supabase.co"
UA = "Mozilla/5.0 Chrome/130.0"
EMAIL_DOMAIN = "vivason.fr"

# Overrides d'email : pour les personnes dont le mail ne suit pas le pattern
# prenom.nom@vivason.fr (nom marital différent, etc.). Clé = full name tel que
# dans l'Excel, normalisé (lowercase + accents strip).
EMAIL_OVERRIDES: dict[str, str] = {
    "jessica doutrligne": "jessica.planque@vivason.fr",
    "jessica doutreligne": "jessica.planque@vivason.fr",
    # L'Excel ecrit "Zagroun" mais le bon orthographe est "Zaghroun"
    "samuel zagroun": "samuel.zaghroun@vivason.fr",
}

# Corrections cosmétiques du nom de centre (orthographe Excel → propre en DB).
CENTRE_NAME_OVERRIDES: dict[str, str] = {
    "ARMANTIERES": "ARMENTIERES",
}

# Corrections cosmétiques de la ville (orthographe Excel → propre en DB).
CITY_OVERRIDES: dict[str, str] = {
    "Armantières": "Armentières",
}


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
    raw = f"{prenom.strip()} {nom.strip()}"
    decomposed = unicodedata.normalize("NFKD", raw)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    s = ascii_only.lower()
    s = s.replace(" ", ".")
    s = re.sub(r"[^a-z0-9.\-]", "", s)
    s = re.sub(r"\.+", ".", s).strip(".")
    return s


def normalize_full_name(full: str) -> str:
    decomposed = unicodedata.normalize("NFKD", full.strip())
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", ascii_only.lower())


def compute_email(prenom: str, nom: str, full_name: str) -> str:
    key = normalize_full_name(full_name)
    if key in EMAIL_OVERRIDES:
        return EMAIL_OVERRIDES[key]
    return f"{normalize_email_local(prenom, nom)}@{EMAIL_DOMAIN}"


def split_full_name(full: str) -> tuple[str, str]:
    """'Pierre-Ugo Morel' -> ('Pierre-Ugo', 'Morel'). On considère que le
    PRÉNOM est tout sauf le dernier mot, NOM = dernier mot. Robuste aux
    noms composés type 'Jean-Pierre Du Mont' (prenom='Jean-Pierre Du', nom='Mont').
    Pour 'D'angelo Marie' on garde 'Marie' en NOM. Imparfait mais aligné
    avec le format de l'Excel."""
    parts = full.strip().split()
    if len(parts) == 1:
        return ("", parts[0])
    return (" ".join(parts[:-1]), parts[-1])


def split_managers_field(field: str | None) -> list[str]:
    if not field:
        return []
    pieces = re.split(r"\s*/\s*", field.strip())
    return [p.strip() for p in pieces if p.strip()]


def parse_centres(xlsx_path: str) -> list[dict]:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb[SHEET_NAME]

    rows = list(ws.iter_rows(values_only=True))
    centres: list[dict] = []
    statut: str | None = None  # 'succursale' ou 'franchise', selon le header en cours

    for r in rows:
        # Skip lignes vides ou sans contenu en colonne A
        cell_a = r[0]
        if cell_a is None or (isinstance(cell_a, str) and not cell_a.strip()):
            continue
        if not isinstance(cell_a, str):
            # On force string pour comparer aux headers
            cell_a = str(cell_a)
        ca = cell_a.strip().upper()
        # Détection des headers
        if ca.startswith("SUCCURSALE"):
            statut = "succursale"
            continue
        if ca.startswith("FRANCHISE") and "ADRESSE" in str(r[1] or "").upper():
            # On distingue le header de l'entrée 'FRANCHISES' titre vs vraie data
            statut = "franchise"
            continue
        if statut is None:
            continue
        # Titre 'SUCCURSALES ET FRANCHISES' à ignorer
        if "FRANCHIS" not in ca and "SUCCURSALE" not in ca and ca == "SUCCURSALES ET FRANCHISES":
            continue

        name = cell_a.strip()
        if name.upper() == "SUCCURSALES ET FRANCHISES":
            continue

        adresse = (r[1] or "").strip() if isinstance(r[1], str) else (str(r[1]) if r[1] is not None else "")
        cp = str(r[2]).strip() if r[2] is not None else ""
        ville = (r[3] or "").strip() if isinstance(r[3], str) else (str(r[3]) if r[3] is not None else "")
        managers_field = r[4] if isinstance(r[4], str) else (str(r[4]) if r[4] else "")
        managers = split_managers_field(managers_field)

        # Override cosmétique éventuel
        clean_name = CENTRE_NAME_OVERRIDES.get(name.upper(), name)
        clean_city = CITY_OVERRIDES.get(ville, ville) if ville else None

        # Prefixe "F-" pour les centres franchise (convention demandee par
        # le client : F-DIJON, F-ARMENTIERES... pour distinguer rapidement
        # franchise vs succursale dans la liste `locations`).
        if statut == "franchise" and not clean_name.startswith("F-"):
            clean_name = f"F-{clean_name}"

        centres.append({
            "name": clean_name,
            "address": adresse or None,
            "postal_code": cp or None,
            "city": clean_city,
            "managers_raw": managers_field or "",
            "managers": managers,
            "statut": statut,
        })

    return centres


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

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
        print(f"[SQL ERROR {e.code}] {e.read().decode()[:300]}", file=sys.stderr)
        raise


def supabase_admin_create_user(env: dict[str, str], email: str, user_metadata: dict) -> dict:
    body = {
        "email": email,
        "email_confirm": True,
        "user_metadata": user_metadata,
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


def fetch_existing_locations(env: dict[str, str]) -> dict[str, str]:
    rows = sql(env, "SELECT id, name FROM public.locations;")
    return {r["name"].strip().lower(): r["id"] for r in rows if r.get("name")}


def fetch_existing_users_by_email(env: dict[str, str]) -> dict[str, str]:
    rows = sql(env, "SELECT id, lower(email) AS email FROM auth.users WHERE email IS NOT NULL;")
    return {r["email"]: r["id"] for r in rows if r.get("email")}


def sql_quote(s: str) -> str:
    """Echappe une string pour l'injecter dans un littéral SQL Postgres."""
    return s.replace("'", "''")


# ---------------------------------------------------------------------------
# Plan + apply
# ---------------------------------------------------------------------------

def build_plan(env: dict[str, str], centres: list[dict]) -> dict:
    existing_locations = fetch_existing_locations(env)
    existing_users = fetch_existing_users_by_email(env)

    # Premier passage : compter combien de centres chaque manager (par email)
    # gère. Si > 1, statut "multi-centres" : pas de location_id principal.
    email_centre_count: dict[str, int] = {}
    for c in centres:
        for full_name in c["managers"]:
            prenom, nom = split_full_name(full_name)
            if not nom:
                continue
            email = compute_email(prenom, nom, full_name)
            email_centre_count[email] = email_centre_count.get(email, 0) + 1

    plan_centres: list[dict] = []
    # Dedup managers : un manager (par email) ne devrait être créé qu'une fois.
    managers_to_create: dict[str, dict] = {}   # email -> {prenom, nom, role, statut, location_name}
    managers_to_promote: dict[str, dict] = {}  # email -> {existing_id, role, statut, location_name}

    for c in centres:
        loc_id = existing_locations.get(c["name"].strip().lower())
        will_create_loc = loc_id is None

        managers_resolved: list[dict] = []
        for full_name in c["managers"]:
            prenom, nom = split_full_name(full_name)
            if not nom:
                continue
            email = compute_email(prenom, nom, full_name)
            if not email or "@" not in email:
                continue
            role_db = "gerant_franchise" if c["statut"] == "franchise" else "manager"
            is_multi = email_centre_count.get(email, 0) > 1

            existing_user_id = existing_users.get(email)
            if existing_user_id:
                # Promotion d'un profil existant (on premier centre rencontré garde priorité).
                if email not in managers_to_promote:
                    managers_to_promote[email] = {
                        "id": existing_user_id,
                        "prenom": prenom,
                        "nom": nom,
                        "role": role_db,
                        "statut": c["statut"],
                        "first_centre_name": c["name"],
                        "multi_centres": is_multi,
                    }
            else:
                if email not in managers_to_create:
                    managers_to_create[email] = {
                        "prenom": prenom,
                        "nom": nom,
                        "role": role_db,
                        "statut": c["statut"],
                        "first_centre_name": c["name"],
                        "multi_centres": is_multi,
                    }

            managers_resolved.append({
                "full_name": full_name,
                "email": email,
                "prenom": prenom,
                "nom": nom,
                "role": role_db,
                "user_id_if_existing": existing_user_id,
            })

        plan_centres.append({
            **c,
            "existing_location_id": loc_id,
            "will_create_location": will_create_loc,
            "managers_resolved": managers_resolved,
        })

    return {
        "centres": plan_centres,
        "managers_to_create": managers_to_create,
        "managers_to_promote": managers_to_promote,
        "existing_locations": existing_locations,
    }


def print_summary(plan: dict) -> None:
    centres = plan["centres"]
    succ = [c for c in centres if c["statut"] == "succursale"]
    franc = [c for c in centres if c["statut"] == "franchise"]
    print("==== PLAN ====")
    print(f"  Centres trouvés dans l'Excel        : {len(centres)} ({len(succ)} succursales, {len(franc)} franchises)")
    print(f"  Centres déjà dans `locations`       : {sum(1 for c in centres if not c['will_create_location'])}")
    print(f"  Centres à créer                      : {sum(1 for c in centres if c['will_create_location'])}")
    print(f"  Managers/gérants à créer             : {len(plan['managers_to_create'])}")
    print(f"  Managers/gérants à promouvoir        : {len(plan['managers_to_promote'])}")
    print()
    print("==== Centres à créer (10 premiers) ====")
    to_create_locs = [c for c in centres if c["will_create_location"]]
    for c in to_create_locs[:10]:
        print(f"  [{c['statut']:10s}] {c['name']:30s} | {c['city'] or '?':20s} | mgrs: {', '.join(m['email'] for m in c['managers_resolved'])}")
    if len(to_create_locs) > 10:
        print(f"  ... +{len(to_create_locs) - 10} autres")
    print()
    print("==== Managers à créer ====")
    for email, m in list(plan["managers_to_create"].items())[:20]:
        flag = " [MULTI-CENTRES -> location_id=NULL]" if m.get("multi_centres") else ""
        print(f"  {email:40s} role={m['role']:18s} centre principal: {m['first_centre_name']}{flag}")
    if len(plan["managers_to_create"]) > 20:
        print(f"  ... +{len(plan['managers_to_create']) - 20} autres")
    print()
    print("==== Managers à promouvoir ====")
    for email, m in list(plan["managers_to_promote"].items())[:20]:
        flag = " [MULTI -> NULL]" if m.get("multi_centres") else ""
        print(f"  {email:40s} -> role={m['role']:18s} centre principal: {m['first_centre_name']}{flag}")
    if len(plan["managers_to_promote"]) > 20:
        print(f"  ... +{len(plan['managers_to_promote']) - 20} autres")
    multi = [e for e, m in {**plan["managers_to_create"], **plan["managers_to_promote"]}.items() if m.get("multi_centres")]
    if multi:
        print()
        print(f"==== Managers MULTI-CENTRES (location_id = NULL) : {len(multi)} ====")
        for e in multi:
            print(f"  - {e}")


def apply_plan(env: dict[str, str], plan: dict) -> None:
    # 1. Créer les locations manquantes
    print("\n=== 1. Création locations manquantes ===")
    location_ids_by_name: dict[str, str] = dict(plan["existing_locations"])
    def _nq(v):
        return "NULL" if v is None else "'" + sql_quote(str(v)) + "'"
    for c in plan["centres"]:
        if not c["will_create_location"]:
            continue
        ins_sql = (
            "INSERT INTO public.locations (name, address, city, postal_code, is_active) "
            f"VALUES ('{sql_quote(c['name'])}', "
            f"{_nq(c['address'])}, "
            f"{_nq(c['city'])}, "
            f"{_nq(c['postal_code'])}, "
            "true) RETURNING id, name;"
        )
        result = sql(env, ins_sql)
        if result:
            new_id = result[0]["id"]
            location_ids_by_name[c["name"].strip().lower()] = new_id
            print(f"  + {c['name']:30s} -> {new_id[:8]}")

    # 2. Créer les profils managers/gérants manquants
    print("\n=== 2. Création managers/gérants manquants ===")
    created_count = 0
    for email, m in plan["managers_to_create"].items():
        try:
            user = supabase_admin_create_user(env, email, {
                "first_name": m["prenom"],
                "last_name": m["nom"],
                "role": m["role"],
                "source": "import_centres",
            })
            uid = user["id"]
            # Update du profil créé par le trigger handle_new_user
            # Multi-centres → location_id reste NULL (statut spécial, pas de centre d'attache).
            if m.get("multi_centres"):
                loc_sql = "NULL"
            else:
                location_id = location_ids_by_name.get(m["first_centre_name"].strip().lower())
                loc_sql = f"'{location_id}'" if location_id else "NULL"
            upd_sql = (
                f"UPDATE public.profiles SET "
                f"first_name = '{sql_quote(m['prenom'])}', "
                f"last_name  = '{sql_quote(m['nom'])}', "
                f"role       = '{m['role']}'::user_role, "
                f"statut     = '{m['statut']}', "
                f"location_id = {loc_sql}, "
                f"is_active  = false "
                f"WHERE id = '{uid}';"
            )
            sql(env, upd_sql)
            created_count += 1
            time.sleep(0.1)
        except error.HTTPError as e:
            print(f"  [ERREUR] {email}: HTTP {e.code} {e.read().decode()[:120]}", file=sys.stderr)
        except Exception as e:  # noqa
            print(f"  [ERREUR] {email}: {e}", file=sys.stderr)
    print(f"  + {created_count}/{len(plan['managers_to_create'])} managers créés")

    # 3. Promouvoir les profils existants
    print("\n=== 3. Promotion managers/gérants existants ===")
    promoted = 0
    for email, m in plan["managers_to_promote"].items():
        # Multi-centres : on ne touche PAS au location_id (les managers
        # multi-sites n'ont pas de centre d'attache, ils gèrent plusieurs
        # centres). Sinon, on set le location_id si pas déjà présent (COALESCE).
        if m.get("multi_centres"):
            upd_sql = (
                f"UPDATE public.profiles SET "
                f"role = '{m['role']}'::user_role, "
                f"statut = '{m['statut']}', "
                f"location_id = NULL "
                f"WHERE id = '{m['id']}' AND role NOT IN ('super_admin');"
            )
        else:
            location_id = location_ids_by_name.get(m["first_centre_name"].strip().lower())
            loc_sql = f"'{location_id}'" if location_id else "NULL"
            upd_sql = (
                f"UPDATE public.profiles SET "
                f"role = '{m['role']}'::user_role, "
                f"statut = '{m['statut']}', "
                f"location_id = COALESCE(location_id, {loc_sql}) "
                f"WHERE id = '{m['id']}' AND role NOT IN ('super_admin');"
            )
        try:
            sql(env, upd_sql)
            promoted += 1
        except Exception as e:  # noqa
            print(f"  [ERREUR promote] {email}: {e}", file=sys.stderr)
    print(f"  + {promoted}/{len(plan['managers_to_promote'])} promus")

    # 4. Pour chaque centre, attribuer manager_id aux salariés (formation_user)
    #    qui ont location_id = ce centre. On choisit le PREMIER manager.
    print("\n=== 4. Attribution manager_id aux salariés (1er manager du centre) ===")
    attributed = 0
    for c in plan["centres"]:
        if not c["managers_resolved"]:
            continue
        loc_id = location_ids_by_name.get(c["name"].strip().lower())
        if not loc_id:
            continue
        first_mgr = c["managers_resolved"][0]
        # Récupérer l'ID du 1er manager (création vient juste d'avoir lieu)
        mgr_email = first_mgr["email"]
        row = sql(env, f"SELECT id FROM auth.users WHERE lower(email) = '{sql_quote(mgr_email)}' LIMIT 1;")
        if not row:
            continue
        mgr_id = row[0]["id"]
        # Attribuer aux salariés statut=franchise (les seuls qui ont besoin
        # d'un manager pour s'inscrire en formation). Pour les succursale,
        # on attribue aussi (le manager succ peut gérer ses workers normaux).
        target_role = "formation_user" if c["statut"] == "franchise" else "worker"
        upd_sql = (
            f"UPDATE public.profiles SET manager_id = '{mgr_id}' "
            f"WHERE role = '{target_role}'::user_role "
            f"AND location_id = '{loc_id}' "
            f"AND (manager_id IS NULL OR manager_id <> '{mgr_id}') "
            f"AND id <> '{mgr_id}';"
        )
        try:
            sql(env, upd_sql)
            attributed += 1
        except Exception as e:  # noqa
            print(f"  [ERREUR attrib] {c['name']}: {e}", file=sys.stderr)
    print(f"  + manager_id attribué pour {attributed} centres")

    print("\n==== APPLY TERMINÉ ====")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Effectue les modifications (sans ce flag : dry-run).")
    args = parser.parse_args()

    env = load_env()
    centres = parse_centres(XLSX_PATH)
    print(f"Centres parsés depuis l'Excel : {len(centres)}")
    plan = build_plan(env, centres)
    print_summary(plan)

    if args.apply:
        print("\n=== APPLY MODE ===")
        apply_plan(env, plan)
    else:
        print("\n=== DRY RUN — aucune écriture en base. Pour appliquer : --apply ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
