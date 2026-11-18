// src/components/Research/ChartRead/ChartReadSheet.jsx
//
// The Chart view's read — THE SHEET (build prompt §6, CR-3, SH-1 – SH-5; round 6 B and C2; spec
// docs/specs/CHART_READ_SPEC_V1.md). Opened by tapping the read; it rises to the plot's lower edge and scrolls
// inside itself. The checks are grouped by purpose; each row shows its two numbers, its plain definition and its
// mark numbers; tapping a row lights its marks on the chart and scrolls nothing, tapping it again clears it.
//
// A LAYER (SH-4): focus moves in and is trapped; Escape closes only the sheet (its keydown stops there, so the
// modal and anything under it never sees that key); focus goes back to the read (the caller's restore).
//
// The sector rank is context, read from stockTechnicalScores/{SYM} with the existing hook (useTechnicalScore) —
// mounted only while the sheet is open, so the Chart view makes that one read only when the sheet opens.
// Every word is the model's (chartRead.js sheetOf → chartReadCopy.js); this file holds none.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import { motionToken } from '../../../theme/motion.js';
import useTechnicalScore from '../useTechnicalScore.js';
import { sheetOf } from './chartRead.js';
import { CHART_READ_COPY as C } from './chartReadCopy.js';

const eyebrow = (color) => ({ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color, whiteSpace: 'nowrap' });
const mono = (size, color) => ({ fontFamily: MONO, fontSize: size, color, lineHeight: 1.45 });
const bare = { all: 'unset', boxSizing: 'border-box' };
const GLYPH = { pass: ['✓', ST.green], fail: ['✗', ST.ink2], unknown: ['–', ST.ink3], quiet: ['·', ST.ink3] };
/** The least share of the view the sheet takes (a short screen: it rises over the plot's lower part). */
export const SHEET_MIN_SHARE = 0.4;

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

function Row({ row, litKey, onRow, first }) {
  const [glyph, color] = GLYPH[row.result] || GLYPH.unknown;
  const lit = litKey === row.key;
  const interactive = row.marks.length > 0;
  const El = interactive ? 'button' : 'div';
  return (
    <El
      {...(interactive ? { type: 'button', 'aria-pressed': lit, onClick: () => onRow(row) } : {})}
      data-check-row={row.key}
      data-check-result={row.result}
      style={{ ...bare, cursor: interactive ? 'pointer' : 'default', width: 'calc(100% + 20px)', margin: '0 -10px', padding: '11px 10px', minHeight: 44, borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start', background: lit ? tint(ST.ink, 7) : 'transparent', boxShadow: first || lit ? 'none' : `inset 0 1px 0 ${ST.hair}` }}
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
 *   onClose: () => void, viewRef: { current: HTMLElement|null }, reducedMotion?: boolean }} p
 */
export default function ChartReadSheet({ body, symbol, litKey, onRow, expanded, onExpand, onClose, viewRef, reducedMotion = false }) {
  const { data } = useTechnicalScore(symbol);
  const model = sheetOf(body, { sector: sectorOf(data), expanded });
  const rootRef = useRef(null);
  const closeRef = useRef(null);
  const fitRef = useRef(null);
  const [fit, setFit] = useState(null); // { height, rise }

  // It rises to the plot's lower edge: its height is the view's, less its own offset under the plot. On a short
  // screen (a phone on its side) that would leave too little sheet, so it takes at least SHEET_MIN_SHARE of the
  // view and rises that much over the plot's lower part.
  useLayoutEffect(() => {
    const view = viewRef?.current;
    const el = rootRef.current;
    if (!view || !el) return undefined;
    const measure = () => {
      // Where the sheet would start with no rise, inside the view (rects: the view is not its offset parent).
      const top = el.getBoundingClientRect().top + (fitRef.current?.rise ?? 0) - view.getBoundingClientRect().top + view.scrollTop;
      const under = view.clientHeight - top;
      const least = Math.round(view.clientHeight * SHEET_MIN_SHARE);
      const next = under >= least ? { height: under, rise: 0 } : { height: least, rise: least - under };
      fitRef.current = next;
      setFit(next);
    };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    if (el.previousElementSibling) ro.observe(el.previousElementSibling); // the plot above it (it yields height while the sheet is open)
    return () => ro.disconnect();
  }, [viewRef]);

  // Focus moves into the layer.
  useEffect(() => { closeRef.current?.focus?.({ preventScroll: true }); }, []);

  // The layer's keys, wherever focus is (review L3-1): a document CAPTURE listener, so Escape closes only the sheet
  // even after a tap outside it (the Rule chip, a pill, the plot, the body) and no screen beneath hears it — the
  // battle screen's suspended cockpit closes the whole research modal on a document Escape — and Tab from outside
  // comes back in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const f = [...root.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const a = document.activeElement;
      const inside = root.contains(a);
      if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  if (!model) return null;
  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={C.sheetLabel}
      data-chart-read-sheet={model.state}
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionToken('smooth', { reducedMotion })}
      style={{ position: 'relative', zIndex: 3, height: fit?.height ?? undefined, marginTop: fit?.rise ? -fit.rise : undefined, overflowY: 'auto', overscrollBehavior: 'contain', background: ST.surface, borderRadius: '18px 18px 0 0', borderTop: `1px solid ${ST.hair}`, padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box' }}
    >
      <span aria-hidden="true" style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, background: ST.hair, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: -6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...eyebrow(ST.ink2), flex: 1 }}>{C.sheetEyebrow}</span>
          <button ref={closeRef} type="button" data-chart-read-close aria-label={C.closeLabel} onClick={onClose} style={{ ...bare, cursor: 'pointer', width: 44, height: 44, marginRight: -12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" strokeWidth="2.2" strokeLinecap="round" style={{ stroke: ST.ink2 }} /></svg>
          </button>
        </div>
        <div data-chart-read-sheet-lead style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: ST.ink }}>{model.lead}</div>
        <div style={mono(10.5, ST.ink2)}>{model.hint}</div>
      </div>
      {model.groups.map((g) => (g.collapsed ? (
        <button key={g.key} type="button" data-check-group="patterns" data-collapsed onClick={onExpand} aria-expanded="false" style={{ ...bare, cursor: 'pointer', minHeight: 44, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderTop: `1px solid ${ST.hair}` }}>
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
          {g.rows.map((r, i) => <Row key={r.key} row={r} litKey={litKey} onRow={onRow} first={i === 0} />)}
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
    </motion.div>
  );
}
