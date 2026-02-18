-- ============================================
-- Seed Data: Modules, Competencies, Qualifiers
-- ============================================

-- 23 Modules audioprothesie
INSERT INTO public.modules (code, name, icon, color, sort_order) VALUES
  ('01', 'Audiometrie Tonale', '🔊', '#E91E63', 1),
  ('02', 'Audiometrie Vocale', '🗣️', '#FF5722', 2),
  ('03', 'Reglages & Fabricants', '⚙️', '#F44336', 3),
  ('04', 'Logique de Reglage', '💗', '#3F51B5', 4),
  ('05', 'Plaquette Tarifaire', '🐸', '#4CAF50', 5),
  ('06', 'Formule de Pre-Reglage', '📐', '#9C27B0', 6),
  ('07', 'MPO & Compression', '📊', '#00BCD4', 7),
  ('08', 'Directivite', '🎯', '#FF9800', 8),
  ('09', 'Retouches Labo', '🔧', '#795548', 9),
  ('10', 'Accessoires', '🖥️', '#607D8B', 10),
  ('11', 'Process Audios', '🎵', '#673AB7', 11),
  ('12', 'ORL', '🎬', '#009688', 12),
  ('13', 'Compression Frequentielle', '💾', '#CDDC39', 13),
  ('14', 'Chaine de Mesure', '🏵️', '#FFC107', 14),
  ('15', 'Mesure In Vivo', '🎛️', '#8BC34A', 15),
  ('16', 'Acouphenes', '🌫️', '#E040FB', 16),
  ('17', 'Applications', '📱', '#2196F3', 17),
  ('18', 'Reglage a Distance', '🌐', '#00E676', 18),
  ('19', 'Commande Numerique', '🛒', '#FF6E40', 19),
  ('20', 'Prise d''Empreinte', '👂', '#FFAB40', 20),
  ('21', 'Rangement et Organisation', '📦', '#69F0AE', 21),
  ('22', 'Appareillage de l''Enfant', '👶', '#EA80FC', 22),
  ('23', 'Memoire de l''Etudiant', '📝', '#80D8FF', 23);

-- ============================================
-- Competencies per module (from real data)
-- ============================================

-- Module 01 - Audiometrie Tonale
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Courbe Osseuse (CO)', 1),
  ('Gain prothetique tonal', 2),
  ('Masquage de l''oreille controlaterale', 3),
  ('Stereo-equilibrage', 4),
  ('Test d''inconfort - UCL / SSI', 5),
  ('Test de Weber', 6)
) AS c(name, sort_order)
WHERE m.code = '01';

-- Module 02 - Audiometrie Vocale
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Gain prothetique vocal dans le bruit', 1),
  ('Gain prothetique vocal dans le calme', 2),
  ('Les listes vocales', 3),
  ('Masquage de l''oreille controlaterale', 4),
  ('Reconnaissance et lecture de la vocale pour un appareillage', 5),
  ('Vocale en champ libre dans le calme et le bruit', 6),
  ('Vocales au casque', 7)
) AS c(name, sort_order)
WHERE m.code = '02';

-- Module 03 - Reglages & Fabricants
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Adaptation physique + Choix des domes & events', 1),
  ('Gestion de la resonance', 2),
  ('Maitrise des algorithmes ReSound', 3),
  ('Maitrise des algorithmes Signia', 4),
  ('Maitrise des algorithmes Starkey', 5)
) AS c(name, sort_order)
WHERE m.code = '03';

-- Module 04 - Logique de Reglage
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Lecture et gestion du gain critique', 1),
  ('Prise en compte dome/event pour l''In Situ', 2),
  ('Test In Situ', 3),
  ('Utilisation appropriee des traitements de signaux', 4)
) AS c(name, sort_order)
WHERE m.code = '04';

-- Module 05 - Plaquette Tarifaire
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Montee en gamme fabricant', 1),
  ('Utilisation de la plaquette', 2)
) AS c(name, sort_order)
WHERE m.code = '05';

