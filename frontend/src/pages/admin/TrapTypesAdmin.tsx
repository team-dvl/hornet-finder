import { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { PageLayout } from '../../components/layout';
import { ReferentialTable, TrapTypeFormModal, type ReferentialColumn } from '../../components/admin';
import { ConfirmationModal } from '../../components/modals';
import { ThumbnailPreview } from '../../components/common';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  deleteTrapType, fetchTrapTypes, selectTrapTypes, selectTrapsLoading, type TrapType,
} from '../../store/store';

const columns: ReferentialColumn<TrapType>[] = [
  {
    key: 'photo',
    header: '',
    render: (type) => (
      type.photo_thumbnail_url
        ? (
          <ThumbnailPreview
            thumbnailUrl={type.photo_thumbnail_url}
            fullUrl={type.photo_url}
            alt={type.name}
          />
        )
        : <span className="text-muted">—</span>
    ),
  },
  {
    key: 'name',
    header: 'Nom',
    render: (type) => type.name,
  },
  {
    key: 'description',
    header: 'Description',
    secondary: true,
    render: (type) => <span className="small text-muted">{type.description || '—'}</span>,
  },
  {
    key: 'usage',
    header: 'Pièges',
    render: (type) => type.trap_count ?? 0,
  },
];

/** Administration of the trap type referential. */
export default function TrapTypesAdmin() {
  const dispatch = useAppDispatch();
  const trapTypes = useAppSelector(selectTrapTypes);
  const loading = useAppSelector(selectTrapsLoading);

  const [editing, setEditing] = useState<TrapType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<TrapType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchTrapTypes());
  }, [dispatch]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await dispatch(deleteTrapType(toDelete.id)).unwrap();
      setToDelete(null);
    } catch (deleteError) {
      // A type still used by traps comes back as a 409 with its trap count
      setError(deleteError as string);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageLayout>
      <Container className="py-4">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h2 className="mb-1">Types de pièges</h2>
            <p className="text-muted mb-0">
              Ces modèles alimentent le formulaire de création d'un piège.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Ajouter un type
          </Button>
        </div>

        {error && <Alert variant="warning" onClose={() => setError(null)} dismissible>{error}</Alert>}

        <ReferentialTable
          rows={trapTypes}
          columns={columns}
          rowKey={(type) => type.id}
          onEdit={(type) => { setEditing(type); setShowForm(true); }}
          onDelete={setToDelete}
          emptyMessage={loading ? 'Chargement…' : 'Aucun type de piège.'}
        />
      </Container>

      {showForm && (
        <TrapTypeFormModal
          onHide={() => setShowForm(false)}
          trapType={editing}
        />
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
