import { HelpTip } from '../common';
import { formatDate } from '../../utils/format';
import { daysBetween } from '../../utils/coloniesApi';
import { today, type ColonySummary } from '../../utils/hivesApi';

interface BroodBreakProps {
  colony: Pick<ColonySummary, 'requeening_since' | 'laying_since'>;
  /** One short line, for a list */
  compact?: boolean;
}

/**
 * The brood break of a colony raising a new queen: counted from the division
 * or the swarm, until the new queen is seen laying. The laying is noted on
 * the day it is seen, so the break lasted at most that long.
 */
export default function BroodBreak({ colony, compact = false }: BroodBreakProps) {
  const since = colony.requeening_since;
  if (!since) return null;
  if (colony.laying_since) {
    const days = daysBetween(since, colony.laying_since);
    if (compact) return <span>Ponte reprise</span>;
    return <span>Ponte reprise le {formatDate(colony.laying_since)} : {days} jours sans ponte au plus</span>;
  }
  const day = daysBetween(since, today());
  if (compact) return <span>Reine en élevage, J+{day}</span>;
  return (
    <span className="d-inline-flex align-items-center flex-wrap justify-content-end">
      Reine en élevage depuis le {formatDate(since)} (J+{day})
      <HelpTip id="brood-break-help" doc="apiaries#colonies" title="Rupture de ponte">
        Repères moyens, à confirmer par vos observations : le dernier couvain d'ouvrières naît au
        plus tard 21 jours après l'événement. Une reine élevée en urgence naît 10 à 16 jours
        après une division, plus tôt après un essaimage (cellules déjà operculées) ; elle pond en
        général une à deux semaines plus tard, davantage par mauvais temps. Notez « Ponte
        constatée » le jour où vous voyez des œufs.
      </HelpTip>
    </span>
  );
}
