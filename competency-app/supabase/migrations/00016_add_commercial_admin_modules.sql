-- ============================================
-- Migration 00016: Ajout des 21 modules commerciaux / administratifs
-- ============================================

INSERT INTO public.modules (code, name, icon, color, sort_order) VALUES
  ('24', 'Tenu et entretien du centre', '👕', '#D32F2F', 24),
  ('25', 'Accueil des clients', '🔔', '#1976D2', 25),
  ('26', 'Accueil telephonique', '🌹', '#388E3C', 26),
  ('27', 'Discours commercial VivaSon', '🔮', '#7B1FA2', 27),
  ('28', 'Remboursements securite sociale et mutuelles', '📚', '#F57C00', 28),
  ('29', 'Relationnel avec l''audioprothesiste', '📱', '#00838F', 29),
  ('30', 'Cosium', '📊', '#303F9F', 30),
  ('31', 'Gestion tiers payants', '🔗', '#5D4037', 31),
  ('32', 'Livraison', '💎', '#0097A7', 32),
  ('33', 'Franfinance', '💳', '#C2185B', 33),
  ('34', 'Garantie VivaSon 4 ans', '🛡️', '#455A64', 34),
  ('35', 'Ventes additionnelles', '🌱', '#689F38', 35),
  ('36', 'Manipulation labo', '⚡', '#E64A19', 36),
  ('37', 'Commandes fournisseurs', '🧳', '#512DA8', 37),
  ('38', 'Remise en banque et courrier', '📦', '#00796B', 38),
  ('39', 'Gestion du stock', '⚠️', '#AFB42B', 39),
  ('40', 'Relances clients', '🔔', '#0288D1', 40),
  ('41', 'Tableau de suivi de CA', '✏️', '#FF8F00', 41),
  ('42', 'Avis Google', '🖥️', '#4527A0', 42),
  ('43', 'Teletransmission des rdv de suivi', '⚠️', '#C0CA33', 43),
  ('44', 'RGPD & 100% sante', '🔐', '#00695C', 44);
