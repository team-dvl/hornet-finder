import axios from 'axios';

// Configuration de base d'Axios
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter automatiquement le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      // Token expiré ou invalide
      localStorage.removeItem('access_token');
      // Vous pouvez rediriger vers la page de connexion ici
    }
    return Promise.reject(error);
  }
);

export default api;
