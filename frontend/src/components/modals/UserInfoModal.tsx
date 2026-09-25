import { useRef } from 'react';
import { Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { jwtDecode } from 'jwt-decode';
import { HelpTip, UserAvatar } from '../common';
import { AppModal, FieldRow, IconButton } from '../ui';
import TokenStatusBadge from '../debug/TokenStatusBadge';
import { formatDateTime } from '../../utils/format';
import { accountConsoleUrl } from '../../utils/authRedirect';
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
  const accountUrl = accountConsoleUrl(auth.settings.authority, auth.settings.client_id);

  return (
    <AppModal show={show} onHide={onHide} title="Mon profil">
      {/* Profile photo, also shown in the Keycloak account console */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <UserAvatar url={avatarUrl} size={72} />
        <div className="min-w-0">
          <div className="fw-semibold text-truncate">{profile.name || profile.preferred_username}</div>
          <div className="d-flex align-items-center gap-2 mt-1">
            <IconButton
              variant="outline-primary"
              size="sm"
              icon="camera"
              label={avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
              showLabel="always"
              disabled={saving}
              onClick={() => fileInput.current?.click()}
            />
            {avatarUrl && (
              <IconButton
                variant="outline-danger"
                size="sm"
                icon="trash"
                label="Supprimer la photo"
                showLabel="never"
                disabled={saving}
                onClick={() => void dispatch(deleteAvatar())}
              />
            )}
            {saving && <Spinner animation="border" size="sm" />}
            <HelpTip id="profile-photo-help" title="Photo de profil">
              Visible dans l'application et dans « Mon compte ».
            </HelpTip>
          </div>
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

      <FieldRow label="Email">
        {profile.email ? (
          <a href={`mailto:${profile.email}`} className="text-decoration-none">{profile.email}</a>
        ) : '—'}
      </FieldRow>
      <FieldRow label="Rôles">
        <span className="d-inline-flex flex-wrap gap-1 justify-content-end">
          {roles.length > 0
            ? roles.map((role) => <Badge key={role} bg="primary" pill>{role}</Badge>)
            : <span className="text-muted">aucun</span>}
        </span>
      </FieldRow>
      {Array.isArray(profile.membership) && (
        <FieldRow label="Groupes">
          <span className="d-inline-flex flex-wrap gap-1 justify-content-end">
            {profile.membership.length === 0 && <span className="text-muted">aucun</span>}
            {(profile.membership as string[])
              .slice()
              .sort((a, b) => a.localeCompare(b))
              .map((group) => (
                <Badge key={group} bg="info" pill>{group.startsWith('/') ? group.slice(1) : group}</Badge>
              ))}
          </span>
        </FieldRow>
      )}

      {/* Technical details, for development only */}
      {import.meta.env.DEV && (
        <div className="mt-3 pt-2 border-top small">
          <FieldRow label="Identifiant">{profile.sub}</FieldRow>
          {tokenExpiry && <FieldRow label="Jeton valable jusqu'au">{formatDateTime(tokenExpiry * 1000)}</FieldRow>}
          <div className="mt-2"><TokenStatusBadge /></div>
        </div>
      )}
      <div className="mt-3">
        <Button variant="link" className="p-0" href={accountUrl}>
          <i className="bi bi-person-gear me-2" aria-hidden="true" />
          Gérer mon compte (mot de passe, connexions)
        </Button>
      </div>
    </AppModal>
  );
}
