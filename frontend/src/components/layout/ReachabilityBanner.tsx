import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { IconButton } from '../ui';
import { useReachability } from '../../hooks/useReachability';
import { probe } from '../../utils/reachability';
import { fetchPublicIps, type PublicIps } from '../../utils/publicIp';

/**
 * The device's public IP address(es), for whoever manages the firewall's
 * allowlist. Mounted when the help opens, so it is only asked for then.
 */
function PublicIpInfo() {
  const [ips, setIps] = useState<PublicIps | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicIps().then((found) => { if (!cancelled) setIps(found); });
    return () => { cancelled = true; };
  }, []);

  if (!ips) return <div className="mt-2 text-secondary">Recherche de votre adresse IP…</div>;
  if (!ips.v4 && !ips.v6) return <div className="mt-2 text-secondary">Adresse IP indisponible.</div>;
  return (
    <div className="mt-2">
      Votre adresse IP publique&nbsp;:
      {ips.v4 && <div><code className="user-select-all text-body">{ips.v4}</code></div>}
      {ips.v6 && <div><code className="user-select-all text-break text-body">{ips.v6}</code></div>}
    </div>
  );
}

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
        <PublicIpInfo />
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
