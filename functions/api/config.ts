import type { Env } from './estimate';
export const onRequestGet: PagesFunction<Env> = async ({ env }) => Response.json({
  siteKey: env.TURNSTILE_SITE_KEY || '',
  configured: Boolean(env.RESEND_API_KEY && env.BUSINESS_EMAIL && env.FROM_EMAIL && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
}, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
