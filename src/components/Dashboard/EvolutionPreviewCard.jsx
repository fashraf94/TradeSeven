// src/components/Dashboard/EvolutionPreviewCard.jsx
//
// Compact Evolution preview — the Agent Record sheet's discoverable entry point
// on the Command Dashboard (the orb/identity taps stay as secondary entries).
// Latest 2–3 timeline entries in condensed row form (dot · title · relative
// date — no expandable narratives here) over a "View full record" affordance
// that opens AgentRecordSheet via the shell's existing recordOpen state.
//
// Timeline assembly is shared with the sheet (buildEvolutionTimeline) so the
// preview can't drift from the full record. Mobile renders it below 05 · Review
// as the loop's closing beat; desktop in the identity column under Career
// record. `style` lets each shell match its neighboring card chrome.

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { CMD, Eyebrow, Mono } from './commandUI';
import { buildEvolutionTimeline, formatRelativeDate } from '../../utils/evolutionTimeline';

const PREVIEW_COUNT = 3;

export default function EvolutionPreviewCard({ agent, accent, onOpenRecord, style }) {
  const latest = useMemo(() => buildEvolutionTimeline(agent).slice(0, PREVIEW_COUNT), [agent]);

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 16,
      background: CMD.surface, border: `1px solid ${CMD.hair}`,
      ...style,
    }}>
      <Eyebrow style={{ marginBottom: 12 }}>Evolution</Eyebrow>

      {latest.length === 0 ? (
        <div style={{ fontSize: 13, color: CMD.ink2, lineHeight: 1.5 }}>
          Play games to see your agent evolve.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {latest.map((event, i) => (
            <div key={event.eventId || `${event.type}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: event.color, flexShrink: 0 }} />
              <div style={{
                flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: CMD.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {event.title}
              </div>
              <Mono style={{ fontSize: 10, color: CMD.ink3, flexShrink: 0 }}>{formatRelativeDate(event.date)}</Mono>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={onOpenRecord}
        role="button"
        aria-label="View full agent record"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 13, paddingTop: 11, borderTop: `1px solid ${CMD.hair}`, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>View full record</span>
        <ChevronRight size={15} color={accent} />
      </div>
    </div>
  );
}
