// src/components/Research/ChartRead/ChartReadChecks.jsx
//
// The Chart view's read — THE CHECKS, ON THE PAGE (the 19 Nov build CP-1, PG-1 – PG-10; §6, CR-3, SH-1 – SH-5; spec
// docs/specs/CHART_READ_SPEC_V1.md V1.1). A section of the Chart view under the read, below a pinned chart — never a
// layer: no dialog role, no focus trap, no Escape of its own (PG-1). The checks are grouped by purpose; each row shows
// its two numbers, its plain definition and its mark numbers; tapping a row lights its marks on the chart and scrolls
// nothing, tapping it again clears it (PG-4). When the uptrend fails the pattern groups collapse to one line; a tap
// expands them (PG-6, SH-3).
//
// The sector rank is context, read from stockTechnicalScores/{SYM} with the existing hook (useTechnicalScore) — once,
// when the checks render (PG-9). Every word is the model's (chartRead.js checksOf → chartReadCopy.js); this file holds
// none.

import React from 'react';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import useTechnicalScore from '../useTechnicalScore.js';
import { checksOf } from './chartRead.js';
import { CHART_READ_COPY as C } from './chartReadCopy.js';

const eyebrow = (color) => ({ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color, whiteSpace: 'nowrap' });
const mono = (size, color) => ({ fontFamily: MONO, fontSize: size, color, lineHeight: 1.45 });
const bare = { all: 'unset', boxSizing: 'border-box' };
const GLYPH = { pass: ['✓', ST.green], fail: ['✗', ST.ink2], unknown: ['–', ST.ink3], quiet: ['·', ST.ink3] };

const msOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return Number.isFinite(ms) ? ms : null; } catch { return null; } }
  return null;
};
/** The sector rank's two fields from the technical score document, or null. */
export const sectorOf = (doc) => (doc && typeof doc === 'object' ? { percentile: doc.factors?.sectorRSPercentile ?? null, updatedAtMs: msOf(doc.updatedAt) } : null);

/** A mark's number in a small square (round 6 R6N); filled when lit. */
export function MarkNumber({ n, lit }) {
  return (
    <span data-mark-number={n} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: 3, border: `1px solid ${ST.ink}`, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, lineHeight: 1, color: lit ? ST.bg : ST.ink, background: lit ? ST.ink : 'transparent', flexShrink: 0 }}>{n}</span>
  );
}

function Row({ row, litKey, onRow, first, scrollMarginTop }) {
  const [glyph, color] = GLYPH[row.result] || GLYPH.unknown;
  const lit = litKey === row.key;
  const interactive = row.marks.length > 0;
  const El = interactive ? 'button' : 'div';
  return (
    <El
      {...(interactive ? { type: 'button', 'aria-pressed': lit, onClick: () => onRow(row) } : {})}
      data-check-row={row.key}
      data-check-result={row.result}
      style={{ ...bare, cursor: interactive ? 'pointer' : 'default', width: 'calc(100% + 20px)', margin: '0 -10px', padding: '11px 10px', minHeight: 44, borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start', background: lit ? tint(ST.ink, 7) : 'transparent', boxShadow: first || lit ? 'none' : `inset 0 1px 0 ${ST.hair}`, scrollMarginTop }}
    >
      <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color, width: 12, flexShrink: 0, lineHeight: 1.5 }}>{glyph}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: row.result === 'quiet' ? ST.ink2 : ST.ink }}>
          {row.name}
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{` — ${C.resultWords[row.result] ?? C.resultWords.unknown}`}</span>
        </span>
        <span style={{ ...mono(11.5, ST.ink2), display: 'flex', flexWrap: 'wrap', gap: '0 12px' }}>
          {row.sides.map(([v, k]) => <span key={`${k}${v}`}><b style={{ color: row.result === 'quiet' ? ST.ink2 : ST.ink, fontWeight: 700 }}>{v}</b>{k ? ` ${k}` : ''}</span>)}
        </span>
        <span style={{ fontSize: 12.5, color: ST.ink2, lineHeight: 1.45 }}>{row.def}</span>
      </span>
      {row.marks.length > 0 && <span style={{ display: 'flex', gap: 3, marginTop: 2 }}>{row.marks.map((n) => <MarkNumber key={n} n={n} lit={lit} />)}</span>}
    </El>
  );
}

