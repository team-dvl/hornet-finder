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
import { setupPWAAuthMonitoring, setupTokenMonitoring, syncAuthStateWithServiceWorker } from './utils/pwaAuth';
import { useMobileSessionPersistence } from './hooks/useMobileSessionPersistence';
import { setApiAccessToken } from './utils/api';

// The statistics are loaded on demand: they stay out of the first load of the PWA
const StatsIndex = lazy(() => import('./pages/stats/StatsIndex'));
const StatDetail = lazy(() => import('./pages/stats/StatDetail'));
const ExportJob = lazy(() => import('./pages/stats/ExportJob'));
const pageFallback = <div className="text-center py-5"><Spinner animation="border" /></div>;

// Import conditionnel pour les tests en développement
if (import.meta.env.DEV) {
  import('./utils/authTester');
}

function App() {
  const auth = useAuth();

  // Give the API client the token of the current session. Done during render
  // and not in an effect: a child's mount effect fires its first requests
  // before the effects of this component would have run, and those calls must
  // already carry the token. `isAuthenticated` is `!user.expired`, so an
  // expired session hands over nothing.
  setApiAccessToken(auth.isAuthenticated && auth.user ? auth.user.access_token ?? null : null);

  // Nettoyer automatiquement l'URL après authentification (pour PWA)
  useUrlCleaner(auth.isAuthenticated);
  
  // Gestion de la persistance de session mobile
  useMobileSessionPersistence();

  // Initialisation unique (viewport iOS, monitoring PWA / tokens, service worker)
  useEffect(() => {
    // Initialiser la correction iOS pour le viewport
    initIOSViewportFix();
    
    // Initialiser le monitoring PWA pour l'authentification
    setupPWAAuthMonitoring();
    
    // Initialiser le monitoring avancé des tokens
    setupTokenMonitoring();
    
    // Synchroniser l'état avec le service worker
    syncAuthStateWithServiceWorker();
  }, []);

  // Synchroniser l'état d'authentification avec le service worker
  useEffect(() => {
    if (!auth.isLoading) {
      syncAuthStateWithServiceWorker();
    }
  }, [auth.isAuthenticated, auth.user, auth.isLoading]);

  switch (auth.activeNavigator) {
    case "signinSilent":
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Alert variant="info">Connexion en cours…</Alert>
        </Container>
      );
    case "signoutRedirect":
      return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
          <Alert variant="info">Déconnexion en cours…</Alert>
        </Container>
      );
  }

  if (auth.isLoading) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Alert variant="info">Chargement…</Alert>
      </Container>
    );
  }

  if (auth.error) {
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
        element={<RequireRole roles={['volunteer', 'beekeeper', 'admin']}><Suspense fallback={pageFallback}><StatsIndex /></Suspense></RequireRole>}
      />
      <Route
        path="/stats/:statId"
        element={<RequireRole roles={['volunteer', 'beekeeper', 'admin']}><Suspense fallback={pageFallback}><StatDetail /></Suspense></RequireRole>}
      />
      {/* Former printing page, now a tab of the QR Codes administration */}
      <Route path="/traps/tags" element={<Navigate to="/admin/tags?tab=print" replace />} />
      <Route path="/docs" element={<DocsIndex />} />
      <Route path="/docs/:moduleId" element={<DocPage />} />
      <Route
        path="/admin"
        element={<RequireRole roles={['volunteer', 'beekeeper', 'admin']}><AdminIndex /></RequireRole>}
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
        element={<RequireRole roles={['beekeeper', 'admin']}><GroupAdmin /></RequireRole>}
      />
      {/* Former address of the invitations page */}
      <Route path="/admin/invitations" element={<Navigate to="/admin/group" replace />} />
      <Route
        path="/admin/tags"
        element={<RequireRole roles={['volunteer', 'beekeeper', 'admin']}><TagsAdmin /></RequireRole>}
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
