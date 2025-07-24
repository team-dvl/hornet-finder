import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <Container className="py-4">
      <Row>
        <Col lg={8} className="mx-auto">
          <div className="mb-4">
            <Link to="/" className="btn btn-outline-secondary mb-3">
              ← Retour à l'application
            </Link>
          </div>

          <h1 className="mb-4">Politique de Confidentialité</h1>
          
          <div className="text-muted mb-4">
            <small>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</small>
          </div>

          <section className="mb-5">
            <h2>1. Introduction</h2>
            <p>
              Velutina (ci-après "l'Application") est une application dédiée au signalement 
              des nids de frelons asiatiques. Cette politique de confidentialité décrit comment 
              nous collectons, utilisons et protégeons vos données personnelles dans le cadre 
              de l'utilisation de notre service.
            </p>
          </section>

          <section className="mb-5">
            <h2>2. Finalité du traitement</h2>
            <p>
              <strong>Les données utilisateur sont exclusivement utilisées dans le seul but 
              poursuivi par cette application :</strong> permettre le signalement et la 
              cartographie des nids de frelons asiatiques pour contribuer à la lutte contre 
              cette espèce invasive.
            </p>
            <p>
              Nous ne collectons et ne traitons vos données que dans la mesure nécessaire 
              pour assurer le bon fonctionnement de l'application et la réalisation de 
              cette mission d'intérêt public.
            </p>
          </section>

          <section className="mb-5">
            <h2>3. Données collectées</h2>
            <p>Dans le cadre de l'utilisation de l'application, nous pouvons collecter :</p>
            <ul>
              <li>Informations de profil (nom, email) fournies par votre fournisseur d'identité (Facebook, Google, etc.)</li>
              <li>Données de géolocalisation des signalements</li>
              <li>Informations techniques relatives aux signalements (photos, descriptions, dates)</li>
              <li>Données de connexion et d'utilisation de l'application</li>
            </ul>
          </section>

          <section className="mb-5">
            <h2>4. Base légale du traitement (RGPD)</h2>
            <p>Conformément au Règlement Général sur la Protection des Données (RGPD), nos traitements reposent sur :</p>
            <ul>
              <li><strong>L'intérêt légitime</strong> (Art. 6.1.f RGPD) : lutte contre une espèce invasive nuisible à l'environnement</li>
              <li><strong>Votre consentement</strong> (Art. 6.1.a RGPD) : pour l'utilisation de services tiers d'authentification</li>
              <li><strong>L'exécution d'une mission d'intérêt public</strong> (Art. 6.1.e RGPD) : protection de l'environnement et de la biodiversité</li>
            </ul>
          </section>

          <section className="mb-5">
            <h2>5. Partage des données</h2>
            <p>
              Les données de signalement peuvent être partagées avec les autorités compétentes 
              (collectivités territoriales, services environnementaux, associations de lutte 
              contre le frelon asiatique) dans le cadre de la mission d'intérêt public de 
              l'application.
            </p>
            <p>
              Nous ne vendons, ne louons ni ne partageons vos données personnelles à des fins 
              commerciales avec des tiers.
            </p>
          </section>

          <section className="mb-5">
            <h2>6. Vos droits (RGPD)</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Droit d'accès</strong> (Art. 15) : obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification</strong> (Art. 16) : corriger des données inexactes</li>
              <li><strong>Droit à l'effacement</strong> (Art. 17) : demander la suppression de vos données</li>
              <li><strong>Droit à la limitation</strong> (Art. 18) : limiter le traitement de vos données</li>
              <li><strong>Droit à la portabilité</strong> (Art. 20) : récupérer vos données dans un format structuré</li>
              <li><strong>Droit d'opposition</strong> (Art. 21) : vous opposer au traitement pour des motifs légitimes</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à l'adresse email indiquée dans la section contact.
            </p>
          </section>

          <section className="mb-5">
            <h2>7. Conservation des données</h2>
            <p>
              Vos données personnelles sont conservées uniquement pendant la durée nécessaire 
              aux finalités pour lesquelles elles ont été collectées, conformément aux 
              obligations légales et réglementaires applicables.
            </p>
            <p>
              Les données de signalement peuvent être conservées plus longtemps à des fins 
              statistiques et de recherche scientifique, après anonymisation.
            </p>
          </section>

          <section className="mb-5">
            <h2>8. Sécurité des données</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées 
              pour protéger vos données personnelles contre la perte, l'utilisation abusive, 
              l'accès non autorisé, la divulgation, l'altération ou la destruction.
            </p>
          </section>

          <section className="mb-5">
            <h2>9. Transferts internationaux</h2>
            <p>
              Dans le cadre de l'utilisation de services d'authentification tiers (Facebook, Google), 
              vos données peuvent être transférées vers des pays situés en dehors de l'Espace 
              Économique Européen. Ces transferts sont encadrés par des garanties appropriées 
              conformément au RGPD.
            </p>
          </section>

          <section className="mb-5">
            <h2>10. Contact et délégué à la protection des données</h2>
            <p>
              Pour toute question relative à cette politique de confidentialité ou pour 
              exercer vos droits RGPD, vous pouvez nous contacter à :
            </p>
            <p>
              <strong>Email :</strong> <a href="mailto:contact@velutina.ovh">contact@velutina.ovh</a>
            </p>
            <p>
              Vous avez également le droit d'introduire une réclamation auprès de la 
              Commission Nationale de l'Informatique et des Libertés (CNIL) si vous 
              estimez que le traitement de vos données ne respecte pas la réglementation.
            </p>
          </section>

          <section className="mb-5">
            <h2>11. Modifications de cette politique</h2>
            <p>
              Cette politique de confidentialité peut être mise à jour périodiquement. 
              Les modifications importantes vous seront notifiées via l'application ou 
              par email.
            </p>
          </section>

          <div className="text-center mt-5">
            <Link to="/" className="btn btn-primary">
              Retour à l'application
            </Link>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
