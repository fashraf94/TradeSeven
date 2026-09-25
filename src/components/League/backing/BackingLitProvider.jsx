// src/components/League/backing/BackingLitProvider.jsx
//
// Backing activation — THE ONE ASK. Mounted once at the app root (src/main.jsx,
// inside UserProvider), this asks GET /api/backing/lit once per signed-in uid
// and provides the answer through BackingLitContext (src/hooks/useBackingLit.js)
// to every backing surface gate. It renders nothing of its own.
//
// WHEN IT ASKS, exactly: when the signed-in uid it sees CHANGES (sign-in, an
// account switch) — never on a re-render, never for a signed-out viewer, and
// never while the code flag is already true (every viewer is lit by the flag
// itself, there is nothing to learn). (Under React StrictMode in a DEV build
// the effect is double-invoked, so a dev server asks twice per uid; the
// first reply is dropped by `active`. Production asks once.) The answer is the server's boolean and
// nothing else; a failed ask reads dark (the server's silence is not a yes).
//
// WHAT THIS COSTS EVERYONE ELSE, stated plainly: one authenticated GET per
// signed-in session, answered `{ lit: false }` with zero Firestore reads
// (api/backing/lit.js). The rendered app is byte-identical to today while the
// answer is false — the context's default — which backingDark.test.jsx holds.

import React, { useEffect, useState } from 'react';
import { BACKING_BETA_ENABLED } from '../../../config/featureFlags';
import { useUser } from '../../../contexts/UserContext';
import { fetchBackingLit } from '../../../services/backingService';
import { BackingLitContext } from '../../../hooks/useBackingLit';

export default function BackingLitProvider({ children }) {
  // Must sit under UserProvider (src/main.jsx): useUser throws outside it.
  const { user } = useUser();
  const uid = typeof user?.uid === 'string' && user.uid.length > 0 ? user.uid : null;
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (uid === null || BACKING_BETA_ENABLED === true) { setLit(false); return undefined; }
    let active = true;
    setLit(false);
    fetchBackingLit()
      .then((body) => { if (active) setLit(body?.lit === true); })
      .catch((err) => {
        console.warn('[BackingLitProvider] the lit ask failed (reading dark):', err?.code ?? err?.message);
        if (active) setLit(false);
      });
    return () => { active = false; };
  }, [uid]);

  return <BackingLitContext.Provider value={lit}>{children}</BackingLitContext.Provider>;
}
