import { Modal, Button, ListGroup, Badge } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';

interface UserInfoModalProps {
  show: boolean;
  onHide: () => void;
}

// Function to decode JWT token
function decodeJWT(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

export default function UserInfoModal({ show, onHide }: UserInfoModalProps) {
  const auth = useAuth();

  if (!auth.user) {
    return null;
  }

  const profile = auth.user.profile;
  
  // Decode the access token to get the claims
  const accessToken = auth.user.access_token;
  const decodedToken = accessToken ? decodeJWT(accessToken) : null;
  
  console.log('Access token string:', accessToken);
  console.log('Decoded token:', decodedToken);
  
  // Extract roles from the decoded access token
  const realmAccess = decodedToken?.realm_access;
  const realmRoles = realmAccess?.roles || [];
  
  console.log('Realm access from decoded token:', realmAccess);

  // Filter relevant roles  
  const roles = realmRoles.filter((role: string) => 
    role === 'volunteer' || 
    role === 'beekeeper' || 
    role === 'admin'
  );
  
  const tokenExpiry = decodedToken?.exp;

  console.log('Extracted roles:', roles);

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Informations utilisateur</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <ListGroup variant="flush">
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Nom d'utilisateur:</strong>
            <span>{profile.preferred_username || profile.name}</span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Nom complet:</strong>
            <span>{profile.name || 'Non disponible'}</span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Email:</strong>
            <span>{profile.email || 'Non disponible'}</span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-start">
            <strong>Rôles:</strong>
            <div className="d-flex flex-wrap gap-1">
              {roles.length > 0 ? (
                roles.map((role: string, index: number) => (
                  <Badge key={index} bg="primary" pill>
                    {role}
                  </Badge>
                ))
              ) : (
                <span className="text-muted">Aucun rôle</span>
              )}
            </div>
          </ListGroup.Item>
          
          {profile.sub && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>ID utilisateur:</strong>
              <span className="text-muted small">{profile.sub}</span>
            </ListGroup.Item>
          )}
          
          {tokenExpiry && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Token expire:</strong>
              <span className="text-muted small">
                {new Date(tokenExpiry * 1000).toLocaleString()}
              </span>
            </ListGroup.Item>
          )}
        </ListGroup>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