-- Module 06 - Formule de Pre-Reglage
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('DSL v5', 1),
  ('Formules fabricants', 2),
  ('NAL NL1', 3),
  ('NAL NL2', 4)
) AS c(name, sort_order)
WHERE m.code = '06';

-- Module 07 - MPO & Compression
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Ajustement MPO', 1),
  ('Calcul de la dynamique residuelle (CK)', 2),
  ('Prise en compte du dome / embout', 3)
) AS c(name, sort_order)
WHERE m.code = '07';

-- Module 08 - Directivite
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Choix du mode microphonique CROS/BiCROS/TriCROS', 1),
  ('Reglage d''une perte asymetrique', 2)
) AS c(name, sort_order)
WHERE m.code = '08';

-- Module 09 - Retouches Labo
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Connaissance du materiel', 1),
  ('Modification pare cerumen', 2),
  ('Realisation d''un custom / double custom / rainurage', 3),
  ('Retouches embouts', 4),
  ('Retouches intras', 5)
) AS c(name, sort_order)
WHERE m.code = '09';

-- Module 10 - Accessoires
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Microphone + / Microphone de table', 1),
  ('Multimic', 2),
  ('Phoneclip +', 3),
  ('Streamline MIC', 4),
  ('Streamline TV', 5),
  ('TV streamer', 6),
  ('Unite TV2/TV streamer +', 7)
) AS c(name, sort_order)
WHERE m.code = '10';

-- Module 11 - Process Audios
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Anamnese', 1),
  ('Note Noah et suivi des anciennes sessions', 2),
  ('Otoscopie (video-otoscope)', 3),
  ('Verifier les appareils : ecoute et nettoyage', 4)
) AS c(name, sort_order)
WHERE m.code = '11';

-- Module 12 - ORL
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Acquisition de l''ORL referent du centre', 1),
  ('Compte rendu + suivi sur tableau de CA', 2),
  ('Courriers d''adressages et correspondances', 3)
) AS c(name, sort_order)
WHERE m.code = '12';

-- Module 13 - Compression Frequentielle
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Reconnaissance ZMC Profil 1 & 2', 1),
  ('Reglage Fc, Fmin et Fmax', 2),
  ('Reglage si CF impossible ou mal supportee', 3),
  ('Reglage SoundShaper et Duplication frequentielle', 4)
) AS c(name, sort_order)
WHERE m.code = '13';

-- Module 14 - Chaine de Mesure
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Lecture des resultats', 1),
  ('Preparation et mise en place des appareils', 2),
  ('Realisation d''une mesure (OSPL 90, Gain max...)', 3)
) AS c(name, sort_order)
WHERE m.code = '14';

-- Module 15 - Mesure In Vivo
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Configuration de la cible', 1),
  ('Lecture des courbes (REUG, REOG, REIG)', 2),
  ('Mise en pratique', 3),
  ('Placement du patient', 4),
  ('Preparation et mise en place des sondes', 5),
  ('Protocole IMC2', 6),
  ('Reglage a partir des resultats', 7),
  ('Signaux de test', 8)
) AS c(name, sort_order)
WHERE m.code = '15';

-- Module 16 - Acouphenes
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Reglage du Generateur de bruit et du TIL chez Signia', 1),
  ('Reglage du Tinnitus chez Starkey', 2),
  ('Reglage du TSG chez ReSound', 3),
  ('THI et realisation d''une acouphenometrie', 4)
) AS c(name, sort_order)
WHERE m.code = '16';

-- Module 17 - Applications
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Signia App', 1),
  ('Smart 3D', 2),
  ('Thrive & MyStarkey', 3)
) AS c(name, sort_order)
WHERE m.code = '17';

-- Module 18 - Reglage a Distance
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Reglage a distance Resound Assist', 1),
  ('Reglage a distance Telecare', 2),
  ('Reglage a distance TeleHear', 3)
) AS c(name, sort_order)
WHERE m.code = '18';

