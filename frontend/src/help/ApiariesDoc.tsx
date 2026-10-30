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
          est complétée depuis la position ; le niveau d'infestation (« Non évalué » par défaut),
          la photo, le numéro d'enregistrement AFSCA et le commentaire sont facultatifs. Vous en devenez le
          propriétaire.
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
          d'une colonie ; <em>réformée</em>, elle sort de l'usage.
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
        </ul>
      </section>
    </>
  );
}
