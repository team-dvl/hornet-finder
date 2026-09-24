import { useRef } from 'react';
import { Modal, Button, ListGroup, Badge, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';
import { UserAvatar } from '../common';
import { useAvatarUrl } from '../../hooks/useAvatarUrl';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  uploadAvatar, deleteAvatar, clearProfileError, selectProfileSaving, selectProfileError,
} from '../../store/store';

interface UserInfoModalProps {
  show: boolean;
  onHide: () => void;
}

// Interface for JWT claims structure
interface JWTClaims {
  exp: number;
  realm_access?: {
    roles: string[];
  };
  name?: string;
  preferred_username?: string;
  email?: string;
  sub?: string;
}

export default function UserInfoModal({ show, onHide }: UserInfoModalProps) {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const avatarUrl = useAvatarUrl();
  const saving = useAppSelector(selectProfileSaving);
  const photoError = useAppSelector(selectProfileError);
  const fileInput = useRef<HTMLInputElement>(null);

  const handlePhotoChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so that choosing the same file again still fires a change
    event.target.value = '';
    if (file) void dispatch(uploadAvatar(file));
  };

  if (!auth.user) {
    return null;
  }

  const profile = auth.user.profile;
  
  // Decode the access token using jwt-decode library
  const accessToken = auth.user.access_token;
  let decodedToken: JWTClaims | null = null;
  
  try {
    decodedToken = accessToken ? jwtDecode<JWTClaims>(accessToken) : null;
  } catch (error) {
    console.error('Error decoding JWT:', error);
  }
  
  
  // Extract roles from the decoded access token
  const realmAccess = decodedToken?.realm_access;
  const realmRoles = realmAccess?.roles || [];

  // Filter relevant roles  
  const roles = realmRoles.filter((role: string) => 
    role === 'volunteer' || 
    role === 'beekeeper' || 
    role === 'admin'
  );
  
  const tokenExpiry = decodedToken?.exp;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Informations utilisateur</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {/* Profile photo, also shown in the Keycloak account console */}
        <div className="d-flex align-items-center gap-3 mb-3">
          <UserAvatar url={avatarUrl} size={80} />
          <div className="d-flex flex-column align-items-start gap-2">
            <div className="d-flex flex-wrap gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                disabled={saving}
                onClick={() => fileInput.current?.click()}
              >
                {saving ? (
                  <Spinner animation="border" size="sm" className="me-1" />
                ) : (
                  <i className="bi bi-camera me-1" />
                )}
                {avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
              </Button>
              {avatarUrl && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  disabled={saving}
                  onClick={() => void dispatch(deleteAvatar())}
                >
                  <i className="bi bi-trash me-1" />
                  Supprimer
                </Button>
              )}
            </div>
            <small className="text-muted">Visible dans l'application et dans « Mon compte ».</small>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="d-none"
            onChange={handlePhotoChosen}
          />
        </div>
        {photoError && (
          <Alert variant="danger" dismissible onClose={() => dispatch(clearProfileError())}>
            {photoError}
          </Alert>
        )}

        <ListGroup variant="flush">
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Nom d'utilisateur:</strong>
            <span className="text-end">{profile.preferred_username || profile.name}</span>
          </ListGroup.Item>
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Nom complet:</strong>
            <span className="text-end">{profile.name || 'Non disponible'}</span>
          </ListGroup.Item>
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Email:</strong>
            {profile.email ? (
              <a href={`mailto:${profile.email}`} className="text-end text-decoration-none">
                {profile.email}
              </a>
            ) : (
              <span className="text-end">Non disponible</span>
            )}
          </ListGroup.Item>
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Rôles:</strong>
            <div className="d-flex flex-wrap gap-1 justify-content-end">
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

          {/* Affichage des groupes (membership) dans une colonne à droite, badges alignés horizontalement, triés */}
          {Array.isArray(profile.membership) && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Groupes:</strong>
              <div className="d-flex flex-wrap gap-1 justify-content-end">
                {profile.membership
                  .slice() // copie pour ne pas muter
                  .sort((a: string, b: string) => a.localeCompare(b))
                  .map((group: string, idx: number) => (
                    <Badge key={group + idx} bg="info" pill>
                      {group.startsWith('/') ? group.slice(1) : group}
                    </Badge>
                  ))}
                {profile.membership.length === 0 && (
                  <span className="text-muted">Aucun groupe</span>
                )}
              </div>
            </ListGroup.Item>
          )}
          
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
