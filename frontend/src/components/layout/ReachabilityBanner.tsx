import { useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { IconButton } from '../ui';
import { useReachability } from '../../hooks/useReachability';
import { probe } from '../../utils/reachability';

/**
 * Strip under the navbar while the server cannot be reached (no coverage, a
 * network the firewall does not let through). The app stays usable as far as
 * what is on screen goes; it retries by itself, the button retries now.
 *
 * Rendered inside the navbar, which it follows. While shown it sets
 * `reach-banner-shown` on the root element, so the content below the navbar
 * makes room for it (`--reach-banner-h` in `App.css`).
 */
export default function ReachabilityBanner() {
  const { unreachable, checking } = useReachability();

  useEffect(() => {
    if (!unreachable) return;
    document.documentElement.classList.add('reach-banner-shown');
    return () => document.documentElement.classList.remove('reach-banner-shown');
  }, [unreachable]);

  if (!unreachable) return null;

  return (
    <div className="reach-banner" role="status">
      <i className="bi bi-wifi-off flex-shrink-0" aria-hidden="true" />
      <span className="text-truncate">Serveur injoignable</span>
      <HelpTip id="reachability-help" title="Serveur injoignable">
        Le serveur ne répond pas. Vérifiez votre connexion&nbsp;: une zone sans couverture ou un réseau
        non autorisé peut en être la cause. L’application réessaie toute seule.
      </HelpTip>
      {checking && <Spinner animation="border" size="sm" role="status" aria-label="Vérification en cours" className="ms-auto flex-shrink-0" />}
      <IconButton
        variant="link"
        className={`${checking ? '' : 'ms-auto '}flex-shrink-0 text-reset`}
        icon="arrow-clockwise"
        label="Réessayer"
        disabled={checking}
        onClick={() => void probe(true)}
      />
    </div>
  );
}
