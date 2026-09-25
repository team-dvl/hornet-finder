import { useEffect, useState } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { PageLayout } from '../../components/layout';
import { ReferentialTable, SpeciesFormModal, type ReferentialColumn } from '../../components/admin';
import { ConfirmationModal } from '../../components/modals';
import { ThumbnailPreview } from '../../components/common';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  deleteSpecies, fetchSpecies, selectSpecies, selectTrapsLoading, type Species,
} from '../../store/store';

const columns: ReferentialColumn<Species>[] = [
  {
    key: 'photo',
    header: '',
    render: (species) => (
      species.photo_thumbnail_url
        ? (
          <ThumbnailPreview
            thumbnailUrl={species.photo_thumbnail_url}
            fullUrl={species.photo_url}
            alt={species.name}
          />
        )
        : <span className="text-muted">—</span>
    ),
  },
  {
    key: 'name',
    header: 'Nom',
    render: (species) => (
      <>
        <div>{species.name}</div>
        {species.scientific_name && (
          <div className="small text-muted fst-italic">{species.scientific_name}</div>
        )}
      </>
    ),
  },
  {
    key: 'credit',
    header: 'Crédit photo',
    secondary: true,
    render: (species) => (
      species.photo_credit
        ? (
          <span className="small text-muted">
            {species.photo_source_url
              ? <a href={species.photo_source_url} target="_blank" rel="noopener">{species.photo_credit}</a>
              : species.photo_credit}
          </span>
        )
        : <span className="text-muted">—</span>
    ),
  },
  {
    key: 'usage',
    header: 'Constats',
    render: (species) => species.event_count ?? 0,
  },
];

/** Administration of the species referential used when recording catches. */
export default function SpeciesAdmin() {
  const dispatch = useAppDispatch();
  const species = useAppSelector(selectSpecies);
  const loading = useAppSelector(selectTrapsLoading);

  const [editing, setEditing] = useState<Species | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<Species | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Always refetch: the cached copy may predate the usage counts
    dispatch(fetchSpecies());
  }, [dispatch]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await dispatch(deleteSpecies(toDelete.id)).unwrap();
      setToDelete(null);
    } catch (deleteError) {
      // A species named by the journal comes back as a 409 with its event count
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
            <h2 className="mb-1">Espèces</h2>
            <p className="text-muted mb-0">
              Ces espèces sont proposées lors de l'enregistrement d'une capture.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Ajouter une espèce
          </Button>
        </div>

        {error && <Alert variant="warning" onClose={() => setError(null)} dismissible>{error}</Alert>}

        <ReferentialTable
          rows={species}
          columns={columns}
          rowKey={(item) => item.id}
          onEdit={(item) => { setEditing(item); setShowForm(true); }}
          onDelete={setToDelete}
          emptyMessage={loading ? 'Chargement…' : 'Aucune espèce.'}
        />
      </Container>

      {showForm && (
        <SpeciesFormModal
          onHide={() => setShowForm(false)}
          species={editing}
        />
      )}

      <ConfirmationModal
        show={toDelete !== null}
        onHide={() => { setToDelete(null); setError(null); }}
        onConfirm={handleDelete}
        itemName={`l'espèce « ${toDelete?.name ?? ''} »`}
        isDeleting={deleting}
        deleteError={error}
      />
    </PageLayout>
  );
}
