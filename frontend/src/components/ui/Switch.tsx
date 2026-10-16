import type { ReactNode } from 'react';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** Emoji or icon element before the label */
  icon?: ReactNode;
  /** A value under the label (a schedule, a device) */
  detail?: ReactNode;
  /** A HelpTip, kept outside the label so a tap on it does not toggle the switch */
  help?: ReactNode;
  disabled?: boolean;
}

/**
 * A settings row ending with an on/off switch that looks native: the iOS
 * switch on an iPhone or iPad, the Material one elsewhere (`data-platform` on
 * <html>, see `applyPlatformLook` and App.css). The whole row toggles it, so
 * the target stays well above 44 px; the control stays a checkbox with the
 * `switch` role for screen readers and keyboards.
 */
export default function Switch({ id, checked, onChange, label, icon, detail, help, disabled }: SwitchProps) {
  return (
    <div className="app-switch-row">
      {icon && <span className="app-switch-icon" aria-hidden="true">{icon}</span>}
      <label htmlFor={id} className="app-switch-label">
        <span className="d-block">{label}</span>
        {detail && <span className="d-block small text-muted">{detail}</span>}
      </label>
      {help}
      <span className="form-check form-switch app-switch">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="form-check-input"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
    </div>
  );
}
