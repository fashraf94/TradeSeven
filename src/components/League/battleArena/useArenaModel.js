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
import { flipPick, placeClaim, mapTournamentActionError } from '../../../services/tournamentActions';
import { isCpuUserId, GROUP_STATUS } from '../../../constants/leagueTournament';
import { buildArenaModel } from './buildArenaModel';
import { useArenaPriceContext } from './useArenaPriceContext';
import { useAtrPercentiles } from './useAtrPercentiles';
import { useLiveComposites } from './useLiveComposites';
import useSpectatedTournamentBattles from '../../../hooks/useSpectatedTournamentBattles';
import { useSessionCompositeTrail } from './useSessionCompositeTrail';
import { FUSE_HERO_ON } from './fuseHeroGate';

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

  // ── per-symbol percentile ATR (Phase 2.5, R1) — the SAME basis banking uses,
  //    so the user star cells + orb score against the percentile ATR, not the
  //    port-contract preview default. Short-cache fresh (10 min) so it tracks the
  //    intraday recompute and converges to banking's close version. ──
  const atrPercentiles = useAtrPercentiles();

  // ── rivals' live composites (Phase B, Option X) — the read-only endpoint map,
  //    polled ~60s while the live orb is ON and the round is a live BATTLE. Null
  //    off-gate (flag off → no poll → rivals stay on the banked series). Feeds
  //    ONLY rival seats; YOUR seat rides youLiveScore (never the endpoint). ──
  const liveComposites = useLiveComposites(group?.id, group?.status === GROUP_STATUS.BATTLE);

  // ── rival HUMAN archetypes (Phase 4 / R12) — the server-side spectator
  //    projection (archetype is PUBLIC_AGENT_CONTEXT). Polled ~60s ONLY while
  //    the fuse gate is on, the round is live, and a human rival exists — so
  //    with the flag dark this adds ZERO network traffic (acceptance 14 read
  //    with Amendment C: the spectator read is Phase 4's specified source and
  //    rides the same gate as the hero itself). CPU rivals never need it
  //    (deterministic recovery); a CPU-only pod never polls. ──
  const hasHumanRival = React.useMemo(
    () => (group?.players || []).some((p) => p?.odUserId && p.odUserId !== uid && !isCpuUserId(p.odUserId)),
    [group, uid],
  );
  const { battles: spectatedBattles } = useSpectatedTournamentBattles(
    group?.id,
    FUSE_HERO_ON && group?.status === GROUP_STATUS.BATTLE && hasHumanRival,
  );

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
      priceCtx: { ...priceCtx, now: Date.now(), atrPercentiles }, // now captured at memo eval (relTime/wire); atrPercentiles = user-layer basis (R1)
      claims,
      displayNames: names,
      uid,
      mode,
      prevStarStates: prevRef.current,
      compositeContext,
      liveComposites, // Option X: rivals' endpoint composites (null off-gate → banked)
      spectatedBattles, // Phase 4: rival-human archetypes ({} until the gated poll lands)
    }) : null),
    [group, battle, priceCtx, atrPercentiles, claims, names, uid, mode, compositeContext, liveComposites, spectatedBattles],
  );

  // adopt the just-built star-states as the next tick's "prev" (after render)
  React.useEffect(() => { if (model?.starStates) prevRef.current = model.starStates; }, [model]);

  // ── the session composite trail (Phase 2, R3 / A3) — the fuse board's TODAY
  //    spine, accumulated in memory from the model's OWN altitudes so it samples
  //    the same ruler the crown and cut read. Gated on the fuse flag: while dark
  //    NO timer runs and nothing accumulates, so production is untouched until
  //    the flip. Nothing consumes `trail` yet — FuseHero draws it in Phase 3. ──
  const seatIds = React.useMemo(() => (model?.seats || []).map((s) => s.id), [model]);
  const trail = useSessionCompositeTrail({
    ids: seatIds,
    scoresAtLast: model?.scoresAtLast,
    seatLive: model?.seatLive,
    seatBanked: model?.seatBanked,
    enabled: FUSE_HERO_ON && group?.status === GROUP_STATUS.BATTLE,
  });
  const modelWithTrail = React.useMemo(
    () => (model ? { ...model, trail } : null),
    [model, trail],
  );

  // ── write handlers (server-authoritative; flipPick toggles by symbol). Errors
  //    are mapped HERE (the connected layer already loads tournamentActions/
  //    Firebase) and re-thrown as a friendly Error, so the presentational dock /
  //    claim sheet just show err.message and never import the service graph. ──
  const onFlip = React.useCallback(async (tk) => {
    try { return await flipPick({ groupId: group?.id, symbol: tk }); }
    catch (err) { throw new Error(mapTournamentActionError(err)); }
  }, [group?.id]);
  const onClaim = React.useCallback(async ({ dropSymbol, addSymbol }) => {
    try { return await placeClaim({ groupId: group?.id, dropSymbol, addSymbol }); }
    catch (err) { throw new Error(mapTournamentActionError(err)); }
  }, [group?.id]);
  const onAsk = React.useCallback(() => Promise.resolve(), []); // read-only this phase

  const ready = !!group && (battle ? priceCtx.pricesLoaded : true);

  return { model: modelWithTrail, handlers: { onFlip, onClaim, onAsk }, ready };
}
