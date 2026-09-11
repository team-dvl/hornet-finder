import { useState, useRef } from 'react';
import { Button, Overlay, Popover, Form, Alert } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch } from '../../store/hooks';
import { bulkArchiveHornets, bulkArchiveNests } from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ConfirmationModal } from '../modals';

export default function BulkArchiveButton() {
  const { isAdmin } = useUserPermissions();
  const auth = useAuth();
  const dispatch = useAppDispatch();

  const [showPopover, setShowPopover] = useState(false);
  const [year, setYear] = useState<string>((new Date().getFullYear() - 1).toString());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const target = useRef(null);

  if (!isAdmin) {
    return null;
  }

  const handleClose = () => {
    setShowPopover(false);
    setError(null);
    setResultMessage(null);
  };

  const handleConfirm = async () => {
    const yearValue = parseInt(year, 10);
    if (isNaN(yearValue)) {
      setError('Veuillez entrer une année valide.');
      return;
    }
    if (!auth.user?.access_token) return;

    setIsArchiving(true);
    setError(null);
    setResultMessage(null);

    try {
      const accessToken = auth.user.access_token;
      const [hornetsResult, nestsResult] = await Promise.all([
        dispatch(bulkArchiveHornets({ year: yearValue, accessToken })).unwrap(),
        dispatch(bulkArchiveNests({ year: yearValue, accessToken })).unwrap(),
      ]);
      setResultMessage(
        `${hornetsResult.archived_count} frelon(s) et ${nestsResult.archived_count} nid(s) archivés pour l'année ${yearValue}.`
      );
      setShowConfirm(false);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <Button
        ref={target}
        onClick={() => setShowPopover(!showPopover)}
        variant="warning"
        size="sm"
        className="map-control-button"
        title="Archiver en masse les données d'une année passée"
        style={{ opacity: 0.85, borderRadius: '12px', backgroundColor: '#b8860b', borderColor: '#b8860b', color: '#fff' }}
      >
        <i className="fas fa-box-archive"></i>
        <span className="map-control-button-text ms-1">Archivage</span>
      </Button>

      <Overlay target={target.current} show={showPopover} placement="bottom" rootClose onHide={handleClose}>
        {(props) => (
          <Popover {...props} id="bulk-archive-popover">
            <Popover.Header>
              <strong>Archiver une année</strong>
            </Popover.Header>
            <Popover.Body>
              <Form.Group className="mb-2">
                <Form.Label className="small text-muted">
                  Archive tous les nids et frelons non archivés de l'année indiquée.
                </Form.Label>
                <Form.Control
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Année (ex: 2025)"
                />
              </Form.Group>
              {error && <Alert variant="danger" className="py-1 small mb-2">{error}</Alert>}
              {resultMessage && <Alert variant="success" className="py-1 small mb-2">{resultMessage}</Alert>}
              <Button variant="warning" size="sm" onClick={() => setShowConfirm(true)} disabled={isArchiving}>
                Archiver l'année {year || '...'}
              </Button>
            </Popover.Body>
          </Popover>
        )}
      </Overlay>

      <ConfirmationModal
        show={showConfirm}
        onHide={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        itemName={`toutes les données de l'année ${year}`}
        itemType="nid"
        action="archive"
        isDeleting={isArchiving}
        deleteError={error}
      />
    </>
  );
}
