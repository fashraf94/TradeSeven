// src/components/League/backing/backingPreview.js
//
// Backing Beta PR 4 — the DEV PREVIEW's two pieces of production plumbing, kept
// in one small module so the preview page (src/screens/BackingPreviewScreen.jsx)
// is the only thing that uses them:
//
//   · BackingPreviewLitContext — BACKING_BETA_ENABLED forced on LOCALLY, for the
//     subtree under a provider. Default false, and nothing in the app provides
//     it except the preview page. The one flag read inside the surfaces the
//     preview renders is the pod card's "Predictions" label (LeaguePod.jsx),
//     which reads `BACKING_BETA_ENABLED || context`. featureFlags.js is not
//     touched; outside the preview the label follows the flag exactly as before.
//   · backingPreviewAllowed / backingPreviewRequested — the gate src/main.jsx
//     consults before it mounts the preview page INSTEAD of the app.
//
// THE GATE, exactly: the page mounts only when the URL carries
// `?preview=backing` AND one of
//   (A) the Vite dev server is running the app (`import.meta.env.DEV === true`);
//   (B) the page is served from a Vercel preview host — the hostname ends in
//       `.vercel.app`, it is not one of the production deployment's own
//       `.vercel.app` aliases (PRODUCTION_VERCEL_HOSTS), and the build does not
//       declare itself a production build (`VITE_VERCEL_ENV === 'production'`,
//       when Vercel exposes it to the Vite build; absent, the host rule decides).
// Everything else is refused: the production domain (fantasytrades.io and
// www.fantasytrades.io — not `.vercel.app`), the production aliases below,
// a local production build (`vite preview` on localhost), any other host. A
// refused request renders the app exactly as today.

import { createContext } from 'react';

/** True only under the dev preview page's provider. */
export const BackingPreviewLitContext = createContext(false);

/** The URL parameter the preview answers to — the repo's `?preview=` dev-screen gate (App.jsx `?preview=baggerbomb`). */
export const BACKING_PREVIEW_PARAM = 'backing';

/**
 * The production deployment's own `.vercel.app` hosts: the Vercel project
 * `trade-seven` (scope `fais-projects-bc179554`, per the Vercel bot on this
 * repo's pull requests) — its production aliases and its production branch
 * alias — plus the legacy production aliases the API's origin allow-list
 * still names (api/_utils/security.js ALLOWED_ORIGINS).
 */
export const PRODUCTION_VERCEL_HOSTS = Object.freeze([
  'trade-seven.vercel.app',
  'trade-seven-cyan.vercel.app',
  'trade-seven-fais-projects-bc179554.vercel.app',
  'trade-seven-git-main-fais-projects-bc179554.vercel.app',
  'tradeseven.vercel.app',
  'portfolio-duel.vercel.app',
  'marketclash.vercel.app',
]);

/** May the preview mount here? Pure — the caller passes the host and the build's env. */
export function backingPreviewAllowed({ hostname, isDev = false, vercelEnv = null } = {}) {
  if (isDev === true) return true;
  if (vercelEnv === 'production') return false;
  const host = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!host.endsWith('.vercel.app')) return false;
  return !PRODUCTION_VERCEL_HOSTS.includes(host);
}

/**
 * Was the preview asked for, AND may it mount here? `location` is
 * window.location; `env` carries the two build-time values main.jsx reads
 * (`import.meta.env.DEV`, `import.meta.env.VITE_VERCEL_ENV`).
 */
export function backingPreviewRequested(location, env = {}) {
  const params = new URLSearchParams(typeof location?.search === 'string' ? location.search : '');
  if (params.get('preview') !== BACKING_PREVIEW_PARAM) return false;
  return backingPreviewAllowed({
    hostname: location?.hostname,
    isDev: env?.DEV === true,
    vercelEnv: typeof env?.VITE_VERCEL_ENV === 'string' ? env.VITE_VERCEL_ENV : null,
  });
}
