import { Row, Col } from 'react-bootstrap';

/** User documentation of the apiary module. */
export default function ApiariesDoc() {
  return (
    <>
      <p className="lead text-muted">
        Gérez vos ruchers depuis une liste, suivez leur niveau d'infestation et partagez-les avec votre association.
      </p>

      <Row className="my-4">
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>🍯</div>
          <h6 className="mt-2">Situer</h6>
          <p className="small text-muted">
            Enregistrez un rucher là où vous êtes ou par son adresse, avec une photo et son numéro AFSCA
          </p>
        </Col>
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>📈</div>
          <h6 className="mt-2">Suivre</h6>
          <p className="small text-muted">
            Indiquez, si vous le connaissez, le niveau d'infestation : faible, modéré ou fort
          </p>
        </Col>
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>🤝</div>
          <h6 className="mt-2">Partager</h6>
          <p className="small text-muted">
            Montrez vos ruchers à votre association, qui peut aussi les tenir à jour
          </p>
        </Col>
      </Row>

      <section data-section="manager" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🗂️</span>
          Le gestionnaire de ruchers
        </h5>
        <p>
          Le module <em>Ruchers</em> s'ouvre sur la liste de vos ruchers. Trois portées :
          {' '}<strong>Mes ruchers</strong> (ceux dont vous êtes propriétaire),
          {' '}<strong>Partagés</strong> (ceux qu'un apiculteur partage avec l'une de vos
          associations) et, pour les administrateurs, <strong>Tous</strong>. Cherchez par numéro,
          adresse, numéro AFSCA ou commentaire, filtrez par niveau d'infestation ou par
          association, et triez : les plus infestés d'abord par défaut, par date, adresse ou numéro.
          Aucune distance n'est affichée ni utilisée pour trier : la position d'un rucher reste
          confidentielle.
        </p>
        <p className="mb-0">
          Sur chaque ligne : <strong>📍</strong> ouvre le module <em>Carte</em> centré sur le rucher,
          mis en évidence parmi ses voisins, avec un bouton <strong>← Ruchers</strong> pour revenir
          à la liste telle que vous l'aviez laissée ; le menu <strong>⋮</strong> donne accès à la
          fiche (et à son partage), à la modification et à la suppression, selon vos droits. Vos
          filtres sont conservés dans l'adresse de la page.
        </p>
      </section>

      <section data-section="adding" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📍</span>
          Ajouter un rucher
        </h5>
        <p>
          Le bouton <strong>+</strong> de la liste ouvre le formulaire à votre position actuelle ;
          sa recherche d'adresse sert quand vous n'êtes pas au rucher. Dans le module
          {' '}<em>Carte</em>, touchez aussi l'endroit voulu puis choisissez « Rucher ». L'adresse
          est complétée depuis la position ; le nom, le niveau d'infestation (« Non évalué » par défaut),
          la photo, le numéro d'enregistrement AFSCA et le commentaire sont facultatifs. Vous en devenez le
          propriétaire. Le nom (« Verger », « Fond du jardin ») désigne le rucher partout où on le
          choisit (une visite, une ruche à placer), avec son adresse en dessous et sa photo.
        </p>
        <p className="mb-0">
          Tout se modifie ensuite depuis la fiche du rucher (bouton ✏️), position comprise : une
          nouvelle adresse choisie dans la recherche déplace le rucher, les coordonnées GPS se
          corrigent à la main. Sur la carte, le cercle de 1 km autour de chaque rucher matérialise
          la zone de chasse des frelons à surveiller.
        </p>
      </section>

      <section data-section="hives" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🐝</span>
          Les ruches
        </h5>
        <p>
          L'onglet <strong>Ruches</strong> du module liste vos ruches, où qu'elles soient :
          celles dont vous êtes propriétaire, celles qui vous sont confiées, celles de vos
          associations, et celles des ruchers que vous voyez. La fiche d'un rucher montre aussi
          les ruches qui s'y trouvent, avec un bouton pour en ajouter une.
        </p>
        <p>
          Une ruche a un <strong>type</strong> (TBH, TBH Chandler, Warré, ruche tronc, nucleus),
          qui ne change pas ensuite : les barrettes et les colonies en dépendent. Elle appartient
          à <strong>vous ou à une de vos associations</strong>, et elle est
          {' '}<strong>confiée</strong> à un apiculteur, vous à la création. Dans un rucher, elle
          est <em>en service</em> ; sans rucher, elle est <em>remisée</em>, vide ou en attente
          d'une colonie ; <em>réformée</em>, elle sort de l'usage. Une <strong>photo</strong>
          facultative (formulaire de la ruche) la fait reconnaître dans les listes et en tête de sa
          fiche ; touchée, elle s'agrandit et peut y être retirée. Les photos des colonies vont avec
          les visites.
        </p>
        <p>
          Chaque déplacement, mise en remise et changement d'apiculteur est daté : la fiche en
          garde l'<strong>historique</strong>, même quand un rucher a été supprimé depuis. Une
          ruche ne va que dans un rucher que vous pouvez modifier. Un rucher qui contient encore
          des ruches ne peut pas être supprimé : déplacez-les ou remisez-les d'abord.
        </p>
        <p className="mb-0">
          Le champ <strong>Hébergé chez</strong> d'un rucher nomme la personne qui l'accueille sur
          son terrain, quand ce n'est pas vous. Ce nom n'apparaît jamais dans le journal d'audit.
        </p>
      </section>

      <section data-section="colonies" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">👑</span>
          Les colonies
        </h5>
        <p>
          Une colonie vit dans une ruche, mais n'est pas la ruche : elle peut changer de ruche
          (<strong>Transvaser</strong>, d'un nucleus vers une TBH, d'un tronc vers une TBH…) et
          garde alors son nom et sa lignée. Ses barrettes la suivent entre ruches de la même
          famille (TBH, Chandler, nucleus) ; vers une Warré ou depuis un tronc, on les recompte.
          Une colonie ne vit que dans une ruche en service, donc dans un rucher.
        </p>
        <p>
          <strong>Le nucleus</strong> est une petite ruche à barrettes (12 au plus, sans cloison) qui
          sert à déplacer une colonie : on la transvase d'abord dans le nucleus, on déplace au
          besoin le nucleus vers un autre rucher, on la laisse se remettre quelques jours avec un
          nourrissage, puis on la transvase dans sa nouvelle ruche, tôt le matin ou tard le soir.
          Comme une ruche, un nucleus appartient à une association ou à une personne. Une colonie
          en nucleus affiche depuis combien de jours elle y est ; elle peut y rester plus longtemps.
          Le bouton <strong>Installer une colonie</strong> d'une ruche propose d'abord les colonies
          qui attendent dans un nucleus.
        </p>
        <p>
          Une colonie naît d'une <strong>division</strong>, de ce qui reste après un
          {' '}<strong>essaimage</strong>, d'un <strong>essaim récolté</strong> ou d'un
          {' '}<strong>essaim nu acheté</strong>. Les deux derniers s'installent depuis la fiche de la
          ruche ; une division et un essaimage s'enregistrent depuis la fiche de la colonie
          d'origine, qui garde ainsi sa descendance. Après un essaimage, la colonie qui est partie
          avec sa reine s'arrête : ce qui reste est une nouvelle colonie, et l'essaim récolté une
          autre. Une colonie s'arrête aussi quand elle meurt, déserte ou est réunie à une autre.
        </p>
        <p>
          Une TBH ou une Chandler accueille <strong>deux colonies</strong> séparées par une
          {' '}<strong>cloison</strong>, qui prend la place d'une barrette : le compartiment 1 est
          en deçà, le compartiment 2 au-delà. Les deux colonies se partagent les 24 positions, soit
          23 barrettes au plus. La cloison se pose depuis la fiche de la ruche, ou au moment d'une
          division ; elle se retire quand un compartiment est vide.
        </p>
        <p className="mb-0">
          <strong>Rupture de ponte</strong> : la partie qui n'a pas la reine (après une division)
          ou ce qui reste après un essaimage élève une nouvelle reine. Sa fiche compte les jours
          depuis l'événement ; notez <strong>Ponte constatée</strong> le jour où vous voyez des
          œufs : la rupture a duré au plus ce nombre de jours. Repères moyens : le dernier couvain
          d'ouvrières naît au plus tard 21 jours après l'événement ; une reine élevée en urgence
          naît 10 à 16 jours après une division et pond en général une à deux semaines plus tard,
          davantage par mauvais temps.
        </p>
      </section>

      <section data-section="visits" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📓</span>
          Les visites
        </h5>
        <p>
          L'onglet <strong>Visites</strong> tient le journal de vos ruchers ; la fiche d'un rucher
          ouvre une nouvelle visite, celle d'une colonie liste les visites où elle a été vue. Une
          visite dit quand, combien de temps, ce qui a été fait (contrôle, nourrissage, division,
          récolte d'essaim, transvasement, muselière…), qui était là et un compte rendu libre.
        </p>
        <p>
          Pour chaque colonie regardée, une <strong>inspection</strong> note ce qui a été vu, tout
          étant facultatif : reine, œufs, couvain, cellules royales, comportement, activité et
          pollen au trou de vol, frelons devant l'entrée, muselière, nourrissage (sirop, candi,
          quantité), et le nombre de barrettes (ou d'éléments) après la visite, prérempli avec celui
          de la colonie. La visite la plus récente donne ce nombre à la colonie. Des
          {' '}<strong>œufs vus</strong> dans une colonie qui élève une reine enregistrent sa
          ponte : la rupture de ponte se termine ce jour-là.
        </p>
        <p>
          <strong>Météo</strong> : température, vent, couverture nuageuse, pluie et temps général
          (ensoleillé, couvert, averses, orageux…). Le bouton <em>Open-Meteo</em> les remplit pour
          l'heure de la visite : ce sont les valeurs d'un modèle météo à l'heure près, sur une grille
          de quelques kilomètres pour les jours récents et plus grossière (10 à 30 km) au-delà de
          80 jours, pas une mesure au rucher ; corrigez-les si besoin, la visite indique alors
          qu'elles ont été saisies. Seule une position arrondie au kilomètre part vers Open-Meteo,
          envoyée par notre serveur. Données météo :{' '}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0).
        </p>
        <p className="mb-0">
          <strong>Participants</strong> : les membres de vos associations ; ils voient la visite et
          peuvent la compléter. Les personnes sans compte se nomment en texte libre, sans jamais
          apparaître dans le journal d'audit. Les <strong>photos</strong> s'ajoutent depuis la fiche
          de la visite, pour tout le rucher ou pour une colonie. Voient une visite : ses
          participants, ceux qui voient le rucher, et ceux qui voient une des ruches inspectées.
        </p>
        <p className="mb-0">
          <strong>Mise en forme</strong> : le compte rendu et les notes de chaque colonie acceptent
          le Markdown, mis en forme à l'affichage : <code>**gras**</code>, <code>_italique_</code>,
          {' '}<code>### titre</code>, <code>- liste</code>, <code>1. liste numérotée</code>,
          {' '}<code>[texte](https://…)</code> pour un lien. La barre d'outils au-dessus du champ
          l'écrit autour de la sélection ; <em>Aperçu</em> montre le résultat. Un retour à la ligne
          reste un retour à la ligne. Les images ne s'affichent pas : ajoutez vos photos à la visite.
        </p>
      </section>

      <section data-section="planning" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📅</span>
          Les visites prévues
        </h5>
        <p>
          L'onglet <strong>Visites</strong> s'ouvre sur <strong>À venir</strong> : les visites prévues,
          la plus proche en tête, les visites en retard marquées en rouge. Le bouton
          {' '}<strong>Prévoir</strong> (ou « Prévoir une visite » dans la fiche d'un rucher) en fixe le
          rucher, le jour et l'heure (demain 9 h par défaut), ce qu'il y aura à faire, les participants et
          des notes de préparation. Le <strong>Journal</strong> garde les visites faites.
        </p>
        <p>
          Le jour venu, <strong>Réaliser</strong> dans la fiche de la visite ouvre son compte rendu, à
          l'heure prévue (ou maintenant si elle n'est pas encore passée) : la météo, les colonies vues,
          le compte rendu. Enregistrée, elle passe au journal et met à jour les colonies, comme une
          visite saisie directement ; une visite faite ne redevient pas prévue. Une visite prévue ne
          change rien aux colonies. Pour l'annuler, supprimez-la.
        </p>
        <p className="mb-0">
          Un <strong>rappel</strong> (notification) part la veille à partir de 18 h vers l'auteur et les
          participants qui ont activé « Rappels de visites prévues » dans le module Notifications,
          jamais entre 21 h et 7 h ; déplacée, la visite est rappelée de nouveau. Le nombre rouge du
          module, sur sa tuile, dans le menu et sur l'onglet Visites, compte les visites prévues
          aujourd'hui ou en retard dont vous êtes l'auteur ou un participant.
        </p>
      </section>

      <section data-section="sharing" className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🔒</span>
          Visibilité et partage
        </h5>
        <p>
          Un rucher est <strong>privé</strong> : ni les visiteurs, ni les piégeurs, ni les chasseurs de nids, ni les autres
          apiculteurs ne le voient. Depuis sa fiche, section <em>Partage</em>, vous pouvez le
          montrer à une association dont vous êtes membre ; avec « Peut modifier », ses membres
          peuvent aussi le mettre à jour.
        </p>
        <p className="mb-0">
          Le partage se retire à tout moment. La suppression d'un rucher reste réservée à son
          propriétaire.
        </p>
      </section>

      <section data-section="permissions">
        <h5 className="text-primary">Qui peut faire quoi ?</h5>
        <ul className="mb-0">
          <li><strong>Propriétaire</strong> (apiculteur) : tout sur ses ruchers</li>
          <li>
            <strong>Association</strong> avec qui le rucher est partagé : le consulter et, si le
            propriétaire l'autorise, le modifier
          </li>
          <li>
            <strong>Administrateur de la plateforme</strong> : consulter et gérer tous les ruchers,
            réattribuer un rucher à un autre apiculteur
          </li>
          <li>
            <strong>Ruche</strong> : son propriétaire (ou un administrateur de l'association
            propriétaire) la confie, la réforme et la supprime ; l'apiculteur à qui elle est
            confiée la modifie, la déplace et la remise ; les membres de l'association
            propriétaire et ceux qui voient le rucher la consultent
          </li>
          <li>
            <strong>Colonie</strong> : les mêmes droits que sa ruche. Qui s'occupe de la ruche
            enregistre divisions, essaimages, transvasements et fin ; le propriétaire de la ruche
            supprime une colonie encodée par erreur
          </li>
        </ul>
      </section>
    </>
  );
}
