import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// add velutina.ovh to server.allowedHosts

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
