// src/components/CommandCenter/panels/ResearchPanel.jsx
//
// Command Center hub — the Shared Research panel (spec V1.2 §8.1). Slice S1 laid the frame; slice S6 (rulings R-S6-3, R-S6-6)
// draws the equipped list's idea from the section hub/researchView.js builds out of the idea reader's answer (one state each
// of the spec's table): the gate off, an account the server does not admit, loading, no equipped list, no idea yet, a pointer
// with no matching version, the current idea, and a request error. An idea shows its exact recorded statement, the status the
// Forge shows for it, its version, time-frame and recorded times, at most two recorded research lines, "1 idea on {list}" (four
// revisions are still one) and — only for a list the agent can deploy with — the honest line about the agent.
//
// The hub writes nothing here: the only action is the Forge's Lists area, where the idea is kept and reviewed, and a Retry
// of the read. A review-due idea says so in the Forge's own words and points at the same door.

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { formatHubTime } from '../hub/hubDate';
import { HONEST_LINE, RESEARCH_STATE } from '../hub/researchView';
import { C, HAIR, MONO } from '../hub/hubStyle';
import { Card, EmptyNote, Eyebrow, HubButton, HubLink, LoadingLine, Mono, Tag } from '../HubParts';

const wrap = { overflowWrap: 'anywhere', minWidth: 0 };

/** A status's chip colour: the same status word the Forge shows, in the hub's tokens. */
const STATUS_TONE = Object.freeze({ ready: 'teal', activated: 'teal', review_due: 'copper', researched: 'gold' });

const HONEST_COPY = Object.freeze({
  [HONEST_LINE.THESIS_IS_IDEA]: COPY.research.honest.thesisIsIdea,
  [HONEST_LINE.THESIS_SAVED]: COPY.research.honest.thesisSaved,
  [HONEST_LINE.THESIS_CUT]: COPY.research.honest.thesisCut,
  [HONEST_LINE.NO_THESIS]: COPY.research.honest.noThesis,
});

/** "Retry" and, after one pressed inside the 30 s wait, when the next opens (said at the press; no timer). */
function RetryLine({ onRetry, retryNotBefore }) {
  // A wait that has ended is not said: the note is shown only while it still stands.
  const at = typeof retryNotBefore === 'number' && retryNotBefore > Date.now() ? COPY.time.et(formatHubTime(retryNotBefore, { roundUp: true })) : null;
  return (
    <div data-hub-research-retry="" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
      <HubLink onPress={onRetry}>{COPY.research.retry}</HubLink>
      {at && <span data-hub-research-wait="" style={{ fontSize: 12.5, color: C.ink3 }}>{COPY.research.retryAt(at)}</span>}
    </div>
  );
}

/** A kept answer's Retry — or, while that Retry is out, the loading line in its place (a press that is being read must show it). */
function RetryOrLoading({ research, onRetry }) {
  return research.refreshing ? <LoadingLine>{COPY.research.loading}</LoadingLine> : <RetryLine onRetry={onRetry} retryNotBefore={research.retryNotBefore} />;
}

/** An answer kept through a failed refresh says how old it is, with the Retry (spec §8.1: "retain only same-owner/list data with as-of annotation") — in every state that can be kept. */
function StaleNote({ research, onRetry }) {
  if (!research.stale) return null;
  const asOf = typeof research.asOf === 'number' ? COPY.research.asOf(COPY.time.et(formatHubTime(research.asOf))) : null;
  return (
    <div data-hub-research-stale="">
      {asOf && <div style={{ fontSize: 12.5, color: C.ink3 }}>{asOf}</div>}
      <RetryOrLoading research={research} onRetry={onRetry} />
    </div>
  );
}

