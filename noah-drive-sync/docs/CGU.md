# Conditions Générales d'Utilisation — Noah Drive Sync

**Version 1.0 — applicable au 8 mai 2026**

---

## ÉDITEUR

> *À compléter avant publication :*
> - Dénomination sociale : [Nom de l'entreprise]
> - Forme juridique et capital : [SAS au capital de X €, EURL, micro-entreprise, etc.]
> - SIRET : [numéro]
> - Adresse du siège : [adresse complète]
> - Directeur de la publication : [Nom, Prénom]
> - Contact : [email]
> - Hébergement de l'app et des sauvegardes : Google LLC (Workspace, datacenters EU)

---

## 1. OBJET

Le logiciel **Noah Drive Sync** ("le Logiciel") effectue une sauvegarde mensuelle automatique des bases de données du logiciel **Noah HIMSA** installées sur le poste de l'Utilisateur, vers un espace de stockage Google Workspace désigné dans la configuration.

Les présentes conditions régissent l'utilisation du Logiciel par l'Utilisateur professionnel (audioprothésiste, centre auditif, réseau de centres) ayant souscrit un contrat commercial avec l'Éditeur.

---

## 2. LICENCE D'UTILISATION

Le Logiciel est concédé sous licence **non exclusive, non transférable, non sous-licenciable**, à l'organisation cliente identifiée au contrat commercial, pour usage sur les postes des sites du réseau identifiés au contrat.

**Toute redistribution, copie, ou installation sur un poste non autorisé contractuellement constitue une violation des présentes CGU et ouvre droit à résiliation immédiate du contrat commercial ainsi qu'à des dommages-intérêts au profit de l'Éditeur.**

L'Utilisateur s'interdit expressément de :
- décompiler, désassembler, ou rétro-concevoir le Logiciel ;
- modifier, traduire, ou créer des œuvres dérivées du Logiciel ;
- distribuer, prêter, louer, ou céder le Logiciel à un tiers ;
- contourner ou tenter de contourner les mécanismes techniques de protection (chiffrement, identifiants intégrés, restrictions de domaine, etc.).

---

## 3. DONNÉES PERSONNELLES — RGPD

Les sauvegardes traitées par le Logiciel contiennent des **données personnelles de santé** au sens de l'article 9 du Règlement Général sur la Protection des Données (RGPD, Règlement UE 2016/679).

L'Utilisateur (ou son organisation) est **responsable de traitement** au sens de l'article 4 du RGPD. L'Éditeur agit en qualité de **sous-traitant** au sens de l'article 28 du RGPD.

Un **Accord de Traitement des Données (DPA)** est conclu séparément entre les parties et précise les engagements respectifs en matière de sécurité technique et organisationnelle, durée de conservation, sous-sous-traitance (Google), notification de violation, et exercice des droits des personnes concernées.

L'Utilisateur reconnaît avoir pris connaissance du DPA avant souscription.

---

## 4. CHIFFREMENT ET CLÉ MAÎTRE

Les sauvegardes sont chiffrées par **AES-256-GCM** avant upload vers le cloud. La clé maître est gérée par l'Éditeur dans un espace technique distinct du Drive de stockage des sauvegardes.

**La restauration d'une sauvegarde nécessite la fourniture de cette clé.** L'Éditeur s'engage à la fournir à l'Utilisateur sur demande écrite et après vérification d'identité, dans un délai maximal de **48 heures ouvrées**.

L'Utilisateur reconnaît expressément qu'**aucune restauration n'est possible sans l'intervention de l'Éditeur** ou la fourniture préalable de la clé maître. L'Éditeur s'engage à conserver la clé pendant toute la durée du contrat et 12 mois suivant sa résiliation.

---

## 5. AUTHENTIFICATION GOOGLE

L'authentification au compte Google Workspace s'effectue exclusivement via le navigateur de l'Utilisateur (flux OAuth 2.0). **L'Éditeur n'a aucun accès aux identifiants Google de l'Utilisateur** (mot de passe, second facteur).

Les jetons d'accès et de rafraîchissement OAuth sont stockés localement sur le poste de l'Utilisateur, dans le dossier `%APPDATA%\NoahDriveSync\token.json`, protégés par les mécanismes de Windows.

---

## 6. OBLIGATIONS DE L'UTILISATEUR

L'Utilisateur s'engage à :

- maintenir le poste à jour (système d'exploitation Windows supporté, antivirus à jour) ;
- conserver une connexion Internet fonctionnelle au moment des sauvegardes mensuelles ;
- **vérifier mensuellement** la bonne exécution de la sauvegarde via le journal `sync.log` accessible dans `%APPDATA%\NoahDriveSync\` ;
- **tester la restauration** d'une sauvegarde au moins une fois par trimestre, en sollicitant l'Éditeur pour la fourniture de la clé si besoin ;
- notifier l'Éditeur de toute anomalie ou message d'erreur dans un délai de 7 jours.

**À défaut de ces vérifications, l'Éditeur ne pourra être tenu pour responsable d'une sauvegarde corrompue, incomplète, ou irrécupérable.**

---

## 7. LIMITATION DE RESPONSABILITÉ

Le Logiciel est fourni **"en l'état"**. L'Éditeur n'apporte aucune garantie expresse ou implicite d'aptitude à un usage particulier, de continuité de service, ou d'absence d'erreurs.

La responsabilité de l'Éditeur, **tous préjudices confondus et toutes causes confondues**, est limitée au montant des sommes effectivement versées par l'Utilisateur au titre de l'année contractuelle en cours, plafonnée à **1 000 € (mille euros)**.

Sont expressément exclus de toute indemnisation les préjudices indirects, et notamment :

- perte d'exploitation ;
- perte de chance ;
- perte de données antérieures à la dernière sauvegarde réussie ;
- atteinte à l'image ou à la réputation ;
- perte de clientèle.

Les présentes limitations ne s'appliquent pas en cas de **dol ou de faute lourde** de l'Éditeur, ou de manquement aux obligations RGPD relevant du sous-traitant.

---

## 8. DURÉE — RÉSILIATION

Les présentes CGU prennent effet à compter de leur acceptation par l'Utilisateur (cochage de la case prévue à cet effet dans le Logiciel) et restent en vigueur tant que l'Utilisateur utilise le Logiciel.

En cas de résiliation du contrat commercial :

- l'Utilisateur conserve l'accès en lecture à ses sauvegardes Drive pendant **30 jours** ;
- la fourniture de la clé maître reste possible pendant **12 mois** après résiliation pour permettre les restaurations passées ;
- au-delà de cette durée, l'Éditeur peut détruire la clé maître et les sauvegardes deviennent irrécupérables.

---

## 9. ÉVOLUTION DES PRÉSENTES CGU

L'Éditeur se réserve le droit de modifier les présentes CGU à tout moment.

La version applicable à un usage donné est celle qui était en vigueur au moment de cet usage. En cas de modification substantielle, l'Utilisateur sera invité à accepter la nouvelle version au prochain lancement du Logiciel. Le refus d'accepter empêche l'utilisation du Logiciel mais n'affecte pas la conservation des sauvegardes déjà réalisées.

---

## 10. PROPRIÉTÉ INTELLECTUELLE

Le Logiciel, son code source, sa documentation, son installeur, et tous les éléments graphiques associés sont la propriété exclusive de l'Éditeur. L'acceptation des présentes CGU n'emporte aucun transfert de propriété intellectuelle.

---

## 11. LOI APPLICABLE — JURIDICTION COMPÉTENTE

Les présentes CGU sont régies par le **droit français**. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive du **Tribunal de [À compléter : ville du siège de l'Éditeur]**.

---

## CONTACT

Pour toute question contractuelle, demande de restauration, ou exercice des droits prévus par le RGPD :

> [À compléter : adresse email de contact, téléphone, adresse postale]

---

> **Acceptation**
>
> En cochant la case « *J'ai lu et j'accepte les conditions générales d'utilisation* » dans le Logiciel, l'Utilisateur reconnaît avoir lu, compris et accepté l'intégralité des présentes CGU. L'acceptation est horodatée et conservée dans la configuration locale du Logiciel (`%APPDATA%\NoahDriveSync\config.json`) à des fins de preuve, conformément à l'article 1366 du Code civil.
