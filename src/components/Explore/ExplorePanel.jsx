// src/components/Explore/ExplorePanel.jsx
//
// Explore Build 1 — THE PANEL BENEATH THE QUESTIONS (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.5,
// §4; build prompt K-7, K-9, K-10). Its form is chosen BY STORY from the one research read (exploreView.js formOf):
//   A  Proposed investigation — the question, editable (Explore's QUESTION_MAX, pinned to the server's), "What
//      starts with it" (only what the investigation receives in Build 1), the cost line from the read's quota, and
//      Work this idea; at the daily limit (the read's two counts) the button gives way to the limit line and Save.
//   B  Your investigation — the read's open investigation: its original question, the read's numbers, and Continue
//      research (mode 'session', open.sessionId). Choosing another question changes nothing here but the line
//      "One investigation per story": no start control exists for this story (E-5, K-10).
//   C  Finished — the read's last ended investigation (saved or concluded, and when) with View it (mode 'session',
//      last.sessionId), and form A's controls below the line.
//   D  No access — the question and what starts with it; the hub's gated line in place of the button; Save stays.
//   E  The read failed — the same, with "Couldn't check your research" and Try again (one tap, one read).
// Selecting, editing and resetting a question change only what is on screen.
//
// FOCUS (spec §9 check 5): the primary button is ONE element across forms A, B and C (a keyed child of a keyed
// block), so when the read after a close turns "Work this idea" into "Continue research", the button that opened the
// sheet — and holds focus again — is the same node.

import React, { useLayoutEffect, useRef } from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { FORMS, QUESTION_MAX, atLimitOf, dateOf } from './exploreView';
import { S, T, wash } from './exploreStyle';
import { Btn, Eyebrow, LinkBtn, Notice, SaveToggle, StatusLine } from './exploreParts';

const COPY = EXPLORE_COPY.panel;
const STATE = EXPLORE_COPY.state;
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** "In progress · {set} of {total}" when the read gives both numbers, else "In progress" (spec §3.7). */
export const progressLineOf = (open) => (Number.isSafeInteger(open.filled) && Number.isSafeInteger(open.parts) ? STATE.inProgressOf(open.filled, open.parts) : STATE.inProgress);

/** The ended line (spec §3.7), dated by the read's `at`. */
export const endedLineOf = (last) => (last.ended === 'saved' ? STATE.saved(dateOf(last.at)) : STATE.concluded(dateOf(last.at)));

function QuestionBox({ id, value, onChange, describedBy }) {
  const ref = useRef(null);
  // It grows with its text: no box on the page scrolls on its own (E-4)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      rows={2}
      maxLength={QUESTION_MAX}
      aria-describedby={describedBy}
      data-explore-question-input=""
      onChange={(e) => onChange(e.target.value)}
      style={{ ...S.input, minHeight: 70, fontWeight: 600, resize: 'none', overflow: 'hidden' }}
    />
  );
}

