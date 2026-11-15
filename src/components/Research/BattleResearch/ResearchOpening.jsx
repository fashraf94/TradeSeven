// src/components/Research/BattleResearch/ResearchOpening.jsx
//
// Battle Research Slice 1 — THE OPENING (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-5, BRS-6, §7; the
// prototype's Br2Opening): before a question, the agent proposes. The card's
// eyebrow is *{Agent} proposes*; then the proposal, the honesty line, the four
// starters as large tap targets (≥ 44 px), and the collapsed *as they stand*
// list from the evidence fetched on open. A starter that can't run says why in
// its own line (the weakest: the two no-weakest cases; What's moving: the
// calendar's line until one usable quote has arrived). Every tap: no message cost.

import React from 'react';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import { BR_COPY, STARTER_TEXT, QUESTION_IDS } from './battleResearchCopy.js';
import { rowButton, ResearchRow } from './ResearchRow.jsx';

const EYEBROW = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 };

/**
 * @param {object} p
 * @param {object} p.proposal      explain.proposalOf(...)
 * @param {string} p.agentName
 * @param {Object<string, { disabled: boolean, line: string|null }>} p.starters
 * @param {(id: string) => void} p.onAsk
 * @param {string|null} p.pending  the question whose evidence is being read
 * @param {object|null} p.failure  { questionId, why } — a failed first fetch
 * @param {{ status: string, rows: object[], unranked: object[], why: string|null }} p.asTheyStand
 * @param {(symbol: string) => void} p.onOpenRow
 */
export default function ResearchOpening({ proposal, agentName, starters, onAsk, pending = null, failure = null, asTheyStand, onOpenRow, narrow = false }) {
  return (
    <div data-br-opening style={{ width: '100%', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section data-br-proposal={proposal.kind} style={{ padding: narrow ? 14 : 18, borderRadius: 14, border: `1px solid ${tint(ST.teal, 45)}`, background: ST.surface, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ ...EYEBROW, color: ST.teal }}>{BR_COPY.proposesEyebrow(agentName)}</span>
        <p data-br-proposal-text style={{ margin: 0, fontSize: narrow ? 16 : 17, lineHeight: 1.45, color: ST.ink }}>{proposal.text}</p>
        <p data-br-honesty style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: ST.ink2 }}>{BR_COPY.honesty}</p>
        <div role="group" aria-label={BR_COPY.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {QUESTION_IDS.map((id, i) => {
            const st = starters[id] ?? { disabled: false, line: null };
            const busy = pending === id;
            return (
              <button
                key={id}
                type="button"
                data-br-starter={id}
                aria-disabled={st.disabled || !!pending ? 'true' : undefined}
                onClick={() => { if (!st.disabled && !pending) onAsk(id); }}
                style={{
                  ...rowButton, boxSizing: 'border-box', width: '100%', minHeight: 48, padding: '10px 14px', borderRadius: 12,
                  display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center',
                  background: i === 0 && !st.disabled ? tint(ST.teal, 16) : 'transparent',
                  border: `1px solid ${st.disabled ? ST.hair : tint(ST.teal, i === 0 ? 70 : 40)}`,
                  color: st.disabled ? ST.ink3 : ST.ink, cursor: st.disabled ? 'default' : 'pointer',
                }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{busy ? BR_COPY.fetching(STARTER_TEXT[id]) : STARTER_TEXT[id]}</span>
                {st.line ? <span data-br-starter-line style={{ fontFamily: MONO, color: ST.ink3, lineHeight: 1.35 }}><span style={{ fontSize: 10.5 }}>{st.line}</span></span> : null}
              </button>
            );
          })}
        </div>
        <span style={{ fontFamily: MONO, color: ST.ink3 }}><span style={{ fontSize: 10.5 }}>{BR_COPY.noCost}</span></span>
        {failure ? (
          <div role="status" data-br-failure style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1px solid ${tint(ST.red, 45)}`, color: ST.ink2 }}>
            <span style={{ fontSize: 13, lineHeight: 1.45 }}>{BR_COPY.firstFetchFailed(failure.why)}</span>
            <button type="button" data-br-retry onClick={() => onAsk(failure.questionId)} style={{ ...rowButton, alignSelf: 'flex-start', minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${ST.hair}`, color: ST.teal }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{BR_COPY.tryAgain}</span>
            </button>
          </div>
        ) : null}
      </section>
      <details data-br-as-they-stand style={{ borderTop: `1px solid ${ST.hair}` }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', color: ST.ink2 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {asTheyStand.status === 'ready' ? BR_COPY.asTheyStand(asTheyStand.rows.length) : asTheyStand.status === 'failed' ? BR_COPY.asTheyStandFailed : BR_COPY.asTheyStandLoading}
          </span>
        </summary>
        {asTheyStand.status === 'ready' ? (
          <ol style={{ margin: '4px 0 8px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {asTheyStand.rows.map((r) => <ResearchRow key={r.facts.symbol} facts={r.facts} position={r.position} lead={r.position === 1} onOpen={() => onOpenRow(r.facts.symbol)} />)}
            {asTheyStand.unranked.map((r) => <ResearchRow key={r.facts.symbol} facts={r.facts} note={r.note} onOpen={() => onOpenRow(r.facts.symbol)} />)}
          </ol>
        ) : null}
      </details>
    </div>
  );
}
