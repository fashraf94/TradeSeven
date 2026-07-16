// src/components/Tournament/ClaimFlipWindow.jsx
//
// P7 (B) — the nightly claim/flip window: the first surface where a player's
// button writes to the engine. One surface, two tabs (Spec §3).
//
// Client-honest / server-authoritative (binding): mutations go through
// tournamentActions (POST, Bearer); the UI mirrors caps/counters for UX but
// NEVER gates a submit on the WINDOW mirror (display-only — the server's 403
// window_closed is the sole authority); it never claims success before the
// server's 200 (the action machine reaches `confirmed` only via `confirm`);
// every server error is surfaced via mapTournamentActionError (mapped copy,
// server message fallback — never swallowed). Reads are the authoritative
// truth: subscribeClaims (won/lost) + the live `group` (legs, flipCountToday,
// droppedPicks). Tokens-native, reduced-motion-aware.

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Gavel, Repeat, Clock, Flame, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeClaims } from '../../services/tournamentGroupService';
import { placeClaim, flipPick, mapTournamentActionError } from '../../services/tournamentActions';
import { getClaimWindowDisplay } from '../../utils/tournamentSurfaces';
import { actionReducer, initialActionState, isActionPending, ACTION_STATUS } from '../../utils/tournamentActionMachine';
import { TOURNAMENT_TUNING, LEG_DIRECTION } from '../../constants/leagueTournament';

const FLIP_CAP = TOURNAMENT_TUNING.FLIP_CAP_PER_DAY;     // 5 per pick per ET-day
const CLAIM_CAP = TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE; // 3 pending

// Display-only ET date (mirrors the server's per-pick flip-counter reset; the
// server re-checks on every flip).
function etTodayStr() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => p.find(x => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function liveDirection(pick) {
  const legs = pick?.legs || [];
  return legs[legs.length - 1]?.direction || LEG_DIRECTION.LONG;
}

function countdownLabel(win) {
  if (win.reason === 'weekend') return 'Closed for the weekend — opens Monday at 4:00 PM ET.';
  if (win.reason === 'friday_evening') return 'Closed — the wire reopens Monday at 4:00 PM ET.';
  const m = win.countdownMinutes ?? 0;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const dur = h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  return win.isOpen ? `Open — claims lock in ${dur} (9:24 AM ET).` : `Closed — the wire opens in ${dur} (4:00 PM ET).`;
}

export default function ClaimFlipWindow({ group, uid, claimsOnly = false, prefillRequest = null, claims: claimsProp = null }) {
  const { tokens } = useTheme();
  const [tab, setTab] = useState('claims');
  const [subClaims, setSubClaims] = useState([]);
  const groupId = group?.id;

  // When the parent supplies `claims` (the awaiting-open pod reads the claims
  // collection once and passes it down), use it and skip our own subscription;
  // otherwise subscribe as before — byte-identical for every other caller.
  const usingExternal = claimsProp != null;
  useEffect(() => {
    if (usingExternal || !groupId) return undefined;
    return subscribeClaims(groupId, setSubClaims);
  }, [groupId, usingExternal]);
  const claims = usingExternal ? claimsProp : subClaims;

  const player = useMemo(
    () => (group?.players || []).find(p => p.odUserId === uid) || null,
    [group, uid],
  );
  const picks = useMemo(() => player?.picks || [], [player]);
  const heldSymbols = useMemo(() => new Set(picks.map(p => p.symbol)), [picks]);
  const poolNames = useMemo(
    () => (group?.userPool || []).filter(s => !heldSymbols.has(s)),
    [group, heldSymbols],
  );
  const myClaims = useMemo(() => claims.filter(c => c.odUserId === uid), [claims, uid]);
  const pendingCount = myClaims.filter(c => c.status === 'pending').length;
  const win = getClaimWindowDisplay();
  const today = etTodayStr();

  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 };
  const tabBtn = (active) => ({
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px',
    borderRadius: 9, border: `1px solid ${active ? tokens.teal : tokens.borderInput}`, cursor: 'pointer',
    background: active ? tokens.bgApp : 'transparent', color: active ? tokens.textPrimary : tokens.textMuted, fontWeight: 700, fontSize: 13,
  });

  if (!player) return null;

  return (
    <div style={card}>
      {claimsOnly ? (
        // L8: pre-open renders Claims ONLY — Flips are a live-battle long↔short
        // mechanic, inert pre-open, so the tab is held until the battle opens.
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: tokens.textPrimary }}>
          <Gavel size={14} /> Claims
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color: tokens.textFaint }}>Flips open when the battle starts</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={tabBtn(tab === 'claims')} onClick={() => setTab('claims')}><Gavel size={14} /> Claims</button>
          <button style={tabBtn(tab === 'flips')} onClick={() => setTab('flips')}><Repeat size={14} /> Flips</button>
        </div>
      )}
      {(claimsOnly || tab === 'claims')
        ? <ClaimsTab tokens={tokens} groupId={groupId} picks={picks} poolNames={poolNames} myClaims={myClaims} pendingCount={pendingCount} win={win} prefillRequest={prefillRequest} />
        : <FlipsTab tokens={tokens} groupId={groupId} picks={picks} today={today} />}
    </div>
  );
}

