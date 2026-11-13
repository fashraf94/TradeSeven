// src/components/SharedResearch/screens/Previews.jsx
//
// Shared Research — THE TWO PREVIEWS and the Continue state (spec §4.1, §7.2
// Item preview and Drop). Nothing is written until "Investigate this":
//   - a story: the headline, "From FantasyTimes · {reporter} · {time}", the beat's
//     question (editable), an optional direction;
//   - a drop (the SignalDrop modal's result): "Your drop · {type} · {time}", the
//     parse's topic and the names it validated, the question composed from the
//     topic (editable), an optional direction. A bailout never reaches here: the
//     unchanged modal offers no way on (ruling P-3);
//   - `existing` (a story or a drop already open — ruling P-3: one Continue state
//     for both): Continue picks it up; nothing new is created.
// The earlier investigation (`previous`) shows on the new one's work view, where
// the server first answers it (ruling P-2).

import React, { useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S, wash } from '../sharedResearchStyle';
import { formatWhen, quotaStateOf } from '../sharedResearchView';
import { Button, Eyebrow, Field, LinkButton, Notice, Running, Tag } from '../parts';
import { questionForBeat } from '../../../constants/sharedResearch';

function QuestionAndDirection({ idPrefix, question, setQuestion, direction, setDirection, disabled }) {
  return (
    <>
      <Field id={`${idPrefix}-q`} label={COPY.proposed} help={COPY.proposedHelp}>
        <textarea id={`${idPrefix}-q`} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={500} disabled={disabled}
          style={{ ...S.input, minHeight: 70, fontWeight: 600, resize: 'vertical' }} />
      </Field>
      <Field id={`${idPrefix}-dir`} label={COPY.direction} help={COPY.directionHelp}>
        <input id={`${idPrefix}-dir`} value={direction} onChange={(e) => setDirection(e.target.value)} maxLength={500} disabled={disabled}
          placeholder={COPY.directionPlaceholder} style={S.input} />
      </Field>
    </>
  );
}

function OpenControls({ sr, gated, phone, question, onInvestigate, onClose }) {
  const quota = quotaStateOf(sr.quota);
  const opening = sr.pending?.kind === 'open';
  const refusal = sr.failure?.action === 'open' ? sr.failure : null;
  return (
    <>
      <p style={S.meta}>{COPY.previewNote}</p>
      {gated && <Notice role="status" tone="gold" attrs={{ 'data-sr-gated': '' }}>{COPY.gated}. {COPY.gatedSub}</Notice>}
      {!gated && quota.dailyLimit && <Notice role="status" tone="gold" attrs={{ 'data-sr-limit': 'daily_limit' }}>{COPY.server.daily_limit}</Notice>}
      {refusal && <Notice role="alert" attrs={{ 'data-sr-refusal': refusal.code }}>{refusal.message}</Notice>}
      {opening && <Running>{COPY.opening}</Running>}
      <div style={S.actions}>
        {!gated && (
          <Button kind="primary" full={phone} disabled={!question.trim() || quota.dailyLimit || sr.pending !== null || sr.waiting} onClick={onInvestigate} attrs={{ 'data-sr-investigate': '' }}>
            {refusal ? COPY.retry : COPY.investigate}
          </Button>
        )}
        <Button kind="ghost" onClick={onClose}>{COPY.cancel}</Button>
      </div>
    </>
  );
}

export function ItemPreview({ sr, story, direction: given, gated, phone, onBack, onClose }) {
  const [question, setQuestion] = useState(story.question || questionForBeat(story.beat));
  const [direction, setDirection] = useState(given || '');
  const investigate = () => sr.openItem({ itemRef: story.itemRef, question: question.trim(), direction: direction.trim() || null });
  return (
    <div data-screen-label="Item preview" style={S.col}>
      {onBack && <div><LinkButton onClick={onBack}>{COPY.allStories}</LinkButton></div>}
      <div style={{ ...S.box, background: wash('teal', 0.05), border: `1px solid ${wash('teal', 0.25)}` }}>
        <Eyebrow tone="teal">{COPY.fromStory}</Eyebrow>
        <p style={{ ...S.body, fontSize: 16, fontWeight: 700 }}>{story.headline}</p>
        {story.context && <p style={S.meta}>{story.context}</p>}
        <div style={S.row}>
          <Tag tone="gold">{COPY.fromFantasyTimes(story.reporterName, formatWhen(story.publishedAt))}</Tag>
        </div>
      </div>
      <QuestionAndDirection idPrefix="sr-item" question={question} setQuestion={setQuestion} direction={direction} setDirection={setDirection} disabled={gated} />
      <OpenControls sr={sr} gated={gated} phone={phone} question={question} onInvestigate={investigate} onClose={onClose} />
    </div>
  );
}

export function DropPreview({ sr, drop, gated, phone, onBack, onClose }) {
  const parse = drop.parseResult?.parse ?? {};
  const topic = typeof parse.topic === 'string' ? parse.topic.trim() : '';
  const names = (drop.parseResult?.validation?.validated ?? []).map((v) => v?.symbol).filter((s) => typeof s === 'string' && s);
  const [question, setQuestion] = useState(topic ? COPY.dropQuestion(topic) : questionForBeat(null));
  const [direction, setDirection] = useState('');
  const investigate = () => sr.openDrop({ dropId: drop.dropId, question: question.trim(), direction: direction.trim() || null });
  return (
    <div data-screen-label="Drop preview" style={S.col}>
      {onBack && <div><LinkButton onClick={onBack}>{COPY.backStart}</LinkButton></div>}
      <div style={{ ...S.box, background: wash('purple', 0.06), border: `1px solid ${wash('purple', 0.3)}` }}>
        <Eyebrow tone="purple">{COPY.yourDrop(null, formatWhen(drop.at) ?? '')}</Eyebrow>
        <Eyebrow>{COPY.dropTopic}</Eyebrow>
        <p style={{ ...S.body, fontSize: 16, fontWeight: 700 }}>{topic}</p>
        <Eyebrow>{COPY.dropNames}</Eyebrow>
        {names.length ? <div style={S.row} data-sr-drop-names="">{names.map((s) => <Tag key={s} tone="teal" dim>{s}</Tag>)}</div> : <p style={S.small}>{COPY.dropNoNames}</p>}
      </div>
      <QuestionAndDirection idPrefix="sr-drop" question={question} setQuestion={setQuestion} direction={direction} setDirection={setDirection} disabled={gated} />
      <OpenControls sr={sr} gated={gated} phone={phone} question={question} onInvestigate={investigate} onClose={onClose} />
    </div>
  );
}

/** `existing: true` — a story's or a drop's investigation already open (ruling P-3: the same Continue state). */
export function ExistingContinue({ sr, phone, onClose }) {
  const row = sr.inv?.record;
  const n = row?.findings?.length ?? 0;
  return (
    <div data-screen-label="Existing investigation" style={S.col}>
      <Notice role="status" tone="teal">{COPY.existingOpen}</Notice>
      <div style={{ ...S.card, border: `1px solid ${wash('teal', 0.3)}` }}>
        <span style={S.small}>{COPY.continueRow(formatWhen(row?.lastTurnAt ?? row?.createdAt) ?? '', n)}</span>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, overflowWrap: 'anywhere' }}>{row?.question}</span>
      </div>
      <div style={S.actions}>
        <Button kind="primary" full={phone} onClick={sr.acceptExisting} attrs={{ 'data-sr-continue-existing': '' }}>{COPY.cont}</Button>
        <Button kind="ghost" onClick={onClose}>{COPY.cancel}</Button>
      </div>
    </div>
  );
}
