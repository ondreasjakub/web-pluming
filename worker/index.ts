import { getPublicConfig } from '../functions/api/config';
import { handleEstimate, type Env } from '../functions/api/estimate';

export type WorkerEnv = Env & { ASSETS: Pick<Fetcher, 'fetch'> };

// Reuse the Pages Functions logic so both deployment targets have the same
// validation, Turnstile checks, and server-only email integration.
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/config') {
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed.' }, {
          status: 405,
          headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
        });
      }
      return getPublicConfig(env);
    }
    if (path === '/api/estimate') return handleEstimate(request, env);
    if (path === '/api' || path.startsWith('/api/')) {
      return Response.json({ error: 'API endpoint not found.' }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
