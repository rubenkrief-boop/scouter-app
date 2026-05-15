"""Backfill de la table `centre_managers` depuis l'Excel.

Pour chaque centre dans l'Excel, on insere (manager_id, location_id) pour
chacun de ses managers/gerants listes. Premier listé = is_primary.

Prerequis : migration 00031 appliquee. Le script `import_centres_with_managers.py`
doit aussi avoir tourne avant (pour que tous les profils existent en base
avec le bon email vivason.fr).

Usage :
  python supabase/seeds/backfill_centre_managers.py            # dry-run
  python supabase/seeds/backfill_centre_managers.py --apply    # ecrit en base
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

# On reutilise les helpers de l'autre script
spec = importlib.util.spec_from_file_location(
    "imp", str(Path(__file__).parent / "import_centres_with_managers.py")
)
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Ecrit en base (sinon dry-run)")
    args = parser.parse_args()

    env = mod.load_env()
    centres = mod.parse_centres(mod.XLSX_PATH)
    existing_users = mod.fetch_existing_users_by_email(env)
    existing_locations = mod.fetch_existing_locations(env)

    rows_to_insert: list[tuple[str, str, bool]] = []  # (manager_id, location_id, is_primary)
    missing_user: list[str] = []
    missing_loc: list[str] = []

    for c in centres:
        loc_id = existing_locations.get(c["name"].strip().lower())
        if not loc_id:
            missing_loc.append(c["name"])
            continue
        for idx, full_name in enumerate(c["managers"]):
            prenom, nom = mod.split_full_name(full_name)
            if not nom:
                continue
            email = mod.compute_email(prenom, nom, full_name)
            uid = existing_users.get(email)
            if not uid:
                missing_user.append(f"{c['name']} -> {email}")
                continue
            rows_to_insert.append((uid, loc_id, idx == 0))

    # Dedup : (manager_id, location_id) unique. On garde is_primary=True si au
    # moins une apparition l'est.
    dedup: dict[tuple[str, str], bool] = {}
    for mgr, loc, primary in rows_to_insert:
        key = (mgr, loc)
        if key in dedup:
            dedup[key] = dedup[key] or primary
        else:
            dedup[key] = primary

    print(f"==== PLAN BACKFILL centre_managers ====")
    print(f"  Couples (gerant, centre) a inserer : {len(dedup)}")
    print(f"  Dont primary=true                  : {sum(1 for v in dedup.values() if v)}")
    print(f"  Profils manquants en base          : {len(missing_user)}")
    if missing_user:
        for m in missing_user[:10]:
            print(f"    - {m}")
        if len(missing_user) > 10:
            print(f"    ... +{len(missing_user) - 10}")
    print(f"  Locations manquantes en base       : {len(missing_loc)}")
    if missing_loc:
        for m in missing_loc:
            print(f"    - {m}")

    if not args.apply:
        print()
        print("=== DRY RUN. Pour appliquer : --apply ===")
        return 0

    # Apply : INSERT en lot, ON CONFLICT DO NOTHING (idempotent).
    if not dedup:
        print("Rien a inserer.")
        return 0

    values_sql = ",\n".join(
        f"('{mgr}'::uuid, '{loc}'::uuid, {str(primary).lower()})"
        for (mgr, loc), primary in dedup.items()
    )
    ins_sql = f"""
INSERT INTO public.centre_managers (manager_id, location_id, is_primary)
VALUES
{values_sql}
ON CONFLICT (manager_id, location_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
RETURNING manager_id, location_id;
"""
    ret = mod.sql(env, ins_sql)
    print(f"\n=== APPLY : {len(ret)} couples inseres/updates ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
