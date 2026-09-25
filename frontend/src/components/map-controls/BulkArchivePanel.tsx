import { useState } from 'react';
import { Button, Form, Alert, InputGroup, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch } from '../../store/hooks';
import { bulkArchiveHornets, bulkArchiveNests } from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { HelpTip } from '../common';

/**
 * Archiving of a past year (administrators), a section of the layers sheet.
 * Confirmed in place, in two taps, rather than by a dialog over the sheet.
 */
export default function BulkArchivePanel() {
  const { isAdmin } = useUserPermissions();
  const auth = useAuth();
  const dispatch = useAppDispatch();

  const [year, setYear] = useState<string>((new Date().getFullYear() - 1).toString());
  const [confirming, setConfirming] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isAdmin) {
    return null;
  }

  const handleConfirm = async () => {
    const yearValue = parseInt(year, 10);
    if (isNaN(yearValue)) {
      setError('Indiquez une année valide.');
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
        `${hornetsResult.archived_count} frelon(s) et ${nestsResult.archived_count} nid(s) archivés pour ${yearValue}.`
      );
    } catch (err) {
      setError(err as string);
    } finally {
      setIsArchiving(false);
      setConfirming(false);
    }
  };

  return (
    <div>
      <div className="fw-semibold mb-2 d-inline-flex align-items-center">
        Archiver une année
        <HelpTip id="bulk-archive-help" title="Archivage">
          Archive tous les nids et frelons non archivés de l'année indiquée : ils ne sont plus affichés par
          défaut, mais restent consultables avec « Afficher les archives ».
        </HelpTip>
      </div>
      <InputGroup>
        <Form.Control
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setConfirming(false);
          }}
          aria-label="Année"
        />
        {confirming ? (
          <>
            <Button variant="outline-secondary" onClick={() => setConfirming(false)} disabled={isArchiving}>Annuler</Button>
            <Button variant="warning" onClick={() => void handleConfirm()} disabled={isArchiving}>
              {isArchiving ? <Spinner animation="border" size="sm" /> : 'Confirmer'}
            </Button>
          </>
        ) : (
          <Button variant="outline-warning" onClick={() => setConfirming(true)}>
            <i className="bi bi-archive me-2" aria-hidden="true" />
            Archiver
          </Button>
        )}
      </InputGroup>
      {error && <Alert variant="danger" className="py-1 small mt-2 mb-0">{error}</Alert>}
      {resultMessage && <Alert variant="success" className="py-1 small mt-2 mb-0">{resultMessage}</Alert>}
    </div>
  );
}
