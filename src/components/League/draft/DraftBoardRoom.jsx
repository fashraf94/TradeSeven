// src/components/League/draft/DraftBoardRoom.jsx
//
// The redesigned Training Draft Board (Phase 1) — the agent-fit spine. One
// fit-ranked, tiered "best available" board keyed to the practice agent's
// archetype (arch_scores[humanArchetype], a direct read), with plain-language
// reasons, a sector lens, search, and scale handling. Composed from the reusable
// League draft atoms; wired to the existing useTrainingDraft hook (live state +
// the two-step pick through applyTrainingPick). The visual source of truth is the
// Claude Design project; this mirrors its DeskRoom, responsive to a phone.
//
// Phase 1 scope: the board, real and interactive. Opponents' picks appear after
// each pick (the animated pick-by-pick reveal is Phase 2).

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTrainingDraft } from '../../../hooks/useTrainingDraft';
import usePreOpenPhase from '../../../hooks/usePreOpenPhase';
import { isTrainingPodDraftV2On } from '../../../config/featureFlags';
import { PICKS_PER_PLAYER, GROUP_STATUS, GROUP_SIZE } from '../../../constants/leagueTournament';
import { TOKENS, DX, alpha, injectDraftCSS, FONT_VARS } from './draftTokens';
import { Icon } from './draftIcons';
import { Mono, Eyebrow, ArchChip, ClockRing } from './draftPrimitives';
import { archMeta, buildFitBoard, tierGroupsOf } from './boardModel';
import { StockCard } from './StockCard';
import { TierHeader } from './TierHeader';
import { SnakeStrip } from './SnakeStrip';
import { SeatCard, LineupSlots } from './SeatCard';
import { PickPanel } from './PickPanel';
import { RevealRow, SnipeCallout } from './RevealRow';
import { useDraftReveal } from './useDraftReveal';
import { DraftForming } from './DraftForming';
import AssetResearchModal from '../../draft/AssetResearchModal';
import { makeLiveDraftPick } from '../../../services/tournamentActions';

// Every tier shows its top TIER_CAP by fit; the rest sits behind a per-tier
// expander. Distribution-robust — holds no matter how the bands fall.
const TIER_CAP = 10;

function useNarrow(bp = 1024) {
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < bp);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [bp]);
  return narrow;
}

function coachLineFor({ phase, archKey, selected, topPick, backToBack, pickNo, myPicks, lastReveal }) {
  const a = archMeta(archKey);
  if (phase === 'done') {
    const ids = (myPicks || []).join(' · ');
    return { title: 'Lineup locked', body: `${ids}. That's your three-stock book — ranked for a ${a.name}. The battle view takes it from here.` };
  }
  if (phase === 'revealing') {
    if (lastReveal && lastReveal.sniped) {
      return { title: 'Sniped from the top', body: `${lastReveal.seatLabel} just took ${lastReveal.symbol} — it was #${lastReveal.humanRank} on your board. Grab the safe name, or gamble it survives.` };
    }
    return { title: 'The table is drafting', body: 'Watch what gets taken — especially near the top of your board. Then I re-rank to your best available.' };
  }
  if (phase === 'waiting') {
    return { title: 'The table is drafting', body: 'Watch what gets taken — especially near the top of your board. Then I re-rank to your best available.' };
  }
  if (backToBack) {
    return { title: 'Back-to-back picks', body: 'You pick now and again immediately — two names before the table moves. Pair them, or double down on a tier.' };
  }
  if (selected) {
    return { title: `${selected.symbol} selected`, body: `${selected.reason}. Confirm to draft, or pick another — nothing's locked until you confirm.` };
  }
  return {
    title: `You're on the clock — pick #${pickNo}`,
    body: topPick ? `${topPick.symbol} tops your board: "${String(topPick.reason).toLowerCase()}". Or reach for a name you bet survives.` : 'Make your pick — every name is pickable; the order just advises.',
  };
}

