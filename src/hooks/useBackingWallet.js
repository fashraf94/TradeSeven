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
  // No week to bind to yet (the pod list names it): unknown, not the full
  // allowance — a known wallet with a remainder would otherwise read 1,000
  // until the list resolved (R-A-3, the PR 4 review record).
  if (typeof weekKey !== 'string' || weekKey.length === 0) return null;
  if (wallet && wallet.lastAllowanceWeek === weekKey) {
    const remaining = Number.isFinite(wallet.allowanceRemaining) ? Math.max(0, Math.floor(wallet.allowanceRemaining)) : 0;
    return remaining;
  }
  return ALLOWANCE_BP;
}

// `walletId`: the wallet DOCUMENT to read when it is not the viewer's own uid
// — the pod list names `dev-{uid}` for a founder smoke session (the activation
// PR: a smoke stake debits the dev wallet, so the meter must read it or it
// would show the full allowance for the whole walk). Null — the uid's own.
export default function useBackingWallet(uid, weekKey, enabled = true, walletId = null) {
  const [state, setState] = useState({ wallet: null, known: false });
  const docId = typeof walletId === 'string' && walletId.length > 0 ? walletId : uid;
  useEffect(() => {
    if (!enabled || !uid) { setState({ wallet: null, known: false }); return undefined; }
    setState({ wallet: null, known: false });
    const unsub = subscribeWallet(docId, (wallet, err) => setState({ wallet, known: !err }));
    return () => unsub();
  }, [enabled, uid, docId]);
  // `known`: the server's record has been read — a MISSING document is a
  // record (no wallet yet; the full allowance ahead). Until the first snapshot
  // lands, or after a failed read, the allowance is unknown and no surface
  // shows a figure for it (FAB-10, the PR 4 review record).
  const left = state.known ? allowanceLeft(state.wallet, weekKey) : null;
  return { wallet: state.wallet, known: state.known && Number.isFinite(left), left, total: ALLOWANCE_BP };
}
