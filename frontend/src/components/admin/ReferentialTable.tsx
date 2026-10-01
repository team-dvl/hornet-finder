import type { ReactNode } from 'react';
import { Table } from 'react-bootstrap';
import { IconButton } from '../ui';

export interface ReferentialColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Hidden below the `md` breakpoint, for the secondary columns */
  secondary?: boolean;
  /** Column that takes the room left on a phone (default: the second one) */
  main?: boolean;
  /** Left out of the phone list, when another column already shows it there */
  phoneHidden?: boolean;
}

interface ReferentialTableProps<T> {
  rows: T[];
  columns: ReferentialColumn<T>[];
  rowKey: (row: T) => string | number;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Reorder mode: the edit and delete actions give way to move up / move down */
  onMove?: (row: T, direction: -1 | 1) => void;
  emptyMessage?: string;
}

/**
 * Table of a referential (trap types today, species tomorrow): a few columns
 * plus the edit and delete actions of each row.
 */
export default function ReferentialTable<T>({
  rows, columns, rowKey, onEdit, onDelete, onMove, emptyMessage = 'Aucune entrée.',
}: ReferentialTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-muted">{emptyMessage}</p>;
  }

  const hasActions = Boolean(onMove || onEdit || onDelete);
  const actions = (row: T, index: number) => onMove ? (
    <div className="d-inline-flex gap-1">
      <IconButton
        variant="outline-secondary" icon="arrow-up" label="Monter" showLabel="never"
        disabled={index === 0} onClick={() => onMove(row, -1)}
      />
      <IconButton
        variant="outline-secondary" icon="arrow-down" label="Descendre" showLabel="never"
        disabled={index === rows.length - 1} onClick={() => onMove(row, 1)}
      />
    </div>
  ) : (onEdit || onDelete) && (
    <div className="d-inline-flex gap-1">
      {onEdit && <IconButton variant="outline-secondary" icon="pencil" label="Modifier" onClick={() => onEdit(row)} />}
      {onDelete && <IconButton variant="outline-danger" icon="trash" label="Supprimer" onClick={() => onDelete(row)} />}
    </div>
  );

  // Phone: one line per row, the main column taking the room left, no table
  // to scroll sideways
  const primary = columns.filter((column) => !column.secondary && !column.phoneHidden);
  const mainKey = (primary.find((column) => column.main) ?? primary[1] ?? primary[0])?.key;

  return (
    <>
      <div className="referential-list d-sm-none">
        {rows.map((row, index) => (
          <div key={rowKey(row)} className="referential-row">
            {primary.map((column) => (
              <div key={column.key} className={column.key === mainKey ? 'referential-main' : 'flex-shrink-0'}>
                {column.render(row)}
              </div>
            ))}
            {hasActions && <div className="flex-shrink-0">{actions(row, index)}</div>}
          </div>
        ))}
      </div>

      <div className="d-none d-sm-block">
        <Table hover responsive className="align-middle">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.secondary ? 'd-none d-md-table-cell' : undefined}>
                  {column.header}
                </th>
              ))}
              {hasActions && <th className="text-end"><span className="visually-hidden">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.secondary ? 'd-none d-md-table-cell' : undefined}>
                    {column.render(row)}
                  </td>
                ))}
                {hasActions && <td className="text-end">{actions(row, index)}</td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}
