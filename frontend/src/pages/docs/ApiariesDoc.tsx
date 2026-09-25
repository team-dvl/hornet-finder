import { Row, Col } from 'react-bootstrap';

/** User documentation of the apiary module. */
export default function ApiariesDoc() {
  return (
    <>
      <p className="lead text-muted">
        Situez vos ruchers, suivez leur niveau d'infestation et partagez-les avec votre association.
      </p>

      <Row className="my-4">
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>🍯</div>
          <h6 className="mt-2">Situer</h6>
          <p className="small text-muted">
            Placez un rucher d'un toucher sur la carte, avec une photo et son numéro AFSCA
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
          <span className="me-2">📍</span>
          Ajouter un rucher
        </h5>
        <p className="mb-0">
          Depuis le module <em>Ruchers</em>, touchez la carte à l'emplacement du rucher puis
          choisissez « Rucher ». Le niveau d'infestation est demandé ; la photo, le numéro
          d'enregistrement AFSCA et le commentaire sont facultatifs. Vous en devenez le
          propriétaire. Tout se modifie ensuite depuis la fiche du rucher (bouton ✏️).
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🗺️</span>
          Retrouver ses ruchers
        </h5>
        <p className="mb-0">
          La carte montre vos ruchers et ceux que vos associations partagent avec vous. Pour ne voir
          que les vôtres, activez « Mes ruchers seulement » dans les couches. Le cercle de 1 km
          autour de chaque rucher matérialise la zone de chasse des frelons à surveiller.
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
