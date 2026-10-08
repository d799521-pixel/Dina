import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Version iPad / navigateur : application web installable (PWA) qui fonctionne
// hors-ligne une fois ouverte. Les données restent dans le stockage local de l'appareil.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Dina — cahier journal et tableau de classe',
        short_name: 'Dina',
        description: 'Cahier journal, préparations, fiches élèves et tableau de classe, hors-ligne.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8fafc',
        theme_color: '#2d3ea0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,woff2,png,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true
      }
    })
  ],
  build: { outDir: resolve('dist-web'), emptyOutDir: true }
})
