// src/components/CommandCenter/sections/BriefSection.jsx
//
// Command Center hub, slice S1 — the Daily Regime Brief (the design's
// BriefSection, ff-side.jsx; spec V1.2 §8.3). S1 renders it loading, with the
// More / Less affordance present but inert: there is no body to expand. S4
// reuses the existing brief hook, which owns its read and its one retry.
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

export default function BriefSection({ brief }) {
  const phone = useHubComposition() === 'phone';
  const [open, setOpen] = useState(false);
  const body = brief?.status === 'ready' && typeof brief.body === 'string' && brief.body ? brief.body : null;
  const caption = body && brief.caption ? brief.caption : null;
  const toggle = body ? () => setOpen((v) => !v) : undefined;

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
            {body
              ? caption && <span style={{ display: 'block', fontSize: 12, color: C.ink3, marginTop: 2 }}>{caption}</span>
              : <LoadingLine style={{ marginTop: 4, fontSize: 12 }}>{COPY.brief.loading}</LoadingLine>}
          </span>
          <span style={{ color: C.ink3, display: 'flex' }}><Icon name={open ? 'chevD' : 'chevR'} size={15} /></span>
        </button>
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
          <p style={{ margin: 0, fontSize: 13.5, color: C.ink2, lineHeight: 1.5, display: open ? 'block' : '-webkit-box', WebkitLineClamp: open ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' }}>
            {body}
          </p>
        ) : (
          <LoadingLine>{COPY.brief.loading}</LoadingLine>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <HubLink onPress={toggle} ariaExpanded={body ? open : undefined} size={13}>{open ? COPY.brief.less : COPY.brief.more}</HubLink>
        </div>
      </Card>
    </Section>
  );
}