function IdeaCard({ research, onRetry }) {
  const { idea } = research;
  const tone = STATUS_TONE[idea.status];
  const meta = [idea.timeFrame, idea.savedOn, idea.statusSince].filter(Boolean);
  return (
    <Card data-hub-card="idea" data-hub-idea-status={idea.status} style={{ background: C.bg, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {idea.statusLabel && <Tag tone={tone || 'teal'} dim={!tone}>{idea.statusLabel}</Tag>}
        <Mono style={{ fontSize: 11, color: C.ink3 }}>{COPY.research.version(idea.version)}</Mono>
      </div>
      <div data-hub-idea-statement="" style={{ fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.45, whiteSpace: 'pre-wrap', ...wrap }}>{idea.statement}</div>
      {meta.length > 0 && (
        <div data-hub-idea-meta="" style={{ fontFamily: MONO, fontSize: 11, color: C.ink3, lineHeight: 1.6, ...wrap }}>{meta.join(COPY.sep)}</div>
      )}
      {idea.reviewDue && (
        <div data-hub-idea-due="" style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, paddingLeft: 10, borderLeft: `2px solid ${C.copper}`, ...wrap }}>{idea.reviewDue}</div>
      )}
      {idea.research.length > 0 && (
        <ul data-hub-idea-research="" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {idea.research.map((r) => (
            <li key={r.id} style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, ...wrap }}>
              <span>{r.line}</span>
              {r.state && <span style={{ color: C.ink3 }}>{COPY.sep}{r.state}</span>}
            </li>
          ))}
        </ul>
      )}
      <div data-hub-idea-count="" style={{ fontSize: 12.5, color: C.ink3, borderTop: `1px solid ${HAIR}`, paddingTop: 10, ...wrap }}>{idea.count}</div>
      {idea.honest && <div data-hub-honest-line={idea.honest} style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.55, ...wrap }}>{HONEST_COPY[idea.honest]}</div>}
      <StaleNote research={research} onRetry={onRetry} />
    </Card>
  );
}

function Body({ research, onRetry }) {
  switch (research?.status) {
    case RESEARCH_STATE.GATE_OFF:
      return <EmptyNote icon="info" title={COPY.research.gateOff} />;
    case RESEARCH_STATE.DISABLED:
      return <EmptyNote icon="info" title={COPY.research.disabled} />;
    case RESEARCH_STATE.NO_LIST:
      return <EmptyNote icon="info" title={COPY.research.noList} />;
    case RESEARCH_STATE.NO_IDEA:
      return (
        <div>
          <EmptyNote icon="info" title={COPY.research.noIdea(research.listName)} />
          <StaleNote research={research} onRetry={onRetry} />
        </div>
      );
    case RESEARCH_STATE.UNAVAILABLE:
      return (
        <div>
          <EmptyNote icon="info" title={COPY.research.pointerUnavailable(research.listName)} />
          {research.stale ? <StaleNote research={research} onRetry={onRetry} /> : <RetryOrLoading research={research} onRetry={onRetry} />}
        </div>
      );
    case RESEARCH_STATE.ERROR:
      return (
        <div>
          <EmptyNote icon="info" title={COPY.research.error} />
          <RetryLine onRetry={onRetry} retryNotBefore={research.retryNotBefore} />
        </div>
      );
    case RESEARCH_STATE.READY:
      return <IdeaCard research={research} onRetry={onRetry} />;
    default:
      return <LoadingLine>{COPY.research.loading}</LoadingLine>;
  }
}

export default function ResearchPanel({ research, onOpenForge, onRetry }) {
  const status = research?.status || RESEARCH_STATE.LOADING;
  // Where there is nothing to open (a release or an account without records), the Forge action is not drawn.
  const door = status !== RESEARCH_STATE.GATE_OFF && status !== RESEARCH_STATE.DISABLED;
  // A review-due idea points at the Forge's review whether or not the route gave the frozen list its sentence is filled from.
  const due = status === RESEARCH_STATE.READY && research.idea?.status === 'review_due';
  return (
    <div data-hub-panel="research" data-hub-status-of={status} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* The design's header row: the eyebrow, and the action on the right (ff-stage.jsx ResearchPanel). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Eyebrow>{COPY.research.ideas}</Eyebrow>
        {door && <HubButton kind="accent" small icon="hammer" onPress={onOpenForge}>{due ? COPY.research.reviewInForge : COPY.research.openForge}</HubButton>}
      </div>
      <Body research={research} onRetry={onRetry} />
    </div>
  );
}
