// src/components/Research/ChartRead/ChartReadBand.jsx
//
// The Chart view's read — THE BAND UNDER THE PLOT (build prompt §5, round 6 A, C, D, E, F; spec
// docs/specs/CHART_READ_SPEC_V1.md). One sentence, then at most one more line, its date, its footnotes, and the
// what-changed chip above the lead. A state that opens the sheet is one button (the whole band). Every word is
// the line model's (chartRead.js readLineOf), which takes every word from chartReadCopy.js; this file holds none.
// RD-12: a failed read shows only the quiet line and Try again.

import React, { forwardRef } from 'react';
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

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: 'block', marginTop: 4 }}>
      <path d="M9 5l7 7-7 7" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: ST.ink2 }} />
    </svg>
  );
}

/**
 * @param {{ line: object|null, status: 'ready'|'failed', onOpen?: () => void, onRetry?: () => void }} p
 */
const ChartReadBand = forwardRef(function ChartReadBand({ line, status, onOpen, onRetry }, ref) {
  if (status === 'failed') {
    return (
      <div data-chart-read="failed" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', borderBottom: `1px solid ${ST.hair}` }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: ST.ink2 }}>{C.failed}</span>
        <button type="button" data-chart-read-retry onClick={onRetry} style={{ ...bare, cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px', color: ST.teal, fontSize: 13, fontWeight: 600 }}>{C.retry}</button>
      </div>
    );
  }
  if (!line) return null;
  const tap = line.opensSheet === true && typeof onOpen === 'function';
  const El = tap ? 'button' : 'div';
  return (
    <El
      ref={ref}
      {...(tap ? { type: 'button', onClick: onOpen, 'aria-haspopup': 'dialog' } : {})}
      data-chart-read={line.state}
      style={{ ...bare, cursor: tap ? 'pointer' : 'default', width: '100%', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px 13px', borderBottom: `1px solid ${ST.hair}`, textAlign: 'left' }}
    >
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
        {tap && <Chevron />}
      </span>
      {line.second && <span data-chart-read-second style={{ fontSize: 13.5, lineHeight: 1.45, color: ST.ink2, paddingLeft: 18 }}>{line.second}</span>}
      {line.notes.map((n) => <span key={n} data-chart-read-note style={{ ...mono(10.5, ST.ink3), paddingLeft: 18 }}>{n}</span>)}
      {tap && <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{C.openLabel}</span>}
    </El>
  );
});

export default ChartReadBand;
