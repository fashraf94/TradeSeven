// src/screens/MyTournamentScreen.jsx
//
// "My Tournament" — a compact ranked status/launchpad page a player lands on
// after claiming a seat. Net-new, gated behind MY_TOURNAMENT_ENABLED (default
// off) and reachable in preview via ?myTournament=1. It wires REAL base-layer
// data into the three sequential states (awaiting → drafting → bracket-live),
// derived from the ranked group lifecycle; it reads only (no scoring/banking/
// scorer contact) and opens into the EXISTING battle surface rather than
// rebuilding it.
//
// This is the data shell: subscriptions + derivations. The pure presentation is
// MyTournamentPage (smoke-tested per state).

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import {
  subscribeMyGroup,
  subscribeMyLobby,
  subscribeRank,
  subscribeLeaderboard,
  subscribeUserDraftStream,
  fetchDisplayNames,
} from '../services/tournamentGroupService';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import {
  getWeeklyComposite,
  getLatestDayEntry,
  round2,
  monthKeyFromEtDate,
  leaderboardDocId,
} from '../constants/leagueTournament';
import { getArchetypeDisplayName } from '../data/archetypeDisplay';
import { groupToPod } from '../components/League/leagueAdapter';
import { LTOKENS, alpha } from '../components/League/leagueTokens';
import { Mono, LIcon } from '../components/League/LeagueParts';
import { deriveMyTournamentState, rankInPod, seatPips } from '../components/Tournament/myTournament/myTournamentModel';
import { deriveSeed } from '../components/Tournament/myTournament/myTournamentSeed';
import { draftLockInstant, countdownSegments, mondayOfIsoWeek } from '../components/Tournament/myTournament/draftLockTime';
import { MyTournamentPage } from '../components/Tournament/myTournament/MyTournamentPage';
import LeagueParticipantView from './LeagueParticipantView';
import '../components/League/league.css';

const SP = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
// Dev/preview override — force a state to eyeball the design (distinct tokens
// from LeagueScreen's ?s=, and only one screen mounts at a time).
const DEV_STATE = ['awaiting', 'drafting', 'bracket'].includes(SP.get('s')) ? SP.get('s') : null;

// Honest header framing (founder decision): the real week + "Ranked · Weekly" —
// no fabricated "16 → 8 → 4 → champion" bracket topology.
const LOCK_LABEL = 'Draft runs Monday morning · ET';
const META = 'Ranked · Weekly';

