import './App.css'
import { Col, Container, Row, Alert } from 'react-bootstrap'
import { useAuth } from 'react-oidc-context';
import InteractiveMap from './InteractiveMap';
import NavbarComponent from './NavbarComponent';

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
    <>
      <NavbarComponent />
      <Container className="px-0">
        <Row className="g-0">
          <Col xs={12}>
            <InteractiveMap />
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default App
