# Accord de Traitement des Données — Scouter

**Article 28 du RGPD (Règlement UE 2016/679)**

**Version 1.0 — applicable au 12 mai 2026**

---

## ENTRE LES SOUSSIGNÉS

**Le Responsable de traitement** ("le Client")

> [À compléter : Dénomination, forme juridique, SIRET, adresse, représenté par Nom/Prénom/qualité]

**ET**

**Le Sous-traitant** ("l'Éditeur")

> [À compléter : Dénomination de l'Éditeur de Scouter, SIRET, adresse, représenté par Nom/Prénom/qualité]

---

## ARTICLE 1. OBJET

Le présent accord (ci-après le « DPA ») a pour objet de définir les conditions dans lesquelles l'Éditeur, agissant en qualité de **sous-traitant** au sens de l'article 28 du RGPD, est autorisé à traiter pour le compte du Client, **responsable de traitement**, des données à caractère personnel dans le cadre de l'utilisation de la plateforme **Scouter** (évaluation continue des compétences, suivi des formations, planification des visites multi-sites).

Il complète les Conditions Générales d'Utilisation acceptées par le Client et accessibles depuis l'application.

---

## ARTICLE 2. DESCRIPTION DU TRAITEMENT

| Élément | Description |
|---|---|
| **Nature du traitement** | Hébergement et traitement de données RH relatives aux collaborateurs du Client : évaluations continues de compétences, scores par module/qualifieur, commentaires manager, formations suivies, planification des visites de centres |
| **Finalité** | Permettre au Client de gérer et améliorer les compétences de ses collaborateurs, suivre leur progression, coordonner les formations et la couverture multi-sites |
| **Durée du traitement** | Durée du contrat commercial. Conservation des évaluations 5 ans après leur date (cf. politique de confidentialité). Profils anonymisés 3 ans après départ du collaborateur. |
| **Catégories de personnes concernées** | Collaborateurs du Client (audioprothésistes, assistants, managers, responsables d'agence) — utilisateurs autorisés de la plateforme |
| **Catégories de données traitées** | Identité (nom, prénom, email professionnel), coordonnées professionnelles, photo de profil (avatar OAuth), poste occupé, manager direct, centre de rattachement, scores et résultats d'évaluation, commentaires d'évaluation, inscriptions et présence aux formations |
| **Données sensibles** | Aucune au sens de l'article 9 du RGPD (pas de santé, religion, syndicat). Les évaluations contiennent toutefois des appréciations subjectives sur les performances professionnelles — à traiter avec la même prudence. |

---

## ARTICLE 3. OBLIGATIONS DE L'ÉDITEUR (SOUS-TRAITANT)

L'Éditeur s'engage à :

1. Traiter les données **uniquement pour la finalité décrite à l'article 2** et conformément aux instructions documentées du Client (incluant le présent DPA et les CGU).

2. Garantir la **confidentialité** des données traitées et veiller à ce que les personnes autorisées à les traiter (employés, prestataires) s'engagent au secret professionnel et reçoivent la formation nécessaire à la protection des données.

3. Mettre en œuvre les **mesures techniques et organisationnelles** suivantes (art. 32 RGPD) :
   - Authentification OAuth 2.0 via Google Workspace, avec restriction de domaine email (allowlist organisation cliente) ;
   - Row-Level Security (RLS) Postgres : chaque utilisateur ne voit que les données auxquelles son rôle l'autorise ;
   - Trafic HTTPS uniquement (TLS 1.2+) entre navigateur, application et base de données ;
   - Mots de passe et tokens chiffrés au repos ;
   - Audit log immuable des actions administratives sensibles (création, désactivation, changement de rôle) ;
   - Logs applicatifs anonymisés (les PII des utilisateurs sont masquées avant envoi à Sentry).

4. Notifier le Client de toute **violation de données personnelles** dans un délai maximal de **48 heures** après en avoir pris connaissance, en lui fournissant toutes les informations nécessaires à sa propre notification à la CNIL (art. 33 RGPD).

5. Aider le Client à répondre aux **demandes d'exercice des droits** des personnes concernées (accès, rectification, effacement, portabilité). L'application expose à cet effet deux endpoints :
   - `/api/me/export` : export JSON des données personnelles (Art. 20 — portabilité) ;
   - `/api/me/delete` : anonymisation du profil (Art. 17 — effacement, avec rétention légale des évaluations).

6. Mettre à disposition du Client toutes les informations nécessaires pour démontrer le **respect des obligations** prévues à l'article 28 RGPD, et permettre la réalisation d'**audits**, y compris des inspections, par le Client ou un tiers mandaté.

7. À la fin du contrat, **restituer ou détruire** l'ensemble des données traitées, selon le choix du Client, dans les délais prévus à l'article 7 ci-dessous.

---

## ARTICLE 4. SOUS-SOUS-TRAITANCE

Le Client autorise expressément l'Éditeur à recourir aux **sous-sous-traitants** suivants pour les besoins du service :

| Sous-sous-traitant | Rôle | Localisation |
|---|---|---|
| **Supabase Inc.** | Base de données Postgres + authentification + storage | Singapore (siège). Région DB configurable. |
| **Vercel Inc.** | Hébergement de l'application web et infrastructure serverless | États-Unis (Covina, CA). |
| **Functional Software, Inc. (Sentry)** | Monitoring d'erreurs et de performance applicative | Région DE (Allemagne) — données EU |

L'Éditeur s'engage à informer le Client de tout changement envisagé concernant l'ajout ou le remplacement d'un sous-sous-traitant, dans un délai de **30 jours** avant le changement. Le Client dispose d'un droit d'opposition motivé pendant ce délai.

Les transferts hors UE (Vercel US, Supabase Singapore) sont encadrés par les **clauses contractuelles types** (CCT) approuvées par la Commission européenne, intégrées par défaut aux conditions de service de chaque fournisseur.

---

## ARTICLE 5. OBLIGATIONS DU CLIENT (RESPONSABLE DE TRAITEMENT)

Le Client s'engage à :

1. Documenter par écrit toute instruction donnée à l'Éditeur concernant le traitement des données.

2. Veiller à ce que les **personnes concernées** (collaborateurs évalués) aient été dûment informées du traitement, conformément aux articles 13 et 14 du RGPD, **avant** leur création dans la plateforme.

3. Recueillir le **consentement** des personnes concernées lorsque la base légale du traitement le requiert (contexte salarié : base légale = exécution du contrat de travail dans la plupart des cas).

4. Veiller à la **mise à jour régulière** de la liste des utilisateurs autorisés (allowlist email, attribution des rôles, départ des collaborateurs).

5. Conserver une **trace de l'acceptation** des présentes par sa structure (signature du DPA, acceptation des CGU dans le logiciel par chaque utilisateur).

---

## ARTICLE 6. RESPONSABILITÉ

Le manquement de l'Éditeur à ses obligations de sous-traitant engage sa responsabilité dans les conditions prévues à l'article correspondant des CGU.

Le manquement du Client à ses obligations de responsable de traitement (notamment l'absence d'information des personnes concernées, le défaut de désactivation des comptes d'anciens collaborateurs, ou des évaluations basées sur des critères discriminatoires) **dégage l'Éditeur de toute responsabilité** dans la limite du préjudice résultant directement de ce manquement.

---

## ARTICLE 7. DURÉE — RÉSILIATION

Le présent DPA prend effet à compter de sa signature et reste en vigueur pendant toute la durée du contrat commercial liant les parties.

À l'issue du contrat :

- L'Éditeur fournit au Client un **export complet** des données traitées sous un format structuré (JSON ou CSV) dans un délai de 30 jours sur demande écrite.
- Passé ce délai, l'Éditeur procède à la **destruction définitive** des données et fournit au Client une attestation de destruction sur demande.

---

## ARTICLE 8. LOI APPLICABLE

Le présent DPA est régi par le droit français et le RGPD. Tout litige relève de la juridiction compétente prévue par les CGU.

---

## SIGNATURES

| Pour le Client (Responsable de traitement) | Pour l'Éditeur (Sous-traitant) |
|---|---|
| Nom : | Nom : |
| Qualité : | Qualité : |
| Date : | Date : |
| Signature : | Signature : |
