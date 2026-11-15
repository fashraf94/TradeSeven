// src/components/Research/BattleResearch/AgentColumn.jsx
//
// Battle Research Slice 1 — THE AGENT'S COLUMN (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-13, BRS-16, §7; the
// prototype's BrExplain, BrTrail): under *{Agent} · {Archetype}*, the agent's
// explanation of the step on screen (deterministic templates from the frozen
// result, explain.js), then the history — each step with its wording and time,
// tappable to return to it — the earlier questions of this battle session, and
// *Start a different question*. On desktop it is the board's right column; on
// the phone the same content is the *Read more · history* sheet, and the first
// paragraph sits in the bottom bar, clamped to two lines (PhoneLeadBar).

import React from 'react';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import { BR_COPY } from './battleResearchCopy.js';
import { rowButton } from './ResearchRow.jsx';
import { Chip } from './ResearchBoard.jsx';

const EYEBROW = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 };

/**
 * @param {object} p
 * @param {object} p.board       boardView.boardOf(...)
 * @param {string} p.voice       *{Agent} · {Archetype}*
 * @param {Array<{ id, line, active }>} p.earlier  this session's other questions
 * @param {number} p.droppedInvestigations
 * @param {object} p.actions     { goTo, reopen, startOver }
 */
export default function AgentColumn({ board, voice, earlier = [], droppedInvestigations = 0, actions }) {
  return (
    <div data-br-agent-column style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <section data-br-explain style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ ...EYEBROW, color: ST.teal }}>{voice}</span>
        {board.paragraphs.map((p, i) => (
          <p key={`${i}:${p.slice(0, 24)}`} data-br-explain-p={i} style={{ margin: 0, fontSize: i === 0 ? 15 : 13.5, lineHeight: 1.5, color: i === 0 ? ST.ink : ST.ink2, overflowWrap: 'anywhere' }}>{p}</p>
        ))}
      </section>
      <section data-br-history style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ ...EYEBROW, color: ST.ink3 }}>{BR_COPY.history}</span>
        <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {board.history.map((h) => (
            <li key={h.stepId} style={{ listStyle: 'none' }}>
              <button
                type="button"
                data-br-history-step={h.stepId}
                aria-current={h.current ? 'step' : undefined}
                onClick={() => actions.goTo(h.stepId)}
                style={{ ...rowButton, width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '6px 10px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'baseline', background: h.current ? tint(ST.teal, 12) : 'transparent', color: h.onTrail ? ST.ink : ST.ink3 }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{h.wording}</span>
                <span style={{ fontFamily: MONO, color: ST.ink3, whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5 }}>{h.time}</span></span>
              </button>
            </li>
          ))}
        </ol>
        {board.droppedSteps ? <span style={{ color: ST.ink3 }}><span style={{ fontSize: 11 }}>{BR_COPY.historyCapped(board.droppedSteps)}</span></span> : null}
      </section>
      {earlier.length || droppedInvestigations ? (
        <section data-br-earlier style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...EYEBROW, color: ST.ink3 }}>{BR_COPY.earlierQuestions}</span>
          {earlier.map((e) => (
            <button key={e.id} type="button" data-br-earlier-question={e.id} onClick={() => actions.reopen(e.id)}
              style={{ ...rowButton, minHeight: 44, padding: '6px 10px', borderRadius: 8, color: ST.ink2, textAlign: 'left' }}>
              <span style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{e.line}</span>
            </button>
          ))}
          {droppedInvestigations ? <span style={{ color: ST.ink3 }}><span style={{ fontSize: 11 }}>{BR_COPY.investigationsCapped}</span></span> : null}
        </section>
      ) : null}
      <Chip data-br-start-over-column onClick={actions.startOver}>{BR_COPY.startOver}</Chip>
    </div>
  );
}

/** The phone's bottom bar (BRS-16): the explanation's first paragraph, clamped to two lines, and *Read more · history*. */
export function PhoneLeadBar({ lead, voice, onMore }) {
  if (!lead) return null;
  return (
    <div data-br-lead-bar style={{ flexShrink: 0, padding: '10px 12px 12px', borderTop: `1px solid ${ST.hair}`, background: ST.surface, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" data-br-lead onClick={onMore} style={{ ...rowButton, display: 'block', width: '100%', minHeight: 44, textAlign: 'left' }}>
        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13.5, lineHeight: 1.45, color: ST.ink }}>
          <b style={{ color: ST.teal, fontWeight: 700 }}>{voice}: </b>{lead}
        </span>
      </button>
      <button type="button" data-br-read-more onClick={onMore} style={{ ...rowButton, alignSelf: 'flex-start', minHeight: 44, color: ST.teal, display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{BR_COPY.readMore}</span>
      </button>
    </div>
  );
}
