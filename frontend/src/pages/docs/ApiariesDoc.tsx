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
            Tenez à jour le niveau d'infestation : faible, modéré ou fort
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

      <section className="mb-4">
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
          association, et triez : les plus infestés d'abord par défaut, ou « Le plus proche », qui
          utilise votre position et affiche la distance de chaque rucher.
        </p>
        <p className="mb-0">
          Sur chaque ligne : <strong>📍</strong> ouvre le module <em>Carte</em> centré sur le rucher,
          mis en évidence parmi ses voisins, avec un bouton <strong>← Ruchers</strong> pour revenir
          à la liste telle que vous l'aviez laissée ; le menu <strong>⋮</strong> donne accès à la
          fiche (et à son partage), à la modification et à la suppression, selon vos droits. Vos
          filtres sont conservés dans l'adresse de la page.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📍</span>
          Ajouter un rucher
        </h5>
        <p>
          Le bouton <strong>+</strong> de la liste ouvre le formulaire à votre position actuelle ;
          sa recherche d'adresse sert quand vous n'êtes pas au rucher. Dans le module
          {' '}<em>Carte</em>, touchez aussi l'endroit voulu puis choisissez « Rucher ». Le niveau
          d'infestation est demandé ; l'adresse est complétée depuis la position, la photo, le
          numéro d'enregistrement AFSCA et le commentaire sont facultatifs. Vous en devenez le
          propriétaire.
        </p>
        <p className="mb-0">
          Tout se modifie ensuite depuis la fiche du rucher (bouton ✏️), position comprise : une
          nouvelle adresse choisie dans la recherche déplace le rucher, les coordonnées GPS se
          corrigent à la main. Sur la carte, le cercle de 1 km autour de chaque rucher matérialise
          la zone de chasse des frelons à surveiller.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🔒</span>
          Visibilité et partage
        </h5>
        <p>
          Un rucher est <strong>privé</strong> : ni les visiteurs, ni les bénévoles, ni les autres
          apiculteurs ne le voient. Depuis sa fiche, section <em>Partage</em>, vous pouvez le
          montrer à une association dont vous êtes membre ; avec « Peut modifier », ses membres
          peuvent aussi le mettre à jour.
        </p>
        <p className="mb-0">
          Le partage se retire à tout moment. La suppression d'un rucher reste réservée à son
          propriétaire.
        </p>
      </section>

      <section>
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
        </ul>
      </section>
    </>
  );
}
