// src/components/Dashboard/deployCeremony/ceremonyData.js
//
// Deploy Ceremony — pure data derivations + the best-effort watchlist-symbol
// re-fetch. Every value here is a real artifact of THIS deploy (the honesty rule,
// spec §1): the picks are derived by construction from the one stored
// lastDecision.portfolio object (§9 display-agreement), never re-fetched from a
// parallel source; the monologue is the agent's own sentence or nothing.

import { useEffect, useRef, useState } from 'react';
import { listWatchlists } from '../../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../../Forge/Watchlist/filterWatchlistsByStatus';

/**
 * The deployed picks, derived by flattening the tiered portfolio object
 * [...star, ...core, ...support] → symbols (spec §7). The portfolio is a tiered
 * object of asset objects, never a flat array; bench is omitted in V1.
 */
export function flattenPicks(portfolio) {
  if (!portfolio || typeof portfolio !== 'object') return [];
  const tiers = [portfolio.star, portfolio.core, portfolio.support];
  const out = [];
  for (const tier of tiers) {
    if (!Array.isArray(tier)) continue;
    for (const asset of tier) {
      const sym = typeof asset === 'string' ? asset : asset?.symbol;
      if (sym) out.push(sym);
    }
  }
  return out;
}

/** First sentence of a block of prose (terminates at . ! ?), or null. */
export function firstSentence(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : trimmed).trim() || null;
}

/**
 * The Act 3 attributed quote — the first sentence of innerMonologue.strategy.
 * SUPPRESSED entirely whenever fallbackKind !== null: that monologue is a canned
 * template, and rendering it as an attributed agent quote is the §6/§9 honesty
 * violation in miniature. Missing/empty → null (never a placeholder).
 */
export function getMonologueQuote(lastDecision, fallbackKind) {
  if (fallbackKind != null) return null;
  const strategy = lastDecision?.innerMonologue?.strategy;
  return firstSentence(strategy);
}

/**
 * Whether to render the subtle truncation continuation indicator for a shown
 * brief excerpt (spec §6 / A.2 §5.3). True only when the excerpt is a real prefix
 * SHORTER than the full stored brief. Comparison is against the stored artifact;
 * the indicator lives in the view layer only — the excerpt itself is never
 * modified. When the full brief isn't available yet, omit (omitting is
 * acceptable; fabricating is not).
 */
export function isExcerptTruncated(briefExcerpt, fullBrief) {
  if (typeof briefExcerpt !== 'string' || !briefExcerpt) return false;
  if (typeof fullBrief !== 'string' || !fullBrief) return false;
  return briefExcerpt.length < fullBrief.length;
}

/**
 * Best-effort equipped-watchlist symbols for the Stage 1 chip (spec §5.4, ruling
 * #3): re-fetch at overlay mount using the SAME read the loadout bench uses
 * (listWatchlists → committed → equipped). If it lands inside stage 1's window
 * the chip renders; if not, the caller omits it. Never blocks the ceremony.
 *
 * @param {string|null} equippedWatchlistId
 * @returns {{ symbols: string[], loaded: boolean }}
 */
export function useEquippedWatchlistSymbols(equippedWatchlistId) {
  const [symbols, setSymbols] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const idRef = useRef(equippedWatchlistId);
  idRef.current = equippedWatchlistId;

  useEffect(() => {
    if (!equippedWatchlistId) { setSymbols([]); setLoaded(true); return undefined; }
    let cancelled = false;
    listWatchlists()
      .then((list) => {
        if (cancelled) return;
        const committed = filterWatchlistsByStatus(list, 'committed');
        const wl = committed.find((w) => w.watchlistId === equippedWatchlistId) || null;
        const syms = (wl?.tickers || [])
          .map((t) => (typeof t === 'string' ? t : t?.symbol || t?.ticker))
          .filter(Boolean);
        setSymbols(syms);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSymbols([]);
        setLoaded(true); // omit the chip; never surface a fetch error into the ceremony
      });
    return () => { cancelled = true; };
  }, [equippedWatchlistId]);

  return { symbols, loaded };
}

// ── Which battle the reveal's CTA opens (PR 2 §5) ───────────────────────────
//
// `stash` is the battle App.jsx built at deploy time from the POST response;
// `recoveredBattle` is the agentBattles doc the ceremony's existence check read
// back as active, for this deploy target, moments ago.
//
// THE RECOVERED BATTLE WINS. In the canonical failure — the post-commit window in
// services/agentBattleVerify.js — there is no stash at all, because the POST never
// returned. But the stash is only cleared when a CTA actually fires, so a
// reveal the user dismissed with "Back to hub" leaves the PREVIOUS deploy's
// battle sitting in the ref for the rest of the SPA session. Preferring it would
// open that stale, possibly expired battle instead of the one just verified —
// reintroducing the dead-end this path exists to close.
//
// Returns `{ kind: 'recovered' | 'stash' | 'none', battle }`. 'recovered' must be
// hydrated from the Firestore doc (handleOpenAgentBattle); 'stash' is already a
// built battle object (enterAgentBattle).
export function pickCeremonyEntry(stash, recoveredBattle) {
  if (recoveredBattle?.id) return { kind: 'recovered', battle: recoveredBattle };
  if (stash) return { kind: 'stash', battle: stash };
  return { kind: 'none', battle: null };
}
