/**
 * Gestionnaire de stockage persistant pour les données d'authentification
 * Utilise IndexedDB pour un stockage plus robuste que localStorage
 */

interface AuthData {
  timestamp: number;
  isAuthenticated: boolean;
  userProfile?: Record<string, unknown>;
  hasValidSession: boolean;
  tokenExpiry?: number;
}

class PersistentAuthStorage {
  private dbName = 'hornet-auth-db';
  private storeName = 'auth-store';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        // Fallback vers localStorage si IndexedDB non disponible
        console.warn('IndexedDB non disponible, utilisation de localStorage');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async saveAuthData(data: AuthData): Promise<void> {
    if (!this.db) {
      // Fallback vers localStorage
      localStorage.setItem('hornet-auth-state', JSON.stringify(data));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data, 'current-auth');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async loadAuthData(): Promise<AuthData | null> {
    if (!this.db) {
      // Fallback vers localStorage
      try {
        const data = localStorage.getItem('hornet-auth-state');
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('current-auth');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as AuthData | undefined;
        resolve(result || null);
      };
    });
  }

  async clearAuthData(): Promise<void> {
    if (!this.db) {
      // Fallback vers localStorage
      localStorage.removeItem('hornet-auth-state');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete('current-auth');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async isExpired(maxAge: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    try {
      const data = await this.loadAuthData();
      if (!data || !data.timestamp) return true;
      
      const now = Date.now();
      return (now - data.timestamp) > maxAge;
    } catch {
      return true;
    }
  }
}

// Instance singleton
export const persistentAuthStorage = new PersistentAuthStorage();

// Initialisation automatique
persistentAuthStorage.init().catch((error) => {
  console.warn('Erreur lors de l\'initialisation du stockage persistant:', error);
});

export type { AuthData };
