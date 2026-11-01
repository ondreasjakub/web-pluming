# Birch Plumbing Inc.

A responsive React + TypeScript + Vite website for Birch Plumbing Inc., Rockford, Illinois. Static assets deploy to **Cloudflare Pages**; `/api/config` and `/api/estimate` run as **Cloudflare Pages Functions**.

## Current integration status

The website and backend are implemented. **Live email delivery has not been configured or tested.** Without all five environment variables, the site displays a clear telephone fallback and disables online submissions. Tests use mocked external providers; they do not prove live inbox delivery. No customer information is stored in the browser or a database.

## Local development

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Vite provides frontend-only development on port 5173. API configuration is not available there, so the form intentionally shows the telephone fallback.

To run the full Cloudflare backend locally:

```sh
cp .dev.vars.example .dev.vars
# Fill in your own development credentials. This file is ignored by Git.
npm run pages:dev
```

Wrangler serves the built frontend and Functions together on port 8788. After frontend changes, restart this command to rebuild. Local environment files must never be committed.

## Cloudflare Pages deployment through GitHub

1. Push this working branch to GitHub and review/merge according to your normal workflow.
2. In Cloudflare, choose **Workers & Pages → Create application → Pages → Connect to Git** and select this GitHub repository.
3. Select the intended production branch (normally `main`). Preview deployments may use this session's working branch.
4. Choose **Vite** (or configure manually):
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: repository root
   - Node version: `22` (set `NODE_VERSION=22` if needed)
5. Keep the root `functions/` directory in the repository. Pages compiles it separately; it is not part of the client bundle. Do not deploy only `dist` via dashboard drag-and-drop: that does not compile the Functions.
6. Configure the variables below for **Production**, and separately for **Preview** if testing previews. Redeploy after changes.
7. Configure your custom domain in the Pages project's **Custom domains** settings.
8. Follow the launch checklist below before accepting real inquiries.

The repository includes a GitHub Actions workflow that runs tests and the production build. Cloudflare's native Git integration handles deployment; no deployment credentials are included in the workflow.

An authenticated command-line alternative is `npx wrangler pages deploy dist --project-name YOUR_PAGES_PROJECT` after `npm run build`. Run it from the repository root so Wrangler finds `functions/`.

## Environment variables

Set these in **Cloudflare Pages → your project → Settings → Variables and Secrets**. Use secrets/encrypted values for API credentials. Never prefix any secret with `VITE_`.

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-only Resend API key with permission to send email. |
| `BUSINESS_EMAIL` | Destination inbox for inquiries. Change this setting, then redeploy, to change recipients without editing source. Use one valid email address. |
| `FROM_EMAIL` | Verified Resend sender, for example `Birch Plumbing Website <website@your-verified-domain.com>`. Must belong to a domain you control and verify. |
| `TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile widget key. Exposed by `/api/config` intentionally. |
| `TURNSTILE_SECRET_KEY` | Server-only Turnstile verification secret. |

`/api/config` exposes only the public site key and a configuration-ready boolean, never the business inbox, sender, or secret keys. “Configured” means values are present, not that they are valid or that live delivery has been tested.

### Set up Resend

1. Create a Resend account and add a sending domain you control.
2. Add Resend's required DNS records and complete domain verification.
3. Create a send-enabled API key and store it as `RESEND_API_KEY` in Cloudflare.
4. Set `FROM_EMAIL` to an address on that verified domain, and `BUSINESS_EMAIL` to the desired recipient.
5. Customer email is used only as `reply_to`, not as the sender. The email contains the name, email, telephone number, selected service, property address, and description as plain text.
6. Check Resend's delivery logs and the destination inbox during end-to-end testing. API acceptance is not a guarantee of final inbox delivery.

### Set up Turnstile

1. In Cloudflare's Turnstile dashboard, create a **Managed** widget.
2. Register the production domain and any preview/test hostnames you will use. Add `localhost` for local testing with a real widget.
3. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the matching Cloudflare environment.
4. The client renders with action `estimate`. The backend checks success, exact hostname, and action before contacting Resend. Standard dummy Turnstile keys may return dummy host/action values; they will intentionally fail these strict checks. Use an allowlisted hostname and a real test widget to exercise the full flow.

## Backend protection and behavior

- Same-origin POST-only JSON endpoint; no permissive CORS.
- Bounded request streaming (20 KB maximum), field lengths, required values, email/phone validation, and a fixed service allowlist.
- Plain-text email with a fixed subject structure; user content is not interpolated into HTML or headers.
- Honeypot, minimum form fill time, expiring form timestamp, and required server-verified Turnstile token.
- Provider timeouts and honest configuration, verification, and send-error messages. Failed submissions require a fresh token.
- No API keys in frontend code; no submission bodies logged by the application.
- Security headers in `public/_headers`, including a restrictive Content Security Policy.
- The public configuration response is `no-store`. Cloudflare `_headers` applies to static files; Functions set their own JSON response headers.
- Turnstile is the application-level anti-bot control, **not a durable per-IP rate limiter**. Before production, add an appropriate Cloudflare WAF rate-limiting rule for POST requests to `/api/estimate` if your plan supports it, and monitor abuse and Resend quotas. An in-memory counter would not be reliable across Cloudflare isolates.
- No automatic send retries or customer auto-replies. If a provider times out after accepting email, the UI asks the visitor to call before trying again, avoiding claims of confirmed delivery.

## Validation

```sh
npm test
npm run build
```

The automated suite covers valid requests, invalid fields/bodies, origin/method/content-type checks, oversized payloads, honeypot/timing/token checks, missing configuration, Turnstile failures and hostname/action mismatch, configurable recipient and reply-to behavior, provider rejection/network failure, and public configuration secrecy.

### Launch checklist

- [ ] Business confirms wording and offered services, including residential work and general maintenance.
- [ ] Business confirms free-estimate wording and the correct phone/address.
- [ ] All five variables are configured in the intended deployment environment.
- [ ] Real Turnstile challenge succeeds on the final hostname.
- [ ] A real form submission reaches the configured inbox; inspect Resend delivery logs and spam folder.
- [ ] Replying to an inquiry addresses the customer correctly.
- [ ] Invalid submissions and security failures do not send mail.
- [ ] Check mobile layout, keyboard navigation, phone links, and the Google map.
- [ ] Add production rate limiting and monitor email/API usage.
- [ ] Once the final domain is known, add an absolute canonical URL, absolute Open Graph image URL, and a domain-specific sitemap. No fictional domain is baked into the site.
- [ ] Review any privacy notice obligations with the business before launch. The form explains inquiry-only use; no analytics/tracking cookies are installed. The map only loads Google's iframe after explicit interaction; Turnstile loads when configured.

## Design and content

Navy, ivory, and a soft green accent; locally hosted Manrope variable font (license in `public/fonts/OFL.txt`); Lucide icons; custom AI-generated residential kitchen imagery (illustrative, not a photograph of company work). There are no invented reviews, certifications, business hours, years in business, emergency response promises, or workmanship guarantees. Phone calls and external maps work without email configuration. The map is click-to-load, and external Google Maps directions are always available.

Business details: **Birch Plumbing Inc. · 1715 Kings Hwy, Rockford, IL 61107 · (815) 988-0719**.
