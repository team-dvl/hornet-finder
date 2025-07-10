import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// add velutina.ovh to server.allowedHosts

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Velutina',
        short_name: 'Velutina',
        description: 'Application de signalement des nids de frelons asiatiques',
        theme_color: '#ffffff',
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
      host: 'velutina.ovh',
      clientPort: 443,
    },
    allowedHosts: [
      'velutina.ovh',
      'www.velutina.ovh',
      'api.velutina.ovh',
      'app.velutina.ovh',
      'auth.velutina.ovh',
    ],
  },
})
