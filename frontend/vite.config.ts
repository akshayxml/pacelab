import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Adds a strict Content-Security-Policy to production builds. Inline
 * scripts (the theme bootstrap) are allowed by hash. In the static build
 * the only external host the page may contact is Intervals.icu, which
 * limits where an injected script could send the API key.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'pacelab-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const scriptHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
        )
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${scriptHashes.join(' ')}`,
          "style-src 'self' 'unsafe-inline'",
          // Athlete avatars come from Intervals.icu / Strava CDNs.
          "img-src 'self' data: https:",
          // Vite inlines very small font subsets as data: URLs.
          "font-src 'self' data:",
          "connect-src 'self' https://intervals.icu",
          "manifest-src 'self'",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // New versions install in the background and apply on the next launch.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PaceLab',
        short_name: 'PaceLab',
        description:
          'Your running dashboard: mileage, year-over-year progress and best efforts.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only. Activity data is cached by the app in IndexedDB;
        // API responses (which carry the API key's data) never go in here.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/*-latin-*.woff2'],
        // Backend routes (API, Strava OAuth) must reach the server.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
    contentSecurityPolicy(),
  ],
  server: {
    // Forward API calls to the backend so cookies stay same-origin in dev.
    // The standalone build has no backend.
    proxy: mode === 'standalone' ? undefined : { '/api': 'http://localhost:4000' },
  },
}))
