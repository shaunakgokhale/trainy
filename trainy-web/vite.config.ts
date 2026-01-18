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
          target: 'https://apis.deutschebahn.com/db-api-marketplace/apis/ris-journeys-transporteure/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/db\/journeys/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const clientId = env.VITE_DB_CLIENT_ID ?? '';
              const apiKey = env.VITE_DB_API_KEY ?? '';
              const hasClientId = Boolean(clientId);
              const hasApiKey = Boolean(apiKey);
              const clientIdLength = clientId.length;
              const apiKeyLength = apiKey.length;
              const clientIdLooksPlaceholder = clientId.startsWith('your_') || clientId === 'undefined';
              const apiKeyLooksPlaceholder = apiKey.startsWith('your_') || apiKey === 'undefined';
              if (env.VITE_DB_CLIENT_ID) {
                proxyReq.setHeader('DB-Client-Id', env.VITE_DB_CLIENT_ID);
              }
              if (env.VITE_DB_API_KEY) {
                proxyReq.setHeader('DB-Api-Key', env.VITE_DB_API_KEY);
              }
              const clientIdHeader = proxyReq.getHeader('DB-Client-Id');
              const apiKeyHeader = proxyReq.getHeader('DB-Api-Key');
              const clientIdHeaderLength =
                typeof clientIdHeader === 'string' ? clientIdHeader.length : undefined;
              const apiKeyHeaderLength =
                typeof apiKeyHeader === 'string' ? apiKeyHeader.length : undefined;
              proxyReq.setHeader('Accept', 'application/json');
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b258d2ce-af1d-45fe-9640-bb8d33995204',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.config.ts:journeysProxyReq',message:'proxy-req',data:{path:proxyReq.path,hasClientId,hasApiKey,clientIdLength,apiKeyLength,clientIdLooksPlaceholder,apiKeyLooksPlaceholder,clientIdHeaderPresent:Boolean(clientIdHeader),apiKeyHeaderPresent:Boolean(apiKeyHeader),clientIdHeaderLength,apiKeyHeaderLength},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H9'})}).catch(()=>{});
              // #endregion
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              const wwwAuthenticate = proxyRes.headers['www-authenticate'];
              const contentType = proxyRes.headers['content-type'];
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b258d2ce-af1d-45fe-9640-bb8d33995204',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.config.ts:journeysProxyRes',message:'proxy-res',data:{path:req.url,status:proxyRes.statusCode,contentType,wwwAuthenticate},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H8'})}).catch(()=>{});
              // #endregion
            });
          },
        },
      },
    },
  }
})
