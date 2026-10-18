import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the backend so cookies stay same-origin in dev.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