export default function DraftBoardRoom({ user, groupId, mode = 'training', onComplete = null, onExit = null }) {
  // Competitive Live Draft (Phase 4): ONE room, both modes. `mode` selects the
  // pick endpoint (via the hook's submitAction), the room title, and opponent
  // naming (humans by name vs "CPU N"). Default 'training' → byte-identical to
  // before this genericization (the reuse-not-fork mandate).
  const competitive = mode === 'competitive';
  const roomTitle = competitive ? 'Live Draft' : 'Training Draft';
  // `entered` flips on "Enter the board". It's declared before the hook so the
  // pick clock can be held while the forming intro covers pick #1 (else the 20s
  // clock would autopick the first pick if the user lingers on the intro).
  const [entered, setEntered] = useState(false);
  const d = useTrainingDraft({ user, groupId, active: true, clockPaused: !entered, submitAction: competitive ? makeLiveDraftPick : null });
  const {
    group,
    poolRows, humanArchetype, events, snakeOrder, members, currentUserId, myPicks,
    seats, isDrafting, isMyTurn, isComplete, finalStatus, universe,
    currentPickIndex, totalPicks, round, pickClock, clockTotalSec, submitting, error, submitPick, draft,
    onClockSeatIdx,
  } = d;

  // Bound to the group the draft hook already returns, so the completion card and
  // the pod's real phase cannot disagree (BUILD_RULES §9).
  const preOpen = usePreOpenPhase(group);

  const narrow = useNarrow();
  const [selected, setSelected] = useState(null);
  const [researchSym, setResearchSym] = useState(null); // L2: the ticker-opened research symbol (V2)
  const [expandedId, setExpandedId] = useState(null);
  const [sectorFilter, setSectorFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [expandedTiers, setExpandedTiers] = useState(() => new Set());

  const loading = !draft || universe == null;
  // The V2 gate (flag OR ?trainingPodV2=1). Off → the board renders byte-identically.
  const v2On = isTrainingPodDraftV2On();

  // clear a stale selection when the turn moves on / the name gets sniped
  useEffect(() => { if (!isMyTurn) setSelected(null); }, [isMyTurn, currentPickIndex]);
  useEffect(() => { if (isComplete && onComplete) onComplete(finalStatus); }, [isComplete, finalStatus, onComplete]);
  // a resumed mid-draft pod skips the forming intro (it's not the first pick)
  useEffect(() => { if (!loading && isDrafting && currentPickIndex > 0) setEntered(true); }, [loading, isDrafting, currentPickIndex]);

  useEffect(() => { injectDraftCSS(); }, []);

  const archKey = humanArchetype;

  // owned sector counts → the Diversifier overlay
  const ownedSectorCounts = useMemo(() => {
    const sectorBySymbol = new Map(poolRows.map((r) => [r.symbol, r.sectorName]));
    const counts = {};
    (myPicks || []).forEach((sym) => {
      const sec = sectorBySymbol.get(String(sym).toUpperCase());
      if (sec) counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [poolRows, myPicks]);

  const board = useMemo(() => {
    const availableRows = poolRows.filter((r) => r.available);
    return buildFitBoard({ availableRows, archKey, ownedSectorCounts });
  }, [poolRows, archKey, ownedSectorCounts]);

  const SECTORS = useMemo(() => [...new Set(poolRows.map((r) => r.sectorName))].sort(), [poolRows]);

  // sector lens + search (in place — preserves fit-rank + tier)
  const q = query.trim().toUpperCase();
  const viewBoard = useMemo(() => {
    let rows = sectorFilter === 'All' ? board : board.filter((s) => s.sectorName === sectorFilter);
    if (q) rows = rows.filter((s) => s.symbol.includes(q));
    return rows;
  }, [board, sectorFilter, q]);
  const tierGroups = useMemo(() => tierGroupsOf(viewBoard), [viewBoard]);

  // snake: overall pick index → { symbol, human }
  const humanSeatIdx = members.indexOf(currentUserId);
  const picksByOverall = useMemo(() => {
    const arr = new Array(totalPicks).fill(null);
    (events || []).forEach((ev) => {
      const idx = (ev.pickNumber || 0) - 1;
      if (idx < 0 || idx >= arr.length) return;
      arr[idx] = { symbol: String(ev.symbol || '').toUpperCase(), human: ev.odUserId === currentUserId };
    });
    return arr;
  }, [events, totalPicks, currentUserId]);

  // Opponent naming: competitive shows a human rival by name (from the group's
  // seatNames) and a CPU pad seat as "CPU N"; training is always "CPU N".
  const seatNames = group?.seatNames || {};
  const seatLabel = (s) => (s.isYou ? 'You' : (competitive && s.isCpu !== true ? (seatNames[s.odUserId] || 'Rival') : `CPU ${s.seatIndex}`));
  const cpuLabel = (odUserId) => {
    if (competitive) {
      const p = (group?.players || []).find((pl) => pl.odUserId === odUserId);
      if (p && p.isCpu !== true) return seatNames[odUserId] || 'Rival';
    }
    return `CPU ${members.indexOf(odUserId)}`;
  };

  // pre-pick board ranks for snipe detection, captured synchronously at pick
  // time (doConfirm) and tagged with the pick index — the reveal only trusts it
  // for the run-up that this exact pick triggered (see useDraftReveal).
  const snipeRanksRef = useRef({ atIndex: -1, ranks: new Map() });

  const { revealing, feed, flash, skip, reduceMotion } = useDraftReveal({
    events, ready: !!draft, currentUserId, snipeRanksRef,
  });
  const revealRows = feed.map((p) => ({ seatLabel: cpuLabel(p.odUserId), isCpu: true, symbol: p.symbol, overall: p.pickNumber, sniped: p.sniped, humanRank: p.humanRank }));
  const lastReveal = revealRows[revealRows.length - 1] || null;

  const selectedRow = selected ? board.find((b) => b.symbol === selected) || null : null;
  const pickNo = Math.min(totalPicks, currentPickIndex + 1);
  const prevHuman = currentPickIndex - 1 >= 0 && snakeOrder[currentPickIndex - 1] === humanSeatIdx;
  const nextHuman = currentPickIndex + 1 < totalPicks && snakeOrder[currentPickIndex + 1] === humanSeatIdx;
  const backToBack = isMyTurn && humanSeatIdx >= 0 && (prevHuman || nextHuman);
  // the reveal wins over both done and your-turn so the run-up plays before the
  // board unlocks / the lineup locks.
  const phase = revealing ? 'revealing' : isComplete ? 'done' : isMyTurn ? 'your-turn' : 'waiting';
  const onClockSeat = seats.find((s) => s.seatIndex === onClockSeatIdx);
  const onClockLabel = onClockSeat ? seatLabel(onClockSeat) : null;
  const coach = coachLineFor({ phase, archKey, selected: selectedRow, topPick: board[0], backToBack, pickNo, myPicks, lastReveal });

  const doConfirm = async () => {
    // Gate on the live board row, not the raw string — a name that left the
    // board (taken / re-rank) can't be confirmed.
    if (!selectedRow) return;
    // Freeze the pre-pick board ranks for this pick → the run-up's snipe check.
    snipeRanksRef.current = { atIndex: currentPickIndex, ranks: new Map(board.map((b) => [b.symbol, b.boardRank])) };
    const ok = await submitPick(selectedRow.symbol, false);
    if (ok) setSelected(null);
  };
  const toggleTier = (id) => setExpandedTiers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // L2: research modal (V2). The row this symbol belongs to (for the sector
  // badge on the opened asset). The draft CTA uses the modal's NATIVE acquire
  // path, so it follows internal navigation and drafts the DISPLAYED stock; the
  // isAcquirable gate below shows it only for a name still on the live board (and
  // only on the human's turn) — research-only otherwise.
  const researchRow = researchSym
    ? (board.find((b) => b.symbol === researchSym) || poolRows.find((r) => r.symbol === researchSym) || null)
    : null;
  const openResearch = (sym) => setResearchSym(sym);
  const closeResearch = () => setResearchSym(null);
  const draftFromModal = async (sym) => {
    // Guard: never call submitPick with an empty symbol — that path autopicks
    // top-fit server-side, which would silently draft the wrong name.
    if (!sym) return;
    // Same snipe-rank freeze as doConfirm — drafting from the modal is a real pick.
    snipeRanksRef.current = { atIndex: currentPickIndex, ranks: new Map(board.map((b) => [b.symbol, b.boardRank])) };
    const ok = await submitPick(sym, false);
    if (ok) { setSelected(null); closeResearch(); }
  };
  const isBoardSymbol = (sym) => !!board.find((b) => b.symbol === String(sym || '').toUpperCase());

  // L3 + L2 overlays (V2 only), shared by both breakpoints so there is ONE
  // confirm affordance and ONE research modal. The sticky bar is viewport-pinned
  // and shows Confirm/Clear only when a pick is selected; the board scroll regions
  // carry matching bottom padding so the last rows clear it.
  const v2Overlays = () => {
    if (!v2On) return null;
    return (
      <>
        {phase === 'your-turn' && selectedRow && (
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, boxSizing: 'border-box',
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: TOKENS.bg, borderTop: `1px solid ${TOKENS.hair}`,
            display: 'flex', justifyContent: 'center', boxShadow: `0 -8px 24px ${alpha(TOKENS.bg, 0.6)}` }}>
            <div style={{ display: 'flex', gap: 9, width: '100%', maxWidth: 720 }}>
              <button className="ld-tap" onClick={() => setSelected(null)} disabled={submitting}
                style={{ all: 'unset', cursor: submitting ? 'default' : 'pointer', padding: '14px 18px', borderRadius: 13, background: TOKENS.surface, border: `1px solid ${TOKENS.hair2}`, color: TOKENS.ink2, fontWeight: 600, fontSize: 13.5 }}>Clear</button>
              <button className="ld-tap" onClick={submitting ? undefined : doConfirm} disabled={submitting}
                style={{ all: 'unset', cursor: submitting ? 'default' : 'pointer', flex: 1, textAlign: 'center', padding: '14px', borderRadius: 13, background: DX.you, color: TOKENS.bg, fontWeight: 700, fontSize: 15, boxShadow: `0 8px 24px ${alpha(DX.you, 0.3)}`, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Drafting…' : `Confirm — draft ${selectedRow.symbol}`}
              </button>
            </div>
          </div>
        )}
        {researchSym && (
          <AssetResearchModal
            asset={{ symbol: researchSym, name: researchSym, sector: researchRow?.sectorName }}
            sector={researchRow?.sectorName}
            isMyTurn={phase === 'your-turn'}
            timeRemaining={pickClock ?? 0}
            canPick={phase === 'your-turn'}
            onAcquire={(a) => draftFromModal(a?.symbol)}
            isAcquirable={isBoardSymbol}
            onClose={closeResearch}
          />
        )}
      </>
    );
  };

  const scopeStyle = {
    height: '100%', minHeight: '100vh', background: TOKENS.bg, color: TOKENS.ink,
    fontFamily: 'var(--ld-ui)', ...FONT_VARS, display: 'flex', flexDirection: 'column', position: 'relative',
    backgroundImage: `radial-gradient(circle at 50% -10%, ${alpha(DX.you, 0.05)}, transparent 55%)`,
  };

  // the forming intro plays on a fresh pod (pick #1) and covers the entry load;
  // a resumed mid-draft pod (cursor > 0) skips it. Wait for the universe before
  // the board renders — otherwise every name would briefly show fit 0 / "Reach".
  // forming plays while loading, or on a fresh pod where it's actually the
  // human's first turn (isMyTurn at pick #1 — the verified seat-0 / first-overall
  // case; if a CPU ever held #1, this stays honest and skips the intro).
  const showForming = !isComplete && !entered && (loading || (isMyTurn && currentPickIndex === 0));
  const formingSeats = seats.length
    ? seats.map((s) => ({ isCpu: s.isCpu, isYou: s.isYou, label: seatLabel(s) }))
    : Array.from({ length: GROUP_SIZE }).map((_, i) => (i === 0 ? { isYou: true, label: 'You' } : { isCpu: true, label: `CPU ${i}` }));

  // ── forming / loading / complete ────────────────────────────────────────
  if (isComplete && !revealing) {
    // PRE-OPEN PHASE: the Mon 08:45 slot is timed so the draft completes BEFORE
    // the 9:30 open by construction (liveDraftSlots.js:28-30), so this card is the
    // first thing a ranked drafter sees — and it told them the battle had begun ~40
    // minutes early. Pre-open reuses the existing "waiting for the next market
    // open" copy; no new string. False off-flag → byte-identical.
    const flipped = finalStatus === GROUP_STATUS.BATTLE && !preOpen;
    // Training-Pod P0 R2: EXPIRED is terminal — never show the "waiting for the
    // next market open" copy for a pod that was closed before it started.
    const expired = finalStatus === GROUP_STATUS.EXPIRED;
    const lockedPicks = expired ? [] : (draft?.picksByUser?.[currentUserId] || myPicks || []);
    return (
      <div className="ld-scope" style={{ ...scopeStyle, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, width: '100%', background: TOKENS.surface, border: `1px solid ${alpha(DX.you, 0.26)}`, borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <Icon name={expired ? 'x' : 'check'} size={26} color={expired ? TOKENS.ink2 : DX.you} stroke={2.4} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{expired ? 'Pod closed' : 'Lineup locked'}</div>
          <div style={{ color: TOKENS.ink2, marginBottom: 20, lineHeight: 1.5 }}>
            {expired
              ? 'This practice pod was closed before its battle began — start a fresh one any time.'
              : flipped ? 'Your pod is live — the five-day battle has begun.' : 'Your pod is locked in and waiting for the next market open.'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {lockedPicks.map((s) => (
              <span key={s} style={{ background: alpha(DX.you, 0.1), border: `1px solid ${alpha(DX.you, 0.3)}`, borderRadius: 8, padding: '6px 12px', fontWeight: 700 }}>{s}</span>
            ))}
          </div>
          {onExit && (
            <button className="ld-tap" onClick={onExit} style={{ all: 'unset', cursor: 'pointer', background: DX.you, color: TOKENS.bg, borderRadius: 10, padding: '12px 24px', fontWeight: 700 }}>
              View your pod →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (showForming) {
    return (
      <div className="ld-scope" style={scopeStyle}>
        <DraftForming archKey={archKey} seats={formingSeats} ready={!loading} onEnter={() => setEntered(true)} narrow={narrow} mode={mode} />
      </div>
    );
  }

  // residual loader: still fetching, or a transient non-drafting/non-complete
  // window (e.g. FORMING→DRAFTING) — neutral, never the live board over an empty
  // pool. The reveal is allowed to render the board after the pod completes.
  if (loading || (!isDrafting && !revealing)) {
    return (
      <div className="ld-scope" style={{ ...scopeStyle, alignItems: 'center', justifyContent: 'center' }}>
        <ClockRing seconds={null} total={clockTotalSec} size={64} />
        <div style={{ color: TOKENS.ink2, marginTop: 16 }}>Loading your draft…</div>
      </div>
    );
  }

  // ── board center (shared by wide + narrow) ──────────────────────────────
  // Defined as inline-invoked render functions (not <Components/>) so the search
  // input keeps focus across keystrokes — a fresh component type each render
  // would remount it.
  const sectorChips = () => (
    <div className="ld-scroll" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: narrow ? 'nowrap' : 'wrap', overflowX: narrow ? 'auto' : 'visible' }}>
      {!narrow && <Icon name="grid" size={13} color={TOKENS.ink3} />}
      {['All', ...SECTORS].map((sec) => {
        const on = sectorFilter === sec;
        return (
          <button key={sec} className="ld-tap" onClick={() => setSectorFilter(sec)} style={{ all: 'unset', cursor: 'pointer', flexShrink: 0,
            padding: '4px 9px', borderRadius: 999, fontFamily: 'var(--ld-mono)', fontSize: 9.5, letterSpacing: '0.04em',
            color: on ? TOKENS.bg : TOKENS.ink2, background: on ? DX.you : TOKENS.surface, border: `1px solid ${on ? DX.you : TOKENS.hair}`, fontWeight: 600 }}>{sec}</button>
        );
      })}
    </div>
  );

  const searchBox = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 10, background: TOKENS.surface, border: `1px solid ${query ? alpha(DX.you, 0.4) : TOKENS.hair}` }}>
      <Icon name="search" size={14} color={query ? DX.you : TOKENS.ink3} />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the board…" style={{ all: 'unset', flex: 1, minWidth: 0, fontSize: 13, color: TOKENS.ink, fontFamily: 'var(--ld-ui)' }} />
      {query && (
        <button className="ld-tap" onClick={() => setQuery('')} style={{ all: 'unset', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={13} color={TOKENS.ink3} /></button>
      )}
    </div>
  );

  const renderTiers = (size) => {
    if (!viewBoard.length) {
      return <div style={{ padding: '28px 8px', textAlign: 'center', color: TOKENS.ink3, fontSize: 13 }}>No names match{q ? ` “${query}”` : ''}{sectorFilter !== 'All' ? ` in ${sectorFilter}` : ''}.</div>;
    }
    return tierGroups.map((g) => {
      // Every tier shows its top TIER_CAP by fit; the rest sits behind a
      // per-tier expander. Search (q) reveals all matches.
      const expanded = expandedTiers.has(g.tier) || !!q;
      const visible = expanded ? g.items : g.items.slice(0, TIER_CAP);
      const hidden = g.items.length - visible.length;
      return (
        <div key={g.tier}>
          <TierHeader tier={g.tier} count={g.items.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((s) => (
              <StockCard key={s.symbol} stock={s} size={size}
                selected={selected === s.symbol} disabled={phase !== 'your-turn'}
                onSelect={(sym) => setSelected(sym === selected ? null : sym)}
                expanded={expandedId === s.symbol} onExpand={setExpandedId}
                onResearch={v2On ? openResearch : undefined} />
            ))}
          </div>
          {hidden > 0 && (
            <button className="ld-tap" onClick={() => toggleTier(g.tier)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', boxSizing: 'border-box', marginTop: 8,
              padding: '11px', borderRadius: 12, background: TOKENS.surface, border: `1px dashed ${TOKENS.hair2}`, color: TOKENS.ink2 }}>
              <Icon name="chevD" size={14} color={TOKENS.ink2} />
              <Mono style={{ fontSize: 11.5, letterSpacing: '0.04em' }}>Show {hidden} more</Mono>
            </button>
          )}
        </div>
      );
    });
  };

  const practiceBadge = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: TOKENS.surface, border: `1px solid ${TOKENS.hair2}` }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: DX.you }} />
      <Mono style={{ fontSize: 9.5, color: TOKENS.ink2, letterSpacing: '0.1em', fontWeight: 600 }}>PRACTICE · NO STAKES</Mono>
    </span>
  );

  // ── narrow (phone) ──────────────────────────────────────────────────────
  if (narrow) {
    return (
      <div className="ld-scope" style={scopeStyle}>
        <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${TOKENS.hair}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{roomTitle}</span>
              <ArchChip archKey={archKey} size="m" />
            </div>
            <Mono style={{ fontSize: 9.5, color: TOKENS.ink3, letterSpacing: '0.04em' }}>PICK {pickNo}/{totalPicks}</Mono>
          </div>
          <SnakeStrip snakeOrder={snakeOrder} picksByOverall={picksByOverall} onClockIndex={isDrafting ? currentPickIndex : -1} humanSeatIdx={humanSeatIdx} />
        </div>

        {phase === 'your-turn' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 16px', flexShrink: 0, background: alpha(DX.you, 0.06), borderBottom: `1px solid ${alpha(DX.you, 0.2)}` }}>
            <ClockRing seconds={pickClock} total={clockTotalSec} size={58} />
            <div style={{ flex: 1 }}>
              <Mono style={{ fontSize: 9.5, letterSpacing: '0.1em', color: DX.you, fontWeight: 700 }}>YOU'RE ON THE CLOCK</Mono>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 1 }}>Pick #{pickNo} overall</div>
            </div>
          </div>
        )}
        {phase === 'waiting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', flexShrink: 0, background: alpha(DX.cpu, 0.07), borderBottom: `1px solid ${alpha(DX.cpu, 0.22)}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DX.cpu, animation: 'ldLiveDot 1.4s infinite' }} />
            <Mono style={{ fontSize: 10, letterSpacing: '0.12em', color: DX.cpu, fontWeight: 700 }}>OPPONENTS DRAFTING</Mono>
          </div>
        )}
        {revealing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', flexShrink: 0, background: alpha(DX.cpu, 0.07), borderBottom: `1px solid ${alpha(DX.cpu, 0.22)}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DX.cpu, animation: 'ldLiveDot 1.4s infinite' }} />
            <Mono style={{ fontSize: 10, letterSpacing: '0.12em', color: DX.cpu, fontWeight: 700, flex: 1 }}>OPPONENTS DRAFTING</Mono>
            <button className="ld-tap" onClick={skip} style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: TOKENS.surface, border: `1px solid ${TOKENS.hair2}`, color: TOKENS.ink2 }}>
              <Mono style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>SKIP</Mono><Icon name="arrowR" size={12} color={TOKENS.ink2} />
            </button>
          </div>
        )}

        <div className="ld-scroll" style={{ flex: 1, overflowY: 'auto', padding: v2On && phase === 'your-turn' ? '12px 16px 96px' : '12px 16px 14px', minHeight: 0 }}>
          {error && <div style={{ borderRadius: 10, padding: '8px 12px', background: alpha(DX.neg, 0.1), border: `1px solid ${alpha(DX.neg, 0.4)}`, color: '#ffd7de', fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
          {revealing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {revealRows.slice().reverse().map((p, i) => <RevealRow key={p.overall} pick={p} fresh={i === 0} />)}
              <div style={{ textAlign: 'center', padding: '8px' }}><Mono style={{ fontSize: 10.5, color: TOKENS.ink3 }}>re-ranking your best available…</Mono></div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
                <Eyebrow color={DX.you}>Best available · {viewBoard.length}</Eyebrow>
                <Mono style={{ fontSize: 9.5, color: TOKENS.ink3 }}>fit advises</Mono>
              </div>
              <div style={{ marginBottom: 8 }}>{searchBox()}</div>
              <div style={{ marginBottom: 8 }}>{sectorChips()}</div>
              {renderTiers('m')}
            </>
          )}
        </div>

        {!v2On && phase === 'your-turn' && (
          <div style={{ flexShrink: 0, padding: '11px 16px calc(11px + env(safe-area-inset-bottom))', borderTop: `1px solid ${TOKENS.hair}`, background: TOKENS.bg }}>
            {selectedRow ? (
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="ld-tap" onClick={() => setSelected(null)} disabled={submitting} style={{ all: 'unset', cursor: 'pointer', padding: '14px 16px', borderRadius: 13, background: TOKENS.surface, border: `1px solid ${TOKENS.hair2}`, color: TOKENS.ink2, fontWeight: 600, fontSize: 13 }}>Clear</button>
                <button className="ld-tap" onClick={doConfirm} disabled={submitting} style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '14px', borderRadius: 13, background: DX.you, color: TOKENS.bg, fontWeight: 700, fontSize: 14.5, boxShadow: `0 8px 24px ${alpha(DX.you, 0.3)}`, opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Drafting…' : `Confirm — draft ${selectedRow.symbol}`}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <Mono style={{ fontSize: 11.5, color: TOKENS.ink2 }}>Tap a name to select · clock auto-picks your top fit</Mono>
              </div>
            )}
          </div>
        )}
        {flash && !reduceMotion && <SnipeCallout symbol={flash.symbol} seatLabel={cpuLabel(flash.odUserId)} />}
        {v2Overlays()}
      </div>
    );
  }

  // ── wide (desktop) — three columns ──────────────────────────────────────
  return (
    <div className="ld-scope" style={scopeStyle}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${TOKENS.hair}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{roomTitle}</div>
          <ArchChip archKey={archKey} />
          {!competitive && practiceBadge}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Mono style={{ fontSize: 11, color: TOKENS.ink3, letterSpacing: '0.06em' }}>ROUND {round} · PICK {pickNo} OF {totalPicks}</Mono>
          <SnakeStrip snakeOrder={snakeOrder} picksByOverall={picksByOverall} onClockIndex={isDrafting ? currentPickIndex : -1} humanSeatIdx={humanSeatIdx} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* left — the table */}
        <div className="ld-scroll" style={{ width: 290, flexShrink: 0, borderRight: `1px solid ${TOKENS.hair}`, padding: v2On && phase === 'your-turn' ? '15px 16px 96px' : '15px 16px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto' }}>
          <Eyebrow>The table</Eyebrow>
          {seats.map((s) => (
            <SeatCard key={s.odUserId} seat={{ ...s, label: seatLabel(s) }} archKey={archKey} active={s.seatIndex === onClockSeatIdx && isDrafting} picksPerPlayer={PICKS_PER_PLAYER} />
          ))}
          <div style={{ marginTop: 6 }}><Eyebrow>Your lineup · {myPicks.length}/{PICKS_PER_PLAYER}</Eyebrow></div>
          <LineupSlots picks={myPicks} picksPerPlayer={PICKS_PER_PLAYER} />
        </div>

        {/* center — the board */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <Eyebrow color={DX.you}>Best available</Eyebrow>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>Ranked for your agent · {viewBoard.length} names</div>
              </div>
              <Mono style={{ fontSize: 10.5, color: TOKENS.ink3, maxWidth: 240, textAlign: 'right', lineHeight: 1.4 }}>Fit advises — any name is pickable</Mono>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, flexWrap: 'wrap' }}>
              <div style={{ width: 230, maxWidth: '40%' }}>{searchBox()}</div>
              {sectorChips()}
            </div>
          </div>
          <div className="ld-scroll" style={{ flex: 1, overflowY: 'auto', padding: v2On && phase === 'your-turn' ? '0 20px 96px' : '0 20px 20px' }}>
            {renderTiers('d')}
          </div>
        </div>

        {/* right — the pick panel */}
        <div style={{ width: 332, flexShrink: 0, borderLeft: `1px solid ${TOKENS.hair}`, padding: v2On && phase === 'your-turn' ? '15px 16px 96px' : '15px 16px', minHeight: 0 }}>
          <PickPanel
            phase={phase} pickClock={pickClock} pickNo={pickNo} backToBack={backToBack}
            selected={selectedRow} coach={coach} orbState={(phase === 'waiting' || phase === 'revealing') ? 'reading' : 'ready'}
            onConfirm={doConfirm} onClear={() => setSelected(null)} submitting={submitting} error={error}
            myPicks={myPicks} onExit={onExit} onClockLabel={onClockLabel} clockTotalSec={clockTotalSec}
            revealRows={revealRows} onSkip={skip}
            showFooterConfirm={!v2On}
          />
        </div>
      </div>
      {flash && !reduceMotion && <SnipeCallout symbol={flash.symbol} seatLabel={cpuLabel(flash.odUserId)} />}
      {v2Overlays()}
    </div>
  );
}
