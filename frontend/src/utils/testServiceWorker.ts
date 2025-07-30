// Utilitaire pour tester le service worker et sa gestion des tokens
export const testServiceWorker = {
  
  // Vérifier si le service worker est actif
  async checkServiceWorkerStatus(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.log('❌ Service Worker non supporté');
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !registration.active) {
      console.log('❌ Service Worker non actif');
      return false;
    }

    console.log('✅ Service Worker actif:', registration.active.scriptURL);
    return true;
  },

  // Tester la communication avec le service worker
  async testServiceWorkerCommunication(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) {
        console.log('❌ Pas de service worker actif pour tester');
        return false;
      }

      // Envoyer un message de test
      registration.active.postMessage({
        type: 'TEST_CONNECTION',
        payload: { timestamp: Date.now() }
      });

      console.log('✅ Message envoyé au service worker');
      return true;
    } catch (error) {
      console.error('❌ Erreur communication service worker:', error);
      return false;
    }
  },

  // Simuler une synchronisation d'état d'authentification
  async simulateAuthSync(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) {
      console.log('❌ Pas de service worker pour sync auth');
      return;
    }

    const mockAuthState = {
      isAuthenticated: true,
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 heure
      profile: {
        name: 'Test User',
        email: 'test@example.com'
      }
    };

    registration.active.postMessage({
      type: 'SYNC_AUTH_STATE',
      payload: mockAuthState
    });

    console.log('✅ État auth simulé envoyé:', mockAuthState);
  },

  // Écouter les messages du service worker
  setupServiceWorkerListener(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, payload } = event.data || {};
      
      console.debug('📨 Message reçu du service worker:', { type, payload });
      
      switch (type) {
        case 'TOKEN_EXPIRING_SOON':
          console.warn('⚠️ Token expire bientôt:', payload);
          break;
        case 'AUTH_STATE_CHANGED':
          console.log('🔄 État auth changé:', payload);
          break;
        case 'BACKGROUND_SYNC_RESULT':
          console.log('🔄 Résultat sync background:', payload);
          break;
        default:
          console.log('📝 Message service worker:', { type, payload });
      }
    });

    console.log('✅ Listener service worker configuré');
  },

  // Test complet du service worker
  async runFullTest(): Promise<void> {
    console.log('🧪 === TEST SERVICE WORKER COMPLET ===');
    
    // 1. Vérifier le statut
    const isActive = await this.checkServiceWorkerStatus();
    if (!isActive) return;

    // 2. Configurer l'écoute
    this.setupServiceWorkerListener();

    // 3. Tester la communication
    await this.testServiceWorkerCommunication();
    
    // 4. Simuler sync auth
    await this.simulateAuthSync();

    console.log('✅ Test service worker terminé - vérifiez la console pour les messages');
  }
};

// Exposer dans window pour faciliter les tests manuels
declare global {
  interface Window {
    testSW: typeof testServiceWorker;
  }
}

if (typeof window !== 'undefined') {
  window.testSW = testServiceWorker;
}
