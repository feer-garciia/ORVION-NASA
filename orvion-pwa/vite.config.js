// orvion-pwa/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Actualiza la app automáticamente cuando hay cambios
      devOptions: { enabled: true }, 
      includeAssets: ['favicon.ico', 'logo.png'], // Archivos extra que queremos que guarde en caché
      manifest: {
        name: 'Orvion - Agricultura Inteligente',
        short_name: 'Orvion',
        id:'/', 
        description: 'Evaluación agrícola satelital y de dron',
        theme_color: '#2e7d32', // Color verde de tu app
        background_color: '#d8e6d5', // Color de fondo al abrir la app
        display: 'standalone', // Hace que se vea como app nativa (sin barra de URL)
        orientation: 'portrait', // Bloquea la pantalla en vertical
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Permite que Android adapte el ícono a su forma
          }
        ]
      },
      workbox: {
        // Configuración del Service Worker (Caché)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Caché para la API de clima (Open-Meteo)
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 día
              }
            }
          },
          {
            // Caché para las teselas del mapa satelital
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              }
            }
          }
        ]
      }
    })
  ],
})