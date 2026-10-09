/** User documentation of the administration module. */
export default function AdminDoc() {
  return (
    <>
      <p className="lead text-muted">
        Les outils de la plateforme : vos QR Codes et votre groupe pour chacun, les référentiels,
        l&apos;archivage et le journal d&apos;audit pour les administrateurs de la plateforme.
      </p>

      <section data-section="qr-codes" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🏷️</span>
          QR Codes
        </h5>
        <p className="mb-0">
          Imprimez des planches de QR Codes vierges (PDF A4 à découper) à coller sur vos pièges, et
          réimprimez une étiquette abîmée sans changer de code. Les administrateurs de la plateforme
          voient tous les QR Codes, l&apos;objet qui les porte, et révoquent ceux qui sont perdus ou
          compromis : un QR Code révoqué n&apos;ouvre plus rien.
        </p>
      </section>

      <section data-section="groups" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">👥</span>
          Groupes et invitations
        </h5>
        <p>
          L&apos;administrateur d&apos;une association d&apos;apiculteurs voit ses membres par leur
          nom, jamais leur adresse email, et invite une personne qui a déjà un compte en tapant son
          adresse complète. Une invitation expire après 30 jours ; un rappel peut partir une fois par
          24 heures.
        </p>
        <p className="mb-0">
          Retirer un membre prend effet au plus tard dans l&apos;heure. Seul un administrateur de la
          plateforme nomme ou destitue l&apos;administrateur d&apos;un groupe, qui en garde toujours
          au moins un.
        </p>
      </section>

      <section data-section="referentials" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📚</span>
          Types de pièges et espèces
        </h5>
        <p className="mb-0">
          Réservé aux administrateurs de la plateforme : les modèles de pièges proposés à la
          création d&apos;un piège, et les espèces proposées lors d&apos;un relevé, avec leur photo et
          leur ordre. Un type ou une espèce déjà utilisé ne peut pas être supprimé.
        </p>
      </section>

      <section data-section="archiving" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🗄️</span>
          Archivage
        </h5>
        <p className="mb-0">
          Réservé aux administrateurs de la plateforme : les signalements de frelons et de nids
          d&apos;une saison ou d&apos;une année écoulée sont archivés d&apos;un coup. Ils quittent la
          carte de l&apos;année en cours sans être supprimés.
        </p>
      </section>

      <section data-section="audit" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🕘</span>
          Journal d&apos;audit
        </h5>
        <p>
          Chaque action faite dans l&apos;application est enregistrée : signalement, modification ou
          suppression d&apos;un nid, d&apos;un frelon, d&apos;un rucher ou d&apos;un piège, relevés et
          entrées du journal des pièges, partages, délégations et transferts, QR Codes, membres et
          invitations des groupes, exports de statistiques et leurs téléchargements. Le journal
          retient qui a agi, quand, sur quel objet, et ce qui a changé (avant → après).
        </p>
        <p>
          <strong>Qui le voit ?</strong> Les seuls administrateurs de la plateforme, en lecture :
          personne ne peut modifier ni effacer un événement. Chaque événement est gardé un an, puis
          supprimé. Votre adresse IP n&apos;y figure pas ; votre nom n&apos;y est pas copié, il est lu
          dans votre compte au moment de la consultation.
        </p>
        <p>
          <strong>Consulter</strong> (administrateurs) : <em>Administration → Journal d&apos;audit</em>,
          du plus récent au plus ancien, filtré par période, domaine, action, personne, source ou texte.
          L&apos;icône <i className="bi bi-clock-history" aria-hidden="true" /> <em>Historique</em> d&apos;une
          fiche (nid, frelon, rucher, piège) ouvre tout ce qui concerne l&apos;objet ; depuis un
          événement, on passe aux actions de la même personne ou de la même requête. L&apos;export
          CSV reprend les filtres en cours et est lui-même enregistré.
        </p>
        <p className="mb-0">
          Les événements marqués <em>reconstitué</em> datent d&apos;avant la mise en service du
          journal : ils viennent des dates déjà enregistrées (création, archivage, relevés, QR Codes,
          invitations). Ce qui n&apos;était pas daté (modifications, suppressions, transferts
          anciens) n&apos;a pas été inventé.
        </p>
      </section>
    </>
  );
}
