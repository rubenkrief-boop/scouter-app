# Accord de Traitement des Données — Noah Drive Sync

**Article 28 du RGPD (Règlement UE 2016/679)**

**Version 1.0 — applicable au 8 mai 2026**

---

## ENTRE LES SOUSSIGNÉS

**Le Responsable de traitement** ("le Client")

> [À compléter : Dénomination, forme juridique, SIRET, adresse, représenté par Nom/Prénom/qualité]

**ET**

**Le Sous-traitant** ("l'Éditeur")

> [À compléter : Dénomination de l'Éditeur de Noah Drive Sync, SIRET, adresse, représenté par Nom/Prénom/qualité]

---

## ARTICLE 1. OBJET

Le présent accord (ci-après le « DPA ») a pour objet de définir les conditions dans lesquelles l'Éditeur, agissant en qualité de **sous-traitant** au sens de l'article 28 du RGPD, est autorisé à traiter pour le compte du Client, **responsable de traitement**, des données à caractère personnel dans le cadre de l'utilisation du logiciel **Noah Drive Sync**.

Il complète les Conditions Générales d'Utilisation acceptées par le Client.

---

## ARTICLE 2. DESCRIPTION DU TRAITEMENT

| Élément | Description |
|---|---|
| **Nature du traitement** | Sauvegarde mensuelle automatisée et chiffrée d'une base de données patients (Noah HIMSA) vers un espace de stockage cloud |
| **Finalité** | Permettre la restauration des données patients en cas de défaillance matérielle, logicielle ou humaine sur le poste source |
| **Durée du traitement** | Durée du contrat commercial + 30 jours pour les sauvegardes + 12 mois pour la conservation de la clé maître |
| **Catégories de personnes concernées** | Patients de l'Utilisateur (audioprothésiste) |
| **Catégories de données traitées** | Identité, coordonnées, données médicales (audiogrammes, fiches d'appareillage), données de facturation présentes dans Noah |
| **Données sensibles** | Oui (données de santé — art. 9 RGPD) |

---

## ARTICLE 3. OBLIGATIONS DE L'ÉDITEUR (SOUS-TRAITANT)

L'Éditeur s'engage à :

1. Traiter les données **uniquement pour la finalité décrite à l'article 2** et conformément aux instructions documentées du Client (incluant le présent DPA et les CGU).

2. **Ne pas transférer** les données hors de l'Union Européenne, sauf décision d'adéquation de la Commission européenne (Google Workspace : datacenters EU).

3. Garantir la **confidentialité** des données traitées et veiller à ce que les personnes autorisées à les traiter (employés, prestataires) :
   - s'engagent au secret professionnel ;
   - reçoivent la formation nécessaire à la protection des données.

4. Mettre en œuvre les **mesures techniques et organisationnelles** suivantes (art. 32 RGPD) :
   - chiffrement AES-256-GCM des sauvegardes avant upload ;
   - clé maître stockée dans un espace technique séparé, accès restreint aux personnels autorisés de l'Éditeur ;
   - authentification du Client par OAuth 2.0 (Google Workspace) sans connaissance des identifiants par l'Éditeur ;
   - journalisation locale des opérations de sauvegarde (`sync.log`) ;
   - supports de stockage hébergés par Google LLC dans des datacenters certifiés ISO 27001 et SOC 2.

5. Notifier le Client de toute **violation de données personnelles** dans un délai maximal de **48 heures** après en avoir pris connaissance, en lui fournissant toutes les informations nécessaires à sa propre notification à la CNIL (art. 33 RGPD).

6. Aider le Client à répondre aux **demandes d'exercice des droits** des personnes concernées (accès, rectification, effacement, portabilité, opposition).

7. Mettre à disposition du Client toutes les informations nécessaires pour démontrer le **respect des obligations** prévues à l'article 28 RGPD, et permettre la réalisation d'**audits**, y compris des inspections, par le Client ou un tiers mandaté.

8. À la fin du contrat, **restituer ou détruire** l'ensemble des données traitées, selon le choix du Client, dans les délais prévus à l'article 8 des CGU.

---

## ARTICLE 4. SOUS-SOUS-TRAITANCE

Le Client autorise expressément l'Éditeur à recourir aux **sous-sous-traitants** suivants pour les besoins du service :

| Sous-sous-traitant | Rôle | Localisation |
|---|---|---|
| **Google LLC (Google Workspace)** | Stockage cloud des sauvegardes chiffrées et hébergement des fichiers techniques | Datacenters Union Européenne |

L'Éditeur s'engage à informer le Client de tout changement envisagé concernant l'ajout ou le remplacement d'un sous-sous-traitant, dans un délai de 30 jours avant le changement. Le Client dispose d'un droit d'opposition motivé pendant ce délai.

---

## ARTICLE 5. OBLIGATIONS DU CLIENT (RESPONSABLE DE TRAITEMENT)

Le Client s'engage à :

1. Documenter par écrit toute instruction donnée à l'Éditeur concernant le traitement des données.

2. Veiller à ce que les **personnes concernées** (patients) aient été dûment informées du traitement, conformément aux articles 13 et 14 du RGPD, **avant** la collecte de leurs données dans Noah.

3. Recueillir le **consentement** des personnes concernées lorsque la base légale du traitement le requiert.

4. Procéder aux **vérifications mensuelles et tests de restauration trimestriels** prévus à l'article 6 des CGU.

5. Conserver une **trace de l'acceptation** des présentes par sa structure (signature du DPA, acceptation des CGU dans le logiciel).

---

## ARTICLE 6. RESPONSABILITÉ

Le manquement de l'Éditeur à ses obligations de sous-traitant engage sa responsabilité dans les conditions prévues à l'article 7 des CGU.

Le manquement du Client à ses obligations de responsable de traitement (notamment l'absence d'information des personnes concernées ou de tests de restauration) **dégage l'Éditeur de toute responsabilité** dans la limite du préjudice résultant directement de ce manquement.

---

## ARTICLE 7. DURÉE — RÉSILIATION

Le présent DPA prend effet à compter de sa signature et reste en vigueur pendant toute la durée du contrat commercial liant les parties, ainsi que durant les périodes de conservation post-résiliation prévues à l'article 8 des CGU.

À l'issue de ces périodes, l'Éditeur procède à la destruction définitive des données et de la clé maître, et fournit au Client une attestation de destruction sur demande.

---

## ARTICLE 8. LOI APPLICABLE

Le présent DPA est régi par le droit français et le RGPD. Tout litige relève de la juridiction compétente prévue à l'article 11 des CGU.

---

## SIGNATURES

| Pour le Client (Responsable de traitement) | Pour l'Éditeur (Sous-traitant) |
|---|---|
| Nom : | Nom : |
| Qualité : | Qualité : |
| Date : | Date : |
| Signature : | Signature : |
