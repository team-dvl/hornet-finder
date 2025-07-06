
import './App.css'
import { Col, Container, Row } from 'react-bootstrap'
import CompassMap from './CompassMap'
import { useAuth } from 'react-oidc-context';

function App() {

  const auth = useAuth();

  switch (auth.activeNavigator) {
      case "signinSilent":
          return <div>Signing you in...</div>;
      case "signoutRedirect":
          return <div>Signing you out...</div>;
  }

  if (auth.isLoading) {
      return <div>Loading...</div>;
  }

  if (auth.error) {
      return <div>Oops... {auth.error.name} caused {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
      return (
      <div>
          Hello {auth.user?.profile.sub}{" "}
          <button onClick={() => void auth.removeUser()}>Log out</button>
      </div>
      );
  }

  return (
    <>
      <button onClick={() => void auth.signinRedirect()}>Log in</button>
      <Container fluid className="px-3">
        <h2>Hornet Nest Finder</h2>
        <p>Find and report hornet nests in your area.</p>
      
        <Row className="w-100">
          <Col xs={12} className="w-100">
            <CompassMap/>
          </Col>
        </Row>
      </Container>
    </>
  )
}

export default App
