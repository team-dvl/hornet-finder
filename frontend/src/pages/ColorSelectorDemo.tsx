import { useState } from 'react';
import { Container, Row, Col, Card, Form } from 'react-bootstrap';
import { ColorSelector } from '../components/forms';
import { COLOR_OPTIONS } from '../utils/colors';

/**
 * Page de démonstration pour le composant ColorSelector
 * Cette page montre les différents modes et tailles du composant
 */
export default function ColorSelectorDemo() {
  const [selectedColor1, setSelectedColor1] = useState('red');
  const [selectedColor2, setSelectedColor2] = useState('blue');
  const [selectedColor3, setSelectedColor3] = useState('');

  return (
    <Container className="py-4">
      <h1 className="mb-4">Démonstration du composant ColorSelector</h1>
      
      <Row className="g-4">
        {/* Mode Read-Write */}
        <Col lg={6}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Mode Read-Write (Dropdown)</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <h6>Taille Small</h6>
                <ColorSelector
                  value={selectedColor1}
                  onChange={setSelectedColor1}
                  label="Couleur sélectionnée"
                  size="sm"
                />
              </div>
              
              <div className="mb-3">
                <h6>Taille Medium (défaut)</h6>
                <ColorSelector
                  value={selectedColor2}
                  onChange={setSelectedColor2}
                  label="Couleur sélectionnée"
                  size="md"
                />
              </div>
              
              <div className="mb-3">
                <h6>Taille Large</h6>
                <ColorSelector
                  value={selectedColor3}
                  onChange={setSelectedColor3}
                  label="Couleur sélectionnée"
                  size="lg"
                />
              </div>
              
              <div className="mb-3">
                <h6>Composant désactivé</h6>
                <ColorSelector
                  value="green"
                  onChange={() => {}}
                  label="Couleur désactivée"
                  disabled
                />
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Mode Read-Only */}
        <Col lg={6}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Mode Read-Only (Badge)</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <h6>Badges de couleurs (taille small)</h6>
                <div className="d-flex flex-wrap gap-2">
                  {COLOR_OPTIONS.filter(c => c.value !== '').map(color => (
                    <ColorSelector
                      key={color.value}
                      value={color.value}
                      readOnly
                      size="sm"
                    />
                  ))}
                </div>
              </div>
              
              <div className="mb-3">
                <h6>Badges de couleurs (taille medium)</h6>
                <div className="d-flex flex-wrap gap-2">
                  {['red', 'blue', 'green', 'yellow', 'orange'].map(color => (
                    <ColorSelector
                      key={color}
                      value={color}
                      readOnly
                      size="md"
                    />
                  ))}
                </div>
              </div>
              
              <div className="mb-3">
                <h6>Couleurs sélectionnées actuellement</h6>
                <div className="d-flex gap-2 mb-2">
                  <span>Couleur 1 :</span>
                  <ColorSelector value={selectedColor1} readOnly size="sm" />
                </div>
                <div className="d-flex gap-2 mb-2">
                  <span>Couleur 2 :</span>
                  <ColorSelector value={selectedColor2} readOnly size="sm" />
                </div>
                <div className="d-flex gap-2">
                  <span>Couleur 3 :</span>
                  {selectedColor3 ? (
                    <ColorSelector value={selectedColor3} readOnly size="sm" />
                  ) : (
                    <span className="text-muted">Aucune couleur</span>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Exemple d'utilisation en contexte</h5>
            </Card.Header>
            <Card.Body>
              <h6>Simulation d'un formulaire de frelon</h6>
              <Form>
                <Row>
                  <Col md={6}>
                    <ColorSelector
                      value={selectedColor1}
                      onChange={setSelectedColor1}
                      label="Couleur de marquage 1"
                      size="sm"
                    />
                  </Col>
                  <Col md={6}>
                    <ColorSelector
                      value={selectedColor2}
                      onChange={setSelectedColor2}
                      label="Couleur de marquage 2"
                      size="sm"
                    />
                  </Col>
                </Row>
              </Form>
              
              <div className="mt-3">
                <h6>Affichage en lecture seule :</h6>
                <div className="d-flex gap-2 align-items-center">
                  <span>Marquages :</span>
                  <ColorSelector value={selectedColor1} readOnly size="sm" />
                  <ColorSelector value={selectedColor2} readOnly size="sm" />
                  {!selectedColor1 && !selectedColor2 && (
                    <span className="text-muted">Aucun marquage</span>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
