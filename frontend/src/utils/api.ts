import axios from 'axios';
import { getAccessToken, refreshSession, userManager } from './oidc';

// Configuration de base d'Axios
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Every call carries the token of the current session, renewed first if it
// is about to expire (read from the OIDC client: the React state can still
// hold a token that has expired while the app was in the background)
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Requests already replayed once after a 401
const replayed = new WeakSet<object>();

// A 401 means the token was refused (expired meanwhile, or revoked): renew
// the session once and replay the request; a second refusal is final
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && config && !replayed.has(config) && (await userManager.getUser())) {
      replayed.add(config);
      if (await refreshSession()) {
        return api(config);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
