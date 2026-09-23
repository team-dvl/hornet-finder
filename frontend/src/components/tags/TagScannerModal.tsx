import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { extractTagValue } from '../../utils/tagsApi';

interface TagScannerModalProps {
  onHide: () => void;
  /** Called with the value of a well-formed tag; its authenticity is checked by the server */
  onTag: (value: string) => void;
}

/**
 * Camera scanner for the QR tags stuck on traps. It is the only way into a
 * tag on iOS, where a home-screen app never captures a scanned link.
 * Mounted only while open, so the camera is released as soon as it closes.
 */
export default function TagScannerModal({ onHide, onTag }: TagScannerModalProps) {
  // Callback ref: the modal body is portalled, so wait for the element itself
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notATag, setNotATag] = useState(false);

  // Kept in a ref so a new callback from the parent does not restart the camera
  const onTagRef = useRef(onTag);
  useEffect(() => {
    onTagRef.current = onTag;
  }, [onTag]);

  const handleDecode = useCallback((result: QrScanner.ScanResult) => {
    const value = extractTagValue(result.data);
    scannerRef.current?.stop();
    if (value) {
      onTagRef.current(value);
    } else {
      setNotATag(true);
    }
  }, []);

  useEffect(() => {
    if (!video) return;
    const scanner = new QrScanner(video, handleDecode, {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      returnDetailedScanResult: true,
    });
    scannerRef.current = scanner;
    scanner.start().catch((reason: unknown) => {
      const name = reason instanceof Error ? reason.name : String(reason);
      setError(name === 'NotAllowedError'
        ? "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur."
        : "Impossible d'ouvrir la caméra de cet appareil.");
    });
    return () => {
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [video, handleDecode]);

  const retry = () => {
    setNotATag(false);
    void scannerRef.current?.start();
  };

  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>📷 Scanner un QR Code</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? (
          <Alert variant="danger" className="mb-0">{error}</Alert>
        ) : (
          <>
            {/* qr-scanner draws its scan region overlay in the video's parent */}
            <div className="position-relative bg-dark rounded overflow-hidden">
              <video ref={setVideo} className="w-100 d-block" playsInline muted />
            </div>
            {notATag ? (
              <Alert variant="warning" className="mt-3 mb-0 d-flex justify-content-between align-items-center">
                <span>Ce QR Code n'appartient pas à Velutina.</span>
                <Button size="sm" variant="outline-dark" onClick={retry}>Réessayer</Button>
              </Alert>
            ) : (
              <div className="text-muted small mt-2">
                Visez le QR Code collé sur le piège.
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <Link to="/traps/tags" className="small">Imprimer des QR Codes</Link>
        <Button variant="secondary" onClick={onHide}>Fermer</Button>
      </Modal.Footer>
    </Modal>
  );
}