-- Module 19 - Commande Numerique
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Connaissance des bons de commandes', 1),
  ('Ebusiness', 2),
  ('Pro.Resound', 3),
  ('StarkeyPro', 4),
  ('Utilisation du scanner, export & decryptage', 5)
) AS c(name, sort_order)
WHERE m.code = '19';

-- Module 20 - Prise d'Empreinte
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Empreinte conduit opere', 1),
  ('Empreinte profonde', 2),
  ('Hygiene & Entretien du materiel', 3),
  ('Placement et verification du coton', 4),
  ('Seringue ou pistolet', 5)
) AS c(name, sort_order)
WHERE m.code = '20';

-- Module 21 - Rangement et Organisation
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Organisation et archivage des dossiers patients', 1),
  ('Rangement du centre', 2),
  ('Tenue de la vitrine', 3)
) AS c(name, sort_order)
WHERE m.code = '21';

-- Module 22 - Appareillage de l'Enfant
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Audiometrie comportementale adaptee', 1),
  ('Choix de l''appareillage', 2),
  ('Communication avec la famille', 3),
  ('Empreinte et adaptation physique', 4),
  ('Reglage specifique pediatrique', 5),
  ('Suivi et accompagnement', 6)
) AS c(name, sort_order)
WHERE m.code = '22';

-- Module 23 - Memoire de l'Etudiant
INSERT INTO public.competencies (module_id, name, sort_order)
SELECT m.id, c.name, c.sort_order
FROM public.modules m,
(VALUES
  ('Avancement du memoire', 1),
  ('Choix du sujet et problematique', 2),
  ('Presentation et soutenance', 3),
  ('Qualite de la redaction', 4),
  ('Recherche bibliographique', 5)
) AS c(name, sort_order)
WHERE m.code = '23';

-- ============================================
-- Qualifiers
-- ============================================
INSERT INTO public.qualifiers (name, qualifier_type, sort_order) VALUES
  ('Maitrise', 'single_choice', 1),
  ('Validation', 'single_choice', 2),
  ('Application', 'single_choice', 3),
  ('Evolution', 'single_choice', 4),
  ('Mise en pratique', 'single_choice', 5);

-- Qualifier Options for Maitrise
INSERT INTO public.qualifier_options (qualifier_id, label, value, sort_order)
SELECT q.id, o.label, o.value, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('Pas du tout', 0, 1),
  ('Assez bien', 0.5, 2),
  ('Tres bien', 0.75, 3),
  ('Parfaitement', 1.0, 4)
) AS o(label, value, sort_order)
WHERE q.name = 'Maitrise';

-- Qualifier Options for Validation
INSERT INTO public.qualifier_options (qualifier_id, label, value, sort_order)
SELECT q.id, o.label, o.value, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('Non valide', 0, 1),
  ('Valide', 1.0, 2)
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

-- Qualifier Options for Evolution
INSERT INTO public.qualifier_options (qualifier_id, label, value, icon, sort_order)
SELECT q.id, o.label, o.value, o.icon, o.sort_order
FROM public.qualifiers q,
(VALUES
  ('En baisse', 0, 'arrow-down', 1),
  ('Stable', 0.5, 'equal', 2),
  ('En progression', 1.0, 'arrow-up', 3)
) AS o(label, value, icon, sort_order)
WHERE q.name = 'Evolution';

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

-- ============================================
-- Default Job Profile
-- ============================================
INSERT INTO public.job_profiles (name, description) VALUES
  ('Audioprothesiste', 'Profil standard d''un audioprothesiste en enseigne');

-- Set expected scores for each module (default 70%)
INSERT INTO public.job_profile_competencies (job_profile_id, module_id, expected_score)
SELECT jp.id, m.id, 70
FROM public.job_profiles jp, public.modules m
WHERE jp.name = 'Audioprothesiste' AND m.parent_id IS NULL;
