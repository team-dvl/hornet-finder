import type { ReactNode } from 'react';

interface FieldRowProps {
  label: ReactNode;
  children: ReactNode;
}

/** One "label — value" line of an object sheet. */
export default function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="field-row">
      <span className="text-muted small flex-shrink-0">{label}</span>
      <span className="text-end text-break">{children}</span>
    </div>
  );
}
