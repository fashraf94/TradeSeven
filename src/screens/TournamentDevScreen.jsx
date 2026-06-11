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

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import BoardEditor from '../components/Tournament/BoardEditor';
import { subscribeGroup, subscribeClaims } from '../services/tournamentGroupService';
import { GROUP_STATUS, TOURNAMENT_TUNING, getLatestDayEntry } from '../constants/leagueTournament';
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

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeGroup(attachedGroupId, setGroup);
  }, [attachedGroupId]);

  useEffect(() => {
    if (!attachedGroupId) return undefined;
    return subscribeClaims(attachedGroupId, setClaims);
  }, [attachedGroupId]);

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
    const data = await adminPost(
      '/api/tournament/bank-daily-scores',
      { groupId: attachedGroupId, bypassTradingDay: true },
      'bank'
    );
    if (data?.skipped) appendLog(`bank: skipped (${data.reason})`);
    else if (data?.dayKey) appendLog(`bank OK · ${data.dayKey}${data.warnings?.length ? ` · ${data.warnings.length} warning(s)` : ''}`);
  }

  async function processClaims() {
    const data = await adminPost(
      '/api/tournament/process-claims',
      { groupId: attachedGroupId },
      'claims'
    );
    if (data?.status) appendLog(`claims OK · ${data.status}${data.status === 'processed' ? ` (${data.approved} approved, ${data.denied} denied)` : ''}`);
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
          <div style={{ fontWeight: 800, fontSize: 18 }}>League Tournament — P1 dev surface</div>
          <div style={{ fontSize: 12, color: tokens.textMuted }}>
            Smoke-test only. Seed → board → resolve (P1a); bank scores, place/process claims, flip picks (P1b).
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
          {log.length > 0 && (
            <pre style={{ margin: 0, fontSize: 11, color: tokens.textMuted, whiteSpace: 'pre-wrap' }}>
              {log.join('\n')}
            </pre>
          )}
        </div>

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
                      const flipsUsed = pick.flipCountDate === etToday() ? (pick.flipCountToday || 0) : 0;
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
                    {(score.picks || []).map(p => (
                      <span key={p.symbol}>
                        {p.symbol} {p.totalPoints} <span style={{ color: tokens.textFaint }}>(banked {p.bankedPoints} · live {p.livePoints})</span>
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
