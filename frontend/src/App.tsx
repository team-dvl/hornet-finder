import './App.css'
import { Col, Container, Row, Button, Alert } from 'react-bootstrap'
import { useAuth } from 'react-oidc-context';
import InteractiveMap from './InteractiveMap';

function App() {
  const auth = useAuth();

  switch (auth.activeNavigator) {
    case "signinSilent":
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Alert variant="info">Signing you in...</Alert>
        </Container>
      );
    case "signoutRedirect":
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Alert variant="info">Signing you out...</Alert>
        </Container>
      );
  }

  if (auth.isLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="info">Loading...</Alert>
      </Container>
    );
  }

  if (auth.error) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="danger">
          Oops... {auth.error.name} caused {auth.error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="px-0">
      <Container className="py-2">
        <Row className="mb-2">
          <Col>
            <h2 className="mb-1">Hornet Nest Finder</h2>
            <p className="text-muted fst-italic mb-2">
              Find and report hornet nests in your area!
            </p>
          </Col>
        </Row>
        
        <Row className="mb-2">
          <Col>
            {!auth.isAuthenticated && (
              <Button 
                variant="primary" 
                onClick={() => void auth.signinRedirect()}
              >
                Log in
              </Button>
            )}
            {auth.isAuthenticated && (
              <Button 
                variant="outline-secondary" 
                onClick={() => void auth.signoutRedirect(
                  { post_logout_redirect_uri: window.location.origin }
                )}
              >
                Log out {auth.user?.profile.name}
              </Button>
            )}
          </Col>
        </Row>
      </Container>
      
      <Container fluid className="px-0">
        <Row className="g-0">
          <Col xs={12}>
            <InteractiveMap />
          </Col>
        </Row>
      </Container>
    </Container>
  );
}

export default App
