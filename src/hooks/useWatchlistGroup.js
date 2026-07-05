// src/hooks/useWatchlistGroup.js
//
// V2 Build 6 (Agent-Book Mode) — read-only source hook for the "My watchlist"
// Correlation-Lab chip. Reads the user's EQUIPPED watchlist and projects it to
// SYMBOLS ONLY. Fence-CLEAN: the `watchlists` collection is owner-readable
// client-side (firestore.rules) and carries nothing scoring-adjacent.
//
// Path: useUser() → uid → useAgent(uid) → agent.equippedWatchlistId (a scalar;
// exactly one equipped list) → getDoc(watchlists/{id}). Symbols are the doc's
// `tickers[].symbol` (bare uppercase), normalized + first-10 truncated + crypto-
// filtered through the SAME pre-validation the group input uses (buildSourceGroup).
//
// Returns { symbols, label, asOf, truncatedFrom, excludedCrypto } or null
// (null = no equipped list / absent doc / no valid equity symbol → no chip).

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useUser } from '../contexts/UserContext';
import useAgent from './useAgent';
import { buildSourceGroup, tsToMs } from '../components/Research/correlationGroup';

// Pure-ish async reader (the only Firestore touch) — imported by the unit test
// with a mocked getDoc, so the hook wrapper below stays trivial glue.
export async function readWatchlistGroup(equippedWatchlistId) {
  if (!equippedWatchlistId) return null;
  const snap = await getDoc(doc(db, 'watchlists', equippedWatchlistId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const ordered = (Array.isArray(data.tickers) ? data.tickers : []).map((t) => t?.symbol);
  return buildSourceGroup(ordered, { label: 'My watchlist', asOf: tsToMs(data.updatedAt) });
}

export default function useWatchlistGroup() {
  const { user } = useUser();
  const { agent } = useAgent(user?.uid);
  const equippedWatchlistId = agent?.equippedWatchlistId ?? null;
  const [group, setGroup] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!equippedWatchlistId) {
      setGroup(null);
      return;
    }
    readWatchlistGroup(equippedWatchlistId)
      .then((g) => { if (alive) setGroup(g); })
      .catch((err) => {
        // Degrade to no-chip on any read failure — never a broken idle state.
        console.warn('[useWatchlistGroup] read failed:', err?.message);
        if (alive) setGroup(null);
      });
    return () => { alive = false; };
  }, [equippedWatchlistId]);

  return group;
}
