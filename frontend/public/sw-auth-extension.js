// Service Worker personnalisé pour la gestion avancée des tokens d'authentification
// Ce fichier sera injecté dans le service worker généré par Vite PWA

// État global du service worker pour l'authentification
let authState = {
  isAuthenticated: false,
  expiresAt: null,
  lastSync: null,
  profile: null
};

// Configuration
const TOKEN_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const TOKEN_WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes avant expiration

console.log('🔧 Service Worker Auth Extension chargé');

// Écouter les messages de l'application principale
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SYNC_AUTH_STATE':
      handleAuthStateSync(payload);
      break;
    
    case 'AUTH_STATUS_UPDATE':
      handleAuthStatusUpdate(payload);
      break;
    
    case 'TOKEN_EXPIRING_SOON':
      handleTokenExpiringSoon(payload);
      break;
    
    case 'GET_AUTH_STATE':
      // Répondre avec l'état actuel
      event.ports[0]?.postMessage({
        type: 'AUTH_STATE_RESPONSE',
        payload: authState
      });
      break;
  }
});

// Gestion de la synchronisation de l'état d'authentification
function handleAuthStateSync(payload) {
  console.log('🔄 Synchronisation de l\'état d\'authentification:', payload);
  
  if (payload?.authState) {
    authState = {
      ...authState,
      ...payload.authState,
      lastSync: Date.now()
    };
    
    console.log('✅ État d\'authentification mis à jour:', authState);
    
    // Programmer la vérification proactive si nécessaire
    scheduleTokenCheck();
  }
}

// Gestion des mises à jour d'état simples
function handleAuthStatusUpdate(payload) {
  console.log('📊 Mise à jour du statut d\'authentification:', payload);
  
  authState.isAuthenticated = payload?.isAuthenticated || false;
  authState.lastSync = payload?.timestamp || Date.now();
  
  if (!authState.isAuthenticated) {
    // Réinitialiser l'état si plus authentifié
    authState.expiresAt = null;
    authState.profile = null;
  }
}

// Gestion des tokens qui expirent bientôt
function handleTokenExpiringSoon(payload) {
  console.log('⚠️ Token expire bientôt:', payload);
  
  // Notifier l'application principale
  broadcastToClients({
    type: 'TOKEN_EXPIRING',
    payload: {
      expiresAt: payload?.expiresAt,
      timeUntilExpiry: payload?.timeUntilExpiry
    }
  });
  
  // Programmer une vérification plus fréquente
  scheduleTokenCheck(30000); // Toutes les 30 secondes
}

// Programmer la vérification des tokens
let tokenCheckTimeout = null;

function scheduleTokenCheck(interval = TOKEN_CHECK_INTERVAL) {
  // Annuler la vérification précédente
  if (tokenCheckTimeout) {
    clearTimeout(tokenCheckTimeout);
  }
  
  tokenCheckTimeout = setTimeout(() => {
    checkTokenStatus();
  }, interval);
}

// Vérifier l'état des tokens
function checkTokenStatus() {
  if (!authState.isAuthenticated || !authState.expiresAt) {
    // Reprogrammer une vérification plus tardive
    scheduleTokenCheck();
    return;
  }
  
  const now = Date.now();
  const expiresAt = authState.expiresAt * 1000; // Convertir en millisecondes
  const timeUntilExpiry = expiresAt - now;
  
  console.log(`🕐 Vérification du token: expire dans ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
  
  if (timeUntilExpiry <= 0) {
    // Token expiré
    console.log('❌ Token expiré');
    authState.isAuthenticated = false;
    authState.expiresAt = null;
    
    broadcastToClients({
      type: 'AUTH_ERROR',
      payload: { reason: 'TOKEN_EXPIRED' }
    });
    
  } else if (timeUntilExpiry <= TOKEN_WARNING_THRESHOLD) {
    // Token expire bientôt
    console.log('⚠️ Token expire bientôt, notification aux clients');
    
    broadcastToClients({
      type: 'TOKEN_EXPIRING',
      payload: {
        expiresAt: authState.expiresAt,
        timeUntilExpiry
      }
    });
    
    // Vérifier plus fréquemment
    scheduleTokenCheck(30000);
  } else {
    // Token encore valide, vérification normale
    scheduleTokenCheck();
  }
}

// Diffuser un message à tous les clients connectés
function broadcastToClients(message) {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      try {
        client.postMessage(message);
      } catch (error) {
        console.warn('Erreur lors de l\'envoi de message au client:', error);
      }
    });
  });
}

// Gestion des événements de cycle de vie
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker Auth Extension activé');
  
  // Prendre le contrôle immédiatement
  event.waitUntil(self.clients.claim());
});

// Gestion de la synchronisation en arrière-plan (si supportée)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'auth-check') {
      console.log('🔄 Synchronisation en arrière-plan déclenchée');
      event.waitUntil(performAuthCheck());
    }
  });
}

// Effectuer une vérification d'authentification
async function performAuthCheck() {
  try {
    // Ici on pourrait faire une requête de vérification au serveur
    // Pour l'instant, on fait confiance aux données locales
    console.log('✅ Vérification d\'authentification terminée');
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Erreur lors de la vérification d\'authentification:', error);
    return Promise.reject(error);
  }
}

// Initialisation
console.log('🎯 Service Worker Auth Extension initialisé');
