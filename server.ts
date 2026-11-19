import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './src/server/apiApp.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = createApiApp();

  const argv = process.argv.slice(2);
  let cliPort: number | undefined;
  let cliHost: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      cliPort = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      cliPort = Number(arg.split('=')[1]);
    } else if (arg === '--host' && argv[i + 1]) {
      cliHost = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--host=')) {
      cliHost = arg.split('=')[1];
    } else if (/^\d{2,5}$/.test(arg) && !cliPort) {
      cliPort = Number(arg);
    } else if (/^(\d{1,3}\.){3}\d{1,3}$/.test(arg) && !cliHost) {
      cliHost = arg;
    }
  }

  const envPort = Number(process.env.PORT);
  const isDevMode = process.env.NODE_ENV !== 'production';
  const resolvedEnvPort =
    Number.isFinite(envPort) && envPort > 0 && !(isDevMode && envPort === 8080)
      ? envPort
      : undefined;
  const port =
    cliPort && Number.isFinite(cliPort) && cliPort > 0
      ? cliPort
      : resolvedEnvPort ?? 3000;
  const host = cliHost?.trim() || '0.0.0.0';

  if (isDevMode) {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
      process.exit(1);
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(port, host, () => {
    console.log(`Hawasa Gebeya server listening on http://${host}:${port}`);
  });
  httpServer.on('error', (err) => {
    console.error(`Server listen error on ${host}:${port}:`, err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
