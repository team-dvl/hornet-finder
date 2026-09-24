import { Row, Col } from 'react-bootstrap';

/** User documentation of the trap module. */
export default function TrapsDoc() {
  return (
    <>
      <p className="lead text-muted">
        Cartographiez vos pièges, notez chaque passage et suivez les captures au fil de la saison.
      </p>

      <Row className="my-4">
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>🪤</div>
          <h6 className="mt-2">Installer</h6>
          <p className="small text-muted">
            Placez un piège d'un clic sur la carte ou en cherchant une adresse
          </p>
        </Col>
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>📋</div>
          <h6 className="mt-2">Entretenir</h6>
          <p className="small text-muted">
            Consignez inspections, nettoyages, recharges et réparations
          </p>
        </Col>
        <Col md={4} className="text-center mb-3">
          <div style={{ fontSize: '3rem' }}>🐝</div>
          <h6 className="mt-2">Compter</h6>
          <p className="small text-muted">
            Enregistrez vos captures par espèce ; le compteur de frelons asiatiques se met à jour
          </p>
        </Col>
      </Row>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📍</span>
          Placer et déplacer un piège
        </h5>
        <p>
          Depuis le module <em>Pièges</em>, cliquez à l'endroit voulu sur la carte puis choisissez
          « Ajouter un piège ». Le bouton <strong>🪤 Piège</strong> des contrôles de la carte ouvre
          le même formulaire avec une recherche d'adresse, pratique quand le piège n'est pas là où
          vous vous trouvez.
        </p>
        <p>
          Pour corriger une position, ouvrez la fiche du piège et utilisez <strong>Déplacer</strong> :
          le marqueur devient déplaçable, la nouvelle position n'est enregistrée qu'après validation.
        </p>
        <p className="mb-0">
          L'adresse et les coordonnées sont deux choses distinctes : l'adresse sert surtout à poser
          le piège et à le retrouver, la position GPS seule le situe. Un déplacement vous propose
          donc l'adresse du nouvel emplacement, mais ne remplace jamais la vôtre sans confirmation.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🏷️</span>
          Le QR Code du piège
        </h5>
        <p className="mb-0">
          Imprimez des QR Codes vierges depuis <em>Administration → QR Codes</em>, en PDF A4 à
          découper, puis collez-en un sur chaque piège. Scannez-le depuis la carte des pièges
          (bouton 📷) pour l'associer au piège ; ensuite, le même scan ouvre directement sa fiche.
          Une étiquette abîmée ? Réimprimez-la depuis <em>Mes QR Codes en service</em> : le QR Code
          reste le même, et le numéro du piège est imprimé sous le code.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📖</span>
          Le journal du piège
        </h5>
        <p>
          Captures et entretien vivent dans un même journal, en ordre chronologique : constater une
          capture, c'est aussi passer au piège. Chaque intervention porte une date, son auteur, un
          commentaire et des photos facultatives.
        </p>
        <ul className="mb-0">
          <li><strong>Capture</strong> : une carte par espèce trouvée dans le piège (frelon asiatique
            par défaut), avec son décompte et une photo facultative</li>
          <li><strong>Inspection, nettoyage, recharge, réparation</strong> : l'entretien courant</li>
          <li><strong>Installation</strong> : remet le piège en service, à la date indiquée</li>
          <li><strong>Retrait</strong> : marque le piège comme remisé — il reste sur la carte, en gris</li>
        </ul>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">👁️</span>
          Visibilité et délégation
        </h5>
        <p>
          Un piège est <strong>public</strong> par défaut : sa position, son type et son compteur de
          captures sont visibles de tous, y compris sans compte. Le journal, lui, n'est lisible que par
          les utilisateurs connectés, et le propriétaire n'est jamais montré aux visiteurs anonymes.
        </p>
        <p className="mb-0">
          Vous pouvez déléguer l'entretien à une association dont vous êtes membre, par exemple
          pendant une absence : ses membres peuvent alors enregistrer captures et interventions. En
          option, la visibilité du piège se restreint à ce groupe. La délégation se retire à tout
          moment, par vous, par un administrateur de ce groupe ou par un administrateur de la
          plateforme.
        </p>
      </section>

      <section>
        <h5 className="text-primary">Qui peut faire quoi ?</h5>
        <ul className="mb-0">
          <li><strong>Propriétaire</strong> (bénévole ou apiculteur) : tout sur ses pièges</li>
          <li><strong>Groupe délégataire</strong> : consulter et enregistrer des interventions</li>
          <li>
            <strong>Administrateur d'un groupe</strong> : désigner ou retirer la délégation des
            pièges des membres de son groupe
          </li>
          <li>
            <strong>Administrateur de la plateforme</strong> : gérer les pièges et les référentiels,
            réattribuer un piège légué, modérer le journal — mais pas enregistrer d'intervention,
            ce n'est pas son rôle
          </li>
        </ul>
      </section>
    </>
  );
}
