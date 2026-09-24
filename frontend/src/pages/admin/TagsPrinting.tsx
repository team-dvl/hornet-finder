import { useEffect, useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { downloadTagSheet, fetchFreeTags, generateTags, TagError, type PrintableTag } from '../../utils/tagsApi';

const MAX_BATCH = 48;

function TagSheet({ tags }: { tags: PrintableTag[] }) {
  return (
    <div className="tag-sheet">
      {tags.map((tag) => (
        <div key={tag.value} className="tag-label">
          <img src={tag.qr_svg} alt={`QR Code ${tag.short}`} />
          <div className="tag-label-code">{tag.short}</div>
        </div>
      ))}
    </div>
  );
}

/** "PDF" and "Imprimer" buttons for one set of tags. */
function SheetActions({ tags, printLabel, onPrint, onError }: {
  tags: PrintableTag[];
  printLabel: string;
  onPrint: () => void;
  onError: (message: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadTagSheet(tags.map((tag) => tag.value));
    } catch (e) {
      onError(e instanceof TagError ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <span className="text-nowrap">
      <Button variant="outline-primary" size="sm" className="me-2" onClick={() => void download()} disabled={downloading}>
        <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
        {downloading ? 'Préparation…' : 'PDF A4'}
      </Button>
      <Button variant="outline-secondary" size="sm" onClick={onPrint}>
        <i className="bi bi-printer me-1" aria-hidden="true" />{printLabel}
      </Button>
    </span>
  );
}

/**
 * Printing tab of the QR Codes. The tags are generated blank; each one is
 * then attached to a trap by scanning it from the map.
 */
export default function TagsPrinting() {
  const [count, setCount] = useState(12);
  const [batch, setBatch] = useState<PrintableTag[]>([]);
  const [free, setFree] = useState<PrintableTag[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which set goes to the printer: the new batch, or every free tag */
  const [printing, setPrinting] = useState<'batch' | 'free'>('batch');

  useEffect(() => {
    fetchFreeTags()
      .then(setFree)
      .catch((e: unknown) => setError(e instanceof TagError ? e.message : String(e)));
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const tags = await generateTags(count);
      setBatch(tags);
      setFree((previous) => [...tags, ...(previous ?? [])]);
    } catch (e) {
      setError(e instanceof TagError ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const print = (which: 'batch' | 'free') => {
    setPrinting(which);
    // Let the sheet to print render before the dialog opens
    window.setTimeout(() => window.print(), 0);
  };

  const reprintable = (free ?? []).filter((tag) => !batch.some((b) => b.value === tag.value));

  return (
    <>
      <div className="d-print-none">
        <p className="text-muted">
          Imprimez une planche de QR Codes vierges, collez-en un sur chaque piège, puis scannez-le
          depuis la carte des pièges (bouton 📷) pour l'associer au piège. Ensuite, un scan ouvre
          directement la fiche du piège pour y enregistrer les captures. Le PDF A4 donne des
          étiquettes de 45 mm à découper : imprimez-le à 100 %, sans ajustement à la page.
        </p>
        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

        <InputGroup className="mb-4" style={{ maxWidth: 360 }}>
          <InputGroup.Text>Nombre</InputGroup.Text>
          <Form.Control
            type="number"
            min={1}
            max={MAX_BATCH}
            value={count}
            onChange={(e) => setCount(Math.min(MAX_BATCH, Math.max(1, Number(e.target.value) || 1)))}
          />
          <Button onClick={() => void generate()} disabled={generating}>
            {generating ? <Spinner animation="border" size="sm" /> : 'Générer'}
          </Button>
        </InputGroup>

        {batch.length > 0 && (
          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">Nouvelle planche ({batch.length})</h2>
            <SheetActions tags={batch} printLabel="Imprimer" onPrint={() => print('batch')} onError={setError} />
          </div>
        )}
      </div>
      {batch.length > 0 && (
        <div className={printing === 'batch' ? '' : 'd-print-none'}>
          <TagSheet tags={batch} />
        </div>
      )}

      <div className="d-print-none mt-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0">Mes QR Codes libres{free && ` (${reprintable.length})`}</h2>
          {reprintable.length > 0 && (
            <SheetActions tags={reprintable} printLabel="Réimprimer" onPrint={() => print('free')} onError={setError} />
          )}
        </div>
        {free === null && !error && <Spinner animation="border" size="sm" />}
        {free !== null && reprintable.length === 0 && (
          <p className="text-muted small">Aucun autre QR Code en attente d'association.</p>
        )}
      </div>
      {reprintable.length > 0 && (
        <div className={printing === 'free' ? '' : 'd-print-none'}>
          <TagSheet tags={reprintable} />
        </div>
      )}
    </>
  );
}
