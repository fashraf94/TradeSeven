// src/components/Research/Sheet/AskReply.jsx
//
// Research Modal Build C — LAYER 2, THE REPLY CARD (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md BC-7). It renders the
// response the chat route returned — the same string chat.js persists as the
// exchange's agentResponse, so the modal and the chat show one exchange. The
// "filed to chat" chip lights only once the battle document the screen
// subscribes to holds that exchange's id. A failed turn says nothing was used
// only when the route answered before its one write (useSheetView
// NOT_CHARGED_STATUSES); otherwise it says to check chat.

import React from 'react';
import { SHEET_COPY } from './sheetCopy.js';
import { ST, MONO, tint } from './sheetTheme.js';

export default function AskReply({ view }) {
  const r = view.reply;
  if (r.status === 'sending') {
    return (
      <div data-sheet-reply="sending" style={{ ...card(ST.purple), fontStyle: 'italic', color: ST.ink2, fontSize: 13 }}>
        {SHEET_COPY.askSending(view.archetype)}
      </div>
    );
  }
  if (r.status === 'failed') {
    const line = r.charged === 'none'
      ? (r.why === 'out' ? SHEET_COPY.failNotChargedOut : r.why === 'closed' ? SHEET_COPY.failNotChargedClosed : SHEET_COPY.failNotCharged(view.archetype))
      : SHEET_COPY.failUnknown;
    return (
      <div data-sheet-reply="failed" data-sheet-charged={r.charged} role="status" style={{ ...card(ST.red), fontSize: 12.5, color: ST.ink2 }}>
        {line}
      </div>
    );
  }
  if (r.status !== 'answered') return null;
  return (
    <div data-sheet-reply="answered" style={{ ...card(ST.purple), display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: ST.purple, whiteSpace: 'nowrap' }}>
          {SHEET_COPY.replyEyebrow}
          <span style={{ color: ST.ink3, fontWeight: 500 }}> · {view.archetype}</span>
        </span>
        <div style={{ flex: 1 }} />
        {view.agentName && <Tag>{view.agentName}</Tag>}
        <Tag lit={view.filed} data-sheet-filed={view.filed ? '1' : '0'}>{view.filed ? SHEET_COPY.replyFiled : SHEET_COPY.replyFiling}</Tag>
      </div>
      <div data-sheet-reply-text style={{ fontSize: 13, fontStyle: 'italic', color: ST.ink2, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{r.reply}</div>
      {r.directive && (
        <div data-sheet-directive style={{ fontSize: 12, color: ST.ink, lineHeight: 1.35 }}>{SHEET_COPY.replyDirective(r.directive)}</div>
      )}
      <div style={{ fontFamily: MONO, fontSize: 9, color: ST.ink3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span>{SHEET_COPY.replyFrom}</span>
        <span>{SHEET_COPY.replySpent}</span>
        <span>{SHEET_COPY.replyOneExchange}</span>
      </div>
    </div>
  );
}

function card(accent) {
  return {
    borderRadius: 12, background: ST.surface, border: `1px solid ${ST.hair}`, borderLeft: `3px solid ${accent}`,
    padding: '8px 11px 9px',
  };
}

function Tag({ children, lit = false, ...rest }) {
  return (
    <span {...rest} style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700, borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap',
      color: lit ? ST.purple : ST.ink3,
      background: lit ? tint(ST.purple, 14) : 'transparent',
      border: `1px solid ${lit ? tint(ST.purple, 45) : ST.hair}`,
    }}>
      {children}
    </span>
  );
}
