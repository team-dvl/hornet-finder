import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
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

  // DEV runs the Vite dev server, prod a build: the dev icons (purple, with a
  // "DEV" band) tell the two installed PWAs apart
  const isDevServer = mode !== 'production'
  const iconSuffix = isDevServer ? '-dev' : ''

  // Icon URL with a hash of the file's content: a new icon gets a new URL, so
  // no cache hands out the old one (prod nginx serves images as immutable for
  // a year, iOS keeps touch icons in a cache of its own)
  const versioned = (file: string) => {
    const hash = createHash('sha256').update(readFileSync(new URL(`./public/${file}`, import.meta.url)))
    return `${file}?v=${hash.digest('hex').slice(0, 8)}`
  }
  const appIcon = versioned(`icons/pwa${iconSuffix}-192x192.png`)

  // Safari also fetches the root paths on its own (/apple-touch-icon.png,
  // -precomposed, /favicon.ico), whatever the <link> says: on the dev server
  // they answer with the dev icons, or the home screen gets the prod one
  const devIconAliases: Record<string, string> = {
    '/favicon.ico': '/favicon-dev.ico',
    '/apple-touch-icon.png': '/apple-touch-icon-dev.png',
    '/apple-touch-icon-precomposed.png': '/apple-touch-icon-dev.png',
  }

  return {
    define: {
      // Home page icon, same file as the installed PWA
      'import.meta.env.VITE_APP_ICON': JSON.stringify(`/${appIcon}`),
    },
    plugins: [
      react(),
      {
        // DEV only. The dev service worker caches index.html but none of the
        // modules Vite serves, so on a network that does not reach the server
        // (edge firewall) React never starts and the page stays white. This
        // inline script, part of the cached index.html, replaces the white page
        // with a message once the app has not started after BOOT_WAIT_MS, or
        // as soon as one of its scripts fails to load. React replaces it when
        // it does start. The prod build is precached whole and needs no guard.
        name: 'dev-boot-guard',
        apply: 'serve',
        transformIndexHtml: () => [{
          tag: 'script',
          injectTo: 'head-prepend',
          children: `(function () {
  var BOOT_WAIT_MS = 8000;
  function show() {
    var root = document.getElementById('root');
    if (!root || root.childNodes.length) return;
    root.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;font:16px system-ui,sans-serif;color:#212529">'
      + '<strong>Serveur injoignable</strong>'
      + '<span>Le serveur de développement ne répond pas. Ce réseau n’est peut-être pas autorisé\u00a0: passez sur un Wi-Fi ou un VPN autorisé.</span>'
      + '<button type="button" onclick="location.reload()" style="min-width:44px;min-height:44px;padding:8px 20px;border:0;border-radius:6px;background:#0d6efd;color:#fff;font:inherit">Réessayer</button></div>';
  }
  setTimeout(show, BOOT_WAIT_MS);
  // A script that fails to load fires "error" on its element, which does not bubble
  window.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'SCRIPT') show(); }, true);
  window.addEventListener('online', function () { if (!document.getElementById('root').childNodes.length) location.reload(); });
})();`,
        }],
      },
      {
        name: 'env-icons',
        transformIndexHtml: (html: string) => html
          .replace('href="/favicon.ico"', `href="/${versioned(`favicon${iconSuffix}.ico`)}"`)
          .replace('href="/apple-touch-icon.png"', `href="/${versioned(`apple-touch-icon${iconSuffix}.png`)}"`),
        configureServer(server) {
          if (!isDevServer) return
          server.middlewares.use((req, _res, next) => {
            const alias = req.url && devIconAliases[req.url.split('?')[0]]
            if (alias) req.url = alias
            next()
          })
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        // The manifest icons carry a ?v= hash, so they are listed here to be precached
        includeAssets: [
          `favicon${iconSuffix}.ico`, 'robots.txt', `apple-touch-icon${iconSuffix}.png`,
          ...['', '-maskable'].flatMap((m) => ['192x192', '512x512'].map((s) => `icons/pwa${iconSuffix}${m}-${s}.png`)),
        ],
        includeManifestIcons: false,
        workbox: {
          // Configuration pour améliorer la persistance des données
          clientsClaim: true,
          skipWaiting: true,
          // The ?v= content hash of the icon URLs still hits their precached copy
          ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
          // Never the SPA shell for the dev catch-all mailbox (Mailpit behind
          // nginx), nor for the API: a printing sheet opens as a page (PDF)
          navigateFallbackDenylist: [/^\/mail\//, /^\/api\//],
          // Stratégies de cache pour les ressources d'authentification
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.destination === 'document'
                && !url.pathname.startsWith('/mail/') && !url.pathname.startsWith('/api/'),
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
        // Rendered from frontend/icons/app-icon*.svg (see its README): rounded
        // "any" icons for desktops, full-bleed "maskable" ones that Android
        // crops to the launcher's shape
        icons: [
          {
            src: versioned(`icons/pwa${iconSuffix}-192x192.png`),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: versioned(`icons/pwa${iconSuffix}-512x512.png`),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: versioned(`icons/pwa${iconSuffix}-maskable-192x192.png`),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: versioned(`icons/pwa${iconSuffix}-maskable-512x512.png`),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
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