/** "What starts with it" (spec §4, N-3): only what the investigation receives in Build 1. */
export function StartsWithIt({ story, question }) {
  const rows = [
    ['story', COPY.startsRows.story, COPY.startsStory(story.title, story.reporter.name, dateOf(story.publishedAt))],
    ['question', COPY.startsRows.question, COPY.startsQuestion],
    question.angleLabel ? ['angle', COPY.startsRows.angle, question.angleLabel] : null,
    ['firstStep', COPY.startsRows.firstStep, COPY.startsFirstStep],
    story.tickers.length > 0 ? ['companies', COPY.startsRows.companies, COPY.startsCompanies] : null,
    question.unknown ? ['open', COPY.startsRows.open, question.unknown] : null,
  ].filter(Boolean);
  return (
    <div style={S.section} data-explore-starts="">
      <Eyebrow>{COPY.starts}</Eyebrow>
      <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
        {rows.map(([key, label, text]) => (
          <div key={key} data-explore-starts-row={key} style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: 10 }}>
            <dt style={{ ...S.eyebrow, paddingTop: 2 }}>{label}</dt>
            <dd style={{ margin: 0, fontSize: 13.5, color: T.ink, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * @param {object} p
 * @param {string} p.form             FORMS (exploreView.js formOf)
 * @param {object} p.story            the reader's story
 * @param {object} p.question         the chosen question
 * @param {string} p.value            its wording on screen (as edited)
 * @param {object|null} p.item        the read's item for this story
 * @param {object|null} p.quota       the read's quota (ready only)
 */
export default function ExplorePanel({
  form, story, question, value, onEdit, onReset, item = null, quota = null,
  saved = false, saveBusy = false, onToggleSave, saveError = null, onWork, onContinue, onViewIt, onRetry, primaryRef, refreshing = false,
}) {
  const fieldId = `ftx-q-${story.id}`;
  const helpId = `${fieldId}-help`;
  const edited = value !== question.text;
  const save = (kind) => <SaveToggle key="save" kind={kind} pressed={saved} busy={saveBusy} label={COPY.save} onToggle={onToggleSave} />;

  if (form === FORMS.LOADING) {
    return (
      <section aria-labelledby="ftx-panel-h" style={S.section} data-explore-panel="loading">
        <Eyebrow as="h3" id="ftx-panel-h">{COPY.investigation}</Eyebrow>
        <StatusLine>{COPY.checking}</StatusLine>
      </section>
    );
  }

  // D and E: the question and what starts with it, no start control, Save stays.
  if (form === FORMS.D || form === FORMS.E) {
    return (
      <section aria-labelledby="ftx-panel-h" style={{ ...S.box, gap: 14, padding: 16 }} data-explore-panel={form}>
        <Eyebrow as="h3" id="ftx-panel-h">{COPY.investigation}</Eyebrow>
        <div style={S.card}><p style={{ ...S.body, fontSize: 14.5, fontWeight: 600 }} data-explore-question-text="">{value}</p></div>
        <StartsWithIt story={story} question={question} />
        {form === FORMS.D ? (
          <Notice role="status" tone="ink2"><span data-explore-gated="">{COPY.gated}</span><br />{COPY.gatedNote}</Notice>
        ) : (
          <div style={S.section}>
            <Notice role="alert" tone="copper">{COPY.readFailed}</Notice>
            <div><Btn kind="secondary" onClick={onRetry} data-explore-retry-read="">{COPY.tryAgain}</Btn></div>
          </div>
        )}
        <div style={S.actions}>{save('secondary')}</div>
        {saveError}
      </section>
    );
  }

  const limit = atLimitOf(quota);
  const proposed = [
    <Eyebrow key="proposed-h" as={form === FORMS.A ? 'h3' : 'h4'} id={form === FORMS.A ? 'ftx-panel-h' : undefined} tone="teal">{form === FORMS.A ? COPY.proposed : COPY.newOne}</Eyebrow>,
    <div key="field" style={{ minWidth: 0 }}>
      <label htmlFor={fieldId} style={S.label}>{COPY.question}</label>
      <QuestionBox id={fieldId} value={value} onChange={onEdit} describedBy={helpId} />
      <p id={helpId} style={{ ...S.small, marginTop: 6 }}>{COPY.questionHelp}</p>
    </div>,
    edited ? <div key="reset" style={{ marginTop: -8 }}><LinkBtn onClick={onReset} data-explore-reset="">{COPY.useWording}</LinkBtn></div> : null,
    <StartsWithIt key="starts" story={story} question={question} />,
    limit ? null : <p key="cost" style={S.meta} data-explore-cost="">{COPY.cost(quota.perDay, quota.investigationsToday)}</p>,
    limit ? <Notice key="limit" role="status" tone="gold"><span data-explore-limit="">{COPY.limit(quota.perDay)}</span></Notice> : null,
  ];

  let children;
  let primary = null;
  if (form === FORMS.B) {
    const open = item.open;
    const differs = open.question === null || norm(open.question) !== norm(value);
    children = [
      <Eyebrow key="yours-h" as="h3" id="ftx-panel-h" tone="teal">{COPY.yours}</Eyebrow>,
      <Notice key="open-note" role="status" tone="teal">{COPY.open}</Notice>,
      <div key="open-card" style={{ ...S.card, border: `1px solid ${wash('teal', 0.3)}` }} data-explore-open="">
        {open.question && <p style={{ ...S.body, fontSize: 14.5, fontWeight: 600 }} data-explore-open-question="">{open.question}</p>}
        <p style={S.meta} data-explore-state="">{progressLineOf(open)}</p>
        {Number.isSafeInteger(open.stepsLeft) && <p style={S.meta} data-explore-steps="">{STATE.stepsLeft(open.stepsLeft)}</p>}
        {open.lastTurnAt && <p style={S.small}>{STATE.lastUpdate(dateOf(open.lastTurnAt))}</p>}
      </div>,
      differs ? <p key="one-per-story" role="status" style={S.meta} data-explore-one-per-story="">{COPY.onePerStory}</p> : null,
    ];
    primary = { label: COPY.continue, act: (event) => onContinue(event, open.sessionId), kind: 'continue' };
  } else if (form === FORMS.C) {
    const last = item.last;
    children = [
      <Eyebrow key="yours-h" as="h3" id="ftx-panel-h" tone="teal">{COPY.yours}</Eyebrow>,
      <div key="ended" style={{ ...S.card, gap: 10 }} data-explore-ended={last.ended}>
        <p style={{ ...S.body, fontWeight: 600 }} data-explore-state="">{endedLineOf(last)}</p>
        <div><Btn kind="secondary" onClick={(event) => onViewIt(event, last.sessionId)} data-explore-view-it="">{COPY.viewIt}</Btn></div>
      </div>,
      <hr key="rule" style={{ border: 'none', borderTop: `1px solid ${T.hair}`, margin: '4px 0', width: '100%' }} />,
      ...proposed,
    ];
    primary = limit ? null : { label: COPY.work, act: onWork, kind: 'work' };
  } else {
    children = proposed;
    primary = limit ? null : { label: COPY.work, act: onWork, kind: 'work' };
  }

  return (
    <section aria-labelledby="ftx-panel-h" style={{ ...S.box, gap: 14, padding: 16, background: wash('teal', 0.05), border: `1px solid ${wash('teal', 0.25)}` }} data-explore-panel={form}>
      {children}
      <div key="actions" style={S.actions} data-explore-actions="">
        {primary
          ? (
            <Btn
              key="primary"
              ref={primaryRef}
              kind="primary"
              disabled={primary.kind === 'work' && !value.trim()}
              ariaDisabled={refreshing}
              onClick={primary.act}
              data-explore-primary={primary.kind}
            >
              {primary.label}
            </Btn>
          )
          : save('primary')}
      </div>
      {primary ? null : saveError}
    </section>
  );
}
