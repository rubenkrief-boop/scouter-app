export default function MentionsLegalesPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>Mentions legales</h1>
      <p className="text-sm text-muted-foreground">Derniere mise a jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <h2>1. Editeur du site</h2>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm not-prose">
        <p className="font-semibold text-amber-800">A completer avec vos informations :</p>
        <ul className="mt-2 space-y-1 text-amber-700">
          <li>Raison sociale : <strong>[NOM DE L'ENTREPRISE]</strong></li>
          <li>Forme juridique : <strong>[SAS / SARL / Auto-entrepreneur / ...]</strong></li>
          <li>Capital social : <strong>[MONTANT] euros</strong></li>
          <li>Siege social : <strong>[ADRESSE COMPLETE]</strong></li>
          <li>SIRET : <strong>[NUMERO SIRET]</strong></li>
          <li>RCS : <strong>[VILLE + NUMERO RCS]</strong></li>
          <li>Numero TVA intracommunautaire : <strong>[NUMERO TVA]</strong></li>
          <li>Directeur de la publication : <strong>[NOM DU DIRECTEUR]</strong></li>
          <li>Email de contact : <strong>[EMAIL]</strong></li>
          <li>Telephone : <strong>[TELEPHONE]</strong></li>
        </ul>
      </div>

      <h2>2. Hebergement</h2>
      <h3>Application web</h3>
      <p>
        L'application est hebergee par <strong>Vercel Inc.</strong><br />
        440 N Barranca Ave #4133, Covina, CA 91723, Etats-Unis<br />
        Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
      </p>

      <h3>Base de donnees</h3>
      <p>
        La base de donnees est hebergee par <strong>Supabase Inc.</strong><br />
        970 Toa Payoh North #07-04, Singapore 318992<br />
        Site web : <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a>
      </p>

      <h2>3. Propriete intellectuelle</h2>
      <p>
        L'ensemble du contenu du site CompetencesPro (textes, graphismes, logiciels, images,
        base de donnees, structure) est protege par le droit d'auteur et le droit des bases de donnees
        conformement aux dispositions du Code de la propriete intellectuelle.
      </p>
      <p>
        Toute reproduction, representation, modification, publication, transmission ou denaturation,
        totale ou partielle, du site ou de son contenu, par quelque procede que ce soit, et sur quelque
        support que ce soit, est interdite sans l'autorisation ecrite prealable de l'editeur.
      </p>

      <h2>4. Donnees personnelles</h2>
      <p>
        Les informations relatives au traitement des donnees personnelles sont detaillees dans
        notre <a href="/legal/confidentialite">Politique de confidentialite</a>.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Le site utilise des cookies strictement necessaires au fonctionnement de l'application
        (authentification, session utilisateur). Pour plus de details, consultez notre{' '}
        <a href="/legal/confidentialite">Politique de confidentialite</a>.
      </p>

      <h2>6. Limitation de responsabilite</h2>
      <p>
        L'editeur ne pourra etre tenu responsable des dommages directs et indirects causes
        au materiel de l'utilisateur lors de l'acces au site CompetencesPro.
      </p>
      <p>
        L'editeur decline toute responsabilite quant a l'utilisation qui pourrait etre faite
        des informations et contenus presents sur le site.
      </p>

      <h2>7. Droit applicable</h2>
      <p>
        Les presentes mentions legales sont regies par le droit francais. En cas de litige,
        les tribunaux francais seront seuls competents.
      </p>
    </article>
  )
}
