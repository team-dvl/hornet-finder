import { useState, type ReactNode } from 'react';
import { ACTION_ICONS } from '../../utils/icons';
import BottomSheet from './BottomSheet';
import IconButton from './IconButton';

export interface SheetAction {
  /** bootstrap-icons name, without the `bi-` prefix */
  icon: string;
  label: string;
  onClick: () => void;
  /** `danger` (delete) is set apart at the bottom of the menu */
  tone?: 'danger' | 'warning';
}

interface SheetActionsProps {
  /** Always-visible actions (the main one first) */
  children?: ReactNode;
  /** Secondary actions: a single one stays in the bar, several go behind a "⋯" button */
  more?: (SheetAction | false | null | undefined)[];
  className?: string;
}

/**
 * Action bar of an object sheet. It never wraps: the main actions stay in the
 * bar, the secondary ones fold into a bottom sheet opened by a "⋯" button.
 */
export default function SheetActions({ children, more = [], className = '' }: SheetActionsProps) {
  const [open, setOpen] = useState(false);
  const actions = more.filter((action): action is SheetAction => Boolean(action));
  if (!children && actions.length === 0) return null;

  const variantOf = (tone?: SheetAction['tone']) => (tone ? `outline-${tone}` : 'outline-secondary');
  const run = (action: SheetAction) => {
    setOpen(false);
    action.onClick();
  };

  return (
    <div className={`sheet-actions ${className}`}>
      {children}
      {actions.length === 1 && (
        <IconButton
          variant={variantOf(actions[0].tone)}
          icon={actions[0].icon}
          label={actions[0].label}
          className="ms-auto"
          onClick={() => run(actions[0])}
        />
      )}
      {actions.length > 1 && (
        <>
          <IconButton
            variant="outline-secondary"
            icon={ACTION_ICONS.moreActions}
            label="Autres actions"
            showLabel="never"
            className="ms-auto"
            onClick={() => setOpen(true)}
          />
          <BottomSheet show={open} onHide={() => setOpen(false)} title="Autres actions">
            <div className="sheet-menu">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`sheet-menu-item${action.tone ? ` sheet-menu-item-${action.tone}` : ''}`}
                  onClick={() => run(action)}
                >
                  <i className={`bi bi-${action.icon}`} aria-hidden="true" />
                  <span className="text-truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
