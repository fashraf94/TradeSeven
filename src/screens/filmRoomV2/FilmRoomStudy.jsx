// src/screens/filmRoomV2/FilmRoomStudy.jsx
//
// Study (spec V1.2 §7; Amendment E BA-41 F1–F4, BA-44 … BA-47). Every
// section opens with the tape's own coverage line.
//   Holdings    the day's first and last held sets, DERIVED (BA-45), with who
//               entered each changed slot and when — or omitted behind its
//               coverage line when the record does not reconcile
//   Swaps       one self-contained card per swap, addressable as #swap-n
//               (BA-47): who made the exit BEFORE its result (BA-6); banked
//               points; the hold-vs-swap fork, rebuilt and dashed, with the gap
//               and the agreement at the sale (BA-11); the sale split by cause
//               — always the SOLD leg's sale — and the fill as its own group
//               (F1, BA-38); the basis note on every card, and the replay
//               sentence only beside a drawn replay — a card with no written
//               replay says why, alone (Amendment E addendum 3, R11)
//   Directives  the card per BA-9, its three states from the tape's rows (F6)
//   Plans       verbatim, with the two market prices and the horizon note (BA-10)
//   Rationale   recorded words, collapsed, beside the checks that carry no agent
//               text, in time order (BA-46)
// Every recorded word — the player's, the agent's, the stored directive's and
// the stored plan's — reaches the screen only as a Quotation (Amendment E
// addendum 2, R7): read at its tape path, verbatim, attributed.
//   Checks      each check with its recorded risk decision (BA-7), tap for detail
//   Diagnostics only when diagnostics.intradayViews is 'present' (F4)

import React, { useState } from 'react';
import {
  valueAt, etClock, checkStateOf, riskSummary, exitMakerOf, swapAnchor, swapOrdinals, lastPointPath, deriveHoldings,
  directiveCardOf, rationaleTimeline, planGroups, PLAN_DIRECTIONS, EXIT_MAKER_WORDS, fmtPrice, fmtPriceDelta, fmtCount, isNum, toMs, etWhen,
} from './filmRoomModel';
// The replay's own coverage line sits under the swaps' (BA-20: every section its coverage).
import { FILM_ROOM_COPY as COPY, REPLAY_SENTENCE, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE, DIRECTIVE_EXPLAINER } from './filmRoomCopy';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../data/intradayDiagnosticCopy';
import {
  C, card, eyebrow, foot, body, mono, tint, plain, TapeNum, AggNum, CountNum, CheckCount, When, Rec, StoredNote, MissingInputs, Section, Row, EmptyCard, Quotation, StateTag, Door, Chip, TextButton, KindMark, Coverage,
} from './FilmRoomKit';
import CheckDetail from './FilmRoomCheckDetail';
import { Pip } from './FilmRoomGlance';

// ── holdings (BA-45) ────────────────────────────────────────────────────────

function minCoverage(...covs) {
  const rank = { unavailable: 0, partial: 1, complete: 2 };
  let best = null;
  for (const c of covs) if (c && rank[c.status] !== undefined && (best === null || rank[c.status] < rank[best])) best = c.status;
  return best ?? 'unavailable';
}

