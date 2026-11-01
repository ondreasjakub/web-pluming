import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEstimateEmail } from '../src/estimate-email.ts';
import { getBusinessEmail } from '../server/contact.ts';
import { getPublicConfig } from '../functions/api/config.ts';
import type { Env } from '../functions/api/estimate.ts';
const fields = { name: 'Jane & John', email: 'customer@example.com', phone: '8155550123', service: 'Plumbing Repairs', address: '123 Main St, Rockford', description: 'Leaking faucet & pipe.\nPlease call before visiting.' };

test('default destination is the address requested by the owner', () => {
  assert.equal(getBusinessEmail({}), 'jakub.ondreas@gmail.com');
  assert.equal(getBusinessEmail({ BUSINESS_EMAIL: '' }), 'jakub.ondreas@gmail.com');
});
test('environment configuration overrides the destination without source edits', () => {
  assert.equal(getBusinessEmail({ BUSINESS_EMAIL: ' other@example.com ' }), 'other@example.com');
});
test('public config provides a usable email fallback without pretending direct delivery is configured', async () => {
  const response = getPublicConfig({} as Env);
  assert.deepEqual(await response.json(), { siteKey: '', configured: false, contactEmail: 'jakub.ondreas@gmail.com' });
});
test('email draft includes every customer field and safely encodes special characters', () => {
  const draft = buildEstimateEmail('jakub.ondreas@gmail.com', fields);
  assert.ok(draft.startsWith('mailto:jakub.ondreas%40gmail.com?'));
  const query = new URLSearchParams(draft.split('?')[1]);
  assert.equal(query.get('subject'), 'Birch Plumbing estimate request: Plumbing Repairs');
  for (const value of Object.values(fields)) assert.ok(query.get('body')?.includes(value));
  assert.equal(query.size, 2);
});
test('rejects recipients that could inject mailto parameters or email headers', () => {
  for (const recipient of ['invalid', 'a@example.com\r\nBcc:other@example.com']) assert.throws(() => buildEstimateEmail(recipient, fields));
});
test('line breaks cannot introduce subject headers', () => {
  const query = new URLSearchParams(buildEstimateEmail('jakub.ondreas@gmail.com', { ...fields, service: 'Repair\r\nBcc: other@example.com' }).split('?')[1]);
  assert.ok(!query.get('subject')?.includes('\n'));
  assert.equal(query.size, 2);
});
test('invalid recipient configuration is not advertised as ready', async () => {
  const response = getPublicConfig({ RESEND_API_KEY: 'key', FROM_EMAIL: 'sender@example.com', TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret', BUSINESS_EMAIL: 'invalid' });
  assert.deepEqual(await response.json(), { siteKey: 'site', configured: false, contactEmail: '' });
});
