import { Button } from 'react-bootstrap';

interface GroupChoice {
  path: string;
  name: string;
}

interface GroupChipsProps {
  groups: GroupChoice[];
  /** Path of the selected group */
  value: string;
  onChange: (path: string) => void;
  /** Id of the element labelling the group */
  labelledBy: string;
  /** Shown instead of the chips when there is no group to pick */
  emptyText: string;
  disabled?: boolean;
}

/**
 * Single choice among groups, as badge-like chips: the selected one filled, the
 * others outlined. Touch-friendly replacement for a select.
 */
export default function GroupChips({
  groups, value, onChange, labelledBy, emptyText, disabled = false,
}: GroupChipsProps) {
  if (groups.length === 0) {
    return <p className="small text-muted mb-0">{emptyText}</p>;
  }
  return (
    <div className="group-chips" role="radiogroup" aria-labelledby={labelledBy}>
      {groups.map((group) => (
        <Button
          key={group.path}
          variant={group.path === value ? 'primary' : 'outline-primary'}
          className="group-chip"
          role="radio"
          aria-checked={group.path === value}
          title={group.name}
          disabled={disabled}
          onClick={() => onChange(group.path)}
        >
          {/* Truncated inside: overflow on the button would clip its touch area */}
          <span className="d-block text-truncate">{group.name}</span>
        </Button>
      ))}
    </div>
  );
}
