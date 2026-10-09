// src/screens/filmRoomV2/FilmRoomDeepDive.jsx
//
// Deep dive (spec V1.2 §7, BA-12, BA-13; Amendment E BA-43). One 10-minute
// price chart per symbol from its `series` document: the price, the session
// open, the market (SPY) and sector lines rebased to the symbol's open, and
// volume — all market data. A swap on the symbol is marked at its recorded
// time. THE EVIDENCE OVERLAY: for a symbol the day's checks stamped, each
// check's stamp is a marker at the stamp's recorded `px` at `evidenceAt` —
// the platform's quote, which may sit off the bar line (the quote delay,
// stated, never smoothed). Opening a marker lists the stamp. No score is drawn
// on a price chart, and a replay point is never presented as the price behind
// a check.
//
// The record's own numbers on the chart — the session open and the last bar's
// close — are labelled by their paths in the series document, with markers.
// The axes are scaffolding (Amendment E addendum R4(b)): gridlines at round
// steps of the % move from the session open, the price at each on the left and
// the % on the right, and intermediate time ticks — no per-tick marker; each
// axis names its class ONCE, in its caption (the price axis by the series
// document's own declaration for its closes, the % axis by the screen's
// declaration). The side facts add the open-to-close change and the session's
// volume, computed from the bars and declared `market` (R4(a)), and the
// company name from the app's existing symbol directory (R4(d)).
//
// The time axis spans the tape day's trading session from the calendar the
// tape writers use — open to the calendar's close, an early close included —
// so an incomplete series ends where its bars end, with the tail blank, and
// "close" always names the session-close instant (Amendment E addendum 2, F2).

import React, { useMemo, useState } from 'react';
import { valueAt, etClock, deepSymbols, evidenceMarkers, roleOf, deriveHoldings, exitMakerOf, fmtPrice, fmtPercent, fmtVolume, seriesFacts, pctTicks, sessionOf, isNum, toMs, SCREEN_AGGREGATE_CLASSES } from './filmRoomModel';
import { classOfNumber } from '../../constants/filmTape';
import { COMPANY_NAMES } from '../../config/stockData';
import { FILM_ROOM_COPY as COPY, FORBIDDEN_WORDS } from './filmRoomCopy';
import { C, card, eyebrow, foot, mono, tint, plain, TapeNum, AggNum, When, Rec, Section, Row, Chip, KindMark, TextButton, Coverage } from './FilmRoomKit';
import { EvidenceStamp } from './FilmRoomCheckDetail';

function seriesOf(series, sym) {
  return (series || []).find((s) => s?.symbol === sym) || null;
}

