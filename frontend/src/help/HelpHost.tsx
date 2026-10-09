import { lazy, Suspense } from 'react';
import { closeHelp, useHelpState } from './helpStore';

// The documentation and its search are only loaded the first time help is opened
const HelpPanel = lazy(() => import('./HelpPanel'));

/** Mounts the help panel once the first `openHelp` call asks for it. */
export default function HelpHost() {
  const { open, request } = useHelpState();
  if (!request) return null;
  return (
    <Suspense fallback={null}>
      <HelpPanel open={open} request={request} onHide={closeHelp} />
    </Suspense>
  );
}
