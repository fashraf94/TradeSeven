// src/screens/TournamentDevScreen.jsx
//
// P1a+P1b — founder smoke-test surface for the tournament user layer,
// reachable ONLY via ?tournamentDev=1 (founder-ratified June 11, 2026).
// This is dev tooling, not the product surface: battle-view composition is
// P7 and TOURNAMENT_TAB_ENABLED stays false until P9. The picks row doubles
// as the Spec §1.5 user-strip skeleton (direction badges, flip affordance +
// cap indicator).
//
// Admin actions take the admin secret from a field held in component state
// only — never persisted — and send it as X-Admin-Secret. The P1b preview
// time-controls ride the same secret on the USER-authed calls (place-claim's
// devBypassWindow, flip's forceMarketState): the server honors each flag
// only when the secret validates, and silently ignores it otherwise.
//
// FOUNDER SMOKE SCRIPT (P1b — preview; group already in battle from the P1a
// seed/resolve flow; secret pasted; market state irrelevant — that's what
// the force selector is for):
//  1. Click "Bank scores". Expect: log `bank OK · day1`; the Standings card
//     appears — every player at their cumulative total, your picks showing
//     banked/live chips; group card pool count unchanged.
//  2. Click "Bank scores" AGAIN. Expect: log `bank: skipped
//     (already_recorded)` — the per-ET-day idempotency, visibly.
//  3. In the Claims card: pick a drop (one of your three picks), an add
//     (any pool name), rank 1 → "Place claim". Expect: the claim appears in
//     the list as PENDING within a second (live subscription).
//  4. Click "Process claims". Expect: log `claims OK · processed`; the
//     claim flips to APPROVED; your picks row swaps the symbol in with a
//     LONG badge; pool count changes by ±1 (drop in, add out).
//  5. Set force to "open", click ⇄ on any of your picks. Expect: log
//     `flip OK NVDA long→short @ {price} · banked {n}`; the badge flips to
//     SHORT; the cap reads 1/5.
//  6. Set force to "closed", flip the same pick. Expect: log `flip OK …
//     @ null · banked null` (bank-pending — settles at the next banking
//     pass); badge back to LONG; cap 2/5.
//  7. Tomorrow (or any later ET day): "Bank scores" again. Expect: day2
//     appears; standings move cumulatively; the bank-pending leg from step
//     6 settles. Day-5 rule note: once 4+ days are banked, place-claim
//     rejects with battle_last_day — by design, not a bug.
//
//  Two operational notes for real (non-dev) groups: banking on a weekend
//  (the Bank button always sends bypassTradingDay) writes a real day{N} and
//  advances the derived day clock — fine on a dev group, deliberate-only on
//  a production one. And "Process claims" is a pre-open action: running it
//  mid-session backdates the won picks' baselines to that morning's open.
//
// P3a SMOKE EXTENSION (Monday pipeline; group in battle after the P1a
// resolve; deploys stay P4-gated and are NOT exercised here):
//  8. Click "Produce boards". Expect: log `boards OK · 4 produced (3
//     fallback)`; the Agent boards card fills — your real agent's board
//     carries Sonnet rationale + USER PICKS stance lines, the placeholder
//     members show FALLBACK/SYNTHETIC badges (deterministic archetype
//     ranking — no agent doc exists for dev users; loud server log).
//     Click again: `4 skipped` — per-member idempotency.
//  9. Click "Resolve agent draft". Expect: log `agent draft OK · resolved ·
//     24 held`; the Agent draft card lists 24 picks (snake, passedOver on
//     snipes); the Agent ledger card jumps to 24 held, all source 'draft'
//     (the reserveBulk acquisition; reconcile-ledger reports them as
//     unverifiable_holder until P4 stamps battles — by design). Click
//     again: `already_resolved` — the stream is never rewritten.
//
// P3b FOUNDER SMOKE — THE FULL BRACKET ARC (orchestrator). Written P4-era;
// the gate has since FLIPPED: the Monday duty now sends REAL deploys on dev
// groups (preview needs CRON_SECRET + TOURNAMENT_DEPLOY_BASE_URL → the
// preview URL — the P4 smoke preconditions):
// 10. Click "Seed bracket" (2 games: you + 3 CPUs in game 1, 4 CPUs in
//     game 2 — all REAL system agents with boards already committed). The
//     Bracket card appears (round 1, both games, CPU chips); your group is
//     auto-attached. Commit YOUR board in the Board editor below.
// 11. Set the duty clock to a MONDAY morning (e.g. next Mon 8:00) and click
//     "Monday duty". Expect (Duty result card + logs): both groups → user
//     draft resolved → battle; 8 boards (CPU fallbacks, 0 synthetic); both
//     agent drafts 24 held; deploy step logs "DEPLOY GATED — P4 pending"
//     per agent. Re-click: `already_complete` — the per-duty/per-ET-date
//     marker, visibly. (If your board isn't committed, the P5 deadline
//     auto-commit defaults it and the pipeline proceeds — step 17 below
//     exercises this deliberately.)
// 12. Bank five days per group: attach each groupId in turn, step the duty
//     clock Mon→Fri, and click "Bank scores" once per simulated day (the
//     clock rides the banking call as simulatedNow). Re-click same day:
//     `skipped (already_recorded)`.
// 13. Set the clock to that FRIDAY evening (after 17:15) and click "Friday
//     duty". Expect: top-two locked per game (final-snapshot scores), both
//     groups COMPLETE, a fresh round-2 group (forming, advancers + any CPU
//     identities they carried), bracket card flips to round 2. Re-click:
//     idempotent no-op. Clicking BEFORE banking day 5 shows the loud
//     "banking pending" no-op instead — also by design.
// 14. Round 2 is terminal (one game — the final four). Repeat 11–13 on the
//     new group (commit your board first if you advanced). The Friday duty
//     ends with CHAMPION + the one-screen recap on the Bracket card
//     (bracket path, best week, signature double-down; composite lands P6).
//
// P5 FOUNDER SMOKE — PLAYBACK · BOARD SURFACE · DEADLINE AUTO-COMMIT:
// 15. PLAYBACK THEATER: attach the P4-smoke group (or any group whose
//     Monday ran — both streams in Firestore). The "Playback theater" card
//     opens on the poster frame; press play and watch both acts at the
//     5s/pick tuning clock: Act 1 the user draft (snipes struck through
//     with who took the name and when), Act 2 the agent draft (board
//     rationale lines; the purple DOUBLE-DOWN chip when an agent takes its
//     own player's pick; muted "ranking auto-pick" fallbacks). Pause, drag
//     the scrubber, skip to the final rosters. Your seats carry the teal
//     you-highlight throughout.
// 16. BOARD SURFACE: on a forming group, the Board editor now confirms the
//     lock semantics before the commit ("binding at Monday's draft");
//     confirm → the rider-#1 doc lands exactly as before; re-commit stays
//     available while forming. (The committed-state card with the
//     auto-commit badge is the League tab's, behind TOURNAMENT_TAB_ENABLED
//     — its on-flag smoke rides P9.)
// 17. DEADLINE AUTO-COMMIT (closes the docketed pre-launch requirement):
//     "Seed bracket" (step 10) and DO NOT commit your board. Set the duty
//     clock to a Monday morning, click "Monday duty". Expect: your seat
//     auto-commits (duty summary autoCommitted: 1; server log
//     "[TournamentAutoCommit] … AUTO-COMMITTED"), the board doc carries
//     autoCommitted: true (+ floored when you have no equipped watchlist),
//     a board_auto_commit feed entry lands on the group doc, and the
//     pipeline proceeds to the FULL Monday in the same tick (both drafts,
//     24 held, live deploys). Re-click: `already_complete`, no duplicate
//     feed entry. USE THE BRACKET SEEDER for this arc — the group seeder's
//     placeholder seats have no agent docs and refuse at the synthetic-
//     board step (by design), so they never reach a full Monday.
//
// ── P6a — COMPOSITE · LEADERBOARD · RANK (data layer; surfaces ride P6b) ──
// 18. COMPOSITE WEEK + LEADERBOARD: run the full bracket arc (steps 10–13).
//     Each "Bank scores" click now also writes agentPoints/compositePoints
//     into the day snapshot (the agent layer summed from the group's live
//     battles) and upserts the DEV month leaderboard doc — the Leaderboard
//     card fills after the first bank: composite rows, CPU chips, your teal
//     row. NEGATIVE CASE: flip a winning pick to short (step 5) before
//     banking a day — the row goes red and stays ranked where it falls,
//     never hidden (the cautionary-learning ruling). Re-bank the same day:
//     idempotency skip, leaderboard totals unchanged.
// 19. RANK RATCHET + CPU-FARM GUARD: the Friday duty (step 13) now applies
//     career rank at each game lock. The Career rank card shows tier/RP/
//     floor and per-week audit lines — on the dev bracket your three
//     opponents are CPUs, so expect raw > 0, guard ×0, Δ +0 (the signed
//     B-2 ruling: fully-padded weeks earn zero positive RP — the guard
//     working is the demo; tier crossings are locked by the unit battery
//     and observable live in the first real-population weeks). Re-run the
//     Friday duty: rankApplied 0, rankSkipped > 0 — no double application.
//     The bracket card's champion recap now ends with "final composite N"
//     (the P3b contract closed). All P6a docs are dev-namespaced
//     (dev-{month} / dev-{uid}) — production leaderboard and rank docs
//     never see smoke data (ruling A-4).

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import BoardEditor from '../components/Tournament/BoardEditor';
import DraftPlaybackTheater from '../components/Tournament/DraftPlaybackTheater';
import LeaderboardCard from '../components/Tournament/LeaderboardCard';
import RankCard from '../components/Tournament/RankCard';
import GroupFeed from '../components/Tournament/GroupFeed';
import SpectatorView from '../components/Tournament/SpectatorView';
import Flat6BattleView from '../components/Tournament/Flat6BattleView';
import ClaimFlipWindow from '../components/Tournament/ClaimFlipWindow';
import RoundBoundaryView from '../components/Tournament/RoundBoundaryView';
import useMyTournamentBattle from '../hooks/useMyTournamentBattle';
import { resolveRoundBoundary } from '../utils/roundBoundary';
import {
  subscribeGroup,
  subscribeClaims,
  subscribeAgentBoards,
  subscribeAgentDraftStream,
  subscribeAgentLedger,
  subscribeBracket,
  subscribeRank,
} from '../services/tournamentGroupService';
import {
  GROUP_STATUS,
  TOURNAMENT_TUNING,
  getLatestDayEntry,
  parseBracketGameId,
  monthKeyFromEtDate,
  rankDocId,
  getWeeklyComposite,
  getWeeklyScore,
  round2,
} from '../constants/leagueTournament';
import { fetchWithAuth } from '../utils/fetchWithAuth';

