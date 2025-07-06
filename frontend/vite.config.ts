import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// add velutina.ovh to server.allowedHosts

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'velutina.ovh',
      'www.velutina.ovh',
      'api.velutina.ovh',
      'app.velutina.ovh',
    ],
  },
})
