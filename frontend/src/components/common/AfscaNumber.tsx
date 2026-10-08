import { formatAfsca } from '../../utils/afsca';

interface AfscaNumberProps {
  value: string;
  className?: string;
}

/** An AFSCA number, shown everywhere the same way: `9.005.577.599`. */
export default function AfscaNumber({ value, className = '' }: AfscaNumberProps) {
  return (
    <code className={`text-nowrap ${className}`.trim()} title="N° AFSCA">
      {formatAfsca(value)}
    </code>
  );
}
