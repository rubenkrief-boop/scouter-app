export default function CGUPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>Conditions Generales d'Utilisation</h1>
      <p className="text-sm text-muted-foreground">Derniere mise a jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <h2>1. Objet</h2>
      <p>
        Les presentes Conditions Generales d'Utilisation (CGU) regissent l'acces et l'utilisation
        de la plateforme SCOUTER, un outil d'evaluation des competences professionnelles
        destine aux audioprothesistes et aux professionnels de l'audioprothese.
      </p>

      <h2>2. Acces au service</h2>
      <p>
        L'acces a SCOUTER est reserve aux utilisateurs disposant d'un compte
        cree par un administrateur de l'organisation. L'utilisation du service est
        strictement limitee au cadre professionnel.
      </p>
      <p>Les comptes utilisateurs sont repartis en quatre roles :</p>
      <ul>
        <li><strong>Administrateur (super_admin)</strong> : gestion complete de la plateforme</li>
        <li><strong>Skill Master</strong> : gestion des referentiels de competences et profils metier</li>
        <li><strong>Manager</strong> : realisation et suivi des evaluations de son equipe</li>
        <li><strong>Collaborateur (worker)</strong> : consultation de ses propres evaluations</li>
      </ul>

      <h2>3. Obligations de l'utilisateur</h2>
      <p>L'utilisateur s'engage a :</p>
      <ul>
        <li>Ne pas divulguer ses identifiants de connexion a des tiers</li>
        <li>Utiliser la plateforme dans le respect de la legislation en vigueur</li>
        <li>Ne pas tenter d'acceder a des donnees auxquelles il n'est pas autorise</li>
        <li>Signaler toute utilisation non autorisee de son compte</li>
        <li>Ne pas perturber le bon fonctionnement du service</li>
        <li>Renseigner des informations exactes et a jour</li>
      </ul>

      <h2>4. Propriete intellectuelle</h2>
      <p>
        La plateforme SCOUTER, son code source, son architecture, ses bases de donnees,
        ses interfaces graphiques et l'ensemble de ses contenus sont la propriete exclusive
        de l'editeur et sont proteges par le droit de la propriete intellectuelle.
      </p>
      <p>
        Toute reproduction, copie, modification, adaptation, traduction, representation
        ou diffusion, totale ou partielle, de la plateforme ou de ses elements constitutifs,
        par quelque moyen que ce soit, sans autorisation prealable ecrite de l'editeur,
        est strictement interdite et constitue un acte de contrefacon sanctionne par les
        articles L.335-2 et suivants du Code de la propriete intellectuelle.
      </p>

      <h2>5. Donnees et evaluations</h2>
      <p>
        Les donnees d'evaluation saisies dans la plateforme sont la propriete de
        l'organisation. L'editeur ne revendique aucun droit sur ces donnees.
      </p>
      <p>
        L'utilisateur reconnaît que les evaluations de competences sont des outils
        d'aide a la decision et ne constituent pas, a elles seules, un jugement
        definitif sur les capacites professionnelles d'un collaborateur.
      </p>

      <h2>6. Disponibilite du service</h2>
      <p>
        L'editeur s'efforce de maintenir le service accessible 24h/24 et 7j/7.
        Toutefois, l'acces peut etre interrompu pour des raisons de maintenance,
        de mise a jour ou en cas de force majeure.
      </p>
      <p>
        L'editeur ne garantit pas la disponibilite permanente du service et ne
        pourra etre tenu responsable des consequences d'une indisponibilite.
      </p>

      <h2>7. Limitation de responsabilite</h2>
      <p>
        L'editeur ne pourra etre tenu responsable des dommages directs ou indirects
        resultant de l'utilisation ou de l'impossibilite d'utiliser la plateforme.
      </p>
      <p>
        L'editeur ne garantit pas l'absence d'erreurs ou de defauts dans le service
        et ne pourra etre tenu responsable des decisions prises sur la base des
        donnees presentees par la plateforme.
      </p>

      <h2>8. Confidentialite</h2>
      <p>
        L'utilisateur s'engage a maintenir la confidentialite des evaluations et des
        donnees auxquelles il a acces dans le cadre de son role. La divulgation
        non autorisee de resultats d'evaluation constitue une faute pouvant
        entrainer la suspension du compte.
      </p>

      <h2>9. Suspension et resiliation</h2>
      <p>
        L'editeur se reserve le droit de suspendre ou supprimer un compte utilisateur
        en cas de violation des presentes CGU, sans preavis ni indemnite.
      </p>

      <h2>10. Modification des CGU</h2>
      <p>
        L'editeur se reserve le droit de modifier les presentes CGU a tout moment.
        Les utilisateurs seront informes de toute modification substantielle.
        La poursuite de l'utilisation du service apres modification vaut acceptation
        des nouvelles CGU.
      </p>

      <h2>11. Droit applicable et juridiction</h2>
      <p>
        Les presentes CGU sont soumises au droit francais. Tout litige relatif a
        l'interpretation ou a l'execution des presentes sera soumis aux tribunaux
        competents du ressort du siege social de l'editeur.
      </p>

      <h2>12. Contact</h2>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm not-prose">
        <p className="text-amber-800">
          Pour toute question relative aux presentes CGU, contactez-nous a :{' '}
          <strong>[EMAIL DE CONTACT A COMPLETER]</strong>
        </p>
      </div>
    </article>
  )
}
