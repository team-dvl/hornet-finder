import { Container, Row, Col, Alert, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function DataDeletion() {
  return (
    <Container className="py-4">
      <Row>
        <Col lg={8} className="mx-auto">
          <div className="mb-4">
            <Link to="/" className="btn btn-outline-secondary mb-3">
              ← Retour à l'application
            </Link>
          </div>

          <h1 className="mb-4">Suppression des Données Utilisateur</h1>
          
          <Alert variant="info" className="mb-4">
            <Alert.Heading>Information importante</Alert.Heading>
            <p className="mb-0">
              Cette page concerne la suppression des données utilisateur dans le cadre 
              de l'utilisation de Facebook comme fournisseur d'identité pour l'application Velutina.
            </p>
          </Alert>

          <section className="mb-5">
            <h2>Demande de suppression de données</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et 
              aux exigences de Facebook pour les applications tierces, vous avez le droit 
              de demander la suppression de toutes vos données personnelles stockées par 
              notre application.
            </p>
          </section>

          <section className="mb-5">
            <h2>Quelles données seront supprimées ?</h2>
            <p>Une demande de suppression complète inclura :</p>
            <ul>
              <li>Votre profil utilisateur et informations d'authentification</li>
              <li>Tous les signalements de nids que vous avez créés</li>
              <li>Vos données de géolocalisation associées aux signalements</li>
              <li>Toutes les photos et descriptions que vous avez fournies</li>
              <li>L'historique de vos connexions et activités sur l'application</li>
            </ul>
          </section>

          <section className="mb-5">
            <h2>Important à savoir</h2>
            <Alert variant="warning">
              <ul className="mb-0">
                <li>
                  <strong>Suppression irréversible :</strong> Cette action est définitive et ne peut pas être annulée.
                </li>
                <li>
                  <strong>Impact sur les données scientifiques :</strong> Les signalements déjà traités 
                  par les autorités compétentes pourraient être conservés sous forme anonymisée 
                  à des fins de recherche environnementale.
                </li>
                <li>
                  <strong>Délai de traitement :</strong> Votre demande sera traitée dans un délai 
                  maximum de 30 jours conformément au RGPD.
                </li>
              </ul>
            </Alert>
          </section>

          <Card className="mb-5">
            <Card.Header className="bg-primary text-white">
              <h3 className="mb-0">Comment faire une demande de suppression</h3>
            </Card.Header>
            <Card.Body>
              <p>
                Pour demander la suppression de vos données, veuillez nous contacter 
                par email en incluant les informations suivantes :
              </p>
              
              <div className="bg-light p-3 rounded mb-3">
                <strong>Adresse email :</strong> 
                <a href="mailto:contact@velutina.ovh?subject=Demande de suppression de données - Facebook IDP" className="ms-2">
                  contact@velutina.ovh
                </a>
              </div>

              <h5>Informations à inclure dans votre email :</h5>
              <ul>
                <li><strong>Objet :</strong> "Demande de suppression de données - Facebook IDP"</li>
                <li><strong>Votre adresse email</strong> utilisée pour vous connecter via Facebook</li>
                <li><strong>Votre nom complet</strong> tel qu'il apparaît sur Facebook</li>
                <li><strong>Date approximative</strong> de votre première connexion à l'application</li>
                <li><strong>Confirmation explicite</strong> que vous souhaitez supprimer toutes vos données</li>
              </ul>

              <Alert variant="info" className="mt-3">
                <small>
                  <strong>Note :</strong> Pour des raisons de sécurité, nous pourrons vous demander 
                  des informations supplémentaires pour vérifier votre identité avant de 
                  procéder à la suppression.
                </small>
              </Alert>
            </Card.Body>
          </Card>

          <section className="mb-5">
            <h2>Alternatives à la suppression complète</h2>
            <p>
              Si vous ne souhaitez pas supprimer toutes vos données mais voulez limiter 
              leur utilisation, vous pouvez également demander :
            </p>
            <ul>
              <li><strong>Anonymisation :</strong> Suppression de vos données personnelles en conservant les signalements de manière anonyme</li>
              <li><strong>Restriction du traitement :</strong> Suspension temporaire de l'utilisation de vos données</li>
              <li><strong>Correction des données :</strong> Modification d'informations incorrectes</li>
            </ul>
          </section>

          <section className="mb-5">
            <h2>Après la suppression</h2>
            <p>
              Une fois vos données supprimées :
            </p>
            <ul>
              <li>Vous ne pourrez plus accéder à l'application avec votre compte Facebook actuel</li>
              <li>Tous vos signalements seront définitivement supprimés de notre base de données</li>
              <li>Vous recevrez un email de confirmation de la suppression</li>
              <li>Vous pourrez créer un nouveau compte si vous souhaitez utiliser à nouveau l'application</li>
            </ul>
          </section>

          <section className="mb-5">
            <h2>Contact et réclamations</h2>
            <p>
              Pour toute question sur cette procédure ou en cas de problème avec votre 
              demande de suppression, contactez-nous à :
            </p>
            <p>
              <strong>Email :</strong> <a href="mailto:contact@velutina.ovh">contact@velutina.ovh</a>
            </p>
            <p>
              En cas de désaccord, vous avez le droit de déposer une réclamation auprès 
              de la Commission Nationale de l'Informatique et des Libertés (CNIL).
            </p>
          </section>

          <div className="text-center mt-5">
            <Link to="/" className="btn btn-primary me-3">
              Retour à l'application
            </Link>
            <a 
              href="mailto:contact@velutina.ovh?subject=Demande de suppression de données - Facebook IDP" 
              className="btn btn-outline-danger"
            >
              Demander la suppression de mes données
            </a>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