/** Today's ET calendar date — mirrors the server's flip-cap reset clock. */
function etToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const CLAIM_STATUS_COLORS = { pending: '#f59e0b', approved: '#10b981', denied: '#ef4444' };

const STATUS_COLORS = {
  [GROUP_STATUS.FORMING]: '#f59e0b',
  [GROUP_STATUS.DRAFTING]: '#38bdf8',
  [GROUP_STATUS.BATTLE]: '#10b981',
  [GROUP_STATUS.COMPLETE]: '#a78bfa',
};

function DirectionBadge({ direction }) {
  const short = direction === 'short';
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 6,
        background: short ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
        color: short ? '#ef4444' : '#10b981',
      }}
    >
      {short ? 'SHORT ↓' : 'LONG ↑'}
    </span>
  );
}

export default function TournamentDevScreen() {
  const { tokens } = useTheme();
  const { user } = useUser();
  const uid = user?.uid;

  const [secret, setSecret] = useState('');
  const [groupId, setGroupId] = useState('');
  const [attachedGroupId, setAttachedGroupId] = useState(null);
  const [group, setGroup] = useState(null);
  const [busy, setBusy] = useState(null); // 'seed' | 'resolve' | 'bank' | 'claims' | 'claim' | 'flip:SYM' | null
  const [log, setLog] = useState([]);
  // P1b state: live claims list, place-claim form, flip force selector.
  const [claims, setClaims] = useState([]);
  const [dropSymbol, setDropSymbol] = useState('');
  const [addSymbol, setAddSymbol] = useState('');
  const [claimRank, setClaimRank] = useState(1);
  const [forceState, setForceState] = useState('auto'); // 'auto' | 'open' | 'closed'
  // P3a state: agent boards, draft stream, held-set ledger (live).
  const [agentBoards, setAgentBoards] = useState([]);
  const [agentDraft, setAgentDraft] = useState(null);
  const [agentLedger, setAgentLedger] = useState(null);
  // P3b state: duty clock (simulated — the P1b time-control idiom), live
  // bracket doc (derived from the attached group's bracketGameId), last
  // duty result for the results card.
  const [simNow, setSimNow] = useState(''); // datetime-local value; '' = real clock
  const [bracket, setBracket] = useState(null);
  const [lastDuty, setLastDuty] = useState(null);
  // P9 — the five-days-clean reconciliation verdict (the launch criterion of
  // record), the reconcile-ledger response rendered green/red.
  const [lastReconcile, setLastReconcile] = useState(null);

  // P6b — the spectator-hierarchy drill-down opened from a leaderboard row.
  const [spectating, setSpectating] = useState(false);

  // P7 — participant battle view: the dev user's OWN flat6 battle, live.
  const { battle: devBattle } = useMyTournamentBattle(attachedGroupId);

  // P7 (C) — the dev rank doc, so the round-boundary eliminated branch's
  // rank/RP line is exercised on the dev verification surface.
  const [devRank, setDevRank] = useState(null);
  useEffect(() => {
    if (!uid) { setDevRank(null); return undefined; }
    return subscribeRank(rankDocId(uid, { dev: true }), setDevRank);
  }, [uid]);

  const derivedBracketId = parseBracketGameId(group?.bracketGameId)?.bracketId ?? null;

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeGroup(attachedGroupId, setGroup);
  }, [attachedGroupId]);

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeClaims(attachedGroupId, setClaims);
  }, [attachedGroupId]);

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeAgentBoards(attachedGroupId, setAgentBoards);
  }, [attachedGroupId]);

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeAgentDraftStream(attachedGroupId, setAgentDraft);
  }, [attachedGroupId]);

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeAgentLedger(attachedGroupId, setAgentLedger);
  }, [attachedGroupId]);

  useEffect(() => {
    if (!derivedBracketId) {
      setBracket(null);
      return undefined;
    }
    return subscribeBracket(derivedBracketId, setBracket);
  }, [derivedBracketId]);

  // P6b — the dev leaderboard month (ruling A-4: smoke rows land on dev-
  // docs; the month is the attached group's day-1 banking month per ruling
  // A-3, falling back to the current ET month pre-banking — the ET clock,
  // never UTC, per BUILD_RULES §6). LeaderboardCard/RankCard self-subscribe.
  const devMonthKey = monthKeyFromEtDate(group?.dailyScores?.day1?.recordedDate ?? etToday());
  const cpuSeat = (group?.players || []).find(p => p.isCpu === true) || null;

  /** The duty clock as an ISO instant, or null for the real clock. */
  function simulatedNowIso() {
    if (!simNow) return null;
    const date = new Date(simNow);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function appendLog(line) {
    setLog(prev => [...prev.slice(-19), `${new Date().toISOString().slice(11, 19)}  ${line}`]);
  }

  async function adminPost(path, body, label) {
    setBusy(label);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      appendLog(`${label} OK`);
      return data;
    } catch (err) {
      appendLog(`${label} FAILED: ${err.message}`);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function seed() {
    const data = await adminPost(
      '/api/admin/seed-tournament-group',
      { founderUserId: uid, autoCommitBoards: true },
      'seed'
    );
    if (data?.groupId) {
      setGroupId(data.groupId);
      setAttachedGroupId(data.groupId);
      appendLog(`group ${data.groupId} · pool ${data.poolSize} · ${data.seededBoards.length} placeholder boards`);
    }
  }

  async function resolve() {
    const data = await adminPost(
      '/api/tournament/resolve-user-draft',
      { groupId: attachedGroupId },
      'resolve'
    );
    if (data?.status) appendLog(`status -> ${data.status} (${data.events?.length ?? 0} picks)`);
  }

  // User-authed calls (Firebase ID token via fetchWithAuth). When the admin
  // secret is present it rides along as X-Admin-Secret so the server-side
  // preview time-controls can validate it; without it the flags are inert.
  async function authedPost(path, body, label) {
    setBusy(label);
    try {
      const res = await fetchWithAuth(path, {
        method: 'POST',
        headers: secret ? { 'X-Admin-Secret': secret } : {},
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      appendLog(`${label} FAILED: ${err.message}`);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function bankScores() {
    // P3b: the duty clock rides the banking call (simulatedNow) so the
    // smoke arc banks day1..day5 in one session — see steps 12–13 above.
    const simulated = simulatedNowIso();
    const data = await adminPost(
      '/api/tournament/bank-daily-scores',
      { groupId: attachedGroupId, bypassTradingDay: true, ...(simulated ? { simulatedNow: simulated } : {}) },
      'bank'
    );
    if (data?.skipped) appendLog(`bank: skipped (${data.reason})`);
    else if (data?.dayKey) appendLog(`bank OK · ${data.dayKey}${data.warnings?.length ? ` · ${data.warnings.length} warning(s)` : ''}`);
  }

  // P3b — bracket seeding + orchestrator duty buttons (run-duty endpoint;
  // the cron path is production-only). Deploys are P4-gated server-side.
  async function seedBracket() {
    const data = await adminPost(
      '/api/admin/seed-tournament-bracket',
      { founderUserId: uid, games: 2 },
      'seed bracket'
    );
    if (data?.bracketId) {
      setGroupId(data.founderGroupId);
      setAttachedGroupId(data.founderGroupId);
      appendLog(`bracket ${data.bracketId} · groups ${data.groupIds.join(', ')} · CPUs ${data.cpuSeats.join(', ')}`);
    }
  }

  async function runDuty(duty) {
    const simulated = simulatedNowIso();
    const data = await adminPost(
      '/api/tournament/run-duty',
      { duty, ...(simulated ? { simulatedNow: simulated } : {}) },
      duty
    );
    if (data) {
      setLastDuty(data);
      appendLog(
        data.status === 'already_complete'
          ? `${duty} @ ${data.etDate} ${data.etTime}: already complete (idempotent no-op)`
          : `${duty} @ ${data.etDate} ${data.etTime}: ${data.groups ?? 0} group(s) · ${data.complete ? 'COMPLETE' : 'incomplete (resumes next tick)'}`
      );
    }
  }

  async function processClaims() {
    const data = await adminPost(
      '/api/tournament/process-claims',
      { groupId: attachedGroupId },
      'claims'
    );
    if (data?.status) appendLog(`claims OK · ${data.status}${data.status === 'processed' ? ` (${data.approved} approved, ${data.denied} denied)` : ''}`);
  }

  // Slice 4 — drive CPU user-layer claim placement on a TRAINING pod (the
  // production path rides the nightly banking cron, which doesn't run on
  // preview). simulatedNow lets the dev exercise advance days. Idempotent per
  // cycle: a re-click returns already_placed.
  async function placeCpuClaims() {
    const simulated = simulatedNowIso();
    const data = await adminPost(
      '/api/tournament/place-cpu-claims',
      { groupId: attachedGroupId, ...(simulated ? { simulatedNow: simulated } : {}) },
      'cpu-claims'
    );
    if (data?.status) appendLog(`cpu-claims OK · ${data.status}${typeof data.placed === 'number' ? ` (${data.placed} placed)` : ''}`);
  }

  // P9 — the five-days-clean reconciliation check, surfaced as a button so the
  // launch criterion of record ("ledger reconciliation clean for five days")
  // is a green/red verdict the founder reads, not a manual curl. Rebuilds the
  // agent held set from the battles' portfolios (derived truth) and reports
  // every divergence; GREEN = zero divergences (every held symbol resolves to a
  // verified holder). Same pass the nightly settlement rides — read-only-safe.
  async function reconcile() {
    const data = await adminPost(
      '/api/tournament/reconcile-ledger',
      { groupId: attachedGroupId },
      'reconcile'
    );
    if (data) {
      setLastReconcile(data);
      const divergences = data.divergences?.length ?? 0;
      appendLog(
        `reconcile ${divergences === 0 ? 'GREEN' : 'RED'} · ${data.heldCount} held · ${divergences} divergence(s)${data.staleCleared ? ` · ${data.staleCleared} stale cleared` : ''}`
      );
    }
  }

  // P3a — Monday pipeline steps (boards → agent draft → acquisition). The
  // deploy step is P4-gated and has no button here by design.
  async function produceBoards() {
    const data = await adminPost(
      '/api/tournament/produce-agent-boards',
      { groupId: attachedGroupId },
      'boards'
    );
    if (data) appendLog(`boards OK · ${data.produced} produced (${data.fallbacks} fallback, ${data.cpu ?? 0} cpu) · ${data.skipped} skipped · ${data.synthetic ?? 0} synthetic · ${data.errors} error(s)`);
  }

  async function resolveAgentDraft() {
    const data = await adminPost(
      '/api/tournament/resolve-agent-draft',
      { groupId: attachedGroupId },
      'agent draft'
    );
    if (data?.status) appendLog(`agent draft OK · ${data.status}${data.heldCount != null ? ` · ${data.heldCount} held` : ''}`);
  }

  async function placeClaim() {
    const data = await authedPost(
      '/api/tournament/place-claim',
      {
        groupId: attachedGroupId,
        dropSymbol,
        addSymbol,
        rank: Number(claimRank) || 1,
        ...(secret ? { devBypassWindow: true } : {}),
      },
      'claim'
    );
    if (data?.claimId) {
      appendLog(`claim placed: drop ${data.dropSymbol} add ${data.addSymbol} rank ${data.rank}`);
      setAddSymbol('');
    }
  }

  async function flipPick(symbol) {
    const data = await authedPost(
      '/api/tournament/flip',
      {
        groupId: attachedGroupId,
        symbol,
        ...(secret && forceState !== 'auto' ? { forceMarketState: forceState } : {}),
      },
      `flip:${symbol}`
    );
    if (data?.to) {
      appendLog(`flip OK ${symbol} ${data.from}→${data.to} @ ${data.flipPrice ?? 'null'} · banked ${data.bankedLegScore ?? 'null'} · ${data.flipCountToday}/${TOURNAMENT_TUNING.FLIP_CAP_PER_DAY}`);
    }
  }

  const card = {
    background: tokens.bgCard,
    border: `1px solid ${tokens.borderDivider}`,
    borderRadius: 10,
    padding: 14,
  };
  const input = {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${tokens.borderInput}`,
    background: tokens.bgApp,
    color: tokens.textPrimary,
    fontSize: 13,
  };
  const btn = (active) => ({
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 700,
    fontSize: 13,
    cursor: active ? 'pointer' : 'not-allowed',
    background: active ? '#38bdf8' : tokens.borderInput,
    color: active ? '#082f49' : tokens.textMuted,
  });

  const todayEt = etToday();

  // P9 — derived verdict for the reconciliation card (null-safe before a run).
  const reconcileDivergences = lastReconcile?.divergences || [];
  const reconcileClean = !!lastReconcile && reconcileDivergences.length === 0;

  if (!uid) {
    return (
      <div style={{ minHeight: '100vh', background: tokens.bgApp, color: tokens.textPrimary, padding: 24 }}>
        Sign in first — the board commit runs under your account.
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.bgApp, color: tokens.textPrimary, padding: 16 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>League Tournament — dev surface</div>
          <div style={{ fontSize: 12, color: tokens.textMuted }}>
            Smoke-test only. Seed → board → resolve (P1a); bank, claims, flips (P1b); Monday pipeline (P3a);
            bracket seed, duty dispatch, advancement, champion (P3b — deploys P4-gated).
          </div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Admin actions</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              type="password"
              placeholder="Admin secret (held in memory only)"
              value={secret}
              onChange={e => setSecret(e.target.value)}
            />
            <button style={btn(!!secret && !busy)} disabled={!secret || !!busy} onClick={seed}>
              {busy === 'seed' ? 'Seeding…' : 'Seed dev group'}
            </button>
            <button style={btn(!!secret && !busy)} disabled={!secret || !!busy} onClick={seedBracket}>
              {busy === 'seed bracket' ? 'Seeding…' : 'Seed bracket'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              placeholder="…or attach an existing groupId"
              value={groupId}
              onChange={e => setGroupId(e.target.value.trim())}
            />
            <button
              style={btn(!!groupId)}
              disabled={!groupId}
              onClick={() => setAttachedGroupId(groupId)}
            >
              Attach
            </button>
            <button
              style={btn(!!secret && !!attachedGroupId && group?.status === GROUP_STATUS.FORMING && !busy)}
              disabled={!secret || !attachedGroupId || group?.status !== GROUP_STATUS.FORMING || !!busy}
              onClick={resolve}
            >
              {busy === 'resolve' ? 'Resolving…' : 'Resolve draft'}
            </button>
          </div>
          {/* P1b battle-phase actions: manual banking (idempotent — run it
              twice to watch the skip) + manual claim processing (the
              processing-window bypass, admin-gated by construction). */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              style={btn(!!secret && group?.status === GROUP_STATUS.BATTLE && !busy)}
              disabled={!secret || group?.status !== GROUP_STATUS.BATTLE || !!busy}
              onClick={bankScores}
            >
              {busy === 'bank' ? 'Banking…' : 'Bank scores'}
            </button>
            <button
              style={btn(!!secret && group?.status === GROUP_STATUS.BATTLE && !busy)}
              disabled={!secret || group?.status !== GROUP_STATUS.BATTLE || !!busy}
              onClick={processClaims}
            >
              {busy === 'claims' ? 'Processing…' : 'Process claims'}
            </button>
            {/* Slice 4 — CPU claim placement (training pods only). */}
            <button
              style={btn(!!secret && group?.isTraining === true && group?.status === GROUP_STATUS.BATTLE && !busy)}
              disabled={!secret || group?.isTraining !== true || group?.status !== GROUP_STATUS.BATTLE || !!busy}
              onClick={placeCpuClaims}
            >
              {busy === 'cpu-claims' ? 'Placing…' : 'CPU claims'}
            </button>
            {/* P9 — the five-days-clean reconciliation verdict (launch criterion). */}
            <button
              style={btn(!!secret && group?.status === GROUP_STATUS.BATTLE && !busy)}
              disabled={!secret || group?.status !== GROUP_STATUS.BATTLE || !!busy}
              onClick={reconcile}
            >
              {busy === 'reconcile' ? 'Reconciling…' : 'Reconcile ledger'}
            </button>
            {/* P3a Monday-pipeline steps. Agent draft needs all four boards;
                the server's boards_missing guard is authoritative — the
                button gate is UX only. */}
            <button
              style={btn(!!secret && group?.status === GROUP_STATUS.BATTLE && !busy)}
              disabled={!secret || group?.status !== GROUP_STATUS.BATTLE || !!busy}
              onClick={produceBoards}
            >
              {busy === 'boards' ? 'Producing…' : 'Produce boards'}
            </button>
            <button
              style={btn(!!secret && group?.status === GROUP_STATUS.BATTLE && agentBoards.length > 0 && !busy)}
              disabled={!secret || group?.status !== GROUP_STATUS.BATTLE || agentBoards.length === 0 || !!busy}
              onClick={resolveAgentDraft}
            >
              {busy === 'agent draft' ? 'Resolving…' : 'Resolve agent draft'}
            </button>
            <label style={{ fontSize: 11, color: tokens.textMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              flip market
              <select
                value={forceState}
                onChange={e => setForceState(e.target.value)}
                style={{ ...input, flex: 'none', width: 92, padding: '6px 8px' }}
                title="Forces the flip branch — honored only with the admin secret"
              >
                <option value="auto">auto</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
              </select>
            </label>
          </div>
          {/* P3b — orchestrator dispatch: duty buttons + the simulated duty
              clock (run "Monday morning" on a Thursday). Empty clock = the
              real clock; the server's ET dispatcher does the routing either
              way. Duty markers key off the (simulated) ET date, so re-clicks
              show the idempotent no-op. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11, color: tokens.textMuted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              duty clock
              <input
                type="datetime-local"
                style={{ ...input, flex: 'none', width: 200, padding: '6px 8px' }}
                value={simNow}
                onChange={e => setSimNow(e.target.value)}
                title="Simulated instant for duties + banking (your local time). Empty = real clock."
              />
            </label>
            <button style={btn(!!secret && !busy)} disabled={!secret || !!busy} onClick={() => runDuty('monday_pipeline')}>
              {busy === 'monday_pipeline' ? 'Running…' : 'Monday duty'}
            </button>
            <button style={btn(!!secret && !busy)} disabled={!secret || !!busy} onClick={() => runDuty('weekday_fanout')}>
              {busy === 'weekday_fanout' ? 'Running…' : 'Incumbent fan-out'}
            </button>
            <button style={btn(!!secret && !busy)} disabled={!secret || !!busy} onClick={() => runDuty('friday_advancement')}>
              {busy === 'friday_advancement' ? 'Running…' : 'Friday duty'}
            </button>
          </div>
          {log.length > 0 && (
            <pre style={{ margin: 0, fontSize: 11, color: tokens.textMuted, whiteSpace: 'pre-wrap' }}>
              {log.join('\n')}
            </pre>
          )}
        </div>

        {/* P3b — last duty result (the advancement-results / pipeline card):
            the run-duty response rendered as-is, founder-readable. */}
        {lastDuty && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Duty result — {lastDuty.duty}</div>
              <span style={{ fontSize: 11, color: tokens.textMuted }}>
                {lastDuty.etDate} {lastDuty.etTime} ET · {lastDuty.status === 'already_complete' ? 'already complete' : lastDuty.complete ? 'COMPLETE' : 'incomplete'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: tokens.textMuted }}>
              {/* Every numeric counter the duty reports, no curated list —
                  a new server-side counter renders here without a client
                  change (the hand-kept list was already missing fields). */}
              {Object.entries(lastDuty)
                .filter(([, value]) => typeof value === 'number')
                .map(([key, value]) => (
                  <span key={key}><span style={{ fontWeight: 700 }}>{key}</span> {value}</span>
                ))}
              {lastDuty.deploys && (
                <span>
                  <span style={{ fontWeight: 700 }}>deploys</span>{' '}
                  {Object.entries(lastDuty.deploys).map(([k, v]) => `${v} ${k}`).join(' · ')}
                  {lastDuty.deploys.gated > 0 ? ' (P4 pending)' : ''}
                </span>
              )}
              {lastDuty.roundsLocked?.length > 0 && (
                <span><span style={{ fontWeight: 700 }}>roundsLocked</span> {lastDuty.roundsLocked.join(', ')}</span>
              )}
              {lastDuty.composedGroups?.length > 0 && (
                <span><span style={{ fontWeight: 700 }}>composed</span> {lastDuty.composedGroups.join(', ')}</span>
              )}
              {lastDuty.champion && (
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>CHAMPION {lastDuty.champion.odUserId} ({lastDuty.champion.weeklyScore} pts)</span>
              )}
            </div>
          </div>
        )}

        {/* P9 — the five-days-clean reconciliation verdict card. GREEN when the
            rebuilt held set matches the battle-portfolio derived truth with zero
            divergence (every held symbol has a verified holder; no orphaned
            brackets, no silent loss); RED lists each divergence {type, symbol,
            details}. Run it after each banked simulated day to read the criterion
            of record straight off the screen. */}
        {lastReconcile && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${reconcileClean ? '#10b981' : '#ef4444'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Reconciliation — {lastReconcile.groupId}</div>
              <span style={{ fontSize: 12, fontWeight: 800, color: reconcileClean ? '#10b981' : '#ef4444' }}>
                {reconcileClean ? 'GREEN — clean' : `RED — ${reconcileDivergences.length} divergence(s)`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: tokens.textMuted }}>
              {/* Every numeric counter the reconcile reports, no curated list —
                  a new server-side counter renders here without a client change
                  (mirrors the duty-result card's loop above). */}
              {Object.entries(lastReconcile)
                .filter(([, value]) => typeof value === 'number')
                .map(([key, value]) => (
                  <span key={key}><span style={{ fontWeight: 700 }}>{key}</span> {value}</span>
                ))}
            </div>
            {reconcileClean ? (
              <div style={{ fontSize: 12, color: '#10b981' }}>
                Every held symbol resolves to a verified holder — no orphaned brackets, no silent loss.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {reconcileDivergences.map((d, i) => (
                  <div key={i} style={{ fontSize: 11, color: tokens.textMuted, padding: '4px 8px', borderRadius: 6, background: tokens.bgApp, border: `1px solid ${tokens.borderInput}` }}>
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>{d.type}</span>
                    {d.symbol ? ` · ${d.symbol}` : ''} — {d.details}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* P3b — live bracket card (one-doc bracket state; the P6/P7
            spectator read surface, dev-rendered). */}
        {bracket && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Bracket {bracket.bracketId}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: bracket.status === 'complete' ? '#a78bfa' : '#10b981' }}>
                {String(bracket.status).toUpperCase()} · round {bracket.currentRound}/{bracket.totalRounds}
              </span>
            </div>
            {Object.values(bracket.rounds || {})
              .sort((a, b) => a.roundNumber - b.roundNumber)
              .map(round => (
                <div key={round.roundNumber} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted }}>
                    Round {round.roundNumber}{round.lockedAt ? ' · locked' : ''}
                  </div>
                  {Object.values(round.games || {})
                    .sort((a, b) => a.gameIndex - b.gameIndex)
                    .map(game => (
                      <div key={game.bracketGameId} style={{ padding: '8px 10px', borderRadius: 8, background: tokens.bgApp, border: `1px solid ${tokens.borderInput}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, color: tokens.textFaint }}>{game.bracketGameId}</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
                          {(game.seats || []).map(seat => {
                            const advanced = (game.advancers || []).includes(seat.odUserId);
                            return (
                              <span key={seat.odUserId} style={{ fontWeight: advanced ? 800 : 500, color: advanced ? '#10b981' : tokens.textPrimary }}>
                                {seat.odUserId === uid ? 'You' : seat.odUserId}
                                {seat.isCpu && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}> CPU</span>}
                                {game.finalScores && <span style={{ color: tokens.textMuted }}> {game.finalScores[seat.odUserId]}</span>}
                                {advanced && ' ↑'}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            {bracket.champion && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
                  🏆 Champion: {bracket.champion.odUserId === uid ? 'You' : bracket.champion.odUserId}
                  {bracket.champion.isCpu ? ' (CPU)' : ''} · {bracket.champion.weeklyScore} pts
                </div>
                {bracket.recap && (
                  <div style={{ fontSize: 11, color: tokens.textMuted }}>
                    Path: {(bracket.recap.bracketPath || []).map(p => `r${p.roundNumber} #${p.placement} (${p.weeklyScore})`).join(' → ')}
                    {bracket.recap.bestWeek && ` · best week r${bracket.recap.bestWeek.roundNumber} (${bracket.recap.bestWeek.weeklyScore})`}
                    {bracket.recap.signatureDoubleDown
                      ? ` · signature double-down ${bracket.recap.signatureDoubleDown.symbol} (r${bracket.recap.signatureDoubleDown.roundNumber}, ${bracket.recap.signatureDoubleDown.kind})`
                      : ' · no double-down this run'}
                    {bracket.recap.finalComposite != null
                      ? ` · final composite ${bracket.recap.finalComposite}`
                      : ' · composite: pre-P6 recap'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* P6b — the real leaderboard surface (dev-namespaced) with the C-1
            consensus/contrarian feed cards; a row opens the spectator drill. */}
        <LeaderboardCard uid={uid} dev initialMonthKey={devMonthKey} onOpenGroup={() => setSpectating(true)} />

        {/* P6b — the spectator hierarchy (tiers 2/3) the row opens: bracket +
            standings + the draft theater + the honest P7 battle degrade. */}
        {spectating && group && (
          <SpectatorView group={group} uid={uid} onBack={() => setSpectating(false)} />
        )}

        {/* P6b — the career-rank surface (dev-{uid}); plus a CPU rank row to
            confirm the §7.1 display-only / frozen treatment. */}
        <RankCard docId={rankDocId(uid, { dev: true })} dev />
        {cpuSeat && <RankCard docId={rankDocId(cpuSeat.odUserId, { dev: true })} dev label={`CPU rank — ${cpuSeat.odUserId}`} />}

        {/* P6b — the group feed (flips, auto-commits, user-side double-downs). */}
        {group && <GroupFeed feed={group.feed} uid={uid} />}

        {/* P7 — the participant battle view (Proposal A): the dev user's OWN
            flat6 battle, live, in the real component. Spectator mode (any
            agent, read-only) rides the SpectatorView card above. */}
        {devBattle && (
          <Flat6BattleView
            battle={devBattle}
            isOwner
            compositeContext={group ? {
              composite: round2(getWeeklyComposite(group, uid)),
              userPoints: round2(getWeeklyScore(group, uid)),
            } : null}
          />
        )}

        {/* P7 (B) — the nightly claim/flip window (battle week). */}
        {group && group.status === GROUP_STATUS.BATTLE && (
          <ClaimFlipWindow group={group} uid={uid} />
        )}

        {/* P7 (C) — the round-boundary interstitial. On the dev screen it
            renders whenever a completed bracket game resolves for this seat
            (the localStorage ack is bypassed here so the founder can re-walk
            advancer/eliminated/champion after each advancement). */}
        {(() => {
          const boundary = resolveRoundBoundary(bracket, uid);
          if (!boundary) return null;
          return (
            <RoundBoundaryView
              bracket={bracket}
              uid={uid}
              boundary={boundary}
              rankDoc={devRank}
              onContinue={() => appendLog(`round-boundary: ${boundary.kind} (round ${boundary.roundNumber}) acknowledged`)}
            />
          );
        })()}

        {group && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Group {group.id}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[group.status] || tokens.textMuted }}>
                {String(group.status).toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: tokens.textMuted }}>
              Round {group.roundNumber} · {group.baseLayerWeek || group.bracketGameId} · pool {group.userPool?.length ?? 0} names
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(group.players || []).map(player => (
                <div
                  key={player.odUserId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: tokens.bgApp,
                    border: `1px solid ${player.odUserId === uid ? '#38bdf8' : tokens.borderInput}`,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, width: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player.odUserId === uid ? 'You' : player.odUserId}
                  </span>
                  {/* User strip skeleton (Spec §1.5): 3 picks + direction badge
                      + flip affordance with cap indicator (P1b). */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(player.picks || []).length === 0 && (
                      <span style={{ fontSize: 12, color: tokens.textFaint }}>no picks yet</span>
                    )}
                    {(player.picks || []).map(pick => {
                      const flipsUsed = pick.flipCountDate === todayEt ? (pick.flipCountToday || 0) : 0;
                      const mine = player.odUserId === uid;
                      const canFlip = mine && group.status === GROUP_STATUS.BATTLE
                        && flipsUsed < TOURNAMENT_TUNING.FLIP_CAP_PER_DAY && !busy;
                      return (
                        <span
                          key={pick.symbol}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                        >
                          {pick.symbol}
                          <DirectionBadge direction={pick.legs?.[pick.legs.length - 1]?.direction} />
                          {mine && group.status === GROUP_STATUS.BATTLE && (
                            <>
                              <button
                                style={{ ...btn(canFlip), padding: '2px 8px', fontSize: 11 }}
                                disabled={!canFlip}
                                onClick={() => flipPick(pick.symbol)}
                                title="Flip direction (long ⇄ short)"
                              >
                                {busy === `flip:${pick.symbol}` ? '…' : '⇄'}
                              </button>
                              <span style={{ fontSize: 10, color: tokens.textMuted }}>
                                {flipsUsed}/{TOURNAMENT_TUNING.FLIP_CAP_PER_DAY}
                              </span>
                            </>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* P1b — Standings: the cumulative snapshot model rendered straight
            from dailyScores (banked/live per pick; weekly = the latest
            snapshot, never a sum). P6a (ruling A-1): sorted and led by the
            COMPOSITE of record — the order Friday's lock advances — with
            the agent/user split alongside; pre-P6a snapshots (no
            compositePoints) degrade to the user total. */}
        {group && (() => {
          const latest = getLatestDayEntry(group);
          if (!latest) return null;
          const rows = (group.players || [])
            .map(p => {
              const score = latest.entry.closeScores?.[p.odUserId] ?? { totalPoints: 0, picks: [] };
              return {
                odUserId: p.odUserId,
                score,
                composite: Number.isFinite(score.compositePoints) ? score.compositePoints : score.totalPoints,
              };
            })
            .sort((a, b) => b.composite - a.composite);
          return (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Standings — cumulative composite</div>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>
                  day{latest.dayN} · {latest.entry.recordedDate} · {latest.entry.recordedBy}
                  {latest.entry.agentScoresCarried ? ' · AGENT LAYER CARRIED' : ''}
                </span>
              </div>
              {rows.map(({ odUserId, score, composite }, i) => (
                <div key={odUserId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ width: 14, color: tokens.textMuted }}>{i + 1}.</span>
                  <span style={{ width: 160, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {odUserId === uid ? 'You' : odUserId}
                  </span>
                  <span style={{ fontWeight: 800, width: 64, color: composite < 0 ? '#ef4444' : tokens.textPrimary }}>{composite}</span>
                  <span style={{ width: 110, fontSize: 10, color: tokens.textFaint }}>
                    {Number.isFinite(score.agentPoints) ? `agent ${score.agentPoints} · user ${score.totalPoints}` : `user ${score.totalPoints}`}
                  </span>
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: tokens.textMuted, fontSize: 11 }}>
                    {(score.picks || []).map((p, pi) => (
                      <span key={`${p.symbol}-${pi}`}>
                        {p.symbol}{p.dropped ? ' (dropped)' : ''} {p.totalPoints}{' '}
                        <span style={{ color: tokens.textFaint }}>(banked {p.bankedPoints} · live {p.livePoints})</span>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: tokens.textFaint }}>
                Waiver order (lowest first): {(group.claimSystem?.currentWaiverPriority || []).join(' → ') || '—'}
              </div>
            </div>
          );
        })()}

        {/* P1b — Claims: place (rider #5 via the server endpoint) + live
            subcollection list. devBypassWindow rides the admin secret. */}
        {group && group.status === GROUP_STATUS.BATTLE && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Claims — overnight wire</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select style={{ ...input, flex: 'none', width: 140 }} value={dropSymbol} onChange={e => setDropSymbol(e.target.value)}>
                <option value="">drop…</option>
                {((group.players || []).find(p => p.odUserId === uid)?.picks || []).map(p => (
                  <option key={p.symbol} value={p.symbol}>{p.symbol}</option>
                ))}
              </select>
              <input
                style={{ ...input, flex: 'none', width: 140 }}
                placeholder="add (pool name)"
                list="dev-claim-pool"
                value={addSymbol}
                onChange={e => setAddSymbol(e.target.value.trim().toUpperCase())}
              />
              <datalist id="dev-claim-pool">
                {(group.userPool || []).slice(0, 60).map(s => <option key={s} value={s} />)}
              </datalist>
              <input
                style={{ ...input, flex: 'none', width: 64 }}
                type="number"
                min={1}
                title="rank (1 = most wanted)"
                value={claimRank}
                onChange={e => setClaimRank(e.target.value)}
              />
              <button
                style={btn(!!dropSymbol && !!addSymbol && !busy)}
                disabled={!dropSymbol || !addSymbol || !!busy}
                onClick={placeClaim}
              >
                {busy === 'claim' ? 'Placing…' : 'Place claim'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {claims.length === 0 && (
                <span style={{ fontSize: 12, color: tokens.textFaint }}>no claims yet</span>
              )}
              {claims.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: CLAIM_STATUS_COLORS[c.status] || tokens.textMuted, width: 70 }}>
                    {String(c.status).toUpperCase()}
                  </span>
                  <span style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.odUserId === uid ? 'You' : (c.username || c.odUserId)}
                  </span>
                  <span>drop {c.dropSymbol} → add {c.addSymbol} · rank {c.rank}</span>
                  {c.denialReason && <span style={{ color: '#ef4444', fontSize: 11 }}>{c.denialReason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* P3a — Agent boards (rider #2 read surface): full ranking head,
            rationale presence, USER PICKS stance lines, fallback/synthetic
            provenance badges. */}
        {group && agentBoards.length > 0 && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Agent boards — Monday pipeline</div>
            {agentBoards.map(b => (
              <div key={b.agentId} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', borderRadius: 8, background: tokens.bgApp, border: `1px solid ${b.odUserId === uid ? '#38bdf8' : tokens.borderInput}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>{b.odUserId === uid ? 'Your agent' : b.agentId}</span>
                  <span style={{ color: tokens.textMuted }}>{b.archetype}</span>
                  {b.fallback && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }} title={b.fallbackReason || ''}>
                      FALLBACK{b.synthetic ? ' · SYNTHETIC' : ''}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: tokens.textFaint }}>{b.board?.length ?? 0} names</span>
                </div>
                <div style={{ fontSize: 11, color: tokens.textMuted, wordBreak: 'break-word' }}>
                  {(b.board || []).slice(0, 10).join(' · ')}{(b.board?.length ?? 0) > 10 ? ' · …' : ''}
                </div>
                {(b.userPicksStance || []).map(s => (
                  <div key={s.symbol} style={{ fontSize: 11, color: tokens.textFaint }}>
                    <span style={{ fontWeight: 700, color: tokens.textMuted }}>{s.symbol}:</span> {s.stance}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* P3a — Agent draft stream (rider #3 playback record; P5 replays it
            on the ~5s/pick clock — here it renders instantly). */}
        {group && agentDraft && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Agent draft — pick stream</div>
              <span style={{ fontSize: 11, color: tokens.textMuted }}>
                round {agentDraft.roundNumber} · resolved {String(agentDraft.resolvedAt).slice(0, 16)}
              </span>
            </div>
            {(agentDraft.events || []).map(e => (
              <div key={e.pickNumber} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12 }}>
                <span style={{ width: 22, color: tokens.textMuted }}>{e.pickNumber}.</span>
                <span style={{ width: 170, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.odUserId === uid ? 'Your agent' : e.agentId}
                </span>
                <span style={{ fontWeight: 800 }}>{e.symbol}</span>
                {e.fallback && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>FALLBACK</span>}
                {e.passedOver?.length > 0 && (
                  <span style={{ fontSize: 10, color: tokens.textFaint }}>passed: {e.passedOver.join(', ')}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* P5 — the playback theater on the dev group's REAL streams (the
            smoke driver; the League tab is the flagged destination). Both
            acts at the tuning-ledger 5s/pick clock, play/pause/scrub. */}
        {group && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary }}>Playback theater (P5)</div>
            <DraftPlaybackTheater key={`theater-${group.id}`} groupId={group.id} group={group} uid={uid} />
          </div>
        )}

        {/* P3a — Agent held-set ledger: watch the reserveBulk acquisition
            land (24 held, source 'draft') and later swaps churn it. */}
        {group && agentLedger && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Agent ledger — held set</div>
              <span style={{ fontSize: 11, color: tokens.textMuted }}>
                {Object.keys(agentLedger.held || {}).length} held · {Object.keys(agentLedger.reservations || {}).length} reserved · {(agentLedger.doubleDowns || []).length} double-down event(s)
              </span>
            </div>
            {Object.entries(
              Object.entries(agentLedger.held || {}).reduce((acc, [symbol, entry]) => {
                const key = entry.heldBy;
                (acc[key] = acc[key] || []).push(`${symbol}${entry.source === 'draft' ? '' : '*'}`);
                return acc;
              }, {})
            ).map(([agentId, symbols]) => (
              <div key={agentId} style={{ fontSize: 11, color: tokens.textMuted, wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 700 }}>{agentId}:</span> {symbols.join(' · ')}
              </div>
            ))}
            <div style={{ fontSize: 10, color: tokens.textFaint }}>* = acquired by swap (not draft)</div>
          </div>
        )}

        {group && (
          <BoardEditor
            key={group.id}
            groupId={group.id}
            group={group}
            uid={uid}
            onCommitted={() => appendLog('board committed')}
          />
        )}
      </div>
    </div>
  );
}
