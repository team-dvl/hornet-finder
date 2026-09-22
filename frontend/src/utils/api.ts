import axios from 'axios';

// Configuration de base d'Axios
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Bearer token of the current session, kept in step by `App` (see
// `setApiAccessToken`). It is held in memory rather than in localStorage: the
// session lives in the OIDC context, and a copy on disk would outlive it.
let accessToken: string | null = null;

/** Token attached to every API call, or `null` when nobody is signed in. */
export function setApiAccessToken(token: string | null): void {
  accessToken = token;
}

// Intercepteur pour ajouter automatiquement le token d'authentification
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et erreurs
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Gestion centralisée des erreurs
    if (error.response?.status === 401) {
      // Token expiré ou invalide : le contexte OIDC en fournira un neuf
      accessToken = null;
    }
    return Promise.reject(error);
  }
);

export default api;
