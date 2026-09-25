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
  emptyMessage?: string;
}

/**
 * Table of a referential (trap types today, species tomorrow): a few columns
 * plus the edit and delete actions of each row.
 */
export default function ReferentialTable<T>({
  rows, columns, rowKey, onEdit, onDelete, emptyMessage = 'Aucune entrée.',
}: ReferentialTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-muted">{emptyMessage}</p>;
  }

  const actions = (row: T) => (onEdit || onDelete) && (
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
        {rows.map((row) => (
          <div key={rowKey(row)} className="referential-row">
            {primary.map((column) => (
              <div key={column.key} className={column.key === mainKey ? 'referential-main' : 'flex-shrink-0'}>
                {column.render(row)}
              </div>
            ))}
            {(onEdit || onDelete) && <div className="flex-shrink-0">{actions(row)}</div>}
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
              {(onEdit || onDelete) && <th className="text-end"><span className="visually-hidden">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.secondary ? 'd-none d-md-table-cell' : undefined}>
                    {column.render(row)}
                  </td>
                ))}
                {(onEdit || onDelete) && <td className="text-end">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}
