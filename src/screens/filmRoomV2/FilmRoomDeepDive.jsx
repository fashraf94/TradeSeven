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
// Axis labels are the record's own numbers — the session open, the session's
// high and low bar, the last bar's close — each by its path in the series
// document with its marker; the chart draws no number of its own.

import React, { useMemo, useState } from 'react';
import { valueAt, etClock, deepSymbols, evidenceMarkers, roleOf, deriveHoldings, extremeBars, exitMakerOf, fmtPrice, fmtVolume, isNum, toMs } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, card, eyebrow, foot, mono, tint, plain, TapeNum, When, Rec, Section, Row, Chip, KindMark, TextButton } from './FilmRoomKit';
import { EvidenceStamp } from './FilmRoomCheckDetail';

function seriesOf(series, sym) {
  return (series || []).find((s) => s?.symbol === sym) || null;
}

/** A line of closes rebased to `base` (another series drawn on this symbol's price scale), or null. */
function rebased(doc, base) {
  const open = doc?.sessionOpen?.value;
  if (!doc || !isNum(open) || !isNum(base)) return null;
  return (doc.bars || []).map((b) => ({ t: toMs(b.t), v: isNum(b.c) ? base * (b.c / open) : null }));
}

function PriceChart({ tape, doc, sym, show, sectorDoc, marketDoc, selectedMark, onMark, height = 250 }) {
  const bars = Array.isArray(doc.bars) ? doc.bars : [];
  const open = doc.sessionOpen?.value;
  const startMs = toMs(doc.sessionOpen?.at) ?? toMs(bars[0]?.t);
  const lastMs = toMs(bars[bars.length - 1]?.t);
  const endMs = lastMs !== null ? lastMs + 10 * 60_000 : null;
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
  const vols = bars.map((b) => b.v).filter(isNum);
  const volMax = vols.length ? Math.max(...vols) : 0;
  const { hi: hiIdx, lo: loIdx } = extremeBars(bars);
  const pct = (ms) => `${(x(ms) / 10).toFixed(3)}%`;
  return (
    <div data-region="price-chart" data-symbol={sym} style={{ position: 'relative', width: '100%', height, marginLeft: 0 }}>
      <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-label={`${sym} · ${COPY.deepPrice}`} style={{ display: 'block', overflow: 'visible', width: '100%', height }}>
        {isNum(open) ? <line data-line="session-open" x1="0" x2="1000" y1={y(open)} y2={y(open)} style={{ stroke: C.ink3, strokeDasharray: '1.5 3' }} vectorEffect="non-scaling-stroke" /> : null}
        {mk ? <path data-line="market" d={line(mk.map((p) => ({ ...p, t: p.t + 10 * 60_000 })))} style={{ fill: 'none', stroke: C.ink3, strokeWidth: 1.1 }} vectorEffect="non-scaling-stroke" /> : null}
        {sc ? <path data-line="sector" d={line(sc.map((p) => ({ ...p, t: p.t + 10 * 60_000 })))} style={{ fill: 'none', stroke: C.purple, strokeWidth: 1.1, opacity: 0.9 }} vectorEffect="non-scaling-stroke" /> : null}
        <path data-line="price" d={line(closes)} style={{ fill: 'none', stroke: C.ink, strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
        {actions.map(({ a, i }) => (toMs(a.at) !== null ? <line key={i} data-swap-mark={i} x1={x(toMs(a.at))} x2={x(toMs(a.at))} y1={padT - 4} y2={padT + ih} style={{ stroke: exitMakerOf(a).by === 'agent' ? C.teal : C.ink2, strokeWidth: 1, strokeDasharray: '3 2' }} vectorEffect="non-scaling-stroke" /> : null))}
        {show.volume && volMax > 0 ? bars.map((b, i) => (isNum(b.v) && toMs(b.t) !== null ? <rect key={i} data-volume-bar={i} x={x(toMs(b.t)) + 2} width={Math.max(2, (10 * 60_000 / (endMs - startMs)) * 1000 - 4)} y={padT + ih + gap + volH - (b.v / volMax) * volH} height={(b.v / volMax) * volH} style={{ fill: tint('scrim', 0.18) }} /> : null)) : null}
      </svg>
      {/* the record's own numbers, as axis labels */}
      {hiIdx >= 0 ? <span style={{ position: 'absolute', left: 2, top: y(bars[hiIdx].h) - 16 }}><TapeNum doc={doc} docLabel={`series:${sym}`} path={['bars', hiIdx, 'h']} fmt={fmtPrice} size={9.5} weight={500} color={C.ink3} /></span> : null}
      {loIdx >= 0 ? <span style={{ position: 'absolute', left: 2, top: y(bars[loIdx].l) + 2 }}><TapeNum doc={doc} docLabel={`series:${sym}`} path={['bars', loIdx, 'l']} fmt={fmtPrice} size={9.5} weight={500} color={C.ink3} /></span> : null}
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
            style={{ ...plain, position: 'absolute', left: `calc(${pct(ms)} - 6px)`, top: y(px) - 6, width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: -16, display: 'flex', justifyContent: 'space-between', ...mono(9, C.ink3) }}>
        <When>{etClock(new Date(startMs).toISOString())}</When>
        <span>{COPY.close10}</span>
      </div>
    </div>
  );
}

function ChartLegend({ sym, sectorEtf, show, onToggle }) {
  const sw = (color, dotted) => <svg width="16" height="6" aria-hidden="true" style={{ display: 'block' }}><line x1="0" x2="16" y1="3" y2="3" style={{ stroke: color, strokeWidth: 1.6, strokeDasharray: dotted ? '1.5 2.5' : undefined }} /></svg>;
  return (
    <div data-region="chart-legend" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{sw(C.ink)}<span style={mono(9.5, C.ink3)}>{COPY.deepPrice} · <Rec>{sym}</Rec></span><KindMark cls="market" /></span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{sw(C.ink3, true)}<span style={mono(9.5, C.ink3)}>{COPY.sessionOpen}</span><KindMark cls="market" /></span>
      <Chip on={show.market} onClick={() => onToggle('market')}>{sw(C.ink3)}{COPY.market}<KindMark cls="market" /></Chip>
      <Chip on={show.sector} onClick={() => onToggle('sector')}>{sw(C.purple)}{sectorEtf ? <Rec>{COPY.sector(sectorEtf)}</Rec> : COPY.sectorNone}<KindMark cls="market" /></Chip>
      <Chip on={show.volume} onClick={() => onToggle('volume')}><span style={{ width: 10, height: 8, background: tint('scrim', 0.3), display: 'inline-block', borderRadius: 1 }} />{COPY.volume}<KindMark cls="market" /></Chip>
      <span style={mono(9.5, C.ink3)}>· {COPY.rebased}</span>
    </div>
  );
}

function SymbolFacts({ tape, doc, sym, holdings, sectorEtf }) {
  const bars = Array.isArray(doc?.bars) ? doc.bars : [];
  const { hi, lo } = extremeBars(bars);
  const role = roleOf(tape, sym, holdings);
  const sp = (path) => <TapeNum doc={doc} docLabel={`series:${sym}`} path={path} fmt={fmtPrice} size={12} />;
  return (
    <div data-region="symbol-facts" style={{ ...card, gap: 0, padding: '10px 14px 6px' }}>
      <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1, paddingBottom: 8 }}><Rec>{sym}</Rec></span>
      <Row k={COPY.inTheBook} v={<span style={mono(10.5, C.ink, { textAlign: 'right' })}><When>{role.text}</When></span>} />
      <Row k={COPY.sessionOpen} v={sp(['sessionOpen', 'value'])} />
      {hi >= 0 ? <Row k={COPY.sessionHigh} v={sp(['bars', hi, 'h'])} /> : null}
      {lo >= 0 ? <Row k={COPY.sessionLow} v={sp(['bars', lo, 'l'])} /> : null}
      {bars.length ? <Row k={COPY.lastBarClose} v={sp(['bars', bars.length - 1, 'c'])} /> : null}
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
  else if (!current) chartBody = <span style={foot}>{COPY.deepNoSeries('')}</span>;
  else if (!doc) chartBody = <span data-no-series={current} style={foot}><Rec>{COPY.deepNoSeries(current)}</Rec></span>;
  else {
    chartBody = (
      <>
        <ChartLegend sym={current} sectorEtf={sectorEtf} show={show} onToggle={toggle} />
        <div style={{ paddingBottom: 18 }}>
          <PriceChart tape={tape} doc={doc} sym={current} show={show} marketDoc={marketDoc} sectorDoc={sectorDoc} selectedMark={mark} onMark={setMark} height={desktop ? 340 : 250} />
        </div>
      </>
    );
  }
  const evidence = current && evidenceMarkers(tape, current).length ? (
    <div data-region="evidence-overlay" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...eyebrow, color: C.gold }}>{COPY.evidenceOverlay}</span>
      <span style={foot}>{COPY.evidenceOverlayNote}</span>
      <span style={foot}>{COPY.riskNote}</span>
      {mark != null ? (
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
    <Section id="deep-chart" title={`${COPY.deepPrice}${current ? ` · ${current}` : ''}`} coverage={tape.coverage?.series}>
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
