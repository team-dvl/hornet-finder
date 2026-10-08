import { useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { BottomSheet } from '../ui';
import { HelpTip } from '../common';
import {
  closeInstallSheet,
  install,
  openInstallSheet,
  shouldAutoOpen,
  useInstallState,
} from '../../utils/installPrompt';

/** Delay before the automatic suggestion, so the app is on screen first. */
const AUTO_OPEN_DELAY_MS = 3000;

/**
 * Suggests pinning the app on the home screen: a button on Android, the
 * steps of the share menu on iOS. Opens by itself from the second visit (once
 * per 30 days at most); the menu entry opens it on demand.
 */
export default function InstallSheet({ signedIn }: { signedIn: boolean }) {
  const { open, available, ios } = useInstallState();

  useEffect(() => {
    if (!signedIn || !available) return;
    const timer = setTimeout(() => {
      // Never on top of another dialog
      if (document.querySelector('.modal.show, .offcanvas.show')) return;
      if (shouldAutoOpen()) openInstallSheet();
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [signedIn, available]);

  return (
    <BottomSheet show={open && available} onHide={closeInstallSheet} title="Installer l'application">
      {ios ? (
        <ol className="ps-3 mb-0 d-grid gap-2">
          <li>
            Touchez <i className="bi bi-box-arrow-up mx-1" aria-hidden="true" />
            <strong>Partager</strong>
          </li>
          <li>
            Choisissez <i className="bi bi-plus-square mx-1" aria-hidden="true" />
            <strong>Sur l’écran d’accueil</strong>
          </li>
        </ol>
      ) : (
        <div className="d-flex align-items-center">
          <Button variant="primary" onClick={() => void install()}>
            <i className="bi bi-download me-2" aria-hidden="true" />
            Installer
          </Button>
          <HelpTip id="install-help">
            Ouverture plein écran depuis l’écran d’accueil, comme une application.
          </HelpTip>
        </div>
      )}
    </BottomSheet>
  );
}
