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
//
// F-1 (the fix prompt of Nov 27): the panel's heading (`ftx-panel-h`) is ONE element across every form, loading
// included (the same keyed child of the same <section>), focusable by script (tabIndex -1). Form E's Try again leaves
// the page with the retry, so the tap puts focus on that heading first (never scrolling): it holds focus while the read
// is out and after it answers — whether forms A, B or C draw, or E again, where the next Tab stop is Try again.

//
// Build 2 (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.3, §6; build prompt K-11, K-14): a broad
// question's group (its companies as tickers, in the story's order, never ordered by anything), and the words the
// compare switch (src/config/exploreFlags.js EXPLORE_COMPARE_ROUTE, read at call time inside the render) decides. With the switch off —
// as it ships — every line is §6's left column, and the word "compare" is on no screen. Form C shows the read's
// question. No figure is ever drawn.

import React, { useLayoutEffect, useRef } from 'react';
import { EXPLORE_COMPARE_ROUTE } from '../../config/exploreFlags';
import { EXPLORE_COPY } from './exploreCopy';
import { FORMS, QUESTION_MAX, atLimitOf, dateOf } from './exploreView';
import { S, T, wash } from './exploreStyle';
import { Btn, Eyebrow, LinkBtn, Notice, SaveToggle, StatusLine, Tickers } from './exploreParts';

const COPY = EXPLORE_COPY.panel;
const STATE = EXPLORE_COPY.state;
const GROUP = COPY.group;

/**
 * A broad question's group (Amendment B §6): the heading, the companies as tickers in the story's order, the line
 * under them, and — with the switch on and the story naming any — "Compares on" and its measure names, as labels.
 */
export function GroupBlock({ question, compare, onOpenCompany, notes = true }) {
  const words = compare ? GROUP.on : GROUP.off;
  return (
    <div style={S.section} data-explore-group={question.id}>
      <Eyebrow as="span">{words.heading(question.group.length)}</Eyebrow>
      <Tickers list={question.group} onOpen={onOpenCompany} />
      {notes ? <p style={S.meta} data-explore-group-note="">{words.note}</p> : null}
      {notes && compare && question.measureNames.length > 0 ? (
        <div style={S.section} data-explore-measures="">
          <Eyebrow as="span">{GROUP.on.measures}</Eyebrow>
          <div style={S.row}>
            {question.measureNames.map((m) => <span key={m} style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${T.hair}`, fontSize: 12.5, fontWeight: 600, color: T.ink, lineHeight: 1.5 }}>{m}</span>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
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
export function StartsWithIt({ story, question, compare = false }) {
  const comparing = compare && question.broad; // §6: the compare route is a broad question's, and only with the switch on
  const rows = [
    ['story', COPY.startsRows.story, COPY.startsStory(story.title, story.reporter.name, dateOf(story.publishedAt))],
    ['question', COPY.startsRows.question, COPY.startsQuestion],
    question.angleLabel ? ['angle', COPY.startsRows.angle, question.angleLabel] : null,
    ['firstStep', COPY.startsRows.firstStep, comparing ? GROUP.on.firstStep : COPY.startsFirstStep],
    comparing ? ['then', COPY.startsThen, GROUP.on.then] : null,
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
  onOpenCompany = null,
}) {
  const fieldId = `ftx-q-${story.id}`;
  const helpId = `${fieldId}-help`;
  const edited = value !== question.text;
  const save = (kind) => <SaveToggle key="save" kind={kind} pressed={saved} busy={saveBusy} label={COPY.save} onToggle={onToggleSave} />;
  const compare = EXPLORE_COMPARE_ROUTE ? true : false; // the switch, read at call time (K-2): a literal ternary, which the build folds away
  const group = question.broad ? <GroupBlock key="group" question={question} compare={compare} onOpenCompany={onOpenCompany} /> : null;
  // The panel's heading: ONE element in every form (the same key in the same <section>), so it stays through a re-read (F-1)
  const heading = (words, tone = null) => <Eyebrow key="panel-h" as="h3" id="ftx-panel-h" tabIndex={-1} tone={tone} style={{ outline: 'none' }}>{words}</Eyebrow>;

  if (form === FORMS.LOADING) {
    return (
      <section aria-labelledby="ftx-panel-h" style={S.section} data-explore-panel="loading">
        {heading(COPY.investigation)}
        <StatusLine>{COPY.checking}</StatusLine>
      </section>
    );
  }

  // D and E: the question and what starts with it, no start control, Save stays.
  if (form === FORMS.D || form === FORMS.E) {
    return (
      <section aria-labelledby="ftx-panel-h" style={{ ...S.box, gap: 14, padding: 16 }} data-explore-panel={form}>
        {heading(COPY.investigation)}
        <div style={S.card}><p style={{ ...S.body, fontSize: 14.5, fontWeight: 600 }} data-explore-question-text="">{value}</p></div>
        {group}
        <StartsWithIt story={story} question={question} compare={compare} />
        {form === FORMS.D ? (
          <Notice role="status" tone="ink2"><span data-explore-gated="">{COPY.gated}</span><br />{COPY.gatedNote}</Notice>
        ) : (
          <div style={S.section}>
            <Notice role="alert" tone="copper">{COPY.readFailed}</Notice>
            {/* the button leaves with the retry: focus goes to the panel's heading first, never to <body> (F-1) */}
            <div><Btn kind="secondary" onClick={(event) => { const h = event.currentTarget.closest('[data-explore-panel]')?.querySelector('#ftx-panel-h'); onRetry?.(); if (h) h.focus({ preventScroll: true }); }} data-explore-retry-read="">{COPY.tryAgain}</Btn></div>
          </div>
        )}
        <div style={S.actions}>{save('secondary')}</div>
        {saveError}
      </section>
    );
  }

  const limit = atLimitOf(quota);
  const proposed = [
    form === FORMS.C ? <Eyebrow key="proposed-h" as="h4" tone="teal">{COPY.newOne}</Eyebrow> : null,
    <div key="field" style={{ minWidth: 0 }}>
      <label htmlFor={fieldId} style={S.label}>{COPY.question}</label>
      <QuestionBox id={fieldId} value={value} onChange={onEdit} describedBy={helpId} />
      <p id={helpId} style={{ ...S.small, marginTop: 6 }}>{COPY.questionHelp}</p>
    </div>,
    edited ? <div key="reset" style={{ marginTop: -8 }}><LinkBtn onClick={onReset} data-explore-reset="">{COPY.useWording}</LinkBtn></div> : null,
    group,
    <StartsWithIt key="starts" story={story} question={question} compare={compare} />,
    limit ? null : <p key="cost" style={S.meta} data-explore-cost="">{COPY.cost(quota.perDay, quota.investigationsToday)}</p>,
    limit ? <Notice key="limit" role="status" tone="gold"><span data-explore-limit="">{COPY.limit(quota.perDay)}</span></Notice> : null,
  ];

  let children;
  let primary = null;
  if (form === FORMS.B) {
    const open = item.open;
    const differs = open.question === null || norm(open.question) !== norm(value);
    children = [
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
      <div key="ended" style={{ ...S.card, gap: 10 }} data-explore-ended={last.ended}>
        <p style={{ ...S.body, fontWeight: 600 }} data-explore-state="">{endedLineOf(last)}</p>
        {last.question ? <p style={{ ...S.body, fontSize: 14.5 }} data-explore-ended-question="">{last.question}</p> : null}
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
      {heading(form === FORMS.B || form === FORMS.C ? COPY.yours : COPY.proposed, 'teal')}
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
