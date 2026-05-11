-- ============================================
-- Migration 00026: Email allowlist (couche 2 par dessus la domain restriction)
--
-- Avant : tout email @vivason.fr ou @vivason.ma pouvait se connecter et
-- voyait un profil cree automatiquement par le trigger handle_new_user.
-- Probleme : un ancien collaborateur dont le compte Google n'est pas
-- supprime peut toujours acceder a SCOUTER apres son depart.
--
-- Solution : table email_allowlist contrôlee par super_admin. Le auth
-- callback verifie que l'email y figure (et est actif) avant de laisser
-- l'utilisateur entrer. Defense en profondeur sur la domain restriction.
--
-- Backfill : tous les emails actuellement dans profiles sont ajoutes pour
-- ne verrouiller personne au deploiement.
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_allowlist (
  email               TEXT PRIMARY KEY CHECK (email = lower(email)),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  added_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_allowlist_active
  ON public.email_allowlist(email) WHERE is_active = true;

-- Backfill depuis profiles
INSERT INTO public.email_allowlist (email, notes, added_at)
SELECT lower(email),
       'Backfill - compte existant au moment de la migration',
       now()
FROM public.profiles
WHERE email IS NOT NULL
  AND email <> ''
  AND lower(email) NOT IN (SELECT email FROM public.email_allowlist)
ON CONFLICT (email) DO NOTHING;

-- Helper utilisable depuis le auth callback (qui tourne avec service role
-- mais on garde la fonction pour de futurs callers RLS-aware).
CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_allowlist
    WHERE email = lower(p_email) AND is_active = true
  );
$$;

-- RLS : seuls les super_admin lisent/ecrivent la table
ALTER TABLE public.email_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage allowlist" ON public.email_allowlist;
CREATE POLICY "Super admins manage allowlist" ON public.email_allowlist
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- Verification post-migration
SELECT
  count(*) FILTER (WHERE is_active = true)  AS actifs,
  count(*) FILTER (WHERE is_active = false) AS inactifs,
  count(*)                                   AS total
FROM public.email_allowlist;
