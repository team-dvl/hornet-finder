import { Badge, Button, ButtonGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { usePendingCounts } from '../../hooks/usePendingCounts';

interface ApiariesTabsProps {
  active: 'apiaries' | 'hives' | 'visits';
}

/**
 * The lists of the apiaries module: the apiaries, the hives wherever they
 * stand, the visits. The red count of the module (visits planned today or
 * late) shows on the tab where they wait.
 */
export default function ApiariesTabs({ active }: ApiariesTabsProps) {
  const navigate = useNavigate();
  const waiting = usePendingCounts().apiaries ?? 0;
  const tab = (id: ApiariesTabsProps['active'], label: string, path: string, count = 0) => (
    <Button
      onClick={() => { if (id !== active) navigate(path); }}
      role="tab"
      aria-selected={id === active}
      variant={id === active ? 'primary' : 'outline-primary'}
    >
      {label}
      {count > 0 && (
        <Badge pill bg="danger" className="ms-1" aria-label={`${count} en attente`}>{count}</Badge>
      )}
    </Button>
  );
  return (
    <ButtonGroup className="d-flex mb-3" role="tablist" aria-label="Vue">
      {tab('apiaries', 'Ruchers', '/apiaries')}
      {tab('hives', 'Ruches', '/apiaries/hives')}
      {tab('visits', 'Visites', '/apiaries/visits', waiting)}
    </ButtonGroup>
  );
}
