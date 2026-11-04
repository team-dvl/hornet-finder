import { Button, ButtonGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

interface ApiariesTabsProps {
  active: 'apiaries' | 'hives' | 'visits';
}

/** The lists of the apiaries module: the apiaries, the hives wherever they stand, the visits. */
export default function ApiariesTabs({ active }: ApiariesTabsProps) {
  const navigate = useNavigate();
  const tab = (id: ApiariesTabsProps['active'], label: string, path: string) => (
    <Button
      onClick={() => { if (id !== active) navigate(path); }}
      role="tab"
      aria-selected={id === active}
      variant={id === active ? 'primary' : 'outline-primary'}
    >
      {label}
    </Button>
  );
  return (
    <ButtonGroup className="d-flex mb-3" role="tablist" aria-label="Vue">
      {tab('apiaries', 'Ruchers', '/apiaries')}
      {tab('hives', 'Ruches', '/apiaries/hives')}
      {tab('visits', 'Visites', '/apiaries/visits')}
    </ButtonGroup>
  );
}
