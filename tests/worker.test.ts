import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type WorkerEnv } from '../worker/index.ts';

function environment() {
  const assetRequests: string[] = [];
  const env: WorkerEnv = {
    RESEND_API_KEY: '', BUSINESS_EMAIL: '', FROM_EMAIL: '',
    TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '',
    ASSETS: { fetch: (async (input: RequestInfo | URL) => {
      assetRequests.push(input instanceof Request ? input.url : String(input));
      return new Response('static website', { headers: { 'Content-Type': 'text/html' } });
    }) as Fetcher['fetch'] },
  };
  return { env, assetRequests };
}

test('Worker routes config to the backend, not SPA assets', async () => {
  const { env, assetRequests } = environment();
  const response = await worker.fetch(new Request('https://birch.example/api/config'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { siteKey: '', configured: false });
  assert.equal(assetRequests.length, 0);
});

test('Worker config exposes the public site key but not secrets', async () => {
  const { env } = environment();
  Object.assign(env, { RESEND_API_KEY: 'private-key', BUSINESS_EMAIL: 'office@example.com', FROM_EMAIL: 'website@example.com', TURNSTILE_SITE_KEY: 'public-site-key', TURNSTILE_SECRET_KEY: 'private-secret' });
  const response = await worker.fetch(new Request('https://birch.example/api/config'), env);
  assert.deepEqual(await response.json(), { siteKey: 'public-site-key', configured: true });
});

test('Worker rejects unsupported config methods', async () => {
  const { env } = environment();
  const response = await worker.fetch(new Request('https://birch.example/api/config', { method: 'POST' }), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET');
});

test('Worker estimate endpoint preserves backend method and origin checks', async () => {
  const { env, assetRequests } = environment();
  const get = await worker.fetch(new Request('https://birch.example/api/estimate'), env);
  assert.equal(get.status, 405);
  const post = await worker.fetch(new Request('https://birch.example/api/estimate', { method: 'POST', headers: { Origin: 'https://attacker.example' } }), env);
  assert.equal(post.status, 403);
  assert.equal(assetRequests.length, 0);
});

test('Worker preserves the honest unconfigured estimate fallback', async () => {
  const { env } = environment();
  const response = await worker.fetch(new Request('https://birch.example/api/estimate', {
    method: 'POST', headers: { Origin: 'https://birch.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Customer', email: 'test@example.com', phone: '8155550123', service: 'Plumbing Repairs', address: '1715 Kings Hwy Rockford', description: 'The kitchen faucet is leaking.' }),
  }), env);
  assert.equal(response.status, 503);
  assert.match((await response.json() as { error: string }).error, /not configured/);
});

test('Worker returns JSON 404 for unknown API routes instead of HTML', async () => {
  const { env, assetRequests } = environment();
  for (const path of ['/api', '/api/unknown', '/api/config/']) {
    const response = await worker.fetch(new Request(`https://birch.example${path}`), env);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('Content-Type') || '', /application\/json/);
  }
  assert.equal(assetRequests.length, 0);
});

test('Worker delegates non-API routes to the static asset binding', async () => {
  const { env, assetRequests } = environment();
  for (const path of ['/', '/assets/site.js', '/images/kitchen.jpg']) {
    const response = await worker.fetch(new Request(`https://birch.example${path}`), env);
    assert.equal(await response.text(), 'static website');
  }
  assert.equal(assetRequests.length, 3);
});
