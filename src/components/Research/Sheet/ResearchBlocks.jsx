// src/components/Research/Sheet/ResearchBlocks.jsx
//
// Battle Research Slice 1 — STATE 2's BLOCKS (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-17 – BRS-19; Amendment C §6;
// R-34: "the later build prepends its blocks"). Rendered ONLY when the battle
// screen hands the modal `sheetContext.research` (BattleResearch/researchContext.js);
// without it this file renders nothing and state 1 is byte-identical.
//
//   researchStrip   sticky under the pills: the original question, each
//                   refinement in its own words, the group and its count, the
//                   active conditions as chips, the readings' times,
//                   ‹ Back to ranking, the {Agent} · {Archetype} label
//   forQuestion     its place and measure, one line for it, one line against
//                   (each omitted when the evidence has none); a stock a step
//                   taken here left out of the result says why, with Undo
//   finding         today's move with its basis and time; *Use across this
//                   result* (up or down today only) with the three counts first
//   compare         Compare with {incumbent} (or a held measured stock picked
//                   here), the rows, the lock line, the tradeoff, what the
//                   evidence supports, Draft it for {Agent} · Nothing is sent
//
// Every string is the research engine's; every tap here costs no message.

import React, { useLayoutEffect, useRef, useState } from 'react';
import { ST, MONO, tint } from './sheetTheme.js';
import { BR_COPY } from '../BattleResearch/battleResearchCopy.js';

