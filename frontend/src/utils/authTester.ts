// Utilitaire de développement pour tester le service worker d'authentification
// À utiliser uniquement en développement

declare global {
  interface Window {
    authTester?: {
      test: () => void;
      simulate: () => void;
      show: () => void;
      listen: () => void;
    };
  }
}

export class AuthServiceWorkerTester {
  private isTestMode: boolean;

  constructor() {
    this.isTestMode = import.meta.env.DEV;
  }

  // Tester la communication avec le service worker
  async testServiceWorkerCommunication() {
    if (!this.isTestMode) return;
    
    console.log('🧪 Test de communication avec le service worker...');
    
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker non supporté');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration.active) {
        console.warn('Aucun service worker actif');
        return;
      }

      // Créer un canal de communication
      const messageChannel = new MessageChannel();
      
      // Écouter la réponse
      messageChannel.port1.onmessage = (event) => {
        console.log('✅ Réponse du service worker:', event.data);
      };

      // Envoyer un message de test
      registration.active.postMessage(
        { type: 'GET_AUTH_STATE' },
        [messageChannel.port2]
      );

    } catch (error) {
      console.error('❌ Erreur lors du test de communication:', error);
    }
  }

  // Simuler un token qui expire bientôt
  async simulateTokenExpiring() {
    if (!this.isTestMode) return;
    
    console.log('🧪 Simulation d\'un token expirant...');
    
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'TOKEN_EXPIRING_SOON',
        payload: {
          key: 'test-token',
          expiresAt: Math.floor(Date.now() / 1000) + 300, // Dans 5 minutes
          timeUntilExpiry: 5 * 60 * 1000
        }
      });
    }
  }

  // Afficher l'état actuel du localStorage d'authentification
  showAuthLocalStorage() {
    if (!this.isTestMode) return;
    
    console.log('🧪 État du localStorage d\'authentification:');
    
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('oidc') || key.includes('auth') || key.includes('token')
    );

    authKeys.forEach(key => {
      const value = localStorage.getItem(key);
      try {
        const parsed = JSON.parse(value || '{}');
        
        console.log(`🔑 ${key}:`, {
          hasData: !!value,
          expiresAt: parsed.expires_at ? new Date(parsed.expires_at * 1000) : null,
          profile: parsed.profile ? parsed.profile.name || parsed.profile.email : null
        });
      } catch {
        console.log(`🔑 ${key}: (non-JSON)`, value?.substring(0, 50) + '...');
      }
    });
  }

  // Écouter les événements du service worker
  startListening() {
    if (!this.isTestMode) return;
    
    console.log('🧪 Démarrage de l\'écoute des événements service worker...');
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.debug('📨 Message du service worker:', event.data);
      });
    }

    // Écouter les événements personnalisés
    window.addEventListener('token-expiring', (event) => {
      console.debug('⚠️ Événement token-expiring reçu:', (event as CustomEvent).detail);
    });
  }

  // Interface de test interactive
  createTestInterface() {
    if (!this.isTestMode) return;
    
    // Ajouter des commandes globales pour les tests
    window.authTester = {
      test: () => this.testServiceWorkerCommunication(),
      simulate: () => this.simulateTokenExpiring(),
      show: () => this.showAuthLocalStorage(),
      listen: () => this.startListening()
    };

    console.log(`
🧪 Interface de test du service worker d'authentification disponible:
   - authTester.test()     : Tester la communication
   - authTester.simulate() : Simuler un token expirant
   - authTester.show()     : Afficher le localStorage
   - authTester.listen()   : Écouter les événements
    `);
  }
}

// Auto-initialisation en mode développement
if (import.meta.env.DEV) {
  const tester = new AuthServiceWorkerTester();
  tester.createTestInterface();
  tester.startListening();
}
