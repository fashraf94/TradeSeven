// src/components/Research/ChartRead/ChartReadBand.jsx
//
// The Chart view's read — THE BAND UNDER THE PLOT (build prompt §5, round 6 A, C, D, E, F; the 19 Nov build PG-5,
// CP-3; spec docs/specs/CHART_READ_SPEC_V1.md V1.1). One sentence, then at most one more line, today so far, its date,
// its footnotes, and the what-changed chip above the lead. It opens nothing (PG-5): the checks sit on the page under it.
// Every word is the line model's (chartRead.js readLineOf), which takes every word from chartReadCopy.js; this file
// holds none. RD-12: a failed read shows only the quiet line and Try again.

import React from 'react';
import { ST, MONO } from '../Sheet/sheetTheme.js';
import { CHART_READ_COPY as C } from './chartReadCopy.js';

const eyebrow = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color: ST.ink2, whiteSpace: 'nowrap' };
const mono = (size, color) => ({ fontFamily: MONO, fontSize: size, color, lineHeight: 1.45 });
const bare = { all: 'unset', boxSizing: 'border-box' };

/** present = filled · absent = hollow ring · wait = amber · none = a dash. Never red (round 6). */
function Glyph({ kind }) {
  const base = { width: 9, height: 9, borderRadius: 5, flexShrink: 0, marginTop: 6, boxSizing: 'border-box' };
  if (kind === 'none') return <span aria-hidden="true" data-read-glyph="none" style={{ ...base, height: 2, borderRadius: 1, marginTop: 10, background: ST.ink3 }} />;
  return <span aria-hidden="true" data-read-glyph={kind} style={{ ...base, background: kind === 'present' ? ST.green : kind === 'wait' ? ST.amber : 'transparent', border: kind === 'absent' ? `1.5px solid ${ST.ink2}` : 'none' }} />;
}

/**
 * @param {{ line: object|null, status: 'ready'|'failed', onRetry?: () => void }} p
 */
export default function ChartReadBand({ line, status, onRetry }) {
  if (status === 'failed') {
    return (
      <div data-chart-read="failed" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', borderBottom: `1px solid ${ST.hair}` }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: ST.ink2 }}>{C.failed}</span>
        <button type="button" data-chart-read-retry onClick={onRetry} style={{ ...bare, cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px', color: ST.teal, fontSize: 13, fontWeight: 600 }}>{C.retry}</button>
      </div>
    );
  }
  if (!line) return null;
  return (
    <div data-chart-read={line.state} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 13px', borderBottom: line.hasChecks ? 'none' : `1px solid ${ST.hair}` }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: '2px 8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={eyebrow}>{line.eyebrow}</span>
        {line.asOf && <span data-chart-read-asof style={mono(10.5, ST.ink2)}>{line.asOf}</span>}
      </span>
      {line.change && <span data-chart-read-change style={{ alignSelf: 'flex-start', ...mono(11, ST.ink), fontWeight: 600, border: `1px solid ${ST.hair}`, borderRadius: 6, padding: '2px 7px' }}>{line.change}</span>}
      <span style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <Glyph kind={line.glyph} />
        <span data-chart-read-lead style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4, color: ST.ink, overflowWrap: 'break-word' }}>
          {line.lead && <b style={{ fontWeight: 700 }}>{line.lead}</b>}{line.rest}
        </span>
      </span>
      {line.second && <span data-chart-read-second style={{ fontSize: 13.5, lineHeight: 1.45, color: ST.ink2, paddingLeft: 18 }}>{line.second}</span>}
      {/* CP-3: today so far — the header's price against the record's marks; no glyph, never part of the check (TD-5). */}
      {line.today && <span data-chart-read-today style={{ ...mono(11.5, ST.ink2), paddingLeft: 18 }}>{line.today}</span>}
      {line.notes.map((n) => <span key={n} data-chart-read-note style={{ ...mono(10.5, ST.ink3), paddingLeft: 18 }}>{n}</span>)}
    </div>
  );
}
