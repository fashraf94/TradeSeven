// src/components/SharedResearch/screens/Start.jsx
//
// Shared Research — THE OPENING SURFACE (spec §4.1, §7.2 Start): Continue your
// research (the server's open investigations, newest three) · Recent stories (the
// hub's selection, props; three shown, Show more) · Bring your own starting point
// · Use a SignalDrop. Browsing writes nothing; the only request is GET ?list=open.
// Gated (the prop, or the server's 404 disabled): the stories stay readable, the
// gated line shows, and nothing here can start an investigation.

import React, { useRef, useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S } from '../sharedResearchStyle';
import { formatDay, formatWhen, quotaStateOf, staleStoriesAt } from '../sharedResearchView';
import { Button, Eyebrow, Field, LinkButton, Notice, Running } from '../parts';

function StoryCard({ story, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={COPY.storyLabel(story.headline, story.question)}
      data-sr-story={story.itemRef?.recordId}
      style={{ appearance: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box', ...S.card, color: T.ink }}
    >
      <span style={{ ...S.small, color: T.ink2 }}>{COPY.fromFantasyTimes(story.reporterName, formatWhen(story.publishedAt) ?? '')}</span>
      <span style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{story.headline}</span>
      {story.context && <span style={{ ...S.meta }}>{story.context}</span>}
      <span style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.hair}`, background: T.surface, fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{story.question}</span>
      <span style={S.small}>{story.reason || COPY.general}</span>
    </button>
  );
}

export default function Start({ sr, stories, gated, phone, prefill, onPickStory, onFrame, onUseDrop, onContinue, onClose }) {
  const [text, setText] = useState(prefill || '');
  const [prompt, setPrompt] = useState(null);
  const [more, setMore] = useState(false);
  const boxRef = useRef(null);
  const quota = quotaStateOf(sr.quota);
  const all = Array.isArray(stories) ? stories : [];
  const shown = more ? all : all.slice(0, 3);
  const staleAt = staleStoriesAt(all, Date.now());
  const p = COPY.prompts.find((x) => x.id === prompt) ?? null;
  const busy = sr.pending !== null;
  const framing = sr.pending?.kind === 'frame';
  const frameRefusal = sr.failure?.action === 'frame' && !sr.frameState ? sr.failure : null;
  const canFrame = Boolean(text.trim()) && !gated && !quota.framingLimit && !busy && !sr.waiting;

  return (
    <div data-screen-label="Start" style={S.col}>
      {!gated && sr.list.open.length > 0 && (
        <section aria-label={COPY.continueHead} data-screen-label="Continue your research" style={S.section}>
          <Eyebrow tone="teal" as="h3">{COPY.continueHead}</Eyebrow>
          {sr.list.open.slice(0, 3).map((row) => (
            <button key={row.sessionId} type="button" onClick={(e) => onContinue(row.sessionId, e)} aria-label={COPY.continueLabel(row.question ?? '')} data-sr-continue={row.sessionId}
              style={{ appearance: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box', minHeight: 48, ...S.card, color: T.ink }}>
              <span style={S.small}>{COPY.continueRow(formatWhen(row.lastTurnAt) ?? formatWhen(row.updatedAt) ?? '', row.findingsCount ?? 0)}</span>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{row.question}</span>
            </button>
          ))}
        </section>
      )}
      {!gated && sr.list.status === 'failed' && (
        <div style={S.row}><span style={S.small}>{COPY.listFailed}</span><LinkButton onClick={sr.loadList}>{COPY.retry}</LinkButton></div>
      )}

      {gated && (
        <Notice role="status" tone="gold" attrs={{ 'data-sr-gated': '' }}>
          {COPY.gated}. {COPY.gatedSub}
        </Notice>
      )}
      {!gated && quota.dailyLimit && <Notice role="status" tone="gold" attrs={{ 'data-sr-limit': 'daily_limit' }}>{COPY.server.daily_limit}</Notice>}

      <section aria-label={COPY.stories} data-screen-label="Recent stories" style={S.section}>
        <div style={S.row}>
          <h3 style={S.h3}>{COPY.stories}</h3>
        </div>
        <p style={S.meta}>{COPY.storiesSub}</p>
        {staleAt && all.length > 0 && <Notice role="status" tone="gold" attrs={{ 'data-sr-stale': '' }}>{COPY.stale(formatDay(staleAt))}</Notice>}
        {all.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {shown.map((story) => <StoryCard key={story.itemRef?.recordId ?? story.headline} story={story} onPick={(e) => onPickStory(story, e)} />)}
          </div>
        ) : (
          <div style={S.box} data-sr-no-stories="">
            <p style={{ ...S.body, fontWeight: 600 }}>{COPY.noStories}</p>
            <p style={S.small}>{COPY.noStoriesSub}</p>
          </div>
        )}
        {all.length > 3 && <div><LinkButton expanded={more} onClick={() => setMore((v) => !v)}>{more ? COPY.fewer : COPY.more(all.length - 3)}</LinkButton></div>}
      </section>

      <section aria-label={COPY.own} data-screen-label="Bring your own starting point" style={{ ...S.section, paddingTop: 8, borderTop: `1px solid ${T.hair}` }}>
        <h3 style={S.h3}>{COPY.own}</h3>
        <div role="group" aria-label={COPY.promptsLabel} style={S.row}>
          {COPY.prompts.map((x) => (
            <Button key={x.id} kind={prompt === x.id ? 'primary' : 'secondary'} attrs={{ 'aria-pressed': prompt === x.id }} onClick={() => { setPrompt(prompt === x.id ? null : x.id); boxRef.current?.focus(); }}>{x.label}</Button>
          ))}
        </div>
        <Field id="sr-own" label={COPY.ownLabel} help={p ? p.help : COPY.ownHelp}>
          <textarea ref={boxRef} id="sr-own" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} disabled={gated || framing}
            placeholder={p ? p.example : COPY.ownExample} style={{ ...S.input, minHeight: 92, resize: 'vertical' }} />
        </Field>
        <p style={S.small}>{COPY.obsNote}</p>
        {!gated && quota.framingLimit && <Notice role="status" tone="gold" attrs={{ 'data-sr-limit': 'framing_limit' }}>{COPY.server.framing_limit}</Notice>}
        {frameRefusal && <Notice role="alert" attrs={{ 'data-sr-refusal': frameRefusal.code }}>{frameRefusal.message}</Notice>}
        {framing && <Running>{COPY.framing}</Running>}
        <div style={S.actions}>
          <Button kind="primary" full={phone} disabled={!canFrame} onClick={() => onFrame(text.trim())} attrs={{ 'data-sr-frame': '' }}>{COPY.frame}</Button>
          <Button kind="ghost" onClick={onClose}>{COPY.cancel}</Button>
        </div>
      </section>

      <div style={{ ...S.row, paddingTop: 8, borderTop: `1px solid ${T.hair}` }}>
        <Button kind="secondary" disabled={gated || busy} onClick={onUseDrop} attrs={{ 'data-sr-use-drop': '' }}>{COPY.signaldrop}</Button>
        <span style={S.small}>{COPY.signaldropHelp}</span>
      </div>
    </div>
  );
}
