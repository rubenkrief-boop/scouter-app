-- ============================================
-- Seed Data: Modules, Qualifiers, Options
-- ============================================

-- 23 Modules audioprothésie
INSERT INTO public.modules (code, name, icon, color, sort_order) VALUES
  ('01', 'Audiométrie Tonale', '🔊', '#E91E63', 1),
  ('02', 'Audiométrie Vocale', '🗣️', '#FF5722', 2),
  ('03', 'Réglages & Fabricants', '⚙️', '#F44336', 3),
  ('04', 'Logique de Réglage', '🧠', '#3F51B5', 4),
  ('05', 'Plaquette Tarifaire', '💰', '#4CAF50', 5),
  ('06', 'Formule de Pré-Réglage', '📐', '#9C27B0', 6),
  ('07', 'MPO & Compression', '📊', '#00BCD4', 7),
  ('08', 'Directivité', '🎯', '#FF9800', 8),
  ('09', 'Retouches Labo', '🔧', '#795548', 9),
  ('10', 'Accessoires', '🎧', '#607D8B', 10),
  ('11', 'Process Audios', '🎵', '#673AB7', 11),
  ('12', 'ORL', '🏥', '#009688', 12),
  ('13', 'Compression Fréquentielle', '📈', '#CDDC39', 13),
  ('14', 'Chaîne de Mesure', '🔗', '#FFC107', 14),
  ('15', 'Mesure In Vivo', '📏', '#8BC34A', 15),
  ('16', 'Acouphènes', '👂', '#E040FB', 16),
  ('17', 'Applications', '📱', '#2196F3', 17),
  ('18', 'Réglage à Distance', '🌐', '#00E676', 18),
  ('19', 'Commande Numérique', '💻', '#FF6E40', 19),
  ('20', 'Prise d''Empreinte', '✋', '#FFAB40', 20),
  ('21', 'Rangement et Organisation', '📦', '#69F0AE', 21),
  ('22', 'Appareillage de l''Enfant', '👶', '#EA80FC', 22),
  ('23', 'Mémoire de l''Étudiant', '📝', '#80D8FF', 23);

-- Sample competencies for Module 01 - Audiométrie Tonale
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Courbe Osseuse (CO)', 1),
  ('Gain prothétique tonal', 2),
  ('Masquage de l''oreille controlatérale', 3),
  ('Stéréo-équilibrage', 4),
  ('Test d''inconfort - UCL / SSI', 5),
  ('Test de Weber', 6)
) AS c(name, sort_order)
WHERE m.code = '01';

-- Sample competencies for Module 02 - Audiométrie Vocale
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Gain prothétique vocal dans le bruit', 1),
  ('Gain prothétique vocal dans le calme', 2),
  ('Les listes vocales', 3),
  ('Masquage de l''oreille controlatérale', 4),
  ('Stéréo-équilibrage vocal', 5),
  ('Test d''intelligibilité', 6),
  ('Test du seuil d''intelligibilité (SRT)', 7)
) AS c(name, sort_order)
WHERE m.code = '02';

-- Sample competencies for Module 03 - Réglages & Fabricants
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Logiciel Phonak Target', 1),
  ('Logiciel Oticon Genie', 2),
  ('Logiciel Signia Connexx', 3),
  ('Logiciel Widex Compass', 4),
  ('Logiciel Starkey Inspire', 5)
) AS c(name, sort_order)
WHERE m.code = '03';

-- Sample competencies for Module 04 - Logique de Réglage
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Analyse du besoin patient', 1),
  ('Choix de l''appareil', 2),
  ('Premier réglage', 3),
  ('Réglage fin', 4)
) AS c(name, sort_order)
WHERE m.code = '04';

-- Sample competencies for Module 05 - Plaquette Tarifaire
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Présentation des gammes', 1),
  ('Argumentation tarifaire', 2)
) AS c(name, sort_order)
WHERE m.code = '05';

-- Qualifiers
INSERT INTO public.qualifiers (name, qualifier_type, sort_order) VALUES
  ('Maîtrise', 'single_choice', 1),
  ('Validation', 'single_choice', 2),
  ('Application', 'single_choice', 3),
  ('Évolution', 'single_choice', 4),
  ('Mise en pratique', 'single_choice', 5);

-- Qualifier Options for Maîtrise
INSERT INTO public.qualifier_options (qualifier_id, label, value, sort_order)
SELECT q.id, o.label, o.value, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('Pas du tout', 0, 1),
  ('Assez bien', 0.5, 2),
  ('Très bien', 0.75, 3),
  ('Parfaitement', 1.0, 4)
) AS o(label, value, sort_order)
WHERE q.name = 'Maîtrise';

-- Qualifier Options for Validation
INSERT INTO public.qualifier_options (qualifier_id, label, value, sort_order)
SELECT q.id, o.label, o.value, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('Non validé', 0, 1),
  ('Validé', 1.0, 2)
) AS o(label, value, sort_order)
WHERE q.name = 'Validation';

-- Qualifier Options for Application
INSERT INTO public.qualifier_options (qualifier_id, label, value, sort_order)
SELECT q.id, o.label, o.value, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('Jamais', 0, 1),
  ('Rarement', 0.25, 2),
  ('Parfois', 0.5, 3),
  ('Toujours', 1.0, 4)
) AS o(label, value, sort_order)
WHERE q.name = 'Application';

-- Qualifier Options for Évolution
INSERT INTO public.qualifier_options (qualifier_id, label, value, icon, sort_order)
SELECT q.id, o.label, o.value, o.icon, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('En baisse', 0, 'arrow-down', 1),
  ('Stable', 0.5, 'equal', 2),
  ('En progression', 1.0, 'arrow-up', 3)
) AS o(label, value, icon, sort_order)
WHERE q.name = 'Évolution';

-- Qualifier Options for Mise en pratique
INSERT INTO public.qualifier_options (qualifier_id, label, value, sort_order)
SELECT q.id, o.label, o.value, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('Jamais', 0, 1),
  ('Rarement', 0.25, 2),
  ('Parfois', 0.5, 3),
  ('Toujours', 1.0, 4)
) AS o(label, value, sort_order)
WHERE q.name = 'Mise en pratique';

-- Default Job Profile: Audioprothésiste
INSERT INTO public.job_profiles (name, description) VALUES
  ('Audioprothésiste', 'Profil standard d''un audioprothésiste en enseigne');

-- Set expected scores for each module (default 70%)
INSERT INTO public.job_profile_competencies (job_profile_id, module_id, expected_score)
SELECT jp.id, m.id, 70
FROM public.job_profiles jp, public.modules m
WHERE jp.name = 'Audioprothésiste' AND m.parent_id IS NULL;
