import { useEffect, useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { HelpTip } from '../../components/common';
import { SheetPdfButton } from '../../components/tags';
import {
  fetchFreeTags, fetchTagSheetLink, fetchTagsInUse, generateTags, TagError, type PrintableTag,
} from '../../utils/tagsApi';

const MAX_BATCH = 48;

function TagSheet({ tags }: { tags: PrintableTag[] }) {
  return (
    <div className="tag-sheet">
      {tags.map((tag) => (
        <div key={tag.value} className="tag-label">
          <img src={tag.qr_svg} alt={`QR Code ${tag.short}`} />
          <div className="tag-label-code">{tag.short}</div>
          {tag.caption && <div className="tag-label-caption">{tag.caption}</div>}
        </div>
      ))}
    </div>
  );
}

/** Button opening the PDF of one set of tags. */
function SheetActions({ tags, label, onError }: {
  tags: PrintableTag[];
  label: string;
  onError: (message: string) => void;
}) {
  const values = tags.map((tag) => tag.value);
  return (
    <SheetPdfButton request={() => fetchTagSheetLink(values)} requestKey={values.join()} onError={onError}>
      {label}
    </SheetPdfButton>
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
  const [inUse, setInUse] = useState<PrintableTag[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (e: unknown) => setError(e instanceof TagError ? e.message : String(e));
    fetchFreeTags().then(setFree).catch(fail);
    fetchTagsInUse().then(setInUse).catch(fail);
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

  const reprintable = (free ?? []).filter((tag) => !batch.some((b) => b.value === tag.value));

  return (
    <>
      <div>
        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

        <h2 className="h5">
          Nouvelle planche{batch.length > 0 && ` (${batch.length})`}
          <HelpTip id="help-tag-print" title="Imprimer des QR Codes">
            Générez des QR Codes vierges, collez-en un sur chaque piège, puis scannez-le depuis la carte
            des pièges (bouton 📷) pour l'associer au piège. Ensuite, un scan ouvre directement la fiche
            du piège. Le PDF A4 donne des étiquettes de 45 mm à découper : imprimez-le à 100 %, sans
            ajustement à la page. Depuis l'application installée sur téléphone, le bouton ouvre le
            menu de partage : choisissez « Imprimer » ou « Enregistrer dans Fichiers ». Dans un
            navigateur, le PDF s'ouvre dans un nouvel onglet.
          </HelpTip>
        </h2>
        <InputGroup className="mb-3" style={{ maxWidth: 360 }}>
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
          <div className="mb-2">
            <SheetActions tags={batch} label="Imprimer (PDF)" onError={setError} />
          </div>
        )}
      </div>
      {batch.length > 0 && (
        <div>
          <TagSheet tags={batch} />
        </div>
      )}

      <div className="mt-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0">
            Mes QR Codes libres{free && ` (${reprintable.length})`}
            <HelpTip id="help-tag-free" title="QR Codes libres">
              Les QR Codes déjà générés mais pas encore associés à un piège.
            </HelpTip>
          </h2>
          {reprintable.length > 0 && (
            <SheetActions tags={reprintable} label="Réimprimer (PDF)" onError={setError} />
          )}
        </div>
        {free === null && !error && <Spinner animation="border" size="sm" />}
        {free !== null && reprintable.length === 0 && (
          <p className="text-muted small">Aucun autre QR Code en attente d'association.</p>
        )}
      </div>
      {reprintable.length > 0 && (
        <div>
          <TagSheet tags={reprintable} />
        </div>
      )}

      <div className="mt-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0">
            Mes QR Codes en service{inUse && ` (${inUse.length})`}
            <HelpTip id="help-tag-in-use" title="QR Codes en service">
              Les QR Codes déjà collés sur vos pièges, pour remplacer une étiquette abîmée : le même QR
              Code reste valable, et le numéro du piège est imprimé sous le code pour ne pas les confondre.
            </HelpTip>
          </h2>
          {inUse && inUse.length > 0 && (
            <SheetActions tags={inUse} label="Réimprimer (PDF)" onError={setError} />
          )}
        </div>
        {inUse === null && !error && <Spinner animation="border" size="sm" />}
        {inUse !== null && inUse.length === 0 && (
          <p className="text-muted small">Aucun QR Code associé à vos pièges.</p>
        )}
      </div>
      {inUse && inUse.length > 0 && (
        <div>
          <TagSheet tags={inUse} />
        </div>
      )}
    </>
  );
}
