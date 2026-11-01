import { getBusinessEmail, isValidBusinessEmail } from '../../server/contact';
export interface Env {
  RESEND_API_KEY: string;
  BUSINESS_EMAIL: string;
  FROM_EMAIL: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}
const services = ['Plumbing Repairs', 'Plumbing Installations', 'Residential Plumbing', 'General Plumbing Maintenance'];
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export function validateSubmission(data: Record<string, unknown>) {
  const limits: Record<string, [number, number]> = { name: [2, 100], email: [3, 254], phone: [7, 30], service: [1, 100], address: [5, 300], description: [10, 5000] };
  const cleaned: Record<string, string> = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (typeof data[key] !== 'string') return { error: 'Please complete all required fields.' };
    const value = (data[key] as string).trim();
    if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return { error: `Please check your ${key === 'description' ? 'description (10–5,000 characters)' : key}.` };
    cleaned[key] = value;
  }
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(cleaned.email)) return { error: 'Please enter a valid email address.' };
  if (!/^[+\d\s().-]+$/.test(cleaned.phone) || cleaned.phone.replace(/\D/g, '').length < 7) return { error: 'Please enter a valid phone number.' };
  if (!services.includes(cleaned.service)) return { error: 'Please select a listed service.' };
  return { data: cleaned };
}
export async function handleEstimate(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Expected a JSON submission.' }, 415);
  if (Number(request.headers.get('Content-Length')) > 20000) return json({ error: 'Your submission is too large.' }, 413);
  let data: Record<string, unknown>;
  try {
    // Bound the stream rather than trusting a client-controlled Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'No submission received.' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 20000) { await reader.cancel(); return json({ error: 'Your submission is too large.' }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
  } catch { return json({ error: 'Invalid submission. Please try again.' }, 400); }
  if (data.website) return json({ error: 'Unable to accept this submission. Please call us.' }, 400);
  const result = validateSubmission(data);
  if (result.error) return json({ error: result.error }, 400);
  if (!env.RESEND_API_KEY || !isValidBusinessEmail(env) || !env.FROM_EMAIL || !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) return json({ error: 'Online requests are not configured yet. Please call (815) 988-0719.' }, 503);
  if (typeof data.startedAt !== 'number' || Date.now() - data.startedAt < 3000 || Date.now() - data.startedAt > 86400000) return json({ error: 'Please take a moment to review the form, or reload the page and try again.' }, 400);
  if (typeof data.turnstileToken !== 'string' || !data.turnstileToken || data.turnstileToken.length > 2048) return json({ error: 'Please complete the security check.' }, 400);
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: data.turnstileToken });
    const ip = request.headers.get('CF-Connecting-IP'); if (ip) body.set('remoteip', ip);
    const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) });
    if (!verification.ok) return json({ error: 'Security verification is unavailable. Please try again or call us.' }, 503);
    const verified = await verification.json() as { success: boolean; hostname: string; action: string };
    if (!verified.success || verified.hostname !== new URL(request.url).hostname || verified.action !== 'estimate') return json({ error: 'Security check failed. Please complete it again.' }, 400);
    const d = result.data!;
    const email = await fetcher('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.FROM_EMAIL, to: [getBusinessEmail(env)], reply_to: d.email, subject: `Website estimate request: ${d.service}`, text: `New estimate request from the Birch Plumbing website\n\nName: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone}\nService: ${d.service}\nProperty address: ${d.address}\n\nDescription:\n${d.description}\n\nPlease reply directly to the customer to follow up.` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!email.ok) return json({ error: 'We could not send your request. Please call (815) 988-0719 or try again later.' }, 502);
    const receipt = await email.json() as { id?: string };
    if (!receipt.id) return json({ error: 'We could not confirm your request. Please call (815) 988-0719 before trying again.' }, 502);
    return json({ success: true });
  } catch { return json({ error: 'We could not confirm your request. Please call (815) 988-0719 before trying again.' }, 502); }
}
export const onRequest: PagesFunction<Env> = ({ request, env }) => handleEstimate(request, env);
