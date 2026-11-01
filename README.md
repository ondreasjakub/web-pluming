# Birch Plumbing Inc.

A responsive React + TypeScript + Vite website for Birch Plumbing Inc., Rockford, Illinois. The default deployment supports **Cloudflare Workers Builds** (`npx wrangler deploy`) with static assets and a server-side API. **Cloudflare Pages Functions** are also preserved as an alternative deployment target. Both targets reuse the same validation, Turnstile, and email handlers.

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
npm run worker:dev
# Or use the Pages runtime:
# npm run pages:dev
```

Wrangler serves the built frontend and backend together on port 8787 for Workers, or port 8788 for Pages. After frontend changes, restart this command to rebuild. Local environment files must never be committed.

## Fix for the deployment error in Workers Builds

The failed log used `npx wrangler deploy` against a Pages-only configuration. The default `wrangler.toml` now declares a Worker entry point (`worker/index.ts`) and static assets (`dist`), so **the existing build/deploy commands can stay unchanged**:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

Alternatively, `npm run deploy` builds and deploys in one command. Merge this fix into the branch Cloudflare builds (or select this PR branch for a preview), then retry the deployment. The configured Cloudflare Worker name should match `name` in `wrangler.toml` (`birch-plumbing`); adjust the name to your existing Worker if necessary.

`worker/index.ts` routes `/api/config` and `/api/estimate` to the same backend used by Pages Functions. The `ASSETS` binding serves the site. `run_worker_first` ensures API requests cannot be swallowed by static asset/SPA fallback, and unknown API routes return JSON 404s. This is **not** a static-only workaround: the secure estimate backend is included.

Set the five email/Turnstile variables below in **Workers & Pages → your Worker → Settings → Variables and Secrets**. `keep_vars = true` preserves dashboard-managed non-secret settings during CLI deployment; secrets remain server-side. A deployment may succeed before these are configured, but real online requests remain disabled until configuration is present. Existing Pages variables are not automatically copied to a Worker.

```sh
npm run build
npm run deploy:check    # Wrangler packaging dry run, no Cloudflare credentials needed
npm run deploy         # Real deployment: requires Cloudflare authorization
```

The dry run verifies the Worker bundle and asset binding; it does not prove a remote deploy or real email delivery. Do not add only `--assets=dist` to a Pages-only project: that would leave its Functions undeployed.

## Cloudflare Pages deployment through GitHub

1. Push this working branch to GitHub and review/merge according to your normal workflow.
2. In Cloudflare, choose **Workers & Pages → Create application → Pages → Connect to Git** and select this GitHub repository.
3. Select the intended production branch (normally `main`). Preview deployments may use this session's working branch.
4. Choose **Vite** (or configure manually):
   - Build command: `npm run build && cp wrangler.pages.toml wrangler.toml` (selects the Pages configuration inside the build environment only)
   - Build output directory: `dist`
   - Root directory: repository root
   - Node version: `22` (set `NODE_VERSION=22` if needed)
5. `wrangler.pages.toml` contains the Pages-only configuration; the build command above copies it over the default Workers configuration for this deployment. Keep the root `functions/` directory in the repository. Pages compiles it separately; it is not part of the client bundle. Do not deploy only `dist` via dashboard drag-and-drop: that does not compile the Functions.
6. Configure the variables below for **Production**, and separately for **Preview** if testing previews. Redeploy after changes.
7. Configure your custom domain in the Pages project's **Custom domains** settings.
8. Follow the launch checklist below before accepting real inquiries.

The repository includes a GitHub Actions workflow that runs tests and the production build. Cloudflare's native Git integration handles deployment; no deployment credentials are included in the workflow.

For command-line Pages deployments, run `npm run pages:deploy -- --project-name YOUR_PAGES_PROJECT`. The script stages the site, Functions, and `wrangler.pages.toml` in an ignored `.wrangler/pages-project` directory with the standard config filename Pages requires. It does not overwrite the default Workers config or use the unsupported Pages `--config` flag. `pages:dev` also copies local `.dev.vars` into that ignored directory; deploy/check never copy it.

## Environment variables

Set these in **Workers & Pages → your Worker (or Pages project) → Settings → Variables and Secrets**. Use secrets/encrypted values for API credentials. Never prefix any secret with `VITE_`.

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
npm run deploy:check
npm run pages:check
```

The automated suite covers valid requests, invalid fields/bodies, origin/method/content-type checks, oversized payloads, honeypot/timing/token checks, missing configuration, Turnstile failures and hostname/action mismatch, configurable recipient and reply-to behavior, provider rejection/network failure, public configuration secrecy, and Worker API/static-asset routing. CI also dry-runs the Workers deployment bundle and compiles the Pages Functions to catch deployment configuration regressions.

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
