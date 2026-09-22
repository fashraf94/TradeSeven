// src/hooks/useBackingWallet.js
//
// Backing Beta PR 4 — the viewer's own wallet (owner-read backingWallets/{uid}).
//
// THE ALLOWANCE IS GRANTED LAZILY on the first wallet touch of a backing week
// (spec V1.3 §2, D-h), so before the viewer's first stake of the week the doc
// still carries the PRIOR week's remainder. The display therefore binds to
// the doc's own `lastAllowanceWeek`: on this week → its `allowanceRemaining`;
// on any other week (or no doc) → the full ALLOWANCE_BP the next stake will be
// drawn from. Both are the server's rule (backingWallet.js ensureAllowance),
// not a client estimate, and the doc's next snapshot — written by the stake
// transaction — replaces the derived value the moment it exists.

import { useEffect, useState } from 'react';
import { ALLOWANCE_BP } from '../constants/backing';
import { subscribeWallet } from '../services/backingService';

export function allowanceLeft(wallet, weekKey) {
  if (wallet && weekKey && wallet.lastAllowanceWeek === weekKey) {
    const remaining = Number.isFinite(wallet.allowanceRemaining) ? Math.max(0, Math.floor(wallet.allowanceRemaining)) : 0;
    return remaining;
  }
  return ALLOWANCE_BP;
}

export default function useBackingWallet(uid, weekKey, enabled = true) {
  const [wallet, setWallet] = useState(null);
  useEffect(() => {
    if (!enabled || !uid) { setWallet(null); return undefined; }
    const unsub = subscribeWallet(uid, setWallet);
    return () => unsub();
  }, [enabled, uid]);
  return { wallet, left: allowanceLeft(wallet, weekKey), total: ALLOWANCE_BP };
}
