import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from './apiApp.ts';

let appInstance: ReturnType<typeof createApiApp> | null = null;
let initError: unknown = null;

try {
  appInstance = createApiApp();
} catch (err) {
  initError = err;
  console.error('Vercel API initialization failed:', err);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appInstance) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error:
          initError instanceof Error
            ? initError.message
            : 'Server API failed to initialize.',
      })
    );
    return;
  }

  // Vercel's Node runtime may pre-parse JSON into req.body and consume the stream.
  // Marking req._body = true tells Express body-parser not to hang re-reading it.
  const vercelReq = req as IncomingMessage & { body?: unknown; _body?: boolean };
  if (vercelReq.body !== undefined && vercelReq._body !== true) {
    vercelReq._body = true;
  }

  return appInstance(req as never, res as never);
}
