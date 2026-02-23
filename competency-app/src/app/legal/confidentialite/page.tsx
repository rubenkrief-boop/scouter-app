export default function ConfidentialitePage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>Politique de confidentialite</h1>
      <p className="text-sm text-muted-foreground">Derniere mise a jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <h2>1. Responsable du traitement</h2>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm not-prose">
        <p className="font-semibold text-amber-800">A completer :</p>
        <ul className="mt-2 space-y-1 text-amber-700">
          <li>Responsable du traitement : <strong>[NOM DE L'ENTREPRISE]</strong></li>
          <li>Adresse : <strong>[ADRESSE]</strong></li>
          <li>Email DPO / contact RGPD : <strong>[EMAIL]</strong></li>
        </ul>
      </div>

      <h2>2. Donnees collectees</h2>
      <p>Dans le cadre de l'utilisation de SCOUTER, nous collectons les donnees suivantes :</p>

      <h3>Donnees d'identification</h3>
      <ul>
        <li>Nom et prenom</li>
        <li>Adresse email professionnelle</li>
        <li>Poste / emploi occupe</li>
        <li>Lieu d'exercice</li>
        <li>Rattachement hierarchique (manager)</li>
      </ul>

      <h3>Donnees d'evaluation professionnelle</h3>
      <ul>
        <li>Resultats d'evaluation des competences</li>
        <li>Scores par module et par competence</li>
        <li>Commentaires d'evaluation</li>
        <li>Historique des evaluations</li>
      </ul>

      <h3>Donnees techniques</h3>
      <ul>
        <li>Adresse IP (journaux de connexion)</li>
        <li>Cookies de session d'authentification</li>
        <li>Date et heure de connexion</li>
      </ul>

      <h2>3. Finalites du traitement</h2>
      <table>
        <thead>
          <tr>
            <th>Finalite</th>
            <th>Base legale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gestion des comptes utilisateurs</td>
            <td>Execution du contrat</td>
          </tr>
          <tr>
            <td>Evaluation des competences professionnelles</td>
            <td>Interet legitime de l'employeur</td>
          </tr>
          <tr>
            <td>Suivi de la progression des collaborateurs</td>
            <td>Interet legitime de l'employeur</td>
          </tr>
          <tr>
            <td>Statistiques et tableaux de bord</td>
            <td>Interet legitime de l'employeur</td>
          </tr>
          <tr>
            <td>Securite et authentification</td>
            <td>Obligation legale / Interet legitime</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Duree de conservation</h2>
      <table>
        <thead>
          <tr>
            <th>Type de donnees</th>
            <th>Duree de conservation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Donnees du compte utilisateur</td>
            <td>Duree du contrat de travail + 3 ans apres le depart</td>
          </tr>
          <tr>
            <td>Resultats d'evaluation</td>
            <td>5 ans apres la date d'evaluation</td>
          </tr>
          <tr>
            <td>Journaux de connexion</td>
            <td>1 an</td>
          </tr>
          <tr>
            <td>Cookies de session</td>
            <td>Duree de la session (supprime a la deconnexion)</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Destinataires des donnees</h2>
      <p>Vos donnees sont accessibles aux personnes suivantes :</p>
      <ul>
        <li><strong>Administrateurs (super_admin)</strong> : acces a toutes les donnees</li>
        <li><strong>Skill Masters</strong> : acces aux referentiels de competences et profils metier</li>
        <li><strong>Managers</strong> : acces aux evaluations de leur equipe uniquement</li>
        <li><strong>Collaborateurs (workers)</strong> : acces a leurs propres evaluations</li>
      </ul>

      <h2>6. Transferts de donnees hors UE</h2>
      <p>
        Nos sous-traitants techniques (Vercel, Supabase) peuvent heberger certaines donnees
        aux Etats-Unis. Ces transferts sont encadres par :
      </p>
      <ul>
        <li>Les clauses contractuelles types (CCT) de la Commission europeenne</li>
        <li>Le Data Processing Agreement (DPA) de chaque prestataire</li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>
        Conformement au Reglement General sur la Protection des Donnees (RGPD) et a la
        loi Informatique et Libertes, vous disposez des droits suivants :
      </p>
      <ul>
        <li><strong>Droit d'acces</strong> : obtenir une copie de vos donnees personnelles</li>
        <li><strong>Droit de rectification</strong> : corriger des donnees inexactes</li>
        <li><strong>Droit a l'effacement</strong> : demander la suppression de vos donnees</li>
        <li><strong>Droit a la limitation</strong> : restreindre le traitement de vos donnees</li>
        <li><strong>Droit a la portabilite</strong> : recevoir vos donnees dans un format structure</li>
        <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos donnees</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous par email a :{' '}
        <strong>[EMAIL DPO A COMPLETER]</strong>
      </p>
      <p>
        Vous pouvez egalement introduire une reclamation aupres de la CNIL :{' '}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
      </p>

      <h2>8. Cookies</h2>
      <h3>Cookies strictement necessaires</h3>
      <p>Ces cookies sont indispensables au fonctionnement du site :</p>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Finalite</th>
            <th>Duree</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>sb-*-auth-token</td>
            <td>Authentification et session utilisateur (Supabase)</td>
            <td>Duree de la session</td>
          </tr>
          <tr>
            <td>cookie-consent</td>
            <td>Enregistrement du choix cookies</td>
            <td>12 mois</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ces cookies ne necessitent pas votre consentement car ils sont essentiels au
        fonctionnement du service (article 82 de la loi Informatique et Libertes).
      </p>

      <h3>Cookies analytiques</h3>
      <p>
        Aucun cookie analytique ou de suivi publicitaire n'est utilise sur ce site.
        Si cela venait a changer, votre consentement serait prealablement recueilli.
      </p>

      <h2>9. Securite</h2>
      <p>
        Nous mettons en oeuvre les mesures techniques et organisationnelles appropriees
        pour proteger vos donnees :
      </p>
      <ul>
        <li>Chiffrement des donnees en transit (HTTPS/TLS)</li>
        <li>Authentification securisee avec mots de passe haches</li>
        <li>Controle d'acces base sur les roles (RLS - Row Level Security)</li>
        <li>Journalisation des acces</li>
      </ul>
    </article>
  )
}
