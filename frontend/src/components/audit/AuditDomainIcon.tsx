import { DOMAINS } from '../../utils/auditLabels';

/** Icon of a domain of the audit trail: the map object's emoji, else a bootstrap icon. */
export default function AuditDomainIcon({ domain }: { domain: string }) {
  const entry = DOMAINS[domain];
  if (entry?.emoji) return <span aria-hidden="true">{entry.emoji}</span>;
  return <i className={`bi bi-${entry?.icon ?? 'dot'}`} aria-hidden="true" />;
}
