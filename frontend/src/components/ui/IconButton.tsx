import { forwardRef } from 'react';
import { Button, type ButtonProps } from 'react-bootstrap';

interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  /** bootstrap-icons name, without the `bi-` prefix */
  icon: string;
  /** Accessible name, tooltip, and visible label where there is room */
  label: string;
  /** When the label is shown next to the icon: from `sm` up (default), always, or never */
  showLabel?: 'sm' | 'always' | 'never';
}

/**
 * Action button that is only an icon on a phone. The label stays available
 * as `aria-label` and tooltip, and shows next to the icon on wider screens.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, showLabel = 'sm', className = '', ...props }, ref) => {
    const labelClass = showLabel === 'always' ? 'ms-2' : showLabel === 'sm' ? 'd-none d-sm-inline ms-2' : 'visually-hidden';
    return (
      <Button ref={ref} aria-label={label} title={label} className={`icon-button ${className}`} {...props}>
        <i className={`bi bi-${icon}`} aria-hidden="true" />
        <span className={labelClass}>{label}</span>
      </Button>
    );
  },
);
IconButton.displayName = 'IconButton';

export default IconButton;
