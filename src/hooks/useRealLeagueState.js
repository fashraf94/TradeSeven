// src/hooks/useRealLeagueState.js
//
// League Next-Arc Phase 1 — the real-data orchestration behind the useLeagueState
// seam. Subscribes to the System-1 read-model and feeds the raw docs to the pure
// leagueAdapter, which maps them onto the Pod/Seat/BookItem shapes. Follows the
// useMyTournamentBattle convention (uid from auth.currentUser, onSnapshot via the
// tournamentGroupService readers, no throws).
//
// Reads wired (Phase-1 prompt): your group (subscribeMyGroup), the bracket funnel
// (subscribeBracket, id parsed from your group's bracketGameId), the base-layer
// field (subscribeBaseLayerGroups, capped), the composite standings (dailyScores,
// read inside the adapter via getWeeklyComposite), and the WHY projection
// (useSpectatedTournamentBattles — the ONLY reasoning source; never a direct
// agentBattles read). Human names come from a one-shot users/{uid} read; CPU names
// are synthesized in the adapter.
//
// Disabled (the sub-flag is off and no dev param) → every subscription no-ops and
// state is null, so the seam returns byte-identical fixtures. The fixture
// `fallback` (passed in) is reused as the cold-start fill (no bespoke empty UI).

import { useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase/config';
import { isoWeekString, parseBracketGameId } from '../constants/leagueTournament';
import {
  subscribeMyGroup,
  subscribeBracket,
  subscribeBaseLayerGroups,
  fetchDisplayNames,
} from '../services/tournamentGroupService';
import { getMarketState } from '../utils/marketSchedule';
import useSpectatedTournamentBattles from './useSpectatedTournamentBattles';
import { buildLeagueState } from '../components/League/leagueAdapter';

// Every odUserId across the reads — the set the human-name read resolves.
function collectUserIds(myGroup, bracket, fieldGroups) {
  const ids = new Set();
  (myGroup?.players || []).forEach((p) => p?.odUserId && ids.add(p.odUserId));
  (fieldGroups || []).forEach((g) => (g.players || []).forEach((p) => p?.odUserId && ids.add(p.odUserId)));
  if (bracket?.rounds) {
    Object.values(bracket.rounds).forEach((round) => {
      Object.values(round?.games || {}).forEach((game) => {
        (game?.seats || []).forEach((s) => s?.odUserId && ids.add(s.odUserId));
      });
    });
  }
  return [...ids];
}

export default function useRealLeagueState(enabled, fallback) {
  const uid = auth.currentUser?.uid || null;
  const currentWeek = useMemo(() => {
    try { return isoWeekString(new Date()); } catch { return null; }
  }, []);

  const [myGroup, setMyGroup] = useState(null);
  const [bracket, setBracket] = useState(null);
  const [fieldGroups, setFieldGroups] = useState([]);
  const [names, setNames] = useState({});
  const [groupReady, setGroupReady] = useState(!enabled);
  const [fieldReady, setFieldReady] = useState(!enabled);

  // your active group (membership) — the live participant group
  useEffect(() => {
    if (!enabled || !uid) { setMyGroup(null); setGroupReady(true); return undefined; }
    const unsub = subscribeMyGroup(uid, (g) => { setMyGroup(g); setGroupReady(true); });
    return () => unsub();
  }, [enabled, uid]);

  // the bracket — id parsed from your group's bracketGameId; null when you're
  // base-layer-only (the funnel then falls back to the fixture fill).
  const bracketId = useMemo(
    () => parseBracketGameId(myGroup?.bracketGameId)?.bracketId || null,
    [myGroup],
  );
  useEffect(() => {
    if (!enabled || !bracketId) { setBracket(null); return undefined; }
    const unsub = subscribeBracket(bracketId, setBracket);
    return () => unsub();
  }, [enabled, bracketId]);

  // the base-layer "field" for this ISO week (capped, recency-ordered)
  useEffect(() => {
    if (!enabled || !currentWeek) { setFieldGroups([]); setFieldReady(true); return undefined; }
    const unsub = subscribeBaseLayerGroups(currentWeek, (g) => { setFieldGroups(g); setFieldReady(true); });
    return () => unsub();
  }, [enabled, currentWeek]);

  // the WHY-projected battles for the subscribed group (owner/completed → full
  // WHY; non-owner active → WHAT-only + _whyConcealed). The ONLY reasoning source.
  const { battles } = useSpectatedTournamentBattles(myGroup?.id || null, enabled);

  // human display names (CPUs are synthesized in the adapter). Keyed on the
  // STABLE sorted id-set string, not the doc objects — the subscriptions hand
  // back fresh object identities on every snapshot tick (banking/flip bumps
  // updatedAt), but the membership rarely changes, so this re-reads users/{uid}
  // only when the set of ids actually changes (not every tick).
  const idsKey = useMemo(
    () => collectUserIds(myGroup, bracket, fieldGroups).sort().join(','),
    [myGroup, bracket, fieldGroups],
  );
  useEffect(() => {
    if (!enabled || !idsKey) return undefined;
    let active = true;
    fetchDisplayNames(idsKey.split(','))
      .then((n) => { if (active) setNames((prev) => ({ ...prev, ...n })); })
      .catch(() => {});
    return () => { active = false; };
  }, [enabled, idsKey]);

  // seconds to the ET close for live-pod countdowns — computed ONCE here (not
  // per-pod) via the centralized, holiday/early-close-aware marketSchedule, and
  // refreshed with the 60s battle poll. null → StatusBadge shows a bare "LIVE".
  const liveClock = useMemo(() => {
    try {
      const s = Math.round((getMarketState().nextCloseTime.getTime() - Date.now()) / 1000);
      return s > 0 ? s : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, battles]);

  const { state, hasRealData } = useMemo(() => {
    if (!enabled) return { state: null, hasRealData: false };
    return buildLeagueState({
      myGroup, bracket, fieldGroups, battlesByOwner: battles, names, uid, liveClock, fallback,
    });
  }, [enabled, myGroup, bracket, fieldGroups, battles, names, uid, liveClock, fallback]);

  const loading = enabled && !(groupReady && fieldReady);
  return { state, loading, hasRealData };
}
