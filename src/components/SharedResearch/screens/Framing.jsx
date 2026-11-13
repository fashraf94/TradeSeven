// src/components/SharedResearch/screens/Framing.jsx
//
// Shared Research — FRAMING (spec §4.1 own words, §7.2 Framing): the player's
// words (theirs, literal, "Your observation"), the one framing call while it is in
// flight, then the proposed question (editable), what will be checked and what
// it does not establish → "Investigate this" opens the record with the question
// the player confirmed. A failed framing keeps the words: Try again re-sends the
// same request id; "Edit my words" closes the framed session and returns them.

import React, { useEffect, useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { S, wash } from '../sharedResearchStyle';
import { Button, Eyebrow, Field, LinkButton, Notice, Running, StatusTag } from '../parts';

export default function Framing({ sr, phone, onEditWords, onClose }) {
  const fs = sr.frameState;
  const [question, setQuestion] = useState(fs?.frame?.question ?? '');
  const [direction, setDirection] = useState('');
  useEffect(() => { if (fs?.frame?.question) setQuestion(fs.frame.question); }, [fs?.frame?.question]);
  if (!fs) return null;
  const running = sr.pending?.kind === 'frame';
  const opening = sr.pending?.kind === 'open';
  const refusal = sr.failure && (sr.failure.action === 'open' || sr.failure.action === 'frame') ? sr.failure : null;
  return (
    <div data-screen-label={`Framing · ${running ? 'running' : fs.status}`} style={S.col}>
      <div style={{ ...S.box, background: wash('purple', 0.06), border: `1px solid ${wash('purple', 0.3)}` }}>
        <Eyebrow tone="purple">{COPY.yourObs}</Eyebrow>
        <p style={{ ...S.body, fontSize: 15.5 }}>{fs.observation}</p>
        <div style={S.row}><StatusTag finding={{ kind: 'observation', status: 'unverified', statusReason: 'player_words' }} /></div>
      </div>
      {running && <Running>{COPY.framing}</Running>}
      {!running && fs.status === 'failed' && (
        <>
          <Notice role="alert" attrs={{ 'data-sr-refusal': refusal?.code ?? 'frame_failed' }}>{refusal?.message ?? COPY.server.frame_failed}</Notice>
          <div style={S.actions}>
            <Button kind="primary" disabled={sr.pending !== null || sr.waiting} onClick={sr.retryFrame} attrs={{ 'data-sr-retry-frame': '' }}>{COPY.retry}</Button>
            <Button kind="secondary" disabled={sr.pending !== null} onClick={onEditWords}>{COPY.editWords}</Button>
            <Button kind="ghost" onClick={onClose}>{COPY.later}</Button>
          </div>
        </>
      )}
      {!running && fs.status === 'framed' && fs.frame && (
        <>
          <Field id="sr-frame-q" label={COPY.proposed} help={COPY.proposedHelp}>
            <textarea id="sr-frame-q" value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={500} style={{ ...S.input, minHeight: 70, fontWeight: 600, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div style={S.box}><Eyebrow>{COPY.willCheck}</Eyebrow><p style={S.body}>{fs.frame.check}</p></div>
            <div style={S.box}><Eyebrow>{COPY.notEst}</Eyebrow><p style={S.body}>{fs.frame.notEstablished}</p></div>
          </div>
          <Field id="sr-frame-dir" label={COPY.direction} help={COPY.directionHelp}>
            <input id="sr-frame-dir" value={direction} onChange={(e) => setDirection(e.target.value)} maxLength={500} placeholder={COPY.directionPlaceholder} style={S.input} />
          </Field>
          {refusal && refusal.action === 'open' && <Notice role="alert" attrs={{ 'data-sr-refusal': refusal.code }}>{refusal.message}</Notice>}
          {opening && <Running>{COPY.opening}</Running>}
          <div style={S.actions}>
            <Button kind="primary" full={phone} disabled={!question.trim() || sr.pending !== null || sr.waiting}
              onClick={() => sr.openFramed({ sessionId: fs.sessionId, question: question.trim(), direction: direction.trim() || null })} attrs={{ 'data-sr-investigate': '' }}>
              {COPY.investigate}
            </Button>
            <Button kind="ghost" onClick={onClose}>{COPY.later}</Button>
            <LinkButton tone="copper" disabled={sr.pending !== null} onClick={onEditWords}>{COPY.editWords}</LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