/**
 * @param {{ body: object, symbol: string, litKey: string|null, onRow: (row) => void, expanded: boolean, onExpand: () => void,
 *   note?: string|null, scrollMarginTop?: number }} p
 *   `note`: one quiet line under the hint (FX-4: on 1W with SMA on, where marks 1 – 3 went), the copy module's words;
 *   `scrollMarginTop`: the pinned chart's height, so a row Tab reaches is brought out from under it (focus order, §8)
 */
const ChartReadChecks = React.forwardRef(function ChartReadChecks({ body, symbol, litKey, onRow, expanded, onExpand, note = null, scrollMarginTop = 0 }, ref) {
  const { data } = useTechnicalScore(symbol);
  const model = checksOf(body, { sector: sectorOf(data), expanded });
  if (!model) return null;
  return (
    <section ref={ref} aria-label={C.checksLabel} data-chart-read-checks={model.state} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 16px 20px', borderBottom: `1px solid ${ST.hair}` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span data-chart-read-hint style={mono(10.5, ST.ink2)}>{model.hint}</span>
        {note && <span data-chart-read-weekly-note style={mono(10.5, ST.ink3)}>{note}</span>}
      </div>
      {model.groups.map((g) => (g.collapsed ? (
        <button key={g.key} type="button" data-check-group="patterns" data-collapsed onClick={onExpand} aria-expanded="false" style={{ ...bare, cursor: 'pointer', minHeight: 44, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderTop: `1px solid ${ST.hair}`, scrollMarginTop }}>
          <span style={{ fontSize: 13.5, color: ST.ink2, lineHeight: 1.45 }}>{g.line}</span>
          <span style={{ fontSize: 12.5, color: ST.teal, fontWeight: 600 }}>{g.expand}</span>
        </button>
      ) : (
        <section key={g.key} data-check-group={g.key} style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={eyebrow(g.quiet ? ST.ink3 : ST.ink2)}>{g.title}</span>
            {g.sub && <span style={mono(10.5, ST.ink3)}>{g.sub}</span>}
            {g.count && <span data-check-count style={{ ...mono(10.5, g.quiet ? ST.ink3 : ST.ink2), marginLeft: 'auto' }}>{g.count}</span>}
          </span>
          {g.rows.map((r, i) => <Row key={r.key} row={r} litKey={litKey} onRow={onRow} first={i === 0} scrollMarginTop={scrollMarginTop} />)}
        </section>
      )))}
      <section data-check-group="context" style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 14, borderTop: `1px solid ${ST.hair}` }}>
        <span style={eyebrow(ST.ink3)}>{model.context.title}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: ST.ink }}>{model.context.name}</span>
        <span data-sector-rank style={mono(11.5, ST.ink2)}>{model.context.value}</span>
        <span style={{ fontSize: 12.5, color: ST.ink2, lineHeight: 1.45 }}>{model.context.def}</span>
      </section>
      {model.other.map((o) => (
        <section key={o.title} data-other-reading style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 14, borderTop: `1px solid ${ST.hair}` }}>
          <span style={eyebrow(ST.ink2)}>{o.title}</span>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: ST.ink }}>{o.text}</span>
        </section>
      ))}
      <div data-chart-read-foot style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 14, borderTop: `1px solid ${ST.hair}` }}>
        {model.foot.map((f, i) => <span key={f} style={mono(10.5, i ? ST.ink3 : ST.ink2)}>{f}</span>)}
      </div>
    </section>
  );
});

export default ChartReadChecks;
