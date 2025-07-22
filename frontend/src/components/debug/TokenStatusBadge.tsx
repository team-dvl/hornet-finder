import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTokenMonitor } from '../../hooks/useTokenMonitor';

/**
 * Composant de diagnostic pour surveiller l'état des tokens
 * À utiliser temporairement pour vérifier que le renouvellement automatique fonctionne
 */
export default function TokenStatusBadge() {
  const { tokenInfo, renewalAttempts, formatTimeLeft, isTokenValid, willExpireSoon } = useTokenMonitor();

  if (!tokenInfo) {
    return null;
  }

  const variant = willExpireSoon ? 'danger' : (isTokenValid ? 'success' : 'warning');
  const timeLeft = formatTimeLeft(tokenInfo.timeUntilExpiry);

  const tooltip = (
    <Tooltip id="token-tooltip">
      <div>
        <strong>Token Info:</strong><br/>
        Expire dans: {timeLeft}<br/>
        Expiration: {new Date(tokenInfo.exp * 1000).toLocaleString('fr-FR')}<br/>
        {renewalAttempts > 0 && (
          <>Tentatives de renouvellement: {renewalAttempts}<br/></>
        )}
      </div>
    </Tooltip>
  );

  return (
    <OverlayTrigger placement="bottom" overlay={tooltip}>
      <Badge 
        bg={variant} 
        className="ms-2 cursor-pointer"
        style={{ fontSize: '0.6em', cursor: 'pointer' }}
      >
        🔐 {timeLeft}
        {renewalAttempts > 0 && ' ⚠️'}
      </Badge>
    </OverlayTrigger>
  );
}
