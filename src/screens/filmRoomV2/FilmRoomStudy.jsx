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
//               (F1, BA-38); the one-step-hypothetical sentence and the basis
//               note on every card
//   Directives  the card per BA-9, its three states from the tape's rows (F6)
//   Plans       verbatim, with the two market prices and the horizon note (BA-10)
//   Rationale   recorded words, collapsed, beside the checks that carry no agent
//               text, in time order (BA-46)
//   Checks      each check with its recorded risk decision (BA-7), tap for detail
//   Diagnostics only when diagnostics.intradayViews is 'present' (F4)

import React, { useState } from 'react';
import {
  valueAt, etClock, checkStateOf, riskSummary, exitMakerOf, swapAnchor, lastPointPath, deriveHoldings,
  directiveCardOf, rationaleTimeline, planGroups, PLAN_DIRECTIONS, EXIT_MAKER_WORDS, fmtPrice, fmtPriceDelta, fmtCount, isNum, toMs, etDateLabel,
} from './filmRoomModel';
// The replay's own coverage line sits under the swaps' (BA-20: every section its coverage).
import { FILM_ROOM_COPY as COPY, REPLAY_SENTENCE, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE, DIRECTIVE_EXPLAINER } from './filmRoomCopy';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../data/intradayDiagnosticCopy';
import { etDateOf } from '../../utils/tapeSchedule';
import {
  C, card, eyebrow, foot, body, mono, tint, plain, TapeNum, CountNum, CheckCount, When, Rec, Section, Row, EmptyCard, Collapsible, StateTag, Door, Chip, TextButton, KindMark, Coverage,
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
function ForkChart({ tape, index, height = 112 }) {
  const r = valueAt(tape, ['actions', index, 'replay']);
  const hold = Array.isArray(r?.holdPath) ? r.holdPath : [];
  const swap = Array.isArray(r?.swapPath) ? r.swapPath : [];
  const all = [...hold, ...swap].filter((p) => isNum(p?.points));
  if (!all.length) return null;
  const t0 = Math.min(...[...hold, ...swap].map((p) => toMs(p.at)).filter((v) => v !== null));
  const t1 = Math.max(...[...hold, ...swap].map((p) => toMs(p.at)).filter((v) => v !== null));
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;   // no recorded instant to place a point at (review A2L3-11)
  const vs = all.map((p) => p.points);
  let lo = Math.min(...vs); let hi = Math.max(...vs);
  const span = Math.max(2, hi - lo); lo -= span * 0.15; hi += span * 0.15;
  const x = (at) => ((toMs(at) - t0) / Math.max(1, t1 - t0)) * 1000;
  const y = (v) => 8 + ((hi - v) / (hi - lo)) * (height - 16);
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
    <div data-region={`fork-${index}`} style={{ position: 'relative', width: '100%', height }}>
      <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-label={COPY.fork} style={{ display: 'block', overflow: 'visible', width: '100%', height }}>
        <path data-line="hold" data-rebuilt="" d={d(hold)} style={{ fill: 'none', stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" />
        <path data-line="swap" data-rebuilt="" d={d(swap)} style={{ fill: 'none', stroke: C.teal, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: -14, display: 'flex', justifyContent: 'space-between', ...mono(9, C.ink3) }}>
        <When>{etClock(new Date(t0).toISOString())}</When>
        <span>{COPY.close10}</span>
      </div>
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
            {Array.isArray(sold.missingInputs) && sold.missingInputs.length ? <span style={foot}><Rec>{COPY.missing(sold.missingInputs)}</Rec></span> : null}
          </>
        ) : <span data-split-missing="sale" style={foot}><Rec>{splitAbsent(tape, index)}</Rec></span>}
      </div>
      <div data-split="fill" data-split-symbol={a.symbolIn} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ ...eyebrow, color: C.ink2, paddingBottom: 4 }}>{COPY.fill}</span>
        {fill ? (
          <>
            <Row border={false} k={<Rec>{COPY.fillRows.recordedFill(a.symbolIn)}</Rec>} v={n(f('recordedPx'), fmtPrice)} />
            <Row k={COPY.fillRows.barAtSwap} sub={fill.barClosedAt ? <When>{COPY.barClosedAt(etClock(fill.barClosedAt))}</When> : null} v={n(f('rebuiltPx'), fmtPrice)} />
            <Row k={COPY.fillRows.barMinusFill} v={n(f('pxDelta'), fmtPriceDelta)} />
            {Array.isArray(fill.missingInputs) && fill.missingInputs.length ? <span style={foot}><Rec>{COPY.missing(fill.missingInputs)}</Rec></span> : null}
          </>
        ) : <span data-split-missing="fill" style={foot}><Rec>{splitAbsent(tape, index)}</Rec></span>}
      </div>
    </div>
  );
}