// ── Claims tab ────────────────────────────────────────────────────────────────
function ClaimsTab({ tokens, groupId, picks, poolNames, myClaims, pendingCount, win, prefillRequest = null }) {
  const [dropSymbol, setDropSymbol] = useState('');
  const [addSymbol, setAddSymbol] = useState('');
  // L7: pre-fill the "claim a name" field when the free-agents list requests it.
  // Nonce-gated so tapping the same symbol twice re-selects it (the effect reruns
  // only on a new request, never clobbering the user's manual edits between taps).
  useEffect(() => {
    if (prefillRequest?.symbol) setAddSymbol(prefillRequest.symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillRequest?.nonce]);
  const [state, dispatch] = useReducer(actionReducer, undefined, initialActionState);
  // Synchronous in-flight guard — a `disabled` prop can't stop a same-tick
  // double-click (React state hasn't committed yet), which would fire two POSTs.
  const inFlight = useRef(false);
  const capReached = pendingCount >= CLAIM_CAP;
  const canSubmit = dropSymbol && addSymbol && !capReached && !isActionPending(state);

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'submit' }); // claims aren't optimistically applied — they land as 'pending'
    try {
      await placeClaim({ groupId, dropSymbol, addSymbol });
      dispatch({ type: 'confirm' });
      setDropSymbol(''); setAddSymbol('');
    } catch (err) {
      dispatch({ type: 'reject', error: mapTournamentActionError(err) });
    } finally {
      inFlight.current = false;
    }
  };

  const sel = { background: tokens.bgApp, border: `1px solid ${tokens.borderInput}`, borderRadius: 8, color: tokens.textPrimary, padding: '8px 10px', fontSize: 13, flex: 1 };
  const STATUS_COLOR = { pending: tokens.amber, approved: tokens.emerald, denied: tokens.red };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* honest window countdown — DISPLAY ONLY (server's 403 is authority) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: win.isOpen ? tokens.emerald : tokens.textMuted }}>
        <Clock size={12} /> {countdownLabel(win)}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <select style={sel} value={dropSymbol} onChange={(e) => setDropSymbol(e.target.value)}>
          <option value="">Drop a pick…</option>
          {picks.map(p => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
        </select>
        <select style={sel} value={addSymbol} onChange={(e) => setAddSymbol(e.target.value)}>
          <option value="">Claim a name…</option>
          {poolNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          padding: '10px 12px', borderRadius: 9, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: canSubmit ? tokens.teal : tokens.bgElevated, color: canSubmit ? '#06201c' : tokens.textFaint, fontWeight: 800, fontSize: 13,
        }}
      >
        {isActionPending(state) ? 'Placing…' : `Place claim · ${pendingCount}/${CLAIM_CAP} pending`}
      </button>

      {capReached && (
        <div style={{ fontSize: 11, color: tokens.amber }}>You have {CLAIM_CAP} pending claims — wait for tonight’s processing.</div>
      )}
      {state.status === ACTION_STATUS.ERROR && state.error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: tokens.red }}><AlertCircle size={12} /> {state.error}</div>
      )}
      {state.status === ACTION_STATUS.CONFIRMED && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: tokens.emerald }}><CheckCircle2 size={12} /> Claim placed — it resolves at the 9:24 AM ET processing pass.</div>
      )}

      {/* the never-regress / banked-points honesty */}
      <div style={{ fontSize: 10.5, color: tokens.textFaint, lineHeight: 1.5, borderTop: `1px solid ${tokens.borderDivider}`, paddingTop: 8 }}>
        Dropping a pick does NOT erase its points — the dropped name keeps scoring its banked legs for the rest of the week. A won name starts fresh, long, at the next open.
      </div>

      {myClaims.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {myClaims.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11 }}>
              <span style={{ flex: 1, color: tokens.textSecondary }}>{c.dropSymbol} → {c.addSymbol}</span>
              <span style={{ fontWeight: 700, color: STATUS_COLOR[c.status] || tokens.textMuted, textTransform: 'uppercase', fontSize: 10 }}>
                {c.status}{c.status === 'denied' && c.denialReason ? ` · ${c.denialReason}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Flips tab ─────────────────────────────────────────────────────────────────
function FlipsTab({ tokens, groupId, picks, today }) {
  // One flip in flight at a time; the optimistic target direction shows on that
  // pick's row until the server confirms (kept) or rejects (rolled back).
  const [state, dispatch] = useReducer(actionReducer, undefined, initialActionState);
  const [outcome, setOutcome] = useState(null); // { symbol, text, doubledDown }
  // Synchronous in-flight guard (same-tick double-click → two real flips).
  const inFlight = useRef(false);

  const flip = async (pick) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const from = liveDirection(pick);
    const to = from === LEG_DIRECTION.LONG ? LEG_DIRECTION.SHORT : LEG_DIRECTION.LONG;
    setOutcome(null);
    dispatch({ type: 'submit', optimistic: { symbol: pick.symbol, to } });
    try {
      const res = await flipPick({ groupId, symbol: pick.symbol });
      dispatch({ type: 'confirm', result: res });
      const exec = res.marketState === 'open'
        ? `Flipped ${res.from}→${res.to} now at $${Number(res.flipPrice).toFixed(2)}${Number.isFinite(res.bankedLegScore) ? ` · banked ${res.bankedLegScore >= 0 ? '+' : ''}${Math.round(res.bankedLegScore)}` : ''}.`
        : `Flip ${res.from}→${res.to} queued — it executes at the next open.`;
      setOutcome({ symbol: pick.symbol, text: exec, doubledDown: res.doubledDown === true });
    } catch (err) {
      dispatch({ type: 'reject', error: mapTournamentActionError(err) });
    } finally {
      inFlight.current = false;
    }
  };

  const pendingSym = isActionPending(state) ? state.optimistic?.symbol : null;
  // Hold the confirmed direction until the authoritative group subscription
  // reconciles the leg — otherwise the success banner ("Flipped long→short")
  // would briefly disagree with the row, which still reads the stale leg.
  const confirmedFlip = state.status === ACTION_STATUS.CONFIRMED ? state.result : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: tokens.textMuted }}>Flips execute anytime — at the live price while the market’s open, at the next open otherwise. {FLIP_CAP} per pick per day.</div>
      {picks.length === 0 && <div style={{ fontSize: 12, color: tokens.textFaint }}>No picks yet.</div>}
      {picks.map(pick => {
        const flipsUsed = pick.flipCountDate === today ? (pick.flipCountToday || 0) : 0;
        const capReached = flipsUsed >= FLIP_CAP;
        const realDir = liveDirection(pick);
        const showDir = pendingSym === pick.symbol
          ? state.optimistic.to
          : (confirmedFlip && confirmedFlip.symbol === pick.symbol ? confirmedFlip.to : realDir);
        const isShort = showDir === LEG_DIRECTION.SHORT;
        const busy = pendingSym === pick.symbol;
        const disabled = capReached || isActionPending(state);
        return (
          <div key={pick.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: tokens.bgElevated, border: `1px solid ${tokens.borderDivider}` }}>
            <span style={{ fontWeight: 800, fontSize: 13, width: 64 }}>{pick.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isShort ? tokens.red : tokens.emerald }}>
              {isShort ? 'SHORT ↓' : 'LONG ↑'}{busy && ' …'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: tokens.textFaint }}>{flipsUsed}/{FLIP_CAP}</span>
            <button
              onClick={() => flip(pick)}
              disabled={disabled}
              style={{
                padding: '6px 10px', borderRadius: 8, border: `1px solid ${tokens.borderInput}`, cursor: disabled ? 'not-allowed' : 'pointer',
                background: 'transparent', color: disabled ? tokens.textFaint : tokens.purpleText, fontWeight: 700, fontSize: 11,
              }}
            >
              Flip to {realDir === LEG_DIRECTION.LONG ? 'short' : 'long'}
            </button>
          </div>
        );
      })}
      {state.status === ACTION_STATUS.ERROR && state.error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: tokens.red }}><AlertCircle size={12} /> {state.error}</div>
      )}
      {outcome && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: tokens.textSecondary }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={12} color={tokens.emerald} /> {outcome.symbol}: {outcome.text}</div>
          {outcome.doubledDown && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tokens.purpleText }}><Flame size={12} color="#a855f7" /> Double-down with your agent on {outcome.symbol} — surfaced to the group feed.</div>
          )}
        </div>
      )}
    </div>
  );
}
