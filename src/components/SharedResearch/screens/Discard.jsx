// src/components/SharedResearch/screens/Discard.jsx
//
// Shared Research — DISCARD, confirmed (spec §4.5): closes the investigation as
// abandoned (`close`, reason 'abandoned'). The record is not deleted; leaving the
// sheet instead ("Continue later") writes nothing and keeps it open.

import React from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { S } from '../sharedResearchStyle';
import { Button, Notice, Running } from '../parts';

export default function Discard({ sr, phone, onBack, onDone }) {
  const closing = sr.pending?.kind === 'close';
  const refusal = sr.failure?.action === 'close' ? sr.failure : null;
  const discard = async () => {
    const answer = await sr.close('abandoned');
    if (answer?.ok) onDone();
  };
  return (
    <div data-screen-label="Discard" style={S.col}>
      <h3 style={S.h3}>{COPY.discardTitle}</h3>
      <Notice tone="copper">{COPY.discardConfirm}</Notice>
      <p style={S.meta}>{COPY.discardAlt}</p>
      {refusal && <Notice role="alert" attrs={{ 'data-sr-refusal': refusal.code }}>{refusal.message}</Notice>}
      {closing && <Running>{COPY.discard}</Running>}
      <div style={S.actions}>
        <Button kind="danger" full={phone} disabled={sr.pending !== null || sr.waiting} onClick={discard} attrs={{ 'data-sr-discard-yes': '' }}>{COPY.discardYes}</Button>
        <Button kind="secondary" full={phone} disabled={closing} onClick={onBack}>{COPY.keep}</Button>
      </div>
    </div>
  );
}
