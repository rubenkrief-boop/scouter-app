ALTER TABLE public.formation_ateliers DROP CONSTRAINT IF EXISTS formation_ateliers_etat_check;
ALTER TABLE public.formation_ateliers ADD CONSTRAINT formation_ateliers_etat_check CHECK (etat IN (E'Termin\u00E9', 'En cours', E'Pas commenc\u00E9'));
