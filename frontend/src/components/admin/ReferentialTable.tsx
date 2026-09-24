import type { ReactNode } from 'react';
import { Button, Table } from 'react-bootstrap';

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
          {(onEdit || onDelete) && <th className="text-end">Actions</th>}
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
              <td className="text-end text-nowrap">
                {onEdit && (
                  <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => onEdit(row)}>
                    <i className="bi bi-pencil" aria-hidden="true" /> Modifier
                  </Button>
                )}
                {onDelete && (
                  <Button variant="outline-danger" size="sm" onClick={() => onDelete(row)}>
                    <i className="bi bi-trash" aria-hidden="true" /> Supprimer
                  </Button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
