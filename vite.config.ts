import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// Force rebuild: v14 - Fix React hooks
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-enes.png', 'favicon.ico'],
      manifest: {
        name: 'ENES Électricité',
        short_name: 'ENES',
        description: 'Application mobile pour électriciens - Gestion des interventions, heures, matériaux et contrôles OIBT',
        theme_color: '#6B8E23',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        lang: 'fr-CH',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: '/logo-enes.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/logo-enes.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Interventions',
            short_name: 'Interventions',
            description: 'Voir mes interventions',
            url: '/interventions',
            icons: [{ src: '/logo-enes.png', sizes: '192x192' }]
          },
          {
            name: 'Calendrier',
            short_name: 'Calendrier',
            description: 'Voir le calendrier',
            url: '/calendar',
            icons: [{ src: '/logo-enes.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        // Clean all old caches on update
        cleanupOutdatedCaches: true,
        // Skip waiting - activate immediately
        skipWaiting: true,
        // Claim clients immediately
        clientsClaim: true,
        // Cache strategies
        runtimeCaching: [
          {
            // API calls - Network first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            // Static assets - Cache first
            urlPattern: /\.(js|css|png|jpg|jpeg|svg|gif|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              }
            }
          },
          {
            // HTML - Network first for fresh content
            urlPattern: /\.html$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    force: true,
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
}));
