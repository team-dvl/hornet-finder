
import './App.css'
import { Col, Container, Row } from 'react-bootstrap'
import { useAuth } from 'react-oidc-context';
import InteractiveMap from './InteractiveMap';

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


  return (
      <Container fluid className='px-0'>
        <h2>Hornet Nest Finder</h2>
        <p><i>Find and report hornet nests in your area!</i></p>
        { /* login button, display only if not authenticated */}
        {!auth.isAuthenticated && <button onClick={() => void auth.signinRedirect()}>Log in</button>}
        {auth.isAuthenticated && <button onClick={() => void auth.signoutRedirect(
          { post_logout_redirect_uri: window.location.origin }
        )}>Log out {auth.user?.profile.name}</button>}
        <Row className="w-100 g-0">
          <Col xs={12} className="w-100">
            <InteractiveMap />
          </Col>
        </Row>
      </Container>
  )
}

export default App
