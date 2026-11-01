import { useEffect, useState } from 'react';
import { Alert, Card, Container, Spinner } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../components/layout';
import { HelpTip } from '../components/common';
import { ConfirmDialog, IconButton, Switch } from '../components/ui';
import { usePush } from '../hooks/usePush';
import {
  fetchPreferences, pushErrorOf, savePreference,
  type NotificationKind, type NotificationPreference,
} from '../utils/pushApi';

const SCHEDULE = '9 h · dimanche 10 h';

/** How each kind reads in the list: icon, the schedule if any, and the help. */
const KIND_INFO: Record<NotificationKind, { icon: string; detail?: string; help: string }> = {
  trap_reading: {
    icon: '🪤',
    detail: SCHEDULE,
    help: "Quand un de vos pièges attend un relevé, selon le délai de son type : à 9 h (10 h le dimanche), "
      + "puis tous les deux jours, trois fois au plus. À partir de trois rappels le même jour, un seul message les "
      + "regroupe. Un piège remisé n'a plus de rappel.",
  },
  trap_refill: {
    icon: '🧪',
    detail: SCHEDULE,
    help: "Quand l'attractif d'un de vos pièges est à renouveler, selon le délai de son type, aux mêmes heures "
      + 'que les rappels de relevé.',
  },
  trap_handover: {
    icon: '🤝',
    help: "Un piège qui vous est transféré par un administrateur de la plateforme ou de votre groupe : vous en "
      + 'recevez ensuite les rappels. Prévenu aussitôt, à toute heure.',
  },
  nest_new: {
    icon: '🏴',
    detail: '9 h–20 h · dimanche dès 10 h',
    help: "Chaque nid signalé. Activé d'office pour les coordinateurs des chasseurs et les administrateurs ; un "
      + "apiculteur l'active s'il le souhaite. Un nid signalé la nuit est annoncé à l'ouverture, à 9 h (10 h le "
      + 'dimanche) ; à partir de trois nids en même temps, un seul message les regroupe.',
  },
  nest_near_apiary: {
    icon: '🍯',
    detail: 'À moins de 1 km',
    help: "Un nid actif signalé à moins de 1 km d'un de vos ruchers, ou d'un rucher partagé avec l'association "
      + "que vous administrez. Aux mêmes heures que les nouveaux nids. L'écran verrouillé montre la commune, jamais "
      + "l'adresse.",
  },
  nest_followup: {
    icon: '📍',
    help: "Ce que devient un nid que vous avez signalé : confirmé, écarté, trouvé vide ou neutralisé. Rien quand c'est "
      + 'vous qui le signalez neutralisé.',
  },
  group_message: {
    icon: '👥',
    help: 'Les messages des administrateurs de vos associations et du coordinateur des piégeurs.',
  },
  platform_message: {
    icon: '📣',
    help: 'Les messages des administrateurs de la plateforme, à tout le monde ou à vous.',
  },
};

/** Kinds whose loss the user must accept knowingly. */
const WARNED: Partial<Record<NotificationKind, { title: string; message: string }>> = {
  group_message: {
    title: 'Ne plus recevoir les messages de vos groupes ?',
    message: "Les administrateurs de vos associations s'en servent pour des consignes ou des rendez-vous. "
      + 'Vous pourrez les réactiver ici à tout moment.',
  },
  platform_message: {
    title: 'Ne plus recevoir les messages de la plateforme ?',
    message: "Les administrateurs s'en servent pour des consignes ou des changements qui peuvent vous concerner. "
      + 'Vous pourrez les réactiver ici à tout moment.',
  },
};

/**
 * Notification settings: this device (the push subscription, per device) and
 * the kinds of notifications the account receives (every device).
 */
