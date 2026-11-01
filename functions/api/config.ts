import { getBusinessEmail, isValidBusinessEmail } from '../../server/contact';
import type { Env } from './estimate';
export const getPublicConfig = (env: Env): Response => Response.json({
  siteKey: env.TURNSTILE_SITE_KEY || '',
  // Public by design: enables the visitor-controlled email draft fallback.
  contactEmail: isValidBusinessEmail(env) ? getBusinessEmail(env) : '',
  configured: Boolean(env.RESEND_API_KEY && isValidBusinessEmail(env) && env.FROM_EMAIL && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
}, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export const onRequestGet: PagesFunction<Env> = ({ env }) => getPublicConfig(env);
