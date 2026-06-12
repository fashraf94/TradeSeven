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
// P3b FOUNDER SMOKE — THE FULL BRACKET ARC (orchestrator; deploys stay
// P4-gated throughout — watch for the loud "P4 pending" lines in logs):
// 10. Click "Seed bracket" (2 games: you + 3 CPUs in game 1, 4 CPUs in
//     game 2 — all REAL system agents with boards already committed). The
//     Bracket card appears (round 1, both games, CPU chips); your group is
//     auto-attached. Commit YOUR board in the Board editor below.
// 11. Set the duty clock to a MONDAY morning (e.g. next Mon 8:00) and click
//     "Monday duty". Expect (Duty result card + logs): both groups → user
//     draft resolved → battle; 8 boards (CPU fallbacks, 0 synthetic); both
//     agent drafts 24 held; deploy step logs "DEPLOY GATED — P4 pending"
//     per agent. Re-click: `already_complete` — the per-duty/per-ET-date
//     marker, visibly. (If your board isn't committed, YOUR group defers
//     loudly — finding #5 — and the all-CPU group proceeds; commit and
//     re-click.)
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

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import BoardEditor from '../components/Tournament/BoardEditor';
import DraftPlaybackTheater from '../components/Tournament/DraftPlaybackTheater';
import {
  subscribeGroup,
  subscribeClaims,
  subscribeAgentBoards,
  subscribeAgentDraftStream,
  subscribeAgentLedger,
  subscribeBracket,
} from '../services/tournamentGroupService';
import { GROUP_STATUS, TOURNAMENT_TUNING, getLatestDayEntry, parseBracketGameId } from '../constants/leagueTournament';
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
                    {' · composite: P6'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
            snapshot, never a sum). */}
        {group && (() => {
          const latest = getLatestDayEntry(group);
          if (!latest) return null;
          const rows = (group.players || [])
            .map(p => ({
              odUserId: p.odUserId,
              score: latest.entry.closeScores?.[p.odUserId] ?? { totalPoints: 0, picks: [] },
            }))
            .sort((a, b) => b.score.totalPoints - a.score.totalPoints);
          return (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Standings — cumulative</div>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>
                  day{latest.dayN} · {latest.entry.recordedDate} · {latest.entry.recordedBy}
                </span>
              </div>
              {rows.map(({ odUserId, score }, i) => (
                <div key={odUserId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ width: 14, color: tokens.textMuted }}>{i + 1}.</span>
                  <span style={{ width: 160, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {odUserId === uid ? 'You' : odUserId}
                  </span>
                  <span style={{ fontWeight: 800, width: 64 }}>{score.totalPoints}</span>
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