function HoldingsSection({ tape, onDeep }) {
  const h = deriveHoldings(tape);
  if (h.status !== 'derived') {
    return <Section id="holdings" title={COPY.holdings} coverage={{ status: 'unavailable', note: h.note }}><EmptyCard>{h.note}</EmptyCard></Section>;
  }
  const status = minCoverage(tape.coverage?.checks, tape.coverage?.actions);
  const cols = h.slots.length;
  const grid = { display: 'grid', gridTemplateColumns: `38px repeat(${cols}, minmax(0,1fr))`, gap: 3, alignItems: 'center' };
  const lab = (t) => <span style={mono(9, C.ink3, { letterSpacing: '0.04em', textTransform: 'uppercase' })}>{t}</span>;
  // A changed slot's tone is who made the swap's exit, as recorded: the agent, a platform rule, the gameplan meeting, or not recorded (review A2L1-1).
  const edge = (tone) => (tone === 'agent' ? `1px solid ${C.teal}` : tone === 'platform' ? `1px solid ${C.ink2}` : tone === 'gameplan' || tone === 'unrecorded' ? `1px dashed ${C.ink2}` : `1px solid ${C.hair}`);
  const chip = (sym, tone, slot = null) => (
    <button key={`${sym}-${tone || ''}`} type="button" data-holding-tone={tone || 'held'} data-slot={slot ?? undefined} onClick={() => onDeep(sym)} title={COPY.deepDoor(sym)} style={{ ...plain, minHeight: 30, minWidth: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: tone === 'out' ? C.ink2 : C.ink, background: tone === 'agent' ? tint('teal', 0.12) : tone === 'platform' ? C.wash : 'transparent', border: edge(tone) }}>
      <Rec style={mono(cols > 6 ? 9.5 : 11, tone === 'out' ? C.ink2 : C.ink, { fontWeight: 700, letterSpacing: '-0.02em' })}>{sym}</Rec>
    </button>
  );
  return (
    <Section id="holdings" title={COPY.holdings} count={<><CountNum value={h.slots.length} aggregate="count(slots of the derived held set)" size={10} /> {COPY.slots}</>} coverage={{ status, note: h.note }}>
      <div data-region="holdings" style={{ ...card, gap: 6 }}>
        <span style={mono(9.5, C.ink3)}><When>{COPY.holdingsAt(etClock(h.start.at), etClock(h.end.at))}</When></span>
        <div style={grid}>{lab(COPY.holdingsStart)}{h.slots.map((s) => chip(s.start, s.change ? 'out' : null))}</div>
        <div style={grid}>{lab(COPY.holdingsEnd)}{h.slots.map((s, k) => chip(s.end, s.change ? s.change.by : null, k))}</div>
        <div style={grid}>
          <span />
          {h.slots.map((s, i) => <span key={i} data-slot-label={i} style={mono(8.5, C.ink3, { textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{s.change ? <><When>{(etClock(s.change.at) || '').replace(/ [AP]M$/, '')}</When><br />{EXIT_MAKER_WORDS[s.change.by].short}</> : ''}</span>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', paddingTop: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: tint('teal', 0.5), border: `1px solid ${C.teal}` }} /><span style={mono(9, C.ink3)}>{COPY.swapByMaker.agent}</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: C.wash, border: `1px solid ${C.ink2}` }} /><span style={mono(9, C.ink3)}>{COPY.swapByMaker.platform}</span></span>
          {h.changes.some((c) => c.by === 'gameplan' || c.by === 'unrecorded') ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, border: `1px dashed ${C.ink2}` }} /><span style={mono(9, C.ink3)}>{COPY.swapByMaker.other}</span></span> : null}
          <span style={mono(9, C.ink3)}>· {COPY.swapMakerNote}</span>
          <span style={mono(9, C.ink3)}>· {COPY.tapForDeep}</span>
        </div>
      </div>
    </Section>
  );
}

// ── swaps (BA-6, BA-11, BA-38, BA-47; F1) ───────────────────────────────────

/** The fork: the hold path and the swap path from the swap to the close, both rebuilt and dashed; a null point is a visible gap. */
const FORK_HEIGHT = 112;

/** The fork's scale — null when it has no point to draw, or no recorded instant to place one at (review A2L3-11). */
function forkScale(tape, index, height = FORK_HEIGHT) {
  const r = valueAt(tape, ['actions', index, 'replay']);
  const hold = Array.isArray(r?.holdPath) ? r.holdPath : [];
  const swap = Array.isArray(r?.swapPath) ? r.swapPath : [];
  const all = [...hold, ...swap].filter((p) => isNum(p?.points));
  if (!all.length) return null;
  const t0 = Math.min(...[...hold, ...swap].map((p) => toMs(p.at)).filter((v) => v !== null));
  const t1 = Math.max(...[...hold, ...swap].map((p) => toMs(p.at)).filter((v) => v !== null));
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  const vs = all.map((p) => p.points);
  let lo = Math.min(...vs); let hi = Math.max(...vs);
  const span = Math.max(2, hi - lo); lo -= span * 0.15; hi += span * 0.15;
  return {
    hold, swap, t0,
    x: (at) => ((toMs(at) - t0) / Math.max(1, t1 - t0)) * 1000,
    y: (v) => 8 + ((hi - v) / (hi - lo)) * (height - 16),
  };
}

/**
 * The paths' end values beside the fork, each at its own height on the fork's
 * scale (the design of record's desktop card); two that would overlap are
 * spread apart about their midpoint, keeping their order. Both tags share one
 * grid cell, so the column is exactly as wide as the wider of them and the
 * fork gives way — a long symbol or value never runs into the split beside it
 * (review A2P3-2).
 */
function ForkEnds({ tape, scale, ends, height }) {
  const at = (path) => { const v = path ? valueAt(tape, path) : null; return isNum(v) ? scale.y(v) : height / 2; };
  let yH = at(ends.hold.path);
  let yS = at(ends.swap.path);
  if (Math.abs(yH - yS) < 16) { const mid = (yH + yS) / 2; const holdFirst = yH <= yS; yH = mid + (holdFirst ? -8 : 8); yS = mid + (holdFirst ? 8 : -8); }
  return (
    <div data-fork-ends="" style={{ display: 'grid', alignItems: 'start', justifyItems: 'start', flexShrink: 0, height, paddingLeft: 12 }}>
      {[['hold', ends.hold, yH, C.ink2], ['swap', ends.swap, yS, C.teal]].map(([k, e, top, color]) => (e.path ? (
        <span key={k} data-fork-end={k} style={{ gridArea: '1 / 1', marginTop: top - 8, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span style={mono(9.5, color)}>{e.label} · <Rec>{e.symbol}</Rec></span>
          <TapeNum doc={tape} path={e.path} size={12} />
        </span>
      ) : null))}
    </div>
  );
}

function ForkChart({ tape, index, height = FORK_HEIGHT, ends = null }) {
  const scale = forkScale(tape, index, height);
  if (!scale) return null;
  const { hold, swap, t0, x, y } = scale;
  const d = (list) => {
    let s = ''; let pen = false;
    for (const p of list) {
      if (!isNum(p?.points) || toMs(p.at) === null) { pen = false; continue; }
      s += `${pen ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.points).toFixed(1)} `;
      pen = true;
    }
    return s.trim();
  };
  return (
    <div data-fork-row={index} style={{ display: 'flex', alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
      <div data-region={`fork-${index}`} style={{ position: 'relative', flex: 1, minWidth: 0, height }}>
        <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-label={COPY.fork} style={{ display: 'block', overflow: 'visible', width: '100%', height }}>
          <path data-line="hold" data-rebuilt="" d={d(hold)} style={{ fill: 'none', stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" />
          <path data-line="swap" data-rebuilt="" d={d(swap)} style={{ fill: 'none', stroke: C.teal, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" />
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -14, display: 'flex', justifyContent: 'space-between', ...mono(9, C.ink3) }}>
          <When>{etClock(new Date(t0).toISOString())}</When>
          <span>{COPY.close10}</span>
        </div>
      </div>
      {ends ? <ForkEnds tape={tape} scale={scale} ends={ends} height={height} /> : null}
    </div>
  );
}

function SplitRows({ tape, index, a }) {
  const base = ['actions', index, 'replay', 'reconciliation'];
  const sold = valueAt(tape, [...base, 'soldAtSale']);
  const fill = valueAt(tape, [...base, 'boughtAtSale']);
  const n = (path, fmt) => <TapeNum doc={tape} path={path} fmt={fmt} size={12} />;
  const s = (k) => [...base, 'soldAtSale', k];
  const f = (k) => [...base, 'boughtAtSale', k];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 10 }}>
      <div data-split="sale" data-split-symbol={a.symbolOut} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ ...eyebrow, color: C.ink2, paddingBottom: 4 }}>{COPY.split}</span>
        {sold ? (
          <>
            <Row border={false} k={<Rec>{COPY.splitRows.recordedExit(a.symbolOut)}</Rec>} v={n(s('recordedPx'), fmtPrice)} />
            <Row k={COPY.splitRows.barAtSwap} sub={sold.barClosedAt ? <When>{COPY.barClosedAt(etClock(sold.barClosedAt))}</When> : null} v={n(s('rebuiltPx'), fmtPrice)} />
            <Row k={COPY.splitRows.barMinusExit} v={n(s('pxDelta'), fmtPriceDelta)} />
            <Row k={COPY.splitRows.rescored} v={n(s('rescoredAtRecordedPx'))} />
            <Row k={COPY.splitRows.inputsPart} v={n(s('inputsDelta'))} />
            <Row k={COPY.splitRows.pricePart} v={n(s('priceDelta'))} />
            <MissingInputs doc={tape} path={s('missingInputs')} style={foot} />
          </>
        ) : <span data-split-missing="sale" style={foot}>{splitAbsent(tape, index)}</span>}
      </div>
      <div data-split="fill" data-split-symbol={a.symbolIn} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ ...eyebrow, color: C.ink2, paddingBottom: 4 }}>{COPY.fill}</span>
        {fill ? (
          <>
            <Row border={false} k={<Rec>{COPY.fillRows.recordedFill(a.symbolIn)}</Rec>} v={n(f('recordedPx'), fmtPrice)} />
            <Row k={COPY.fillRows.barAtSwap} sub={fill.barClosedAt ? <When>{COPY.barClosedAt(etClock(fill.barClosedAt))}</When> : null} v={n(f('rebuiltPx'), fmtPrice)} />
            <Row k={COPY.fillRows.barMinusFill} v={n(f('pxDelta'), fmtPriceDelta)} />
            <MissingInputs doc={tape} path={f('missingInputs')} style={foot} />
          </>
        ) : <span data-split-missing="fill" style={foot}>{splitAbsent(tape, index)}</span>}
      </div>
    </div>
  );
}

/**
 * Why a split group is absent: no replay at all, or a replay an earlier replay
 * logic built — Amendment D's split was never computed for it. The replay's
 * own stored note when it carries one (bound by its path, Astra B2), else the
 * same fixed words (BA-38; review A2L3-1: never "No replay" beside a replay
 * that is drawn).
 */
function splitAbsent(tape, index) {
  const r = valueAt(tape, ['actions', index, 'replay']);
  if (!r) return COPY.replayNone;
  return typeof r.note === 'string' && r.note ? <StoredNote doc={tape} path={['actions', index, 'replay', 'note']} /> : REPLAY_VERSION_NOTE;
}

function SwapCard({ tape, index, ordinal, desktop, onDeep }) {
  const a = tape.actions[index];
  const who = exitMakerOf(a);
  const color = who.by === 'agent' ? C.teal : C.ink2;
  const r = a.replay || null;
  // BA-11: both continued lines are marked hypothetical when later trades share the slot. The action row's count is the
  // merge's recount (current); the replay's is the count it was built with — either above zero marks it (review A2L4-9).
  const rowN = valueAt(tape, ['actions', index, 'subsequentTradesInSlot']);
  const replayN = valueAt(tape, ['actions', index, 'replay', 'subsequentTradesInSlot']);
  const later = isNum(rowN) && (rowN > 0 || !(isNum(replayN) && replayN > 0)) ? ['actions', index, 'subsequentTradesInSlot'] : ['actions', index, 'replay', 'subsequentTradesInSlot'];
  const hypothetical = (isNum(rowN) && rowN > 0) || (isNum(replayN) && replayN > 0);
  const holdEnd = lastPointPath(tape, index, 'holdPath');
  const swapEnd = lastPointPath(tape, index, 'swapPath');
  // The design of record's desktop card puts each path's end value beside the fork, at its height; the phone keeps them under it.
  // R11: a replay is DRAWN when it is written and its fork has a point to draw at a recorded instant (forkScale).
  const drawn = Boolean(r) && forkScale(tape, index) !== null;
  // A card with no written replay says why: a crypto leg by its own stored reason, once (the day's coverage note,
  // which also names crypto legs after the candle pass, stays at the section's head — R11's "caveat once"); any other
  // by the day's replay coverage note (the close pass's "awaiting the candle pass", or outside the candle window).
  const crypto = a.replayReason === 'crypto_not_supported';
  const beside = Boolean(desktop && drawn);
  const ends = beside ? { hold: { path: holdEnd, label: COPY.holdPath, symbol: a.symbolOut }, swap: { path: swapEnd, label: COPY.swapPath, symbol: a.symbolIn } } : null;
  // "Swap n" and #swap-n read one sequence: the swap's place in time order (addendum R4(a); BA-47).
  const anchor = swapAnchor(ordinal - 1);
  return (
    <article id={anchor} data-swap-card={index} style={{ ...card, gap: 10, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span data-swap-title="" style={{ ...eyebrow, color: C.ink2, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {COPY.swapWord} <AggNum value={ordinal} aggregate="ordinal(actions[] in time order)" size={9.5} weight={700} /> · {etClock(a.at) ? <When>{etClock(a.at)}</When> : COPY.notRecorded}
        </span>
        <a href={`#${anchor}`} data-anchor={anchor} style={mono(9.5, C.ink3, { textDecoration: 'none' })}><span data-identifier="">{`#${anchor}`}</span></a>
      </div>
      <span data-exit-maker={who.by} style={{ display: 'flex' }}><StateTag color={color}>{who.label}</StateTag></span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1 }}><Rec>{a.symbolOut}</Rec> <span style={{ color: C.ink3, fontWeight: 500 }}>→</span> <Rec>{a.symbolIn}</Rec></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...mono(11, C.ink2) }}>
          {a.tier ? <Rec>{a.tier}</Rec> : null}
          {isNum(a.slotIndex) ? <>· {COPY.slot} <TapeNum doc={tape} path={['actions', index, 'slotIndex']} fmt={fmtCount} size={11} weight={500} /></> : null}
        </span>
      </div>
      <div data-result-row="banked" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={mono(10.5, C.ink2)}>{COPY.banked}</span>
        <TapeNum doc={tape} path={['actions', index, 'lockedPoints']} size={16} />
        <span style={mono(10, C.ink3)}>{COPY.platformQuote}</span>
      </div>
      <div style={{ display: desktop ? 'grid' : 'flex', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', flexDirection: 'column', gap: desktop ? 20 : 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...eyebrow, color: C.ink2 }}>{COPY.fork}</span>
            {hypothetical ? <span data-hypothetical="" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><StateTag color={C.gold}>{COPY.hypothetical}</StateTag><TapeNum doc={tape} path={later} fmt={fmtCount} size={10.5} weight={600} /><span style={mono(9.5, C.ink3)}>{COPY.laterTrades}</span></span> : null}
          </div>
          {r ? (
            <>
              <div style={{ paddingBottom: 14 }}><ForkChart tape={tape} index={index} ends={ends} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
                <span data-path-label="hold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg>
                  <span style={mono(9.5, C.ink2)}>{COPY.holdPath} · <Rec>{COPY.heldLine(a.symbolOut)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
                  {holdEnd && !beside ? <TapeNum doc={tape} path={holdEnd} size={12} /> : null}
                </span>
                <span data-path-label="swap" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: C.teal, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg>
                  <span style={mono(9.5, C.ink2)}>{COPY.swapPath} · <Rec>{COPY.boughtLine(a.symbolIn)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
                  {swapEnd && !beside ? <TapeNum doc={tape} path={swapEnd} size={12} /> : null}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={mono(9.5, C.ink3)}>{COPY.rebuiltDashed}</span><KindMark cls="rebuilt" /></span>
              </div>
              <div data-result-row="gap" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={mono(10.5, C.ink2)}>{COPY.gap}</span>
                <TapeNum doc={tape} path={['actions', index, 'replay', 'gapPoints']} size={13} />
                <span style={mono(10, C.ink3)}>{COPY.gapNote}</span>
              </div>
              <div data-result-row="closed-leg" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={mono(10.5, C.ink2)}>{COPY.closedLeg}</span>
                <TapeNum doc={tape} path={['actions', index, 'replay', 'reconciliation', 'closedLegDelta']} size={12} />
                <span style={mono(10, C.ink3)}>{COPY.closedLegNote}</span>
              </div>
              {r.note ? <span style={foot}><StoredNote doc={tape} path={['actions', index, 'replay', 'note']} /></span> : null}
            </>
          ) : (
            <span data-replay-none={crypto ? 'crypto' : 'not-written'} style={foot}>
              {COPY.replayNone}{crypto ? <> · {COPY.replayCrypto}</> : (typeof tape.coverage?.replay?.note === 'string' && tape.coverage.replay.note ? <> · <StoredNote doc={tape} path={['coverage', 'replay', 'note']} /></> : null)}
            </span>
          )}
          {/* R11: the sentence only BESIDE A DRAWN REPLAY — the replay's own stored label, verbatim and bound by its path
              (R1, R9, Astra B2), else the screen's own R9 sentence. A card with no written replay says why in its line
              above, alone; a replay that draws nothing carries no sentence either. */}
          {drawn ? <span data-replay-sentence="" style={foot}>{r.label ? <StoredNote doc={tape} path={['actions', index, 'replay', 'label']} /> : REPLAY_SENTENCE}</span> : null}
        </div>
        <SplitRows tape={tape} index={index} a={a} />
      </div>
      <span data-basis-note="" style={{ ...foot, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>{typeof r?.lockedBasisNote === 'string' && r.lockedBasisNote ? <StoredNote doc={tape} path={['actions', index, 'replay', 'lockedBasisNote']} /> : LOCKED_BASIS_NOTE}</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Door label={COPY.deepDoor(a.symbolOut)} onClick={() => onDeep(a.symbolOut)} />
        <Door label={COPY.deepDoor(a.symbolIn)} onClick={() => onDeep(a.symbolIn)} />
      </div>
    </article>
  );
}

function SwapsSection({ tape, desktop, onDeep }) {
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  const ordinals = swapOrdinals(tape);
  return (
    <Section id="swaps" title={COPY.swaps} count={actions.length ? <CountNum value={actions.length} aggregate="count(actions[])" size={10} /> : null} doc={tape} coverageAt={['coverage', 'actions']}>
      <div data-coverage-of="replay"><Coverage label={COPY.replayCoverage} doc={tape} at={['coverage', 'replay']} style={{ padding: '0 2px' }} /></div>
      {actions.length
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{actions.map((a, i) => <SwapCard key={a.key || i} tape={tape} index={i} ordinal={ordinals[i]} desktop={desktop} onDeep={onDeep} />)}</div>
        : <EmptyCard>{COPY.swapsNone}</EmptyCard>}
    </Section>
  );
}

// ── directives (BA-9; F6) ───────────────────────────────────────────────────

/** A filing's time; with its date when it was filed before the tape's own day (review A2L1-14). */
function filedLabel(filedAt, etDate) {
  return etWhen(filedAt, etDate) ?? '';
}

/**
 * F6's explainer cards hold FIXTURE words — the screen's own copy, laid out as a card's quotation is (the words,
 * then whose they would be), under the screen's boundary like any other copy. Never a Quotation: a quotation
 * reads only the tape, at its path (R7).
 */
function ExampleWords({ text, by, color = C.ink2, weight = 400 }) {
  return (
    <div data-example-words={by} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <p style={{ ...body, fontSize: 12.5, fontWeight: weight, color }}>{text}</p>
      <span style={mono(9.5, C.ink3, { lineHeight: 1.4 })}>— {COPY.quoteBy[by]}</span>
    </div>
  );
}

function DirectiveCard({ tape, index, example }) {
  const d = example || tape.directives[index];
  const s = directiveCardOf(d);
  const row = (k, v) => <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}><span style={mono(9.5, C.ink3, { letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.3 })}>{k}</span>{v}</div>;
  const base = ['directives', index, 'after'];
  // R7: every word this card shows from the record is a quotation of the directive row, at the row's own filing time.
  const quote = (key, by, opts) => <Quotation doc={tape} path={['directives', index, key]} by={by} at={['directives', index, 'filedAt']} {...opts} />;
  const filedWords = { size: 12.5, weight: 600, color: C.ink };
  const retainedWords = { size: 12.5, color: C.ink2 };
  let filed = <span />;
  if (s.filed) filed = example ? <ExampleWords text={d.canonicalText} by="directive" color={C.ink} weight={600} /> : quote('canonicalText', 'directive', filedWords);
  else if (d.cardState === 'no_change') {
    filed = d.retainedDirectiveText
      ? (
        <div data-retained="" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, color: C.ink2 }}>{COPY.retainedLabel}</span>
          {example ? <ExampleWords text={d.retainedDirectiveText} by="directive" /> : quote('retainedDirectiveText', 'directive', retainedWords)}
        </div>
      )
      : <span style={{ fontSize: 12.5, color: C.ink2 }}>{COPY.noneInForce}</span>;
  }
  return (
    <div data-directive-card={example ? `example-${d.cardState}` : index} data-card-state={d.cardState} style={{ ...card, borderLeft: `3px solid ${C.purple}`, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow, color: C.purple }}>{example ? COPY.explainerLabels[d.cardState] : <When>{COPY.directiveAt(filedLabel(d.filedAt, tape.etDate))}</When>}</span>
      </div>
      {row(COPY.youAsked, example
        ? <ExampleWords text={d.playerText} by="player" color={C.ink} />
        : (typeof d.playerText === 'string' && d.playerText ? quote('playerText', 'player', { lines: 3, color: C.ink }) : <span style={foot}>{COPY.notRecorded}</span>))}
      {row(s.title, filed)}
      {s.filed ? row(COPY.receipt, example
        ? <span style={{ fontSize: 12.5, color: C.teal, fontWeight: 600 }}>{COPY.reached(d.heardClock)}</span>
        : (d.heard ? <span data-heard="" style={{ fontSize: 12.5, color: C.teal, fontWeight: 600 }}><When>{COPY.reached(etClock(d.heard.at))}</When></span> : <span style={{ fontSize: 12.5, color: C.ink2 }}>{COPY.unconfirmed}</span>)) : null}
      {d.agentReply ? row(COPY.reply, example ? <ExampleWords text={d.agentReply} by="agent" /> : quote('agentReply', 'agent', { lines: 2 })) : null}
      {d.agentReplyDiffers ? <span data-reply-differs="" style={foot}>{COPY.replyDiffers}</span> : null}
      {!example && d.after ? row(COPY.after, (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', ...mono(11, C.ink2) }}>
          <TapeNum doc={tape} path={[...base, 'checks']} fmt={fmtCount} size={11} weight={600} /> {COPY.afterChecks(d.after.checks)}
          <TapeNum doc={tape} path={[...base, 'holds']} fmt={fmtCount} size={11} weight={600} /> {COPY.afterHolds(d.after.holds)} ·
          <TapeNum doc={tape} path={[...base, 'swaps']} fmt={fmtCount} size={11} weight={600} /> {COPY.afterSwaps(d.after.swaps)}
        </span>
      )) : null}
    </div>
  );
}

function DirectivesSection({ tape }) {
  const [open, setOpen] = useState(false);
  const list = Array.isArray(tape.directives) ? tape.directives : [];
  return (
    <Section id="directives" title={COPY.directives} doc={tape} coverageAt={['coverage', 'directives']} right={<TextButton onClick={() => setOpen(!open)}>{open ? COPY.explainerClose : COPY.explainerOpen}</TextButton>}>
      {list.length ? list.map((d, i) => <DirectiveCard key={d.key || i} tape={tape} index={i} />) : <EmptyCard>{COPY.directivesNone}</EmptyCard>}
      {open ? (
        <div data-region="directive-explainer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={foot}>{COPY.explainerNote}</span>
          {DIRECTIVE_EXPLAINER.map((ex) => <DirectiveCard key={ex.cardState} tape={tape} example={ex} />)}
        </div>
      ) : null}
    </Section>
  );
}

// ── plans (BA-10) ───────────────────────────────────────────────────────────

function PlansSection({ tape }) {
  const [filter, setFilter] = useState(null);
  const plans = Array.isArray(tape.plans) ? tape.plans : [];
  // the horizon note the plans store (the first plan that carries one), bound by its path (Astra B2)
  const noteAt = plans.findIndex((p) => typeof p?.price?.note === 'string' && p.price.note);
  if (!plans.length) return <Section id="plans" title={COPY.plans} doc={tape} coverageAt={['coverage', 'plans']}><EmptyCard>{COPY.plansNone}</EmptyCard></Section>;
  const syms = [...new Set(plans.map((p) => p.symbol))];
  return (
    <Section id="plans" title={COPY.plans} doc={tape} coverageAt={['coverage', 'plans']} note={noteAt >= 0 ? <StoredNote doc={tape} path={['plans', noteAt, 'price', 'note']} /> : null}>
      <div data-region="plan-chips" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        <Chip on={filter === null} onClick={() => setFilter(null)}>{COPY.plansAll}</Chip>
        {syms.map((s) => <Chip key={s} on={filter === s} onClick={() => setFilter(s)}><Rec>{s}</Rec><CountNum value={plans.filter((p) => p.symbol === s).length} aggregate="count(plans[] of the symbol)" size={9.5} color={C.ink3} /></Chip>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {planGroups(tape, filter).map((g) => (
          <div key={`${g.at}`} style={{ ...card, gap: 0, padding: '4px 14px' }}>
            <span style={mono(10, C.ink3, { letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 0 4px', fontWeight: 700 })}><When>{etClock(g.at)}</When></span>
            {g.items.map((i) => {
              const p = plans[i];
              return (
                <div key={p.key || i} data-plan={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '9px 0 10px', borderTop: `1px solid ${C.hair}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}><Rec>{p.symbol}</Rec></span>
                    <StateTag dim>{PLAN_DIRECTIONS[p.direction] || <Rec>{p.direction || ''}</Rec>}</StateTag>
                  </div>
                  {/* R7: the plan's prose is the stored plan's words — the tape records no author for it */}
                  <Quotation doc={tape} path={['plans', i, 'signalSummary']} by="plan" at={['plans', i, 'at']} size={12.5} />
                  {p.threshold ? (
                    <div data-plan-threshold="" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={mono(10.5, C.ink3)}>{COPY.threshold}</span>
                      <Quotation doc={tape} path={['plans', i, 'threshold']} by="plan" at={['plans', i, 'at']} size={12} />
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={mono(10, C.ink3)}>{COPY.atPlan}</span><TapeNum doc={tape} path={['plans', i, 'price', 'atPlan', 'value']} fmt={fmtPrice} size={12} /></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={mono(10, C.ink3)}>{COPY.atClose}</span><TapeNum doc={tape} path={['plans', i, 'price', 'atClose', 'value']} fmt={fmtPrice} size={12} /></span>
                  </div>
                  <MissingInputs doc={tape} path={['plans', i, 'price', 'missingInputs']} style={foot} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── rationale (BA-46, BA-22; F3) ────────────────────────────────────────────

/**
 * BA-46 under addendum R6: collapsed by default as a CLAMPED PREVIEW — the
 * hypothesis, then the first lines of the recorded words, with "Read more"
 * when they run past the preview (the design of record's Collapsible). Both
 * are the agent's recorded words, so both are quotations of the entry, at its
 * own time (R7); the preview clamps the full stored value with CSS.
 */
const RATIONALE_PREVIEW_LINES = 2;
function RationaleEntry({ tape, index }) {
  const r = tape.rationale[index];
  const at = ['rationale', index, 'at'];
  return (
    <div data-rationale={index} style={{ ...card, gap: 6, borderLeft: `2px solid ${C.ink2}` }}>
      <span style={mono(10, C.ink2, { fontWeight: 600, lineHeight: 1.4 })}><When>{COPY.rationaleLabel(etClock(r.at) ?? '')}</When></span>
      <div data-rationale-body={index} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <Quotation doc={tape} path={['rationale', index, 'hypothesis']} by="agent" at={at} weight={600} color={C.ink} />
        <Quotation doc={tape} path={['rationale', index, 'rationale']} by="agent" at={at} lines={RATIONALE_PREVIEW_LINES} />
      </div>
    </div>
  );
}

function RationaleSection({ tape, onCheck }) {
  const rows = rationaleTimeline(tape);
  const recorded = Array.isArray(tape.rationale) ? tape.rationale : [];
  return (
    <Section id="rationale" title={COPY.rationale} count={recorded.length ? <CountNum value={recorded.length} aggregate="count(rationale[])" size={10} /> : null} doc={tape} coverageAt={['coverage', 'rationale']}>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row) => (row.kind === 'rationale'
            ? <RationaleEntry key={`r${row.index}`} tape={tape} index={row.index} />
            : (
              <button key={`s${row.index}`} type="button" data-state-entry={row.index} onClick={() => onCheck(row.index)} style={{ ...plain, ...card, gap: 4, border: `1px dashed ${C.hair2}`, background: 'transparent' }}>
                <span style={mono(10, C.ink2, { fontWeight: 600 })}><When>{COPY.stateEntry(etClock(tape.checks[row.index].at) ?? '', row.label)}</When></span>
                <span style={foot}>{COPY.stateEntryNote}</span>
              </button>
            )))}
        </div>
      ) : <EmptyCard>{COPY.rationaleNone}</EmptyCard>}
    </Section>
  );
}

// ── checks (BA-7, BA-44) ────────────────────────────────────────────────────

function ChecksSection({ tape, selected, onSelect }) {
  const checks = Array.isArray(tape.checks) ? tape.checks : [];
  return (
    <Section id="checks" title={COPY.checks} count={<CheckCount tape={tape} />} doc={tape} coverageAt={['coverage', 'checks']} note={COPY.riskNote}>
      {selected != null && checks[selected] ? <CheckDetail tape={tape} index={selected} onClose={() => onSelect(null)} /> : null}
      {checks.length ? (
        <div style={{ ...card, gap: 0, padding: '2px 14px' }}>
          {checks.map((c, i) => {
            const st = checkStateOf(c);
            return (
              <button key={c.key || i} type="button" data-check-row={i} onClick={() => onSelect(selected === i ? null : i)} style={{ ...plain, display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 0', width: '100%', borderTop: `1px solid ${C.hair}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={mono(11.5, C.ink, { width: 68, flexShrink: 0 })}><When>{etClock(c.at) ?? ''}</When></span>
                  <span style={{ width: 9, height: 9, flexShrink: 0 }}><Pip tone={st.tone} /></span>
                  <span style={mono(10.5, C.ink2, { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{st.label}</span>
                  {c.scores ? <TapeNum doc={tape} path={['checks', i, 'scores', 'total']} size={12} /> : null}
                </span>
                <span style={mono(10, C.ink3, { paddingLeft: 76 })}><Rec>{riskSummary(c)}</Rec></span>
              </button>
            );
          })}
        </div>
      ) : <EmptyCard>{COPY.checksNone}</EmptyCard>}
    </Section>
  );
}

// ── diagnostics (BA-14; F4) ─────────────────────────────────────────────────

function DiagnosticsSection({ tape }) {
  if (tape.diagnostics?.intradayViews !== 'present') return null;
  return (
    <Section id="diagnostics" title={COPY.diagnostics}>
      <div data-region="diagnostics" style={{ ...card, border: `1px dashed ${C.hair2}`, gap: 6 }}>
        <span style={mono(9.5, C.ink3)}>{INTRADAY_DIAGNOSTIC_HEADER}</span>
        <span style={mono(11.5, C.ink2)}>{COPY.diagnosticsPresent}</span>
      </div>
    </Section>
  );
}

export default function FilmRoomStudy({ tape, desktop, onDeep, selected, onSelect, jump }) {
  const col = { display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 };
  const sections = {
    holdings: <HoldingsSection key="holdings" tape={tape} onDeep={onDeep} />,
    swaps: <SwapsSection key="swaps" tape={tape} desktop={desktop} onDeep={onDeep} />,
    directives: <DirectivesSection key="directives" tape={tape} />,
    plans: <PlansSection key="plans" tape={tape} />,
    rationale: <RationaleSection key="rationale" tape={tape} onCheck={onSelect} />,
    checks: <ChecksSection key="checks" tape={tape} selected={selected} onSelect={onSelect} />,
    diagnostics: <DiagnosticsSection key="diagnostics" tape={tape} />,
  };
  if (desktop) {
    return (
      <div data-depth="study" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: 24, alignItems: 'start' }}>
        <div style={col}>{sections.holdings}{sections.swaps}{sections.plans}</div>
        <div style={col}>{sections.directives}{sections.rationale}{sections.checks}{sections.diagnostics}</div>
      </div>
    );
  }
  return (
    <div data-depth="study" style={col}>
      <div data-region="study-jumps" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '-2px 0' }}>
        {COPY.jumps.map(([id, label]) => <Chip key={id} onClick={() => jump(id)}>{label}</Chip>)}
      </div>
      {sections.holdings}{sections.swaps}{sections.directives}{sections.plans}{sections.rationale}{sections.checks}{sections.diagnostics}
    </div>
  );
}
