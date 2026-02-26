-- ============================================
-- Migration 00016: Ajout des 21 modules commerciaux / administratifs
-- Numerotation 01-21 en miroir des modules techniques
-- ============================================

INSERT INTO public.modules (code, name, icon, color, sort_order) VALUES
  ('01', 'Tenu et entretien du centre', '👕', '#D32F2F', 24),
  ('02', 'Accueil des clients', '🔔', '#1976D2', 25),
  ('03', 'Accueil telephonique', '🌹', '#388E3C', 26),
  ('04', 'Discours commercial VivaSon', '🔮', '#7B1FA2', 27),
  ('05', 'Remboursements securite sociale et mutuelles', '📚', '#F57C00', 28),
  ('06', 'Relationnel avec l''audioprothesiste', '📱', '#00838F', 29),
  ('07', 'Cosium', '📊', '#303F9F', 30),
  ('08', 'Gestion tiers payants', '🔗', '#5D4037', 31),
  ('09', 'Livraison', '💎', '#0097A7', 32),
  ('10', 'Franfinance', '💳', '#C2185B', 33),
  ('11', 'Garantie VivaSon 4 ans', '🛡️', '#455A64', 34),
  ('12', 'Ventes additionnelles', '🌱', '#689F38', 35),
  ('13', 'Manipulation labo', '⚡', '#E64A19', 36),
  ('14', 'Commandes fournisseurs', '🧳', '#512DA8', 37),
  ('15', 'Remise en banque et courrier', '📦', '#00796B', 38),
  ('16', 'Gestion du stock', '⚠️', '#AFB42B', 39),
  ('17', 'Relances clients', '🔔', '#0288D1', 40),
  ('18', 'Tableau de suivi de CA', '✏️', '#FF8F00', 41),
  ('19', 'Avis Google', '🖥️', '#4527A0', 42),
  ('20', 'Teletransmission des rdv de suivi', '⚠️', '#C0CA33', 43),
  ('21', 'RGPD & 100% sante', '🔐', '#00695C', 44);
