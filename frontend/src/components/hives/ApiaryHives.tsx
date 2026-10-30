import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { fetchHives, type Hive } from '../../utils/hivesApi';
import HiveListItem from './HiveListItem';

interface ApiaryHivesProps {
  apiaryId: number;
  /** The user may put hives in this apiary */
  canAdd: boolean;
}

/**
 * The hives standing in an apiary, in its sheet. A hive opens in the hive
 * list of the module, where its sheet and actions live.
 */
export default function ApiaryHives({ apiaryId, canAdd }: ApiaryHivesProps) {
  const navigate = useNavigate();
  const [hives, setHives] = useState<Hive[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHives({ apiary: apiaryId, status: 'active' })
      .then((found) => { if (!cancelled) setHives(found); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [apiaryId]);

  if (failed || (hives?.length === 0 && !canAdd)) return null;

  return (
    <section className="mt-3" aria-label="Ruches du rucher">
      <div className="d-flex align-items-center gap-2 mb-1">
        <span className="text-muted small flex-grow-1">
          Ruches{hives ? ` (${hives.length})` : ''}
        </span>
        {canAdd && (
          <IconButton
            variant="outline-secondary"
            icon={ACTION_ICONS.add}
            label="Ajouter une ruche"
            onClick={() => navigate(`/apiaries/hives?apiary=${apiaryId}&add=1`)}
          />
        )}
      </div>
      {!hives && <Spinner animation="border" size="sm" />}
      {hives && hives.length > 0 && (
        <div className="list-group">
          {hives.map((hive) => (
            <HiveListItem
              key={hive.id}
              hive={hive}
              inApiary
              onOpen={() => navigate(`/apiaries/hives?apiary=${apiaryId}&hive=${hive.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