/**
 * Why a split group is absent: no replay at all, or a replay an earlier replay
 * logic built — Amendment D's split was never computed for it. The replay's
 * own stored note when it carries one, else the same fixed words (BA-38;
 * review A2L3-1: never "No replay" beside a replay that is drawn).
 */
function splitAbsent(tape, index) {
  const r = valueAt(tape, ['actions', index, 'replay']);
  if (!r) return COPY.replayNone;
  return r.note || REPLAY_VERSION_NOTE;
}

function SwapCard({ tape, index, desktop, onDeep }) {
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
  const anchor = swapAnchor(index);
  return (
    <article id={anchor} data-swap-card={index} style={{ ...card, gap: 10, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow, color: C.ink2 }}><When>{COPY.swapAt(etClock(a.at) ?? '')}</When></span>
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
              <div style={{ paddingBottom: 14 }}><ForkChart tape={tape} index={index} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
                <span data-path-label="hold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg>
                  <span style={mono(9.5, C.ink2)}>{COPY.holdPath} · <Rec>{COPY.heldLine(a.symbolOut)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
                  {holdEnd ? <TapeNum doc={tape} path={holdEnd} size={12} /> : null}
                </span>
                <span data-path-label="swap" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: C.teal, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg>
                  <span style={mono(9.5, C.ink2)}>{COPY.swapPath} · <Rec>{COPY.boughtLine(a.symbolIn)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
                  {swapEnd ? <TapeNum doc={tape} path={swapEnd} size={12} /> : null}
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
              {r.note ? <span style={foot}><Rec>{r.note}</Rec></span> : null}
            </>
          ) : <span style={foot}>{COPY.replayNone}{a.replayReason === 'crypto_not_supported' ? ` · ${COPY.replayCrypto}` : ''} · <Rec>{tape.coverage?.replay?.note || ''}</Rec></span>}
          <span data-replay-sentence="" style={foot}><Rec>{r?.label || REPLAY_SENTENCE}</Rec></span>
        </div>
        <SplitRows tape={tape} index={index} a={a} />
      </div>
      <span data-basis-note="" style={{ ...foot, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}><Rec>{r?.lockedBasisNote || LOCKED_BASIS_NOTE}</Rec></span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Door label={COPY.deepDoor(a.symbolOut)} onClick={() => onDeep(a.symbolOut)} />
        <Door label={COPY.deepDoor(a.symbolIn)} onClick={() => onDeep(a.symbolIn)} />
      </div>
    </article>
  );
}

function SwapsSection({ tape, desktop, onDeep }) {
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  return (
    <Section id="swaps" title={COPY.swaps} count={actions.length ? <CountNum value={actions.length} aggregate="count(actions[])" size={10} /> : null} coverage={tape.coverage?.actions}>
      <div data-coverage-of="replay"><Coverage label={COPY.replayCoverage} coverage={tape.coverage?.replay} style={{ padding: '0 2px' }} /></div>
      {actions.length
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{actions.map((a, i) => <SwapCard key={a.key || i} tape={tape} index={i} desktop={desktop} onDeep={onDeep} />)}</div>
        : <EmptyCard>{COPY.swapsNone}</EmptyCard>}
    </Section>
  );
}

// ── directives (BA-9; F6) ───────────────────────────────────────────────────

/** A filing's time; with its date when it was filed before the tape's own day (review A2L1-14). */
function filedLabel(filedAt, etDate) {
  const clock = etClock(filedAt) ?? '';
  const day = etDateOf(filedAt);
  return day && etDate && day !== etDate ? `${etDateLabel(day, { short: true })}, ${clock}` : clock;
}

function DirectiveCard({ tape, index, example }) {
  const d = example || tape.directives[index];
  const s = directiveCardOf(d);
  const row = (k, v) => <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}><span style={mono(9.5, C.ink3, { letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.3 })}>{k}</span>{v}</div>;
  const base = ['directives', index, 'after'];
  return (
    <div data-directive-card={example ? `example-${d.cardState}` : index} data-card-state={d.cardState} style={{ ...card, borderLeft: `3px solid ${C.purple}`, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow, color: C.purple }}>{example ? COPY.explainerLabels[d.cardState] : <When>{COPY.directiveAt(filedLabel(d.filedAt, tape.etDate))}</When>}</span>
      </div>
      {row(COPY.youAsked, <Collapsible text={`“${d.playerText ?? ''}”`} lines={3} color={C.ink} />)}
      {row(s.title, s.filed
        ? <span style={{ fontSize: 12.5, lineHeight: 1.45, color: C.ink, fontWeight: 600 }}><Rec>{s.text}</Rec></span>
        : (d.cardState === 'no_change' ? <span style={{ fontSize: 12.5, color: C.ink2 }}><Rec>{d.retainedDirectiveText ? COPY.retained(d.retainedDirectiveText) : COPY.noneInForce}</Rec></span> : <span />))}
      {s.filed ? row(COPY.receipt, example
        ? <span style={{ fontSize: 12.5, color: C.teal, fontWeight: 600 }}>{COPY.reached(d.heardClock)}</span>
        : (d.heard ? <span data-heard="" style={{ fontSize: 12.5, color: C.teal, fontWeight: 600 }}><When>{COPY.reached(etClock(d.heard.at))}</When></span> : <span style={{ fontSize: 12.5, color: C.ink2 }}>{COPY.unconfirmed}</span>)) : null}
      {d.agentReply ? row(COPY.reply, <Collapsible text={`“${d.agentReply}”`} lines={2} color={C.ink2} />) : null}
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
    <Section id="directives" title={COPY.directives} coverage={tape.coverage?.directives} right={<TextButton onClick={() => setOpen(!open)}>{open ? COPY.explainerClose : COPY.explainerOpen}</TextButton>}>
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
  const note = plans.find((p) => p?.price?.note)?.price?.note || null;
  if (!plans.length) return <Section id="plans" title={COPY.plans} coverage={tape.coverage?.plans}><EmptyCard>{COPY.plansNone}</EmptyCard></Section>;
  const syms = [...new Set(plans.map((p) => p.symbol))];
  return (
    <Section id="plans" title={COPY.plans} coverage={tape.coverage?.plans} note={note ? <Rec>{note}</Rec> : null}>
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
                  {p.signalSummary ? <p style={{ ...body, fontSize: 12.5, color: C.ink2 }}><Rec>{p.signalSummary}</Rec></p> : null}
                  {p.threshold ? <span style={mono(10.5, C.ink2)}><span style={{ color: C.ink3 }}>{COPY.threshold} · </span><Rec>{p.threshold}</Rec></span> : null}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={mono(10, C.ink3)}>{COPY.atPlan}</span><TapeNum doc={tape} path={['plans', i, 'price', 'atPlan', 'value']} fmt={fmtPrice} size={12} /></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={mono(10, C.ink3)}>{COPY.atClose}</span><TapeNum doc={tape} path={['plans', i, 'price', 'atClose', 'value']} fmt={fmtPrice} size={12} /></span>
                  </div>
                  {Array.isArray(p.price?.missingInputs) && p.price.missingInputs.length ? <span style={foot}><Rec>{COPY.missing(p.price.missingInputs)}</Rec></span> : null}
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

function RationaleEntry({ tape, index }) {
  const [open, setOpen] = useState(false);
  const r = tape.rationale[index];
  return (
    <div data-rationale={index} style={{ ...card, gap: 6, borderLeft: `2px solid ${C.ink2}` }}>
      <span style={mono(10, C.ink2, { fontWeight: 600, lineHeight: 1.4 })}><When>{COPY.rationaleLabel(etClock(r.at) ?? '')}</When></span>
      {open ? (
        <div data-rationale-body={index} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {r.hypothesis ? <p style={{ ...body, fontWeight: 600 }}><Rec>{r.hypothesis}</Rec></p> : null}
          {r.rationale ? <p style={{ ...body, color: C.ink2 }}><Rec>{r.rationale}</Rec></p> : null}
        </div>
      ) : null}
      <TextButton onClick={() => setOpen(!open)}>{open ? COPY.rationaleClose : COPY.rationaleOpen}</TextButton>
    </div>
  );
}

function RationaleSection({ tape, onCheck }) {
  const rows = rationaleTimeline(tape);
  const recorded = Array.isArray(tape.rationale) ? tape.rationale : [];
  return (
    <Section id="rationale" title={COPY.rationale} count={recorded.length ? <CountNum value={recorded.length} aggregate="count(rationale[])" size={10} /> : null} coverage={tape.coverage?.rationale}>
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
    <Section id="checks" title={COPY.checks} count={<CheckCount tape={tape} />} coverage={tape.coverage?.checks} note={COPY.riskNote}>
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
