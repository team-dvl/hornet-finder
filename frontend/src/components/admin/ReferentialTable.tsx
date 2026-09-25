import type { ReactNode } from 'react';
import { Table } from 'react-bootstrap';
import { IconButton } from '../ui';

export interface ReferentialColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Hidden below the `md` breakpoint, for the secondary columns */
  secondary?: boolean;
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

  return (
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
            {(onEdit || onDelete) && (
              <td className="text-end">
                {/* Icons only, stacked on a phone, so the row fits without scrolling sideways */}
                <div className="d-inline-flex flex-column flex-sm-row gap-1">
                  {onEdit && (
                    <IconButton variant="outline-secondary" icon="pencil" label="Modifier" onClick={() => onEdit(row)} />
                  )}
                  {onDelete && (
                    <IconButton variant="outline-danger" icon="trash" label="Supprimer" onClick={() => onDelete(row)} />
                  )}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
