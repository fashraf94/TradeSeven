// src/components/CommandCenter/sections/ActivitySection.jsx
//
// Command Center hub, slice S1 — Recent activity (the design's
// ActivitySection, ff-side.jsx; spec V1.2 §8.2). The heading is the spec's,
// exactly: the list is a bounded projection of the ten most recent completed
// games and the current loadout, not an event history, so it never says
// "since your last visit". S1 renders it loading; S4 supplies the rows
// (hub/activityRows.js) and the sheet that holds the whole list.

import React from 'react';
import { readyRows } from '../hub/hubModel';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, HAIR, tint } from '../hub/hubStyle';
import { HubLink, Icon, LoadingLine, Mono, Row, Section } from '../HubParts';

const KIND_ICON = { completed: 'sword', deployed: 'bolt', loadout: 'pencil', idea: 'search' };

/**
 * The list itself, as the section and the activity sheet both draw it. A row opens something only when it names a game
 * (`battleId`): a loadout row is a fact, not a destination.
 */
export function ActivityRows({ items, onOpen }) {
  return (
    <div data-hub-activity-list="" style={{ display: 'flex', flexDirection: 'column', borderRadius: 14, border: `1px solid ${HAIR}`, background: C.bg, overflow: 'hidden' }}>
      {items.map((e, i) => (
        <Row
          key={e.id}
          onPress={onOpen && e.battleId ? () => onOpen(e) : undefined}
          ariaLabel={COPY.activity.rowLabel(e.text, e.sub, e.at)}
          style={{ minHeight: 52, padding: '9px 12px', borderTop: i ? `1px solid ${HAIR}` : 'none', borderRadius: 0 }}
          right={<Mono style={{ fontSize: 10, color: C.ink3, whiteSpace: 'nowrap', flexShrink: 0 }}>{e.at}</Mono>}
        >
          <span data-hub-activity-row={e.kind || ''} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint('teal', 0.1), flexShrink: 0, marginTop: 1, color: C.teal }}>
              <Icon name={KIND_ICON[e.kind] || 'dot'} size={13} />
            </span>
            <span style={{ display: 'block', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.ink }}>{e.text}</span>
              {e.sub && <span style={{ display: 'block', fontSize: 12, color: C.ink3, marginTop: 2, lineHeight: 1.4, textWrap: 'pretty' }}>{e.sub}</span>}
            </span>
          </span>
        </Row>
      ))}
    </div>
  );
}

/**
 * With a `limit` (the phone Overview's three rows, the side column's ten) and more rows than it, the design's "All activity
 * · N" link follows — N is the projection's own length — and opens the activity sheet (slice S4).
 */
export default function ActivitySection({ activity, limit = null, onOpen, onAll }) {
  const ready = activity?.status === 'ready';
  const failed = activity?.status === 'error';
  const rows = readyRows(activity);
  const items = limit ? rows.slice(0, limit) : rows;
  return (
    <Section label={COPY.activity.label} data-hub-section="activity">
      {!ready && !failed && <LoadingLine>{COPY.activity.loading}</LoadingLine>}
      {failed && <div data-hub-activity-note="error" style={{ fontSize: 13, color: C.ink2 }}>{COPY.activity.unavailable}</div>}
      {ready && items.length === 0 && <div style={{ fontSize: 13, color: C.ink3 }}>{COPY.activity.empty}</div>}
      {ready && items.length > 0 && <ActivityRows items={items} onOpen={onOpen} />}
      {ready && limit && rows.length > limit && (
        <div><HubLink onPress={onAll}>{COPY.activity.all(rows.length)}</HubLink></div>
      )}
    </Section>
  );
}
