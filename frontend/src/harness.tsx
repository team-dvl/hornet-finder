import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from 'react-oidc-context';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './index.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { store } from './store';
import type { Trap } from './store/store';
import TrapInfoPopup from './components/traps/TrapInfoPopup';

const others = new URLSearchParams(location.search).get('others') !== 'false';
const trap = {
  id: 1, latitude: 50, longitude: 4, active: true, installed_at: '2026-06-01', hornet_catch_count: 37,
  photo_url: null, photo_thumbnail_url: null, address: 'Rue des Abeilles 12, 1300 Wavre',
  trap_type: { slug: 'harp', name: 'Harpe électrique', accumulates: true },
  contents: { at: '2026-09-24T10:00:00Z', items: others ? [{ species_slug: 'vespa-velutina', quantity: 12 }, { species_slug: 'vespa-crabro', quantity: 2 }] : [{ species_slug: 'vespa-velutina', quantity: 12 }], others_counted: others },
} as Trap;
createRoot(document.getElementById('root')!).render(
  <AuthProvider authority="http://localhost:1/realms/x" client_id="x" redirect_uri="http://localhost:5199">
    <Provider store={store}><BrowserRouter><TrapInfoPopup show onHide={() => {}} trap={trap} /></BrowserRouter></Provider>
  </AuthProvider>,
);
