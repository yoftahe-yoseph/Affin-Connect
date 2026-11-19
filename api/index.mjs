let handlerPromise = null;

export default async function handler(req, res) {
  try {
    if (!handlerPromise) {
      handlerPromise = import('./_handler.mjs').then((mod) => mod.default || mod);
    }
    const appHandler = await handlerPromise;

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        res.off('finish', onDone);
        res.off('close', onDone);
        res.off('error', onError);
      };
      const onDone = () => {
        cleanup();
        resolve();
      };
      const onError = (err) => {
        cleanup();
        reject(err);
      };

      res.once('finish', onDone);
      res.once('close', onDone);
      res.once('error', onError);

      try {
        const result = appHandler(req, res);
        if (result && typeof result.then === 'function') {
          result.catch(onError);
        }
      } catch (syncErr) {
        onError(syncErr);
      }
    });
  } catch (err) {
    handlerPromise = null;
    console.error('Vercel API invocation error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          code:
            err && typeof err === 'object' && 'code' in err
              ? err.code
              : undefined,
          stack:
            err instanceof Error && err.stack
              ? err.stack.split('\n').slice(0, 6)
              : undefined,
        })
      );
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
