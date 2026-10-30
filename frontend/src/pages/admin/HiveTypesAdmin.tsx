import { useCallback, useEffect, useState } from 'react';
import { Alert, Container } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { IconButton } from '../../components/ui';
import { HiveTypeFormModal, ReferentialTable, type ReferentialColumn } from '../../components/admin';
import { ConfirmationModal } from '../../components/modals';
import { deleteHiveType, fetchHiveTypes, hiveErrorOf, type HiveType } from '../../utils/hivesApi';

/** What the bars of a type are, in a few words. */
function barsOf(type: HiveType): string {
  if (type.bar_family === 'topbar') {
    return `${type.max_bars} barrettes${type.max_colonies > 1 ? ', 2 colonies' : ''}`;
  }
  if (type.bar_family === 'warre') return `${type.bars_per_box} barrettes par élément`;
  return 'Sans barrette';
}

const columns: ReferentialColumn<HiveType>[] = [
  { key: 'name', header: 'Nom', main: true, render: (type) => type.name },
  { key: 'bars', header: 'Barrettes', render: (type) => <span className="small">{barsOf(type)}</span> },
  {
    key: 'description',
    header: 'Description',
    secondary: true,
    render: (type) => <span className="small text-muted">{type.description || '—'}</span>,
  },
  { key: 'usage', header: 'Ruches', render: (type) => type.hive_count ?? 0 },
];

/** Administration of the hive type referential. */
export default function HiveTypesAdmin() {
  const [types, setTypes] = useState<HiveType[] | null>(null);
  const [editing, setEditing] = useState<HiveType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<HiveType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchHiveTypes().then(setTypes).catch((fetchError) => setError(hiveErrorOf(fetchError)));
  }, []);
  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteHiveType(toDelete.id);
      setToDelete(null);
      load();
    } catch (deleteError) {
      // A type still used by hives comes back as a 409
      setError(hiveErrorOf(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader
          title="Types de ruches"
          help="Ces modèles alimentent le formulaire de création d'une ruche."
          actions={(
            <IconButton
              variant="primary"
              icon="plus-lg"
              label="Ajouter"
              onClick={() => { setEditing(null); setShowForm(true); }}
            />
          )}
        />

        {error && !toDelete && <Alert variant="warning" onClose={() => setError(null)} dismissible>{error}</Alert>}

        <ReferentialTable
          rows={types ?? []}
          columns={columns}
          rowKey={(type) => type.id}
          onEdit={(type) => { setEditing(type); setShowForm(true); }}
          onDelete={setToDelete}
          emptyMessage={types === null ? 'Chargement…' : 'Aucun type de ruche.'}
        />
      </Container>

      {showForm && (
        <HiveTypeFormModal onHide={() => setShowForm(false)} hiveType={editing} onSaved={load} />
      )}

      <ConfirmationModal
        show={toDelete !== null}
        onHide={() => { setToDelete(null); setError(null); }}
        onConfirm={handleDelete}
        itemName={`le type « ${toDelete?.name ?? ''} »`}
        isDeleting={deleting}
        deleteError={error}
      />
    </PageLayout>
  );
}
