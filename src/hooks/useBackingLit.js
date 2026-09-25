// src/hooks/useBackingLit.js
//
// Backing activation — IS THE BACKING LAYER LIT FOR THIS VIEWER? The client
// half of the founder smoke override (api/_utils/backingSmoke.js; spec V1.3
// §11 gate 4 as amended by Amendment A §A7): ONE hook every backing surface
// gate reads, over ONE context the app root provides
// (src/components/League/backing/BackingLitProvider.jsx).
//
//   useBackingLit() = BACKING_BETA_ENABLED || <the server's answer for this viewer>
//
// THE CLIENT NEVER DECIDES. It does not read its hostname, it does not read
// the env vars, it does not know the allowlist. The provider asks
// GET /api/backing/lit once per signed-in session and holds the boolean the
// server returns: `{ lit: true }` only for an allowlisted uid on a Vercel
// preview with the switch on, `{ lit: false }` for everyone else, everywhere,
// and whenever the ask fails. The context's DEFAULT is false, so a surface
// mounted without the provider — every dark row, every test that mounts a
// host bare — reads exactly the code flag, as today.
//
// THE FLAG IS READ AT CALL TIME inside the hook (never a module-scope
// derivation), so a hermetic featureFlags mock with a getter governs every
// suite (backingDark.test.jsx flips it per row), and the flip PR that turns
// the constant true lights every viewer with no provider involved.
//
// THIS MODULE IMPORTS ONLY REACT AND THE FLAGS — deliberately. Every backing
// surface and the League pod card read it, so it must add nothing to their
// import graph; the ask (the service, the user context) lives in the provider.
//
// THE DEV PREVIEW PAGE (src/screens/BackingPreviewScreen.jsx) provides this
// SAME context with `true` for its fixture subtree — `BackingPreviewLitContext`
// in backingPreview.js is this context, re-exported — so the pod card's
// "Predictions" label lights there exactly as before.

import { createContext, useContext } from 'react';
import { BACKING_BETA_ENABLED } from '../config/featureFlags';

/** The server's answer for this viewer. DEFAULT FALSE: no provider, no light. */
export const BackingLitContext = createContext(false);

/**
 * Is the backing layer lit for this viewer? The code flag, read at call
 * time, OR the server's answer under the provider. A pure context read: no
 * effect, no request, no listener — a surface gate calls it and returns null
 * without running anything.
 */
export function useBackingLit() {
  const answered = useContext(BackingLitContext) === true;
  return BACKING_BETA_ENABLED === true || answered;
}
