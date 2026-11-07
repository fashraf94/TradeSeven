// src/components/CommandCenter/hub/useLeagueLoadoutLock.js
//
// Build A2 — the hub's League lock (FD-3): one live subscription for the owner, through the client read
// (src/services/leagueLockService.js: the member-scoped group query the writers run, judged by the shared leagueLockOf).
// One effect, nothing else (commandCenterHub.activity.guard.test.js pins it): it starts the subscription for the owner
// and the cleanup stops it. Its answer is the lock, or that the read failed, held for the owner it was read for, so a
// change of owner never shows another account's week.

import { useEffect, useState } from 'react';
import { subscribeLeagueLock } from '../../../services/leagueLockService';

const NO_ANSWER = /* @__PURE__ */ Object.freeze({ lock: null, failed: false });

/** The owner's League lock: { lock, failed } — `lock` null until the read answers, `failed` when it could not. */
export function useLeagueLoadoutLock(uid) {
  const [held, setHeld] = useState(null);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeLeagueLock(uid, (lock) => setHeld({ uid, lock, failed: false }), () => setHeld({ uid, lock: null, failed: true }));
  }, [uid]);
  return held && held.uid === uid ? held : NO_ANSWER;
}