export default function Notifications() {
  const push = usePush();
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<NotificationKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPreferences()
      .then((list) => { if (!cancelled) setPrefs(list); })
      .catch((error) => { if (!cancelled) setPrefsError(pushErrorOf(error)); });
    return () => { cancelled = true; };
  }, []);

  const apply = async (kind: NotificationKind, enabled: boolean) => {
    const previous = prefs;
    setPrefs((list) => list?.map((p) => (p.id === kind ? { ...p, enabled } : p)) ?? list);
    setPrefsError(null);
    try {
      setPrefs(await savePreference(kind, enabled));
    } catch (error) {
      setPrefs(previous);
      setPrefsError(pushErrorOf(error));
    }
  };

  const toggle = (kind: NotificationKind, enabled: boolean) => {
    if (!enabled && WARNED[kind]) setConfirming(kind);
    else void apply(kind, enabled);
  };

  const blocked = push.permission === 'denied';
  const deviceDetail = push.support === 'install-ios'
    ? "Ajoutez d'abord l'application à l'écran d'accueil"
    : push.support === 'unsupported'
      ? 'Non prises en charge par ce navigateur'
      : blocked ? 'Bloquées dans les réglages du navigateur' : undefined;
  const warning = confirming ? WARNED[confirming] : undefined;

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="Notifications" help="Les rappels et les messages que vous recevez, et sur quels appareils." />

        {push.config === null && <Spinner animation="border" role="status" />}
        {push.config && !push.config.enabled && (
          <Alert variant="secondary">Les notifications ne sont pas activées sur ce serveur.</Alert>
        )}

        {push.config?.enabled && (
          <>
            {push.config.paused_kinds.length > 0 && (
              <Alert variant="warning">
                {prefs?.every((pref) => push.config?.paused_kinds.includes(pref.id))
                  ? 'Les administrateurs ont suspendu les notifications pour le moment.'
                  : 'Les administrateurs ont suspendu certaines notifications pour le moment.'}
              </Alert>
            )}
            <h2 className="h6 text-uppercase text-muted mb-2">Sur cet appareil</h2>
            <Card body className="mb-4 py-0">
              <Switch
                id="push-device"
                icon="📱"
                label="Cet appareil"
                detail={deviceDetail}
                checked={push.subscribed}
                disabled={push.busy || push.support !== 'ok' || blocked}
                onChange={(on) => void (on ? push.enable() : push.disable())}
                help={(
                  <HelpTip id="push-device-help" title="Cet appareil">
                    Autorise cet appareil à afficher les notifications, même application fermée. À régler sur
                    chaque appareil. Sur iPhone et iPad (iOS 16.4 ou plus), seulement depuis l'application ajoutée
                    à l'écran d'accueil ; après une mise à jour, fermez-la complètement puis rouvrez-la.
                  </HelpTip>
                )}
              />
              {push.subscribed && (
                <div className="app-switch-row">
                  <span className="app-switch-icon" aria-hidden="true">🔔</span>
                  <span className="flex-grow-1">Envoyer un essai</span>
                  {push.busy && <Spinner animation="border" size="sm" />}
                  <IconButton
                    variant="outline-secondary"
                    icon="send"
                    label="Envoyer un essai"
                    showLabel="never"
                    disabled={push.busy}
                    onClick={() => void push.test()}
                  />
                </div>
              )}
            </Card>
            {push.error && <Alert variant="danger">{push.error}</Alert>}
            {push.notice && <Alert variant="success">{push.notice}</Alert>}

            <h2 className="h6 text-uppercase text-muted mb-2">Me prévenir pour</h2>
            {prefsError && <Alert variant="danger">{prefsError}</Alert>}
            {prefs === null && !prefsError && <Spinner animation="border" role="status" />}
            {prefs && (
              <Card body className="py-0">
                {prefs.map((pref) => {
                  const info = KIND_INFO[pref.id];
                  return (
                    <Switch
                      key={pref.id}
                      id={`kind-${pref.id}`}
                      icon={info?.icon}
                      label={pref.label}
                      detail={push.config?.paused_kinds.includes(pref.id) ? 'Suspendu par les administrateurs' : info?.detail}
                      checked={pref.enabled}
                      onChange={(on) => toggle(pref.id, on)}
                      help={info && <HelpTip id={`kind-${pref.id}-help`} title={pref.label}>{info.help}</HelpTip>}
                    />
                  );
                })}
              </Card>
            )}
          </>
        )}
      </Container>

      {warning && confirming && (
        <ConfirmDialog
          show
          onHide={() => setConfirming(null)}
          onConfirm={() => { const kind = confirming; setConfirming(null); void apply(kind, false); }}
          title={warning.title}
          message={warning.message}
          confirmLabel="Ne plus recevoir"
          confirmIcon="bell-slash"
          variant="warning"
        />
      )}
    </PageLayout>
  );
}
