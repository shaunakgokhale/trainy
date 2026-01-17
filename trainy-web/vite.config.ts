import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  // Ensure we load env from the trainy-web root (where .env.local lives)
  const rootDir = resolve(__dirname)
  const env = loadEnv(mode, rootDir, '')

  return {
    root: rootDir,
    plugins: [react()],
    server: {
      proxy: {
        // Proxy DB Timetables API requests to avoid CORS issues
        '/api/db/timetables': {
          target: 'https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/db\/timetables/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Add DB auth headers from env
              if (env.VITE_DB_CLIENT_ID) {
                proxyReq.setHeader('DB-Client-Id', env.VITE_DB_CLIENT_ID);
              }
              if (env.VITE_DB_API_KEY) {
                proxyReq.setHeader('DB-Api-Key', env.VITE_DB_API_KEY);
              }
              proxyReq.setHeader('Accept', 'application/xml');
            });
          },
        },
        // Proxy DB RIS::Journeys API requests
        '/api/db/journeys': {
          target: 'https://apis.deutschebahn.com/db-api-marketplace/apis/ris-journeys/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/db\/journeys/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.VITE_DB_CLIENT_ID) {
                proxyReq.setHeader('DB-Client-Id', env.VITE_DB_CLIENT_ID);
              }
              if (env.VITE_DB_API_KEY) {
                proxyReq.setHeader('DB-Api-Key', env.VITE_DB_API_KEY);
              }
              proxyReq.setHeader('Accept', 'application/json');
            });
          },
        },
      },
    },
  }
})
