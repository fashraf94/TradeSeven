// src/components/Explore/ExploreQuestions.jsx
//
// Explore Build 1 — "Questions worth working" (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.5): a real
// radio group of the story's questions, each with its angle label and its wording. Arrow keys move the choice and the
// focus (one Tab stop, on the chosen one). Choosing only prepares the panel below: nothing is read or sent.

import React from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { S, T, rowBtnStyle, wash } from './exploreStyle';

const COPY = EXPLORE_COPY.questions;

export default function ExploreQuestions({ story, selectedId, onSelect, headingRef = null }) {
  const ids = story.questions.map((q) => q.id);
  const headingId = `ftx-q-h-${story.id}`;
  const onKeyDown = (event) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = ids[(ids.indexOf(selectedId) + step + ids.length) % ids.length];
    onSelect(next);
    [...event.currentTarget.querySelectorAll('[data-explore-question]')].find((el) => el.dataset.exploreQuestion === next)?.focus();
  };
  return (
    <section aria-labelledby={headingId} style={S.section} data-explore-questions="">
      <h3 id={headingId} ref={headingRef} tabIndex={-1} style={{ ...S.h2, outline: 'none' }}>{COPY.title}</h3>
      <p style={S.meta}>{COPY.help}</p>
      <div role="radiogroup" aria-labelledby={headingId} onKeyDown={onKeyDown} style={{ display: 'grid', gap: 8 }}>
        {story.questions.map((q) => {
          const on = q.id === selectedId;
          return (
            <button
              key={q.id}
              type="button"
              role="radio"
              aria-checked={on ? 'true' : 'false'}
              tabIndex={on ? 0 : -1}
              data-explore-question={q.id}
              className="ftx-rowbtn"
              onClick={() => onSelect(q.id)}
              style={{ ...rowBtnStyle, flexDirection: 'row', gap: 12, alignItems: 'flex-start', border: `1px solid ${on ? wash('teal', 0.6) : T.hair}`, background: on ? wash('teal', 0.06) : T.surface }}
            >
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${on ? T.teal : T.ink3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                {on && <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.teal }} />}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                {q.angleLabel && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: on ? T.teal : T.ink2 }}>{q.angleLabel}</span>}
                <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: T.ink, overflowWrap: 'anywhere' }}>{q.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
