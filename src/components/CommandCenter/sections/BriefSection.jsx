// src/components/CommandCenter/sections/BriefSection.jsx
//
// Command Center hub, slice S1 — the Daily Regime Brief (the design's
// BriefSection, ff-side.jsx; spec V1.2 §8.3). S1 rendered it loading, with the
// More / Less affordance present but inert: there was no body to expand. Slice
// S4 (ruling R-S4-4) supplies the brief from the existing brief hook
// (hub/useHubBrief.js), which owns its read and its one retry:
//
//   loading   "Checking the brief", More / Less present and disabled (as in S1)
//   ready     the body, two lines clamped, More / Less to expand it; the caption
//             is the brief's own record and its age — "Brief for {date}", "Last
//             session's brief · for {date}" or "Brief for {date} · {n} sessions
//             old", and "Generated {day} {time} ET" only when the document
//             returned a time (hub/useHubBrief.js briefCaption)
//   collapsed a brief two to five sessions old (DRB stale fix, founder ruling
//             Oct 29 2026): the caption and More, and no body until More is
//             pressed. The phone row already holds every body behind its toggle.
//   missing   "No brief available" (also for a brief more than five sessions old)
//   error     "Couldn't load the brief · Retry"; Retry reads it again
//
// The design's "Sources · N" link is not carried: §8.3 forbids a sources
// count or sheet built from the brief's source failures. The caption is the
// brief's own recorded date / generation time, never the fetch time.
//
// Desktop, tablet and stacked: a labelled card with a two-line body. Phone: a
// collapsible row (the design's `collapsible` variant).

import React, { useState } from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, HAIR } from '../hub/hubStyle';
import { Card, HubLink, Icon, LoadingLine, Mono, Section, useHubComposition } from '../HubParts';

/** What the card says while there is no body: the wait, the absence, or the failure with its Retry. */
function BriefState({ status, onRetry, style }) {
  if (status === 'error') {
    return (
      <div data-hub-brief-state="error" style={{ fontSize: 13, color: C.ink2, lineHeight: 1.45, ...style }}>
        {COPY.brief.failed}{COPY.sep}<HubLink onPress={onRetry}>{COPY.brief.retry}</HubLink>
      </div>
    );
  }
  if (status === 'missing') {
    return <div data-hub-brief-state="missing" style={{ fontSize: 13, color: C.ink2, lineHeight: 1.45, ...style }}>{COPY.brief.missing}</div>;
  }
  return <LoadingLine style={style}>{COPY.brief.loading}</LoadingLine>;
}

export default function BriefSection({ brief, onRetry }) {
  const phone = useHubComposition() === 'phone';
  const [open, setOpen] = useState(false);
  const status = brief?.status;
  const body = status === 'ready' && typeof brief.body === 'string' && brief.body ? brief.body : null;
  const caption = body && brief.caption ? brief.caption : null;
  // An old brief's body is not drawn until More is pressed (desktop; the phone row draws none until opened anyway).
  const hidden = !!body && brief.collapsed === true && !open;
  const toggle = body ? () => setOpen((v) => !v) : undefined;
  // More / Less belongs to a body, or to the wait for one (S1's inert control); an absence or a failure has none to expand.
  const expandable = status !== 'missing' && status !== 'error';

  if (phone) {
    return (
      <section aria-label={COPY.brief.label} data-hub-section="brief" style={{ borderRadius: 16, background: C.surface, border: `1px solid ${HAIR}`, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={toggle}
          disabled={!toggle}
          aria-expanded={body ? open : undefined}
          data-hub-inset-focus=""
          style={{ appearance: 'none', font: 'inherit', color: 'inherit', background: 'transparent', border: 'none', cursor: toggle ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '10px 14px', textAlign: 'left' }}
        >
          <span style={{ display: 'block', flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.ink }}>{COPY.brief.label}</span>
            {body && caption && <span style={{ display: 'block', fontSize: 12, color: C.ink3, marginTop: 2 }}>{caption}</span>}
            {!body && status === 'missing' && <span data-hub-brief-state="missing" style={{ display: 'block', fontSize: 12, color: C.ink2, marginTop: 2 }}>{COPY.brief.missing}</span>}
            {!body && status === 'error' && <span data-hub-brief-state="error" style={{ display: 'block', fontSize: 12, color: C.ink2, marginTop: 2 }}>{COPY.brief.failed}</span>}
            {!body && expandable && <LoadingLine style={{ marginTop: 4, fontSize: 12 }}>{COPY.brief.loading}</LoadingLine>}
          </span>
          <span style={{ color: C.ink3, display: 'flex' }}><Icon name={open ? 'chevD' : 'chevR'} size={15} /></span>
        </button>
        {/* Retry sits beside the toggle, not in it: a control inside a button is not one. */}
        {status === 'error' && <div style={{ padding: '0 14px 12px' }}><HubLink onPress={onRetry}>{COPY.brief.retry}</HubLink></div>}
        {open && body && (
          <div style={{ padding: '0 14px 14px' }}>
            <p style={{ margin: 0, fontSize: 13.5, color: C.ink2, lineHeight: 1.5, textWrap: 'pretty' }}>{body}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <Section
      label={COPY.brief.label}
      data-hub-section="brief"
      right={caption ? <Mono style={{ fontSize: 10.5, color: C.ink3, whiteSpace: 'nowrap' }}>{caption}</Mono> : null}
    >
      <Card>
        {body ? (
          !hidden && (
            <p style={{ margin: 0, fontSize: 13.5, color: C.ink2, lineHeight: 1.5, display: open ? 'block' : '-webkit-box', WebkitLineClamp: open ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' }}>
              {body}
            </p>
          )
        ) : (
          <BriefState status={status} onRetry={onRetry} />
        )}
        {expandable && (
          <div style={{ display: 'flex', gap: 16, marginTop: hidden ? 0 : 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            <HubLink onPress={toggle} ariaExpanded={body ? open : undefined} size={13}>{open ? COPY.brief.less : COPY.brief.more}</HubLink>
          </div>
        )}
      </Card>
    </Section>
  );
}
