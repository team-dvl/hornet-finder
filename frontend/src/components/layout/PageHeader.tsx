import type { ReactNode } from 'react';
import { HelpTip } from '../common';

interface PageHeaderProps {
  title: ReactNode;
  /** Explanation of the page, in a help tip rather than a paragraph */
  help?: ReactNode;
  /** Buttons on the right of the title (e.g. "Ajouter") */
  actions?: ReactNode;
  className?: string;
}

/**
 * Title line of a scrolling page. On a phone the navbar already shows the
 * page name, so the title is hidden there and only its help and actions stay.
 */
export default function PageHeader({ title, help, actions, className = '' }: PageHeaderProps) {
  const helpTip = help && <HelpTip id="page-help" title={typeof title === 'string' ? title : undefined}>{help}</HelpTip>;
  if (!helpTip && !actions) {
    return <h2 className={`h3 mb-3 d-none d-sm-block ${className}`}>{title}</h2>;
  }
  return (
    <div className={`d-flex align-items-center gap-2 mb-3 ${className}`}>
      <h2 className="h3 mb-0 d-none d-sm-flex align-items-center">{title}{helpTip}</h2>
      {helpTip && <span className="d-sm-none">{helpTip}</span>}
      {actions && <div className="ms-auto d-flex gap-2">{actions}</div>}
    </div>
  );
}
