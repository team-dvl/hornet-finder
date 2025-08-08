import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// add velutina.ovh to server.allowedHosts

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, '.', '')
  
  // Extract domain information from Keycloak URL
  const keycloakUrl = env.VITE_KEYCLOAK_URL || 'https://auth.dev.velutina.ovh/'
  const keycloakDomain = keycloakUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  
  // Determine dev domain (dev.velutina.ovh if using dev keycloak, localhost otherwise)
  const isLocalEnvironment = env.VITE_ENVIRONMENT === 'local'
  const devDomain = isLocalEnvironment ? 'localhost' : 'dev.velutina.ovh'
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        workbox: {
          // Configuration pour améliorer la persistance des données
          clientsClaim: true,
          skipWaiting: true,
          // Stratégies de cache pour les ressources d'authentification
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 3,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Pattern dynamique pour les requêtes auth basé sur l'URL Keycloak
              urlPattern: ({ url }) => url.toString().startsWith(keycloakUrl.replace(/\/$/, '')),
              handler: 'NetworkOnly', // Les requêtes auth ne doivent pas être cachées
            },
        ],
        // Ajouter notre extension d'authentification au service worker généré
        additionalManifestEntries: [
          {
            url: '/sw-auth-extension.js',
            revision: null
          }
        ],
        // Importer notre extension dans le service worker
        importScripts: ['sw-auth-extension.js']
      },
      manifest: {
        name: 'Velutina',
        short_name: 'Velutina',
        description: 'Application de signalement des nids de frelons asiatiques',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'wss',
      host: devDomain,
      clientPort: 443,
    },
    allowedHosts: [
      devDomain,
      keycloakDomain,
    ],
  },
  }
})
