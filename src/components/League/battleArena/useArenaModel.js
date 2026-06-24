// src/components/League/battleArena/useArenaModel.js
//
// League Battle View V2 — the orchestrator hook (Phase 3). Gathers the effectful
// inputs the pure buildArenaModel bridge needs (the live price context, the claims
// subscription, the human display names, the prev-tick star-states ref) and the
// write handlers, then memoizes the model each render. Thin plumbing over the pure
// core — not unit-tested (the repo has no DOM harness; the bridge IS tested).
//
// OWNER-ONLY (founder ruling): consumes the host's already-subscribed `group` +
// your own `battle`; it NEVER subscribes a rival's battle. Writes REUSE the
// proven tournamentActions endpoints (flipPick/placeClaim) — no new mutation path.

import React from 'react';
import { flat6BattleSymbols } from '../../../utils/flat6BattleEnrichment';
import { subscribeClaims, fetchDisplayNames } from '../../../services/tournamentGroupService';
import { flipPick, placeClaim } from '../../../services/tournamentActions';
import { isCpuUserId } from '../../../constants/leagueTournament';
import { buildArenaModel } from './buildArenaModel';
import { useArenaPriceContext } from './useArenaPriceContext';

export function useArenaModel({ group, battle, mode, uid, compositeContext }) {
  // ── the symbol union (agent six ∪ your three), content-keyed so the price hook
  //    doesn't churn its WS subscription / poll on every fresh doc identity ──
  const symbolsKey = React.useMemo(() => {
    const agent = flat6BattleSymbols(battle);
    const mine = (group?.players?.find((p) => p?.odUserId === uid)?.picks || [])
      .map((p) => p?.symbol).filter(Boolean);
    return Array.from(new Set([...agent, ...mine])).join(',');
  }, [battle, group, uid]);
  const symbols = React.useMemo(() => (symbolsKey ? symbolsKey.split(',') : []), [symbolsKey]);

  const priceCtx = useArenaPriceContext(symbols, battle);

  // ── claims subcollection (live) ──
  const [claims, setClaims] = React.useState([]);
  React.useEffect(() => {
    if (!group?.id) return undefined;
    return subscribeClaims(group.id, setClaims);
  }, [group?.id]);

  // ── human display names (one-shot per membership; CPUs excluded) ──
  const [names, setNames] = React.useState({});
  const humanIdsKey = React.useMemo(
    () => (group?.players || []).map((p) => p?.odUserId)
      .filter((id) => id && !isCpuUserId(id)).sort().join(','),
    [group],
  );
  React.useEffect(() => {
    if (!humanIdsKey) return undefined;
    let alive = true;
    fetchDisplayNames(humanIdsKey.split(','))
      .then((n) => { if (alive) setNames(n || {}); })
      .catch(() => { /* names degrade to odUserId — non-fatal */ });
    return () => { alive = false; };
  }, [humanIdsKey]);

  // ── prev star-states (for deriveBeats transition diffs) ──
  const prevRef = React.useRef({});

  const model = React.useMemo(
    () => (group ? buildArenaModel({
      group,
      battle,
      priceCtx: { ...priceCtx, now: Date.now() }, // now captured at memo eval (relTime/wire)
      claims,
      displayNames: names,
      uid,
      mode,
      prevStarStates: prevRef.current,
      compositeContext,
    }) : null),
    [group, battle, priceCtx, claims, names, uid, mode, compositeContext],
  );

  // adopt the just-built star-states as the next tick's "prev" (after render)
  React.useEffect(() => { if (model?.starStates) prevRef.current = model.starStates; }, [model]);

  // ── write handlers (server-authoritative; flipPick toggles by symbol) ──
  const onFlip = React.useCallback((tk) => flipPick({ groupId: group?.id, symbol: tk }), [group?.id]);
  const onClaim = React.useCallback(
    ({ dropSymbol, addSymbol }) => placeClaim({ groupId: group?.id, dropSymbol, addSymbol }),
    [group?.id],
  );
  const onAsk = React.useCallback(() => Promise.resolve(), []); // read-only this phase

  const ready = !!group && (battle ? priceCtx.pricesLoaded : true);

  return { model, handlers: { onFlip, onClaim, onAsk }, ready };
}