const EYEBROW = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' };
const BTN = { all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' };

function Link({ children, onClick, ...rest }) {
  return (
    <button type="button" onClick={onClick} style={{ ...BTN, color: ST.teal, padding: '0 2px' }} {...rest}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{children}</span>
    </button>
  );
}

/** The context strip (BRS-17 item 1): sticky under the pills, so the question stays with the stock. */
export function ResearchStrip({ research }) {
  // The tab strip (also sticky) sits under this one: its height goes to the scroller as --research-strip-h.
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const scroller = el?.closest?.('[data-shell-scroll]');
    if (!el || !scroller) return undefined;
    const put = () => scroller.style.setProperty('--research-strip-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    put();
    const RO = typeof ResizeObserver === 'function' ? ResizeObserver : null;
    const ro = RO ? new RO(put) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); scroller.style.removeProperty('--research-strip-h'); };
  }, []);
  return (
    <section ref={ref} data-research-strip style={{ position: 'sticky', top: 0, zIndex: 2, margin: '-16px -16px 0', padding: '10px 16px 10px', background: ST.bg, borderBottom: `1px solid ${ST.hair}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button type="button" data-research-back onClick={research.onBack} style={{ ...BTN, color: ST.teal, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{BR_COPY.backToRanking}</span>
        </button>
        <span data-research-voice style={{ flex: 1, minWidth: 0, textAlign: 'right', fontFamily: MONO, color: ST.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ fontSize: 10.5 }}>{research.voice}</span>
        </span>
      </div>
      <span data-research-question style={{ fontSize: 14, fontWeight: 700, color: ST.ink, lineHeight: 1.3 }}>{research.question.text}</span>
      {research.refinements.map((w, i) => <span key={`${w}:${i}`} style={{ color: ST.ink2 }}><span style={{ fontSize: 12 }}>{w}</span></span>)}
      <span style={{ fontFamily: MONO, color: ST.ink3, lineHeight: 1.4 }}>
        <span style={{ fontSize: 10.5 }}>{[`${research.group.label} · ${research.group.count}`, research.resultLabel, research.times.text].filter(Boolean).join(' · ')}</span>
      </span>
      {research.conditions.length ? (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {research.conditions.map((c) => (
            <span key={c.id} data-research-chip={c.id} style={{ padding: '1px 8px', borderRadius: 999, border: `1px solid ${tint(ST.teal, 45)}`, color: ST.teal }}><span style={{ fontSize: 10.5, fontWeight: 600 }}>{c.label}</span></span>
          ))}
        </span>
      ) : null}
    </section>
  );
}

/** *For this question* (BRS-17 item 2). */
export function ForThisQuestion({ research }) {
  const r = research.row;
  return (
    <section data-research-for-question style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...EYEBROW, color: ST.ink3 }}>{BR_COPY.forThisQuestion}</span>
      <span data-research-place style={{ fontFamily: MONO, color: ST.ink, lineHeight: 1.4 }}><span style={{ fontSize: 12 }}>{r.measureText}</span></span>
      {r.support ? <span data-research-support style={{ color: ST.ink, lineHeight: 1.45 }}><span style={{ fontSize: 13 }}>{r.support}</span></span> : null}
      {r.against ? <span data-research-against style={{ color: ST.ink2, lineHeight: 1.45 }}><span style={{ fontSize: 13 }}>{r.against}</span></span> : null}
      {research.left ? (
        <div role="status" data-research-left style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, border: `1px solid ${tint(ST.amber, 50)}` }}>
          <span style={{ flex: '1 1 180px', fontSize: 12.5, lineHeight: 1.45, color: ST.ink2 }}>{research.left}</span>
          <Link data-research-left-undo onClick={research.onUndo}>{BR_COPY.undo}</Link>
        </div>
      ) : null}
    </section>
  );
}

/** The finding (BRS-17 item 3) and Use across this result (BRS-18a). */
export function Finding({ research }) {
  const f = research.row.finding;
  const [confirm, setConfirm] = useState(null); // { conditionId, counts }
  const [applied, setApplied] = useState(null); // { remain }
  if (!f) return null;
  const wordsOf = (id) => (id === 'up_today' ? 'up today' : 'down today');
  return (
    <section data-research-finding style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...EYEBROW, color: ST.ink3 }}>{BR_COPY.finding}</span>
      <span style={{ fontFamily: MONO, color: ST.ink, lineHeight: 1.4 }}><span style={{ fontSize: 12 }}>{f.text}</span></span>
      {f.conditionId && !confirm ? (
        <Link data-research-use-across={f.conditionId} onClick={() => { setApplied(null); setConfirm({ conditionId: f.conditionId, replaces: f.replaces, counts: research.onUseAcross(f.conditionId) }); }}>{BR_COPY.acrossLabel}</Link>
      ) : null}
      {confirm ? (
        <div role="group" data-research-use-across-confirm style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${tint(ST.teal, 45)}` }}>
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: ST.ink2 }}>
            {BR_COPY.acrossConfirm(wordsOf(confirm.conditionId), confirm.replaces ? wordsOf(confirm.replaces) : null, confirm.counts.remain, confirm.counts.fail, confirm.counts.notAssessed)}
          </span>
          <span style={{ display: 'flex', gap: 12 }}>
            <Link data-research-apply onClick={() => { research.onApplyUseAcross(confirm.conditionId); setApplied({ remain: confirm.counts.remain }); setConfirm(null); }}>{BR_COPY.apply}</Link>
            <Link data-research-cancel onClick={() => setConfirm(null)}>{BR_COPY.cancel}</Link>
          </span>
        </div>
      ) : null}
      {applied ? (
        <span role="status" data-research-applied style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: ST.ink2 }}>
          <span style={{ fontSize: 12.5 }}>{BR_COPY.applied(applied.remain)}</span>
          <Link data-research-view-updated onClick={research.onBack}>{BR_COPY.viewUpdated}</Link>
          <Link data-research-applied-undo onClick={() => { setApplied(null); research.onUndo(); }}>{BR_COPY.undo}</Link>
        </span>
      ) : null}
    </section>
  );
}

