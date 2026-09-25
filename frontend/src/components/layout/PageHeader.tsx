import type { ReactNode } from 'react';
import { HelpTip } from '../common';

interface PageHeaderProps {
  title: ReactNode;
  /** One sentence about the page: a help tip next to the title, the plain text on a phone */
  help?: string;
  /** Buttons on the right of the title (e.g. "Ajouter") */
  actions?: ReactNode;
  className?: string;
}

/**
 * Title line of a scrolling page. On a phone the navbar already shows the
 * page name: the title gives way to the short description of the page.
 */
export default function PageHeader({ title, help, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`d-flex align-items-center gap-2 mb-3 ${className}`}>
      <h2 className="h3 mb-0 d-none d-sm-flex align-items-center">
        {title}
        {help && <HelpTip id="page-help" title={typeof title === 'string' ? title : undefined}>{help}</HelpTip>}
      </h2>
      {help && <p className="small text-muted mb-0 d-sm-none">{help}</p>}
      {actions && <div className="ms-auto d-flex gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
