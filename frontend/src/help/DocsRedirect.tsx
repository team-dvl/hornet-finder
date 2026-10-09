import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { isDocModule } from './anchors';
import { openHelp } from './helpStore';

/**
 * Former address of the documentation (`/docs`, `/docs/:moduleId`), which now
 * lives in the help panel: opens it over the home page.
 */
export default function DocsRedirect() {
  const { moduleId } = useParams();
  useEffect(() => {
    openHelp(isDocModule(moduleId) ? moduleId : undefined);
  }, [moduleId]);
  return <Navigate to="/" replace />;
}