/** Compare with {incumbent} or a held measured stock (BRS-18), and the Draft door (BRS-19). */
export function Compare({ research }) {
  const [picked, setPicked] = useState(research.compareDefault);
  const holding = research.incumbent ? research.incumbent.symbol : picked;
  const c = holding ? research.compareFor(holding) : null;
  const choices = research.incumbent ? [] : research.holdingsForCompare.filter((h) => h.symbol !== research.row.symbol);
  if (!c && !choices.length) return null;
  return (
    <section data-research-compare={holding ?? ''} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ ...EYEBROW, color: ST.ink3 }}>{research.incumbent ? BR_COPY.compareWith(research.incumbent.symbol) : BR_COPY.compareWithHolding}</span>
      {choices.length ? (
        <span role="group" aria-label={BR_COPY.pickHolding} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {choices.map((h) => (
            <button key={h.symbol} type="button" data-research-pick={h.symbol} aria-pressed={h.symbol === picked ? 'true' : 'false'} onClick={() => setPicked(h.symbol)}
              style={{ ...BTN, padding: '0 12px', borderRadius: 999, border: `1px solid ${h.symbol === picked ? ST.teal : ST.hair}`, color: h.symbol === picked ? ST.teal : ST.ink2 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{h.symbol}</span>
            </button>
          ))}
        </span>
      ) : null}
      {c ? (
        <>
          <div role="table" data-research-compare-table style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${ST.hair}` }}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 8, padding: '6px 0', borderBottom: `1px solid ${ST.hair}` }}>
              <span role="columnheader" />
              <span role="columnheader" style={{ fontFamily: MONO, color: ST.ink }}><span style={{ fontSize: 11.5, fontWeight: 700 }}>{research.row.symbol}</span></span>
              <span role="columnheader" style={{ fontFamily: MONO, color: ST.ink }}><span style={{ fontSize: 11.5, fontWeight: 700 }}>{c.holding}</span></span>
            </div>
            {c.rows.map((r) => (
              <div key={r.key} role="row" data-research-compare-row={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 8, padding: '6px 0', borderBottom: `1px solid ${ST.hair}` }}>
                <span role="rowheader" style={{ color: ST.ink3 }}><span style={{ fontSize: 11.5 }}>{r.label}</span></span>
                <span role="cell" style={{ color: ST.ink, overflowWrap: 'anywhere' }}><span style={{ fontSize: 11.5 }}>{r.cand ?? '—'}</span></span>
                <span role="cell" style={{ color: ST.ink, overflowWrap: 'anywhere' }}><span style={{ fontSize: 11.5 }}>{r.held ?? '—'}</span></span>
              </div>
            ))}
          </div>
          {c.lock ? <span data-research-lock style={{ color: ST.ink2, lineHeight: 1.45 }}><span style={{ fontSize: 12.5 }}>{c.lock}</span></span> : null}
          {c.tradeoff ? <span data-research-tradeoff style={{ color: ST.ink, lineHeight: 1.45 }}><span style={{ fontSize: 13 }}>{c.tradeoff}</span></span> : null}
          <span data-research-evidence style={{ color: ST.ink2, lineHeight: 1.45 }}><span style={{ fontSize: 13 }}>{c.evidence}</span></span>
        </>
      ) : null}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" data-research-draft onClick={() => research.onDraft(research.draftFor(holding))}
          style={{ ...BTN, padding: '0 16px', borderRadius: 12, border: `1px solid ${tint(ST.purple, 60)}`, background: tint(ST.purple, 18), color: ST.ink }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{BR_COPY.draftFor(research.agentName)}</span>
        </button>
        <span style={{ fontFamily: MONO, color: ST.ink3 }}><span style={{ fontSize: 10.5 }}>{BR_COPY.nothingSent}</span></span>
      </span>
    </section>
  );
}

/** The research blocks, in order, keyed for AnalysisBlocks (R-34). Empty without research. */
export function researchBlocks(research) {
  if (!research || typeof research !== 'object') return [];
  return [
    { key: 'researchStrip', node: <ResearchStrip research={research} /> },
    { key: 'researchForQuestion', node: <ForThisQuestion research={research} /> },
    { key: 'researchFinding', node: <Finding key={`${research.stepId}|${research.row.symbol}`} research={research} /> },
    { key: 'researchCompare', node: <Compare key={research.row.symbol} research={research} /> },
  ];
}
