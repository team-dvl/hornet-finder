import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'
import { Container, Alert, Spinner } from 'react-bootstrap'
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context';
import { Home, MapPage, Nests, Traps, Apiaries, DocsIndex, DocPage, AdminIndex, TrapTypesAdmin, SpeciesAdmin, TagsAdmin, ArchivingAdmin, GroupAdmin, PrivacyPolicy, DataDeletion, Invitations } from './pages';
import { RequireRole } from './components/common';
import { initIOSViewportFix } from './utils/iosViewportFix';
import { useUrlCleaner } from './utils/urlCleaner';
import { useSessionGuard } from './hooks/useSessionGuard';
import { ADMIN, APP_ROLES, BEEKEEPER, TRAPPER } from './utils/roles';

// The statistics are loaded on demand: they stay out of the first load of the PWA
const StatsIndex = lazy(() => import('./pages/stats/StatsIndex'));
const StatDetail = lazy(() => import('./pages/stats/StatDetail'));
const ExportJob = lazy(() => import('./pages/stats/ExportJob'));
const pageFallback = <div className="text-center py-5"><Spinner animation="border" /></div>;

function App() {
  const auth = useAuth();

  // Nettoyer automatiquement l'URL après authentification (pour PWA)
  useUrlCleaner(auth.isAuthenticated);

  // Renews the session on launch, resume and reconnection
  const resuming = useSessionGuard();

  // Initialiser la correction iOS pour le viewport
  useEffect(() => {
    initIOSViewportFix();
  }, []);

  if (auth.activeNavigator === 'signoutRedirect') {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="info">Déconnexion en cours…</Alert>
      </Container>
    );
  }

  if (auth.isLoading || resuming) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="info">Chargement…</Alert>
      </Container>
    );
  }

  // A failed background renewal is not shown: the session is renewed again on
  // the next resume or API call, or dropped if Keycloak has ended it
  if (auth.error && auth.error.source !== 'renewSilent') {
    // Si erreur d'authentification (ex: token expiré), nettoyer et rediriger
    console.warn('Erreur d\'authentification:', auth.error);
    
    // Nettoyer l'URL si elle contient des paramètres OAuth invalides
    if (window.location.search.includes('code=') || window.location.search.includes('state=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="warning" className="text-center">
          <h5>Session expirée</h5>
          <p>Votre session a expiré. Veuillez recharger la page pour vous reconnecter.</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </Alert>
      </Container>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/nests" element={<Nests />} />
      <Route
        path="/apiaries"
        element={<RequireRole roles={['beekeeper', 'admin']}><Apiaries /></RequireRole>}
      />
      {/* One trap manager for these paths, so resolving a tag or scanning returns to /traps without remounting it */}
      <Route element={<Traps />}>
        <Route path="/traps" element={null} />
        <Route path="/tag/:tagValue" element={null} />
        {/* Shortcut of the installed app (long press on its icon): opens the scanner */}
        <Route path="/scan" element={null} />
      </Route>
      <Route
        path="/stats"
        element={<RequireRole roles={APP_ROLES}><Suspense fallback={pageFallback}><StatsIndex /></Suspense></RequireRole>}
      />
      <Route
        path="/stats/:statId"
        element={<RequireRole roles={APP_ROLES}><Suspense fallback={pageFallback}><StatDetail /></Suspense></RequireRole>}
      />
      {/* Former printing page, now a tab of the QR Codes administration */}
      <Route path="/traps/tags" element={<Navigate to="/admin/tags?tab=print" replace />} />
      <Route path="/docs" element={<DocsIndex />} />
      <Route path="/docs/:moduleId" element={<DocPage />} />
      <Route
        path="/admin"
        element={<RequireRole roles={APP_ROLES}><AdminIndex /></RequireRole>}
      />
      <Route
        path="/admin/trap-types"
        element={<RequireRole roles={['admin']}><TrapTypesAdmin /></RequireRole>}
      />
      <Route
        path="/admin/species"
        element={<RequireRole roles={['admin']}><SpeciesAdmin /></RequireRole>}
      />
      <Route
        path="/admin/archiving"
        element={<RequireRole roles={['admin']}><ArchivingAdmin /></RequireRole>}
      />
      <Route
        path="/admin/group"
        element={<RequireRole roles={[BEEKEEPER, TRAPPER, ADMIN]}><GroupAdmin /></RequireRole>}
      />
      {/* Former address of the invitations page */}
      <Route path="/admin/invitations" element={<Navigate to="/admin/group" replace />} />
      <Route
        path="/admin/tags"
        element={<RequireRole roles={[TRAPPER, BEEKEEPER, ADMIN]}><TagsAdmin /></RequireRole>}
      />
      {/* Link of the invitation emails: signs in first, then lists the invitations */}
      <Route path="/invitations" element={<Invitations />} />
      {/* An emailed export link: opens without signing in */}
      <Route path="/export/:token" element={<Suspense fallback={pageFallback}><ExportJob /></Suspense>} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/data-deletion" element={<DataDeletion />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App
