// src/components/Explore/ExploreShelf.jsx
//
// Explore Build 2 — THE SHELF, "Your theses" (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.2, B-16;
// build prompt K-12). Drawn from the one research read ALONE (exploreView.js shelfOf): every number and every sentence
// on it is the read's own field.
//   nothing, with access   the blank thesis sentence (words, no count, no rail: B-16), "Nothing here yet…", and the
//                          day's "{used} of {perDay} investigations used today."
//   an open one            its question; "In progress · {filled} of {parts}" and a rail from those two numbers (with
//                          `filled: null`, "In progress" and no rail); "{n} steps left"; its story's title when the
//                          story is loaded; Continue research (the sheet, mode 'session', the read's open.sessionId)
//   a saved one            "Thesis saved · {date}"; its statement when it has one, else its question; View it
//   a concluded one        "Concluded · {date}"; its question; View it
//   no access              one line (SQ-4) · the read failed: the line and Try again (one tap, one read)
// A null question or statement leaves its line out: nothing is invented in its place. The open rows keep Build 1's
// "Research in progress" attributes (it is the same list, moved onto the shelf).

import React from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { RESEARCH, dateOf, shelfOf } from './exploreView';
import { S, T } from './exploreStyle';
import { Btn, LinkBtn, Notice, StatusLine, Tag } from './exploreParts';
import { progressLineOf } from './ExplorePanel';

const COPY = EXPLORE_COPY.shelf;
const STATE = EXPLORE_COPY.state;
const CARD = EXPLORE_COPY.card;
const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
/** The most parts a rail draws segment by segment; the read's numbers past it still show in the line. */
const RAIL_MAX = 20;

/** The rail: `parts` segments, `filled` of them lit — only when the read gives both numbers. */
function Rail({ filled, parts }) {
  if (!isCount(filled) || !isCount(parts) || parts < 1 || parts > RAIL_MAX || filled > parts) return null;
  return (
    <span aria-hidden="true" data-explore-rail={`${filled}/${parts}`} style={{ display: 'flex', gap: 4, width: 120, flexShrink: 0 }}>
      {Array.from({ length: parts }, (_, i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < filled ? T.teal : T.hair }} />)}
    </span>
  );
}

function BlankSentence() {
  return (
    <p aria-label={COPY.blankLabel} data-explore-shelf-blank="" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.8, fontWeight: 500, color: T.ink2, overflowWrap: 'anywhere' }}>
      {COPY.blank.map(([kind, words], i) => (kind === 'blank'
        ? <span key={i} style={{ color: T.ink3, borderBottom: `1.5px dotted ${T.ink3}` }}>{words}</span>
        : <React.Fragment key={i}>{words}</React.Fragment>))}
    </p>
  );
}

export default function ExploreShelf({ research, byId, onContinue, onViewIt, placement }) {
  const headingId = `ftx-shelf-h-${placement}`;
  const shelf = shelfOf(research);
  const holds = Boolean(shelf) && (shelf.open.length > 0 || shelf.finished.length > 0);
  const status = research?.status ?? RESEARCH.LOADING;
  const state = holds ? 'holds' : status === RESEARCH.READY ? 'empty' : status;
  const used = shelf ? <p style={S.meta} data-explore-shelf-used="">{COPY.used(research.quota.investigationsToday, research.quota.perDay)}</p> : null;

  let body;
  if (status === RESEARCH.GATED) body = <p style={S.meta} data-explore-shelf-gated="">{COPY.gated}</p>;
  else if (status === RESEARCH.FAILED) {
    body = (
      <div style={S.section}>
        <Notice role="alert" tone="copper">{COPY.failed}</Notice>
        {/* the button leaves with the retry: focus goes to the shelf's heading first, never to <body> (review P-3) */}
        <div><Btn kind="secondary" onClick={() => { const h = document.getElementById(headingId); research.retry(); if (h) h.focus({ preventScroll: true }); }} data-explore-shelf-retry="">{COPY.tryAgain}</Btn></div>
      </div>
    );
  } else if (status !== RESEARCH.READY) body = <StatusLine>{COPY.checking}</StatusLine>;
  else if (!holds) body = <><BlankSentence /><p style={S.meta} data-explore-shelf-empty="">{COPY.empty}</p>{used}</>;
  else {
    body = (
      <>
        {shelf.open.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-explore-in-progress="">
            {shelf.open.map((it) => {
              const story = byId.get(it.storyId) ?? null;
              const o = it.open;
              return (
                <div key={it.storyId} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }} data-explore-progress-row={it.storyId}>
                  {story?.sample ? <div style={S.row}><Tag tone="copper" dim>{CARD.sample}</Tag></div> : null}
                  {o.question ? <span style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, color: T.ink, overflowWrap: 'anywhere' }} data-explore-shelf-question="">{o.question}</span> : null}
                  <div style={{ display: 'flex', alignItems: 'center', columnGap: 10, rowGap: 4, flexWrap: 'wrap' }}>
                    <Rail filled={o.filled} parts={o.parts} />
                    <span style={{ ...S.meta, color: T.teal, fontWeight: 600 }} data-explore-state="open">{progressLineOf(o)}</span>
                    {isCount(o.stepsLeft) ? <span style={S.meta} data-explore-steps="">{STATE.stepsLeft(o.stepsLeft)}</span> : null}
                  </div>
                  {story ? <p style={S.meta} data-explore-shelf-story="">{story.title}</p> : null}
                  <div><Btn kind="primary" onClick={(event) => onContinue(event, o.sessionId)} data-explore-progress-continue="">{COPY.continue}</Btn></div>
                </div>
              );
            })}
          </div>
        ) : null}
        {shelf.finished.map((it) => {
          const last = it.last;
          const saved = last.ended === 'saved';
          const words = saved ? last.statement ?? last.question : last.question;
          return (
            <div key={`${it.storyId}:${last.sessionId}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${T.hair}`, paddingTop: 12, minWidth: 0 }} data-explore-thesis-row={it.storyId} data-explore-thesis={last.ended}>
              <span style={{ ...S.meta, color: saved ? T.gold : T.ink2, fontWeight: 700 }} data-explore-state={last.ended}>
                {saved ? STATE.saved(dateOf(last.at)) : STATE.concluded(dateOf(last.at))}
              </span>
              {words ? <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: T.ink, overflowWrap: 'anywhere' }} data-explore-thesis-words={saved && last.statement ? 'statement' : 'question'}>{words}</span> : null}
              <div><LinkBtn onClick={(event) => onViewIt(event, last.sessionId)} data-explore-thesis-view="">{COPY.viewIt}</LinkBtn></div>
            </div>
          );
        })}
        <div style={{ borderTop: `1px solid ${T.hair}`, paddingTop: 12 }}>{used}</div>
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} style={{ ...S.section, gap: 12 }} data-explore-shelf={state} data-explore-shelf-placement={placement}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 id={headingId} tabIndex={-1} style={{ ...S.eyebrow, color: holds ? T.teal : T.ink3, outline: 'none' }}>{COPY.title}</h2>
        {holds ? <span style={S.meta} data-explore-shelf-counts="">{COPY.counts(shelf.openCount, shelf.finishedCount)}</span> : null}
      </div>
      {body}
    </section>
  );
}

/** Whether the shelf holds a thesis (open or finished): it then sits above the hero on a phone (Amendment B §4.1). */
export const shelfHolds = (research) => {
  const shelf = shelfOf(research);
  return Boolean(shelf) && (shelf.open.length > 0 || shelf.finished.length > 0);
};
