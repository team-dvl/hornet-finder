/** User documentation of the administration module. */
export default function AdminDoc() {
  return (
    <>
      <p className="lead text-muted">
        Les outils de la plateforme : vos QR Codes et votre groupe pour chacun, les référentiels,
        l&apos;archivage, la plateforme et le journal d&apos;audit pour les administrateurs de la plateforme.
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
          Types de pièges, de ruches et espèces
        </h5>
        <p className="mb-0">
          Réservé aux administrateurs de la plateforme : les modèles de pièges proposés à la
          création d&apos;un piège, les modèles de ruches (leurs barrettes et le nombre de
          colonies qu&apos;ils accueillent), et les espèces proposées lors d&apos;un relevé, avec leur
          photo et leur ordre. Un type ou une espèce déjà utilisé ne peut pas être supprimé.
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

      <section data-section="platform" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🎛️</span>
          Plateforme
        </h5>
        <p>
          Réservé aux administrateurs de la plateforme : <em>Administration → Plateforme</em> ouvre les
          pages <em>Notifications</em> et <em>Journal d&apos;audit</em>, et montre l&apos;état : les appareils
          abonnés, les envois, le planificateur.
        </p>
        <p>
          <strong>Envois et planificateur.</strong> Le planificateur est le service qui décide d&apos;envoyer,
          toutes les 10 minutes : rappels de pièges, alertes de nids, fin de saison, ménage. Les envois sont le
          résultat : ce que le service de notification du navigateur ou du téléphone a répondu pour chaque
          message, quel qu&apos;en soit l&apos;origine (automatique, écrit par une personne, essai). Des envois
          vides ne disent donc pas que le planificateur est en panne (rien n&apos;était dû, ou hors des heures
          d&apos;envoi) ; un planificateur à l&apos;arrêt coupe les envois automatiques, pas les messages écrits.
          Le détail appareil par appareil est dans <em>Notifications → Envois</em>, avec le délai
          d&apos;affichage mesuré sur l&apos;appareil.
        </p>
        <p>
          <strong>Suspendre des notifications</strong> (<em>Plateforme → Notifications</em>). Un interrupteur
          par sorte, et un interrupteur général qui les bascule toutes. Suspendre coupe la sorte pour tout le
          monde, sans toucher aux réglages de chacun ni aux abonnements des appareils. Les rappels de pièges et
          les alertes de nids attendent la reprise (les rappels partent alors, dans les heures d&apos;envoi) ;
          une alerte de nid de plus de 48 heures est perdue. Un message écrit par une personne (groupe,
          plateforme) est refusé tant que sa sorte est suspendue, et l&apos;avis de transfert d&apos;un nid
          n&apos;est pas gardé. Ce qui est déjà parti chez le service de notification n&apos;est pas rappelé.
          L&apos;essai de l&apos;appareil n&apos;est jamais suspendu.
        </p>
        <p className="mb-0">
          Chaque changement est inscrit au journal d&apos;audit (qui, quand, quelles sortes).
        </p>
      </section>

      <section data-section="audit" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🕘</span>
          Journal d&apos;audit
        </h5>
        <p>
          Chaque action faite dans l&apos;application est enregistrée : signalement, modification ou
          suppression d&apos;un nid, d&apos;un frelon, d&apos;un rucher, d&apos;une ruche ou d&apos;un piège,
          déplacements, remises et changements d&apos;apiculteur des ruches, visites et
          destructions des nids (et le passage des nids non traités à « abandonné » en fin de saison), relevés et
          entrées du journal des pièges, partages, délégations et transferts (et le passage en privé d&apos;un piège
          d&apos;un type lié à un rucher quand son propriétaire devient apiculteur, enregistré comme une action du système), QR Codes, membres et
          invitations des groupes, notifications envoyées à un groupe ou à un membre (le titre et le nombre
          de destinataires, jamais le texte), exports de statistiques et leurs téléchargements. Le journal
          retient qui a agi, quand, sur quel objet, et ce qui a changé (avant → après).
        </p>
        <p>
          <strong>Qui le voit ?</strong> Les seuls administrateurs de la plateforme, en lecture :
          personne ne peut modifier ni effacer un événement. Chaque événement est gardé un an, puis
          supprimé. Votre adresse IP n&apos;y figure pas ; votre nom n&apos;y est pas copié, il est lu
          dans votre compte au moment de la consultation.
        </p>
        <p>
          <strong>Consulter</strong> (administrateurs) : <em>Administration → Plateforme → Journal d&apos;audit</em>,
          du plus récent au plus ancien (l&apos;icône de tri inverse l&apos;ordre), filtré par période,
          domaine, action, personne, source ou texte.
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
