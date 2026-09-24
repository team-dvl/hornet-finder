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

  // DEV runs the Vite dev server, prod a build: the dev icons (purple outline)
  // tell the two installed PWAs apart
  const isDevServer = mode !== 'production'
  const iconSuffix = isDevServer ? '-dev' : ''

  return {
    plugins: [
      react(),
      {
        name: 'env-icons',
        transformIndexHtml: (html: string) => html
          .replace('href="/favicon.ico"', `href="/favicon${iconSuffix}.ico"`)
          .replace('href="/apple-touch-icon.png"', `href="/apple-touch-icon${iconSuffix}.png"`),
      },
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: [`favicon${iconSuffix}.ico`, 'robots.txt', `apple-touch-icon${iconSuffix}.png`],
        workbox: {
          // Configuration pour améliorer la persistance des données
          clientsClaim: true,
          skipWaiting: true,
          // Dev catch-all mailbox (Mailpit behind nginx): never the SPA shell
          navigateFallbackDenylist: [/^\/mail\//],
          // Stratégies de cache pour les ressources d'authentification
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.destination === 'document' && !url.pathname.startsWith('/mail/'),
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
            src: `icons/pwa${iconSuffix}-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `icons/pwa${iconSuffix}-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
          }
        ],
        // Long press on the installed app icon (Android, desktop; not iOS)
        shortcuts: [
          {
            name: 'Scanner un QR Code',
            short_name: 'Scanner',
            description: 'Ouvrir l\'appareil photo pour lire le QR Code d\'un piège',
            url: '/scan',
            icons: [{ src: 'icons/shortcut-scan-96x96.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
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
    fs: {
      // The dev server is reachable from the Internet and gets probed by
      // scanners. NOTE: this list REPLACES Vite's defaults, so they must be
      // repeated here (.env, certificates, .git, ...).
      deny: [
        // Vite defaults
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc',
        '.yarnrc.yml',
        '**/.git/**',
        // Project files that have no business being served
        'Dockerfile*',
      ],
    },
  },
  }
})
