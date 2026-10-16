import { useEffect, useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { BottomSheet } from '../ui';
import { HelpTip } from '../common';
import { usePush } from '../../hooks/usePush';
import { pushPermission, pushSupport } from '../../utils/push';
import { installSheetRecent, visitCount } from '../../utils/installPrompt';

const STATE_KEY = 'hornet-push-prompt';
/** The question comes from this visit on */
const MIN_VISITS = 2;
const LATER_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** After the app is on screen, and after the install suggestion had its turn */
const AUTO_OPEN_DELAY_MS = 5000;

interface PromptState {
  /** "Plus tard": not before this time */
  laterUntil?: number;
  /** "Ne plus demander", or answered */
  never?: boolean;
}

function readState(): PromptState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') as PromptState;
  } catch {
    return {};
  }
}

function writeState(value: PromptState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable (private window): the question just comes back
  }
}

/**
 * Whether to ask on this device: the browser can receive (on an iPhone, only
 * the installed app: the install suggestion comes first), the permission was
 * never asked, from the second visit, not answered nor postponed, and not the
 * day the install suggestion was shown (one question at a time).
 */
function shouldAsk(): boolean {
  if (pushSupport() !== 'ok' || pushPermission() !== 'default') return false;
  if (visitCount() < MIN_VISITS) return false;
  const state = readState();
  if (state.never || (state.laterUntil && Date.now() < state.laterUntil)) return false;
  return !installSheetRecent(DAY_MS);
}

/**
 * First question about notifications, once per device: a sheet whose
 * "Activer" is the tap the browser needs to ask its own permission (required
 * on iPhone). Mounted in the navbar, for signed-in users.
 */
export default function PushPromptSheet({ signedIn }: { signedIn: boolean }) {
  const [candidate, setCandidate] = useState(false);
  useEffect(() => {
    if (!signedIn || !shouldAsk()) return;
    const timer = setTimeout(() => {
      // Never on top of another dialog
      if (document.querySelector('.modal.show, .offcanvas.show')) return;
      setCandidate(true);
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [signedIn]);

  return candidate ? <PromptSheet onDone={() => setCandidate(false)} /> : null;
}

function PromptSheet({ onDone }: { onDone: () => void }) {
  const push = usePush();
  const [closed, setClosed] = useState(false);
  // Only once the server says notifications are on, and if this device is not subscribed yet
  const show = !closed && push.config?.enabled === true && !push.subscribed;

  const close = (state: PromptState) => {
    writeState(state);
    setClosed(true);
    onDone();
  };

  const accept = async () => {
    await push.enable();
    // Granted or refused, the browser has answered: never ask again from here
    writeState({ never: true });
    if (pushPermission() === 'granted') {
      setClosed(true);
      onDone();
    }
  };

  return (
    <BottomSheet
      show={show}
      onHide={() => close({ laterUntil: Date.now() + LATER_MS })}
      title="Recevoir les rappels ?"
    >
      <div className="d-flex align-items-center mb-3">
        <span className="flex-grow-1">Un message quand un piège est à relever, et ceux de vos groupes.</span>
        <HelpTip id="push-prompt-help" doc="traps#reminders" title="Notifications">
          Les rappels partent à 9 h (10 h le dimanche) pour vos pièges à relever ou dont l'attractif est à renouveler,
          selon les délais de leur type. Vous choisissez ce que vous recevez dans le module Notifications, à tout
          moment.
        </HelpTip>
      </div>
      {push.error && <Alert variant="danger">{push.error}</Alert>}
      <div className="d-grid gap-2">
        <Button variant="primary" onClick={() => void accept()} disabled={push.busy}>
          {push.busy
            ? <Spinner animation="border" size="sm" className="me-2" />
            : <i className="bi bi-bell me-2" aria-hidden="true" />}
          Activer
        </Button>
        <Button variant="outline-secondary" onClick={() => close({ laterUntil: Date.now() + LATER_MS })}>
          Plus tard
        </Button>
        <Button variant="link" className="text-muted" onClick={() => close({ never: true })}>
          Ne plus demander
        </Button>
      </div>
    </BottomSheet>
  );
}
