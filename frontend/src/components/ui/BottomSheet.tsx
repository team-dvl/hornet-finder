import type { ReactNode } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { useOverlayHistory } from '../../hooks/useOverlayHistory';

interface BottomSheetProps {
  show: boolean;
  onHide: () => void;
  title: ReactNode;
  children: ReactNode;
}

/**
 * Panel sliding up from the bottom of the screen, in place of popovers and
 * small choice dialogs (map layers, add actions, overlapping objects). On
 * wider screens it stays a centred panel of limited width.
 */
export default function BottomSheet({ show, onHide, title, children }: BottomSheetProps) {
  useOverlayHistory(show, onHide);
  return (
    <Offcanvas show={show} onHide={onHide} placement="bottom" className="bottom-sheet">
      <Offcanvas.Header closeButton closeLabel="Fermer" className="py-2">
        <Offcanvas.Title as="h6" className="mb-0 text-truncate">{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="pt-0">{children}</Offcanvas.Body>
    </Offcanvas>
  );
}
