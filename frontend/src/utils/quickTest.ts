/**
 * Tests simples du Service Worker d'authentification
 * Utilisation: Ouvrir la console et taper `window.testSW.runFullTest()`
 */

// Test de base du service worker - version simplifiée
export const quickTest = {
  
  // Test rapide
  async run() {
    console.log('🧪 === TEST RAPIDE SERVICE WORKER ===');
    
    // 1. Vérifier si le SW est actif
    if (!('serviceWorker' in navigator)) {
      console.log('❌ Service Worker non supporté');
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) {
      console.log('❌ Pas de service worker actif');
      return false;
    }

    console.log('✅ Service Worker actif');
    
    // 2. Test de communication
    registration.active.postMessage({
      type: 'TEST_CONNECTION',
      payload: { test: true, timestamp: Date.now() }
    });
    
    console.log('✅ Message de test envoyé');
    
    // 3. Vérifier localStorage
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('oidc') || key.includes('auth')
    );
    
    console.log('📦 Clés d\'auth dans localStorage:', authKeys.length);
    
    if (authKeys.length > 0) {
      console.log('✅ Données d\'authentification présentes');
      
      // 4. Simuler une vérification de token
      registration.active.postMessage({
        type: 'SYNC_AUTH_STATE',
        payload: {
          authState: {
            isAuthenticated: true,
            expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
            profile: { test: true }
          }
        }
      });
      
      console.log('✅ Test de synchronisation d\'état envoyé');
    } else {
      console.log('⚠️ Pas de données d\'authentification trouvées');
    }
    
    console.log('✅ Test terminé - vérifiez les messages dans la console');
    return true;
  },
  
  // Afficher l'état du localStorage
  showStorage() {
    console.log('📦 === CONTENU LOCALSTORAGE AUTH ===');
    
    Object.keys(localStorage)
      .filter(key => key.includes('oidc') || key.includes('auth'))
      .forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const value = JSON.parse(item);
            console.log(`🔑 ${key}:`, value);
          }
        } catch {
          console.log(`🔑 ${key}:`, localStorage.getItem(key));
        }
      });
  },

  // Test de simulation d'expiration
  async simulateExpiring() {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) {
      console.log('❌ Pas de service worker pour le test');
      return;
    }

    registration.active.postMessage({
      type: 'TOKEN_EXPIRING_SOON',
      payload: {
        key: 'test-token',
        expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes
        timeUntilExpiry: 2 * 60 * 1000
      }
    });

    console.log('⚠️ Simulation d\'expiration de token envoyée');
  }
};

// Exposer dans window
declare global {
  interface Window {
    quickTest: typeof quickTest;
  }
}

if (typeof window !== 'undefined') {
  window.quickTest = quickTest;
  
  // Message d'aide
  console.log(`
🧪 Tests Service Worker disponibles:
   - window.quickTest.run()           : Test rapide
   - window.quickTest.showStorage()   : Voir le localStorage
   - window.quickTest.simulateExpiring() : Simuler expiration
   - window.testSW.runFullTest()      : Test complet (si disponible)
  `);
}
