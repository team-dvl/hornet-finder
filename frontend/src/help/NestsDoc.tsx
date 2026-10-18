/** User documentation of the nests module. */
export default function NestsDoc() {
  return (
    <>
      <p className="lead text-muted">
        Signaler les nids de <em><a href="https://fr.wikipedia.org/wiki/Vespa_velutina" target="_blank" rel="noopener">Vespa
        velutina</a></em> et les suivre jusqu&apos;à leur neutralisation, saison par saison.
      </p>

      <section data-section="who" className="mb-4">
        <h5 className="text-primary">Qui fait quoi ?</h5>
        <ul className="mb-0">
          <li><strong>Tout le monde</strong> signale un nid, suit ce qu&apos;il devient et peut signaler qu&apos;il a été neutralisé.</li>
          <li><strong>Chasseurs de nids, apiculteurs, administrateurs</strong> voient tous les nids ; les piégeurs voient les nids neutralisés et ceux qu&apos;ils suivent.</li>
          <li><strong>Coordinateurs des piégeurs</strong> : transfèrent à un piégeur un nid qu&apos;ils ont signalé pour lui (voir <em>Suivi d&apos;un nid</em>).</li>
          <li><strong>Coordinateurs</strong> (administrateurs de la plateforme et coordinateurs des chasseurs) : vérification des nids signalés, neutralisation, modification des nids et de leurs photos, numéros AFSCA des ruchers à moins de 1 km.</li>
          <li><strong>Administrateurs</strong> : eux seuls réactivent un nid neutralisé, écarté ou abandonné, l&apos;archivent ou le suppriment ; ils transfèrent aussi n&apos;importe quel nid.</li>
        </ul>
      </section>

      <section data-section="module" className="mb-4">
        <h5 className="text-primary">Le module</h5>
        <p>
          Il montre la saison en cours : un nid ne sert qu&apos;une saison et n&apos;est jamais réoccupé. Les saisons
          passées restent dans l&apos;archivage, à titre historique.
        </p>
        <ul className="mb-0">
          <li><strong>À traiter</strong> : ce qui attend une action de votre part. Les nids à vérifier et ceux à neutraliser (coordinateurs), les nids actifs à moins de 1 km de vos ruchers, vos signalements pas encore neutralisés.</li>
          <li><strong>Nids</strong> : tous les nids de la saison, à rechercher (numéro, adresse) et filtrer par statut.</li>
          <li><strong>Mes signalements</strong> : pour qui ne voit pas tous les nids, ses propres signalements et où ils en sont.</li>
          <li>L&apos;icône <i className="bi bi-map" aria-hidden="true" /> <em>Carte</em> ouvre la carte des nids ; <em>Voir sur la carte</em> la centre sur un nid, avec un bouton de retour à la liste.</li>
        </ul>
      </section>

      <section data-section="report" className="mb-4">
        <h5 className="text-primary">Signaler un nid</h5>
        <p>
          <em>Signaler</em> demande d&apos;abord où est le nid : la position de l&apos;appareil, un point choisi sur la
          carte, ou une adresse. Placez-le où se trouve le nid, pas où vous êtes si vous le voyez de loin.
        </p>
        <p>
          Une photo nette permet de confirmer l&apos;espèce. Indiquez l&apos;<strong>état du nid</strong> : actif
          (des frelons entrent et sortent), vide (abandonné, par exemple un nid de l&apos;an passé découvert quand les
          feuilles tombent) ou inconnu. Un nid vide est enregistré comme abandonné. La hauteur, estimée depuis le sol,
          se donne par classes : une estimation à l&apos;œil se trompe facilement d&apos;un tiers.
        </p>
        <p>
          Un <strong>téléphone</strong> et un <strong>commentaire pour les coordinateurs</strong>, facultatifs, ne
          sont lus que par les coordinateurs (et par vous) : ils servent à vous rappeler pour vérifier le nid sans
          passer sur place. Le commentaire ordinaire, lui, peut apparaître sur la carte publique une fois le nid
          neutralisé, si le lieu est public.
        </p>
        <p className="mb-0">
          Les nids de l&apos;année à 5 km au plus de votre position sont aussi listés sur la carte, dans
          <em> Couches → Nids les plus proches</em>, avec leur distance à vol d&apos;oiseau (pour qui voit tous les nids).
        </p>
      </section>

      <section data-section="status" className="mb-4">
        <h5 className="text-primary">Où en est un nid</h5>
        <p>
          La <strong>vérification</strong> ne demande pas toujours un passage sur place : la décision peut se prendre
          sur les photos du signalement et après un échange, souvent par téléphone, avec la personne qui l&apos;a fait.
          Le coordinateur note sur quoi elle repose (photos, échange avec le signaleur, sur place).
        </p>
        <ul>
          <li><strong>Signalé</strong> : en attente d&apos;une vérification.</li>
          <li><strong>Confirmé</strong> : un coordinateur a vérifié qu&apos;il s&apos;agit d&apos;un nid actif de frelons asiatiques. Il relève alors le type (primaire ou secondaire), la hauteur et la taille.</li>
          <li><strong>Neutralisé</strong> : sa neutralisation (destruction) est enregistrée, avec sa date.</li>
          <li><strong>Écarté</strong> : autre espèce (frelon européen, guêpes…) ou introuvable. Il n&apos;est plus montré sur la carte.</li>
          <li><strong>Abandonné</strong> : trouvé vide, ou pas neutralisé à la fin de l&apos;hiver : le 1<sup>er</sup> mars, les nids de la saison précédente encore signalés ou confirmés passent abandonnés.</li>
        </ul>
        <p className="mb-0">
          Le type est pré-choisi d&apos;après la date du signalement : de février à mai, un nid est en général
          <em> primaire</em> (bâti par la reine fondatrice, petit, souvent bas et abrité) ; à partir de juillet,
          <em> secondaire</em> (plus grand, souvent haut). Chaque vérification, neutralisation ou fin de saison s&apos;inscrit au
          journal du nid, sur sa fiche ; un coordinateur peut en supprimer une entrée, le statut suit.
        </p>
      </section>

      <section data-section="destruction" className="mb-4">
        <h5 className="text-primary">Neutralisation</h5>
        <p>
          Un coordinateur l&apos;enregistre (<em>Neutraliser</em>) : la date, qui l&apos;a faite et par quels moyens
          (perche, nacelle, nid retiré, plusieurs à la fois). La personne qui suit le nid, d&apos;habitude celle qui
          l&apos;a signalé, peut aussi la signaler (<em>Signaler neutralisé</em>) : c&apos;est souvent elle qui le
          sait la première. Elle peut retirer son signalement.
        </p>
        <p className="mb-0">
          <strong>FixMyStreet</strong> : la Région wallonne subventionne des destructeurs formés, attribués par zone,
          qu&apos;on sollicite par sa plateforme. Le numéro de la demande relie le nid au dossier.
        </p>
      </section>

      <section data-section="follow" className="mb-4">
        <h5 className="text-primary">Suivi d&apos;un nid</h5>
        <p>
          Chaque nid est suivi par une personne : celle qui l&apos;a signalé, au départ. Elle le voit, reçoit les
          notifications de son suivi et peut signaler sa neutralisation. Suivre un nid, c&apos;est le gérer :
          cela ne fait pas de vous son propriétaire au sens juridique.
        </p>
        <p className="mb-0">
          Quand un coordinateur des piégeurs signale un nid pour quelqu&apos;un d&apos;autre (par exemple après un
          appel), il le lui transfère : <em>Transférer</em>, dans le menu de la fiche, parmi les
          piégeurs. Un administrateur peut le faire pour n&apos;importe quel nid. La personne qui a signalé le nid
          reste indiquée comme telle ; le coordinateur ne voit plus le nid ensuite, sauf s&apos;il voit tous les nids.
          La personne choisie est prévenue par une notification.
        </p>
      </section>

      <section data-section="alerts" className="mb-4">
        <h5 className="text-primary">Notifications</h5>
        <p>Chacun les règle dans le module <em>Notifications</em> :</p>
        <ul>
          <li><strong>Tous les nouveaux nids</strong> : activé d&apos;office pour les coordinateurs et les administrateurs ; un apiculteur l&apos;active s&apos;il le souhaite. Un nid signalé vide ne prévient que les coordinateurs.</li>
          <li><strong>Nids près de mes ruchers</strong> : un nid actif à moins de 1 km d&apos;un de vos ruchers, ou d&apos;un rucher partagé avec l&apos;association que vous administrez.</li>
          <li><strong>Suivi de mes signalements</strong> : confirmé, écarté, trouvé vide ou neutralisé, pour les nids que vous suivez ; et, aussitôt, un nid qui vous est transféré.</li>
        </ul>
        <p className="mb-0">
          Elles partent de 9 h (10 h le dimanche) à 20 h ; ce qui arrive la nuit est annoncé à l&apos;ouverture, et à
          partir de trois nouveaux nids en même temps, un seul message les regroupe. Le texte se lit sur l&apos;écran
          verrouillé : le numéro du nid et la commune, jamais l&apos;adresse ni un nom.
        </p>
      </section>

      <section data-section="access">
        <h5 className="text-primary">Accès</h5>
        <p className="mb-0">
          La carte des nids neutralisés est publique ; le signalement nécessite une connexion, pour garantir la qualité
          des données.
          <br />
          Apiculteurs : contactez-nous via <a href="mailto:vedrinsabeille@gmail.com">vedrin.sabeille@gmail.com</a> pour un accès privilégié.
        </p>
      </section>
    </>
  );
}