const FORBIDDEN = FORBIDDEN_WORDS.map((w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}(s|es|d|ed|ing)?\\b`, 'i'));

/**
 * A symbol's company name from the app's existing symbol directory (R4(d));
 * null when it has none but the symbol. The forbidden list stands as written
 * (R5), so a name that holds one of its words ("Best Buy") is shown as the
 * symbol alone — R4(d)'s own fallback (review A2P1-2).
 */
export function displayNameOf(sym) {
  const name = typeof sym === 'string' ? COMPANY_NAMES[sym] : null;
  if (typeof name !== 'string' || !name || name === sym) return null;
  return FORBIDDEN.some((re) => re.test(name)) ? null : name;
}
function DisplayName({ sym, style }) {
  const name = displayNameOf(sym);
  return name ? <span data-display-name={sym} style={style}>{name}</span> : null;
}

const PCT_AXIS = 'axis(% from the session open)';
const PAD_L = 64;            // the price axis's gutter — wide enough for the record's marked session open
const PAD_R = 46;            // the % axis's gutter
const TICK_EVERY_MS = 90 * 60_000;
/** A chart tick's clock, without AM/PM (the design of record's ticks). */
const tickClock = (ms) => (etClock(new Date(ms).toISOString()) || '').replace(/ [AP]M$/, '');

/** A line of closes rebased to `base` (another series drawn on this symbol's price scale), or null. */
function rebased(doc, base) {
  const open = doc?.sessionOpen?.value;
  if (!doc || !isNum(open) || !isNum(base)) return null;
  return (doc.bars || []).map((b) => ({ t: toMs(b.t), v: isNum(b.c) ? base * (b.c / open) : null }));
}

function PriceChart({ tape, doc, sym, show, sectorDoc, marketDoc, selectedMark, onMark, height = 250 }) {
  const bars = Array.isArray(doc.bars) ? doc.bars : [];
  const open = doc.sessionOpen?.value;
  // The time domain is the tape day's TRADING SESSION from the calendar the writers use — never the bars' extent:
  // bars sit where they exist, a missing head or tail stays blank, and "close" is the calendar's session-close
  // instant, early or regular (Amendment E addendum 2, F2). Only a date the calendar does not know as a session
  // falls back to the bars' extent, and then its right end is the last bar's end time — never "close".
  const session = sessionOf(tape?.etDate);
  const lastMs = toMs(bars[bars.length - 1]?.t);
  const startMs = session ? session.openMs : (toMs(doc.sessionOpen?.at) ?? toMs(bars[0]?.t));
  const endMs = session ? session.closeMs : (lastMs !== null ? lastMs + 10 * 60_000 : null);
  const marks = evidenceMarkers(tape, sym);
  const actions = (Array.isArray(tape.actions) ? tape.actions : []).map((a, i) => ({ a, i })).filter(({ a }) => a.symbolOut === sym || a.symbolIn === sym);
  const mk = show.market ? rebased(marketDoc, open) : null;
  const sc = show.sector ? rebased(sectorDoc, open) : null;
  const ys = [
    ...bars.map((b) => b.c), ...bars.map((b) => b.h), ...bars.map((b) => b.l), open,
    ...(mk || []).map((p) => p.v), ...(sc || []).map((p) => p.v),
    ...marks.map((m) => valueAt(tape, ['checks', m.index, 'evidence', sym, 'px'])),
  ].filter(isNum);
  if (!bars.length || !ys.length || startMs === null || endMs === null) return null;
  let lo = Math.min(...ys); let hi = Math.max(...ys);
  const span = Math.max(hi * 0.002, hi - lo); lo -= span * 0.08; hi += span * 0.08;
  const volH = show.volume ? 40 : 0; const gap = show.volume ? 8 : 0; const padT = 18;
  const ih = height - padT - volH - gap - 4;
  const x = (ms) => ((ms - startMs) / (endMs - startMs)) * 1000;
  const y = (v) => padT + ((hi - v) / (hi - lo)) * ih;
  const line = (pts) => {
    let s = ''; let pen = false;
    for (const p of pts) { if (!isNum(p.v) || p.t === null) { pen = false; continue; } s += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)} `; pen = true; }
    return s.trim();
  };
  const closes = bars.map((b) => ({ t: (toMs(b.t) ?? 0) + 10 * 60_000, v: b.c }));
  const lastEndX = lastMs !== null ? x(lastMs + 10 * 60_000) : 1000;
  const vols = bars.map((b) => b.v).filter(isNum);
  const volMax = vols.length ? Math.max(...vols) : 0;
  const pct = (ms) => `${(x(ms) / 10).toFixed(3)}%`;
  // R4(b) scaffolding: gridlines at round % steps from the session open; the session open's own line is the 0 step.
  const ticks = isNum(open) && open > 0 ? pctTicks(lo / open - 1, hi / open - 1) : [];
  const timeTicks = [];
  for (let t = startMs + TICK_EVERY_MS; t < endMs - TICK_EVERY_MS / 2; t += TICK_EVERY_MS) timeTicks.push(t);
  const tickLabel = { position: 'absolute', ...mono(9, C.ink3, { whiteSpace: 'nowrap', lineHeight: 1 }) };
  return (
    <div data-region="price-chart" data-symbol={sym} style={{ position: 'relative', width: '100%', boxSizing: 'border-box', padding: `0 ${PAD_R}px 0 ${PAD_L}px` }}>
      <div data-plot="" data-domain-start={new Date(startMs).toISOString()} data-domain-end={new Date(endMs).toISOString()} style={{ position: 'relative', width: '100%', height }}>
        <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-label={`${sym} · ${COPY.deepPrice}`} style={{ display: 'block', overflow: 'visible', width: '100%', height }}>
          {ticks.filter((v) => v !== 0).map((v) => <line key={v} data-gridline="" x1="0" x2="1000" y1={y(open * (1 + v))} y2={y(open * (1 + v))} style={{ stroke: C.hair }} vectorEffect="non-scaling-stroke" />)}
          {isNum(open) ? <line data-line="session-open" x1="0" x2="1000" y1={y(open)} y2={y(open)} style={{ stroke: C.ink3, strokeDasharray: '1.5 3' }} vectorEffect="non-scaling-stroke" /> : null}
          {mk ? <path data-line="market" d={line(mk.map((p) => ({ ...p, t: p.t + 10 * 60_000 })))} style={{ fill: 'none', stroke: C.ink3, strokeWidth: 1.1 }} vectorEffect="non-scaling-stroke" /> : null}
          {sc ? <path data-line="sector" d={line(sc.map((p) => ({ ...p, t: p.t + 10 * 60_000 })))} style={{ fill: 'none', stroke: C.purple, strokeWidth: 1.1, opacity: 0.9 }} vectorEffect="non-scaling-stroke" /> : null}
          <path data-line="price" d={line(closes)} style={{ fill: 'none', stroke: C.ink, strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
          {actions.map(({ a, i }) => (toMs(a.at) !== null ? <line key={i} data-swap-mark={i} x1={x(toMs(a.at))} x2={x(toMs(a.at))} y1={padT - 4} y2={padT + ih} style={{ stroke: exitMakerOf(a).by === 'agent' ? C.teal : C.ink2, strokeWidth: 1, strokeDasharray: '3 2' }} vectorEffect="non-scaling-stroke" /> : null))}
          {show.volume && volMax > 0 ? bars.map((b, i) => (isNum(b.v) && toMs(b.t) !== null ? <rect key={i} data-volume-bar={i} x={x(toMs(b.t)) + 2} width={Math.max(2, (10 * 60_000 / (endMs - startMs)) * 1000 - 4)} y={padT + ih + gap + volH - (b.v / volMax) * volH} height={(b.v / volMax) * volH} style={{ fill: tint('scrim', 0.18) }} /> : null)) : null}
        </svg>
        {/* R4(b): the axes' tick labels — scaffolding, no per-tick marker; each axis's class is named once, in its caption below. */}
        {ticks.map((v) => (
          <React.Fragment key={`tick${v}`}>
            {/* The 0 step's price is the session open, which the record's own marked label carries — never an unmarked twin of it. */}
            {v !== 0 ? <span data-axis-scaffolding="price" aria-hidden="true" style={{ ...tickLabel, right: 'calc(100% + 6px)', top: y(open * (1 + v)) - 5 }}>{fmtPrice(open * (1 + v))}</span> : null}
            <span data-axis-scaffolding="percent" aria-hidden="true" style={{ ...tickLabel, left: 'calc(100% + 6px)', top: y(open * (1 + v)) - 5 }}>{fmtPercent(v)}</span>
          </React.Fragment>
        ))}
        {/* the record's own numbers, as axis labels */}
        {/* No session high or low is shown: hindsight after a plan or an exit (spec §13, BA-10; review A2L1-4). The axis carries the open and the last close. */}
        {/* The record's session open sits ON the price axis, at its 0 step — off the lines that all start there (review A2P3-7). */}
        {isNum(open) ? <span data-axis-record="sessionOpen" style={{ position: 'absolute', right: 'calc(100% + 4px)', top: y(open) - 6 }}><TapeNum doc={doc} docLabel={`series:${sym}`} path={['sessionOpen', 'value']} fmt={fmtPrice} size={9.5} weight={500} color={C.ink3} /></span> : null}
        {/* The last close sits at the end of its own line — where the bars end, never out in a blank tail (F2): */}
        {/* just before that end when it lies right of the middle, just after it otherwise, so it never runs into the axis gutter (review A2A2-2). */}
        {isNum(bars[bars.length - 1]?.c) ? <span data-axis-record="lastClose" style={{ position: 'absolute', ...(lastEndX > 500 ? { right: `calc(${(100 - lastEndX / 10).toFixed(3)}% + 2px)` } : { left: `calc(${(lastEndX / 10).toFixed(3)}% + 4px)` }), top: y(bars[bars.length - 1].c) - 16 }}><TapeNum doc={doc} docLabel={`series:${sym}`} path={['bars', bars.length - 1, 'c']} fmt={fmtPrice} size={9.5} weight={500} color={C.ink3} /></span> : null}
        {/* the evidence overlay (BA-43) */}
        {marks.map((m) => {
          const px = valueAt(tape, ['checks', m.index, 'evidence', sym, 'px']);
          const ms = toMs(m.at);
          if (!isNum(px) || ms === null) return null;
          const on = selectedMark === m.index;
          return (
            <button
              key={m.index}
              type="button"
              data-evidence-marker={m.index}
              data-marker-px={px}
              data-marker-at={m.at}
              aria-label={`${COPY.evidenceLabel} · ${etClock(m.at) ?? ''}`}
              aria-pressed={on}
              onClick={() => onMark(on ? null : m.index)}
              style={{ ...plain, position: 'absolute', left: `calc(${pct(ms)} - 12px)`, top: y(px) - 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: on ? C.gold : 'transparent', boxShadow: `inset 0 0 0 1.5px ${C.gold}` }} />
            </button>
          );
        })}
        {actions.map(({ a, i }) => {
          const ms = toMs(a.at);
          if (ms === null) return null;
          const who = exitMakerOf(a);
          const right = x(ms) > 600;
          return (
            <span key={`l${i}`} data-swap-label={i} style={{ position: 'absolute', top: 0, ...(right ? { right: `calc(${100 - x(ms) / 10}% + 6px)` } : { left: `calc(${pct(ms)} + 6px)` }), display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', ...mono(9.5, who.by === 'agent' ? C.teal : C.ink2, { fontWeight: 600 }) }}>
              {a.symbolOut === sym ? COPY.exitMark : COPY.entryMark} · <When>{etClock(a.at)}</When> · {who.label}
            </span>
          );
        })}
      </div>
      {/* the time axis: the session open, the intermediate ticks, the close — instants, as the design of record writes them */}
      <div data-time-axis="" style={{ position: 'relative', height: 12, marginTop: 4, ...mono(9, C.ink3) }}>
        <When style={{ ...tickLabel, left: 0 }}>{tickClock(startMs)}</When>
        {timeTicks.map((t) => <When key={t} style={{ ...tickLabel, left: pct(t), transform: 'translateX(-50%)' }}><span data-time-tick="" data-at={new Date(t).toISOString()}>{tickClock(t)}</span></When>)}
        {session
          ? <span data-axis-end="close" data-at={new Date(endMs).toISOString()} style={{ ...tickLabel, right: 0 }}>{COPY.close10}</span>
          : <span data-axis-end="last-bar" data-at={new Date(endMs).toISOString()} style={{ ...tickLabel, right: 0 }}><When>{tickClock(endMs)}</When></span>}
      </div>
      <div data-region="axis-captions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 12px', margin: `6px -${PAD_R}px 0 -${PAD_L}px`, ...mono(9, C.ink3) }}>
        <span data-axis-caption="price" data-axis-doc={`series:${sym}`} data-axis-path="bars[0].c" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{COPY.axisPrice}<LineMark doc={doc} path={['bars', 0, 'c']} /></span>
        <span data-axis-caption="percent" data-axis-aggregate={PCT_AXIS} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{COPY.axisPercent}<KindMark cls={SCREEN_AGGREGATE_CLASSES[PCT_AXIS] ?? null} /></span>
      </div>
    </div>
  );
}

/** A line's marker: the class its own series document declares for the numbers it draws (F2; review A2L1-9). No document → no marker. */
function LineMark({ doc, path }) {
  if (!doc) return null;
  return <KindMark cls={classOfNumber(doc.numberClasses, path)} />;
}

function ChartLegend({ sym, sectorEtf, show, onToggle, doc, marketDoc, sectorDoc }) {
  const sw = (color, dotted) => <svg width="16" height="6" aria-hidden="true" style={{ display: 'block' }}><line x1="0" x2="16" y1="3" y2="3" style={{ stroke: color, strokeWidth: 1.6, strokeDasharray: dotted ? '1.5 2.5' : undefined }} /></svg>;
  return (
    <div data-region="chart-legend" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{sw(C.ink)}<span style={mono(9.5, C.ink3)}>{COPY.deepPrice} · <Rec>{sym}</Rec></span><LineMark doc={doc} path={['bars', 0, 'c']} /></span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{sw(C.ink3, true)}<span style={mono(9.5, C.ink3)}>{COPY.sessionOpen}</span><LineMark doc={doc} path={['sessionOpen', 'value']} /></span>
      <Chip on={show.market} onClick={() => onToggle('market')}>{sw(C.ink3)}{COPY.market}<LineMark doc={marketDoc} path={['bars', 0, 'c']} /></Chip>
      <Chip on={show.sector} onClick={() => onToggle('sector')}>{sw(C.purple)}{sectorEtf ? <Rec>{COPY.sector(sectorEtf)}</Rec> : COPY.sectorNone}<LineMark doc={sectorDoc} path={['bars', 0, 'c']} /></Chip>
      <Chip on={show.volume} onClick={() => onToggle('volume')}><span style={{ width: 10, height: 8, background: tint('scrim', 0.3), display: 'inline-block', borderRadius: 1 }} />{COPY.volume}<LineMark doc={doc} path={['bars', 0, 'v']} /></Chip>
      <span style={mono(9.5, C.ink3)}>· {COPY.rebased}</span>
    </div>
  );
}

function SymbolFacts({ tape, doc, sym, holdings, sectorEtf }) {
  const bars = Array.isArray(doc?.bars) ? doc.bars : [];
  const role = roleOf(tape, sym, holdings);
  const sp = (path) => <TapeNum doc={doc} docLabel={`series:${sym}`} path={path} fmt={fmtPrice} size={12} />;
  // R4(a): computed from THIS symbol's own bars — market operands only, declared `market`.
  const { change, volume } = seriesFacts(doc, tape);
  return (
    <div data-region="symbol-facts" data-symbol={sym} style={{ ...card, gap: 0, padding: '10px 14px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8, minWidth: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1 }}><Rec>{sym}</Rec></span>
        <DisplayName sym={sym} style={mono(10.5, C.ink3, { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })} />
      </div>
      <Row k={COPY.inTheBook} v={<span style={mono(10.5, C.ink, { textAlign: 'right' })}><When>{role.text}</When></span>} />
      <Row k={COPY.sessionOpen} v={sp(['sessionOpen', 'value'])} />
      {bars.length ? <Row k={COPY.lastBarClose} v={sp(['bars', bars.length - 1, 'c'])} /> : null}
      {change !== null ? <Row k={COPY.changeOpenToClose} v={<AggNum value={change} aggregate="change(sessionOpen.value to bars[last].c)" fmt={fmtPercent} size={12} weight={700} color={C.ink} />} /> : null}
      {volume !== null ? <Row k={COPY.volumeSession} v={<AggNum value={volume} aggregate="sum(bars[].v)" fmt={fmtVolume} size={12} weight={700} color={C.ink} />} /> : null}
      <Row k={COPY.sectorLine} v={<span style={mono(10.5, sectorEtf ? C.ink : C.ink3)}>{sectorEtf ? <Rec>{sectorEtf}</Rec> : COPY.sectorLineNone}</span>} />
    </div>
  );
}

/** Desktop: every symbol's price at a glance; click to select. */
function SmallMultiples({ series, symbols, sym, onSym }) {
  return (
    <div data-region="all-symbols" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10 }}>
      {symbols.map((s) => {
        const doc = seriesOf(series, s);
        const bars = Array.isArray(doc?.bars) ? doc.bars : [];
        const cs = bars.map((b) => b.c).filter(isNum);
        const lo = cs.length ? Math.min(...cs) : 0; const hi = cs.length ? Math.max(...cs) : 1; const sp = Math.max(hi * 0.001, hi - lo);
        const d = cs.map((v, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, cs.length - 1)) * 100).toFixed(1)} ${(((hi - v) / sp) * 36 + 2).toFixed(1)}`).join(' ');
        const on = s === sym;
        return (
          <button key={s} type="button" data-mini={s} aria-pressed={on} onClick={() => onSym(s)} style={{ ...plain, borderRadius: 12, padding: '8px 10px', background: on ? tint('teal', 0.07) : C.surface, border: `1px solid ${on ? tint('teal', 0.4) : C.hair2}`, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}><Rec>{s}</Rec></span>
              {bars.length ? <TapeNum doc={doc} docLabel={`series:${s}`} path={['bars', bars.length - 1, 'c']} fmt={fmtPrice} size={10.5} weight={500} color={C.ink2} /> : null}
            </span>
            {cs.length ? <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 40, display: 'block' }} aria-hidden="true"><path d={d} style={{ fill: 'none', stroke: C.ink, strokeWidth: 1.3 }} vectorEffect="non-scaling-stroke" /></svg> : <span style={mono(9, C.ink3)}>{COPY.deepNoSeries(s)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function FilmRoomDeepDive({ tape, seriesState, sym, onSym, desktop }) {
  const [show, setShow] = useState({ market: true, sector: true, volume: true });
  const [mark, setMark] = useState(null);
  const series = seriesState?.series || [];
  const holdings = useMemo(() => deriveHoldings(tape), [tape]);
  const symbols = useMemo(() => deepSymbols(tape, series, holdings), [tape, series, holdings]);
  const current = sym && symbols.includes(sym) ? sym : (symbols.find((s) => seriesOf(series, s)) || symbols[0] || null);
  const doc = current ? seriesOf(series, current) : null;
  const sectorEtf = current ? (tape.comparables?.sectors?.[current] ?? null) : null;
  const marketDoc = seriesOf(series, 'SPY');
  const sectorDoc = sectorEtf ? seriesOf(series, sectorEtf) : null;
  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const picker = (
    <div data-region="symbol-picker" style={{ display: 'flex', gap: 6, overflowX: desktop ? 'visible' : 'auto', flexWrap: desktop ? 'wrap' : 'nowrap', paddingBottom: 2 }}>
      {symbols.map((s) => <Chip key={s} on={s === current} onClick={() => { setMark(null); onSym(s); }} title={roleOf(tape, s, holdings).text}><Rec>{s}</Rec></Chip>)}
    </div>
  );
  let chartBody;
  if (seriesState?.status === 'loading' || seriesState?.status === 'idle') chartBody = <span style={foot}>{COPY.loading}</span>;
  // A failed read is said as a failed read — never as "no series" (review A2L3-2).
  else if (seriesState?.status === 'error') chartBody = <span data-state="series-error" style={foot}>{COPY.seriesReadError}</span>;
  else if (!current) chartBody = <span style={foot}>{COPY.deepNoSymbols}</span>;
  else if (!doc) chartBody = <span data-no-series={current} style={foot}><Rec>{COPY.deepNoSeries(current)}</Rec></span>;
  else {
    chartBody = (
      <>
        <ChartLegend sym={current} sectorEtf={sectorEtf} show={show} onToggle={toggle} doc={doc} marketDoc={marketDoc} sectorDoc={sectorDoc} />
        <div>
          <PriceChart tape={tape} doc={doc} sym={current} show={show} marketDoc={marketDoc} sectorDoc={sectorDoc} selectedMark={mark} onMark={setMark} height={desktop ? 340 : 250} />
        </div>
      </>
    );
  }
  const evidence = current && evidenceMarkers(tape, current).length ? (
    <div data-region="evidence-overlay" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...eyebrow, color: C.gold }}>{COPY.evidenceOverlay}</span>
      <Coverage label={COPY.evidenceCoverage} coverage={tape.coverage?.evidence} />
      <span style={foot}>{COPY.evidenceOverlayNote}</span>
      <span style={foot}>{COPY.riskNote}</span>
      {mark != null && tape.checks?.[mark] ? (
        <div data-evidence-panel={mark} style={{ ...card, background: C.wash, gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ ...eyebrow, color: C.ink2 }}>{COPY.evidenceLabel}</span>
            <TextButton onClick={() => setMark(null)}>{COPY.close}</TextButton>
          </div>
          <span style={mono(10, C.ink3)}><When>{COPY.checkAt(etClock(tape.checks[mark].at) ?? '')}</When></span>
          <EvidenceStamp tape={tape} index={mark} symbol={current} />
        </div>
      ) : null}
    </div>
  ) : null;
  const chart = (
    <Section id="deep-chart" title={`${COPY.deepPrice}${current ? ` · ${current}` : ''}`} right={current ? <DisplayName sym={current} style={mono(9.5, C.ink3)} /> : null} coverage={tape.coverage?.series}>
      <div style={{ ...card, gap: 10 }}>
        {chartBody}
        {evidence}
      </div>
    </Section>
  );
  if (desktop) {
    return (
      <div data-depth="deep" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {picker}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
          {chart}
          <div style={{ paddingTop: 22 }}>{doc ? <SymbolFacts tape={tape} doc={doc} sym={current} holdings={holdings} sectorEtf={sectorEtf} /> : null}</div>
        </div>
        <Section id="deep-all" title={COPY.allSymbols} coverage={tape.coverage?.series}>
          <SmallMultiples series={series} symbols={symbols} sym={current} onSym={(s) => { setMark(null); onSym(s); }} />
        </Section>
      </div>
    );
  }
  return (
    <div data-depth="deep" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {picker}
      {chart}
      {doc ? <SymbolFacts tape={tape} doc={doc} sym={current} holdings={holdings} sectorEtf={sectorEtf} /> : null}
    </div>
  );
}

export { fmtVolume };