// A tiny subscribe→state hook (the RankCard.jsx idiom). `arg` null → null value.
function useSub(subscribe, arg) {
  const [val, setVal] = React.useState(null);
  React.useEffect(() => {
    if (arg == null) { setVal(null); return undefined; }
    const unsub = subscribe(arg, setVal);
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [subscribe, arg]);
  return val;
}

function currentMonthKey() {
  try {
    const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    return monthKeyFromEtDate(etDate);
  } catch { return null; }
}

function weekTitle(baseLayerWeek) {
  const monday = baseLayerWeek ? mondayOfIsoWeek(baseLayerWeek) : null;
  if (!monday) return 'Ranked Tournament';
  try {
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(monday);
    return `Week of ${label}`;
  } catch { return 'Ranked Tournament'; }
}

export default function MyTournamentScreen({ onEditInForge, agentLoadout, isDesktop } = {}) {
  const { tokens } = useTheme();
  const uid = auth.currentUser?.uid;
  const compact = !isDesktop;
  const [view, setView] = React.useState('page');

  const group = useSub(subscribeMyGroup, uid);
  const lobby = useSub(subscribeMyLobby, uid);
  const rank = useSub(subscribeRank, uid);
  const { battle } = useMyTournamentBattle(group?.id);

  const monthKey = React.useMemo(() => currentMonthKey(), []);
  const leaderboard = useSub(subscribeLeaderboard, monthKey ? leaderboardDocId(monthKey) : null);
  const userDraft = useSub(subscribeUserDraftStream, group?.id || null);

  // Equipped-loadout tickers — a one-shot read of the equipped watchlist (the
  // assembleBoardPrefill read path, minus the pool intersection).
  const [tickers, setTickers] = React.useState([]);
  const wlId = agentLoadout?.equippedWatchlistId;
  React.useEffect(() => {
    if (!wlId) { setTickers([]); return undefined; }
    let alive = true;
    getDoc(doc(db, 'watchlists', wlId))
      .then((snap) => {
        if (!alive) return;
        const raw = snap.exists() ? (snap.data().tickers || []) : [];
        setTickers(raw.map((t) => (typeof t === 'string' ? t : t?.symbol)).filter(Boolean));
      })
      .catch(() => { if (alive) setTickers([]); });
    return () => { alive = false; };
  }, [wlId]);

  // Pod member display names (one-shot; humans → users/{uid}, CPUs synthesized).
  const [names, setNames] = React.useState({});
  const groupId = group?.id;
  React.useEffect(() => {
    const members = group?.groupMembers;
    if (!members || !members.length) { setNames({}); return undefined; }
    let alive = true;
    fetchDisplayNames(members).then((n) => { if (alive) setNames(n || {}); }).catch(() => {});
    return () => { alive = false; };
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live countdown clock (30s cadence — the hero shows D/H/M).
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // "Open my battle" → the existing, self-subscribing participant/battle surface.
  if (view === 'battle') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: tokens.bgApp }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center',
          padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px',
          background: tokens.bgApp, borderBottom: `1px solid ${tokens.borderDivider}`,
        }}>
          <button
            onClick={() => setView('page')}
            style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: tokens.textMuted, fontSize: 13 }}
          >
            <ArrowLeft size={16} /> My Tournament
          </button>
        </div>
        <LeagueParticipantView />
      </div>
    );
  }

  const state = DEV_STATE || deriveMyTournamentState({ group, battle });
  const hasSeat = !!(group || lobby);
  const baseLayerWeek = group?.baseLayerWeek || lobby?.baseLayerWeek || null;
  const title = weekTitle(baseLayerWeek);

  // Honest empty: signed out, or no seat and not a forced preview.
  if (!DEV_STATE && (!uid || (state === 'awaiting' && !hasSeat))) {
    return <Poster message={!uid ? 'Sign in to see your tournament.' : 'No active tournament yet — claim a seat in the League lobby.'} />;
  }

  // ── build the per-state view models ──────────────────────────────────────
  const lockMs = baseLayerWeek ? draftLockInstant(baseLayerWeek) : null;
  const segments = lockMs != null ? countdownSegments(lockMs - now) : { past: true, d: 0, h: 0, m: 0 };

  const awaiting = {
    segments,
    lockLabel: LOCK_LABEL,
    pips: seatPips({ group, lobby }),
    loadout: {
      archLabel: agentLoadout?.archetype ? getArchetypeDisplayName(agentLoadout.archetype) : null,
      watchlistName: agentLoadout?.equippedWatchlistName || null,
      tickers,
    },
    seatSub: group ? 'Your group is set — locks at the Monday draft' : undefined,
  };

  const yourPicks = (() => {
    const fromPlayers = group?.players?.find((p) => p.odUserId === uid)?.picks;
    if (Array.isArray(fromPlayers) && fromPlayers.length) return fromPlayers.map((pk) => pk?.symbol).filter(Boolean);
    return (userDraft?.events || []).filter((e) => e.odUserId === uid).map((e) => e.symbol).filter(Boolean);
  })();
  // Agent's six are keyed by agentId in the stream (not attributable to the
  // viewer without the agent id), so during this brief resolution beat they
  // degrade to pending rather than risk misattribution.
  const draft = { yourPicks, agentPicks: [] };

  const dayEntry = group ? getLatestDayEntry(group) : null;
  const bracket = {
    seed: deriveSeed(leaderboard?.entries, uid),
    rank,
    standing: {
      composite: group ? round2(getWeeklyComposite(group, uid)) : undefined,
      podRank: group ? rankInPod(group, uid) : null,
    },
    pod: group ? groupToPod(group, { names, uid, base: true }) : null,
    battleDayLabel: dayEntry ? `Day ${dayEntry.dayN} of 5` : null,
  };

  return (
    <MyTournamentPage
      state={state}
      title={title}
      meta={META}
      compact={compact}
      awaiting={awaiting}
      draft={draft}
      bracket={bracket}
      onEditInForge={onEditInForge}
      onOpenBattle={() => setView('battle')}
    />
  );
}

// Honest empty poster — matches the obsidian surface.
function Poster({ message }) {
  return (
    <div style={{
      minHeight: '100vh', background: LTOKENS.bg, color: LTOKENS.ink,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
    }}>
      <span style={{
        width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(LTOKENS.gold, 0.12), border: `1px solid ${alpha(LTOKENS.gold, 0.34)}`,
      }}>
        <LIcon name="ranked" size={22} color={LTOKENS.gold} stroke={2} />
      </span>
      <Mono style={{ fontSize: 13, color: LTOKENS.ink2, maxWidth: 320, lineHeight: 1.5 }}>{message}</Mono>
    </div>
  );
}
