// src/components/SharedResearch/screens/Builder.jsx
//
// Shared Research — THE THESIS BUILDER'S VIEW (B4 build prompt K-2, K-4 to K-17;
// Amendment B §B7; design of record R3 / R3b on C-B, phone 390 and desktop D1).
// The body draws it for a session whose view carries `shape: 'builder'` — the
// SESSION decides, never the flag (K-2). Every other session keeps today's Work.
//
//   the work view — the sentence card (folding to its strip as the sheet scrolls),
//     the conversation (session.exchanges as stored), the part in front's choices
//     directly under it (research and free drawn apart), and the pinned composer.
//     One column unless the sheet itself is at least 880 px wide (the phone round,
//     P-1); one scroll, the sheet's (P-2);
//   the ready view (ThesisReady) — the server's sentence, "How it will be judged",
//     Save thesis with the uncertain save;
//   the saved view (ThesisSaved) — today's state only (DR-7).
//
// RENDER, NEVER DECIDE (K-4): the card, `filled`, `ready`, `blockers`, `sentence`,
// `pick`, `saveIssue` and every choice are drawn as received; every button is one
// entry of `thesis.choices`, sent back as offered (thesisView.js only orders them).
// One request at a time, taps included (K-16): every action goes through the hook's
// single `run`, and every control is disabled while one is in flight.

import React, { useEffect, useId, useRef, useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S, wash } from '../sharedResearchStyle';
import { directionOfStep, evidenceOf, findingsById, formatDay, remainingOf, stateOf } from '../sharedResearchView';
import {
  footOf, panelOf, conversationOf, hasSuggestedPart, partOfGoal, directionOffered, revisedWhyChoiceOf, horizonLabelOf, themeLineOf,
} from '../thesisView';
import {
  CardHead, CardLine, CHOICES, ClearConfirm, Composer, Count, Cover, EvidenceList, FOOT, FreeButton, KeepReasons, Mark, Mine, MoreActions, NamesPick, PartPanel,
  PriceLines, Rail, ResearchButton, Said, Sentence, Strip, ThemeLine, WhyBlock, WhyProposal, WRAP, basisTagOf, freeLabelOf, researchLabelOf, usePanelInView,
  scrollParentOf, STRIP_ROOM, useFootRoom, useFocusKept, useWideEnough,
} from '../builderParts';
import { Button, LinkButton, Notice, Running, Tag } from '../parts';
import ThesisReady from './ThesisReady';
import ThesisSaved from './ThesisSaved';

const B = COPY.builder;
const RETRYABLE = new Set(['step_failed', 'network', 'step_in_flight', 'server_error']);


/**
 * A list of free choices as buttons (K-5): the names pick and the why's "keep some" draw their own inputs; Change and a
 * drop that clears ask first (K-8) through `onFree`.
 */
export function FreeChoices({ choices, thesis, companies, agentName, onFree, disabled }) {
  const pickConfirm = choices.find((c) => c.op === 'confirm' && c.part === 'names') ?? null;
  return choices.map((c, i) => {
    const key = `${c.op}:${c.part}:${JSON.stringify(c.value ?? c.options ?? null)}:${i}`;
    if (c.op === 'set' && c.part === 'names' && Array.isArray(c.options)) {
      return <NamesPick key={key} choice={c} pickConfirm={pickConfirm} thesis={thesis} companies={companies} agentName={agentName} disabled={disabled}
        onSend={(symbols) => onFree(c, symbols)} onConfirmPick={() => onFree(pickConfirm)} />;
    }
    if (c === pickConfirm && choices.some((x) => x.op === 'set' && x.part === 'names' && Array.isArray(x.options))) return null; // drawn inside the names pick
    if (c.op === 'set' && c.part === 'why' && Array.isArray(c.options)) {
      return <KeepReasons key={`${key}:${thesis?.rev ?? 0}`} choice={c} proposal={thesis?.parts?.why?.proposal} agentName={agentName} disabled={disabled} onSend={(value) => onFree(c, value)} />;
    }
    const look = freeLabelOf(c, thesis, agentName);
    return <FreeButton key={key} {...look} disabled={disabled} onClick={() => onFree(c)} attrs={{ 'data-sr-free': `${c.op}:${c.part}`, 'data-sr-free-value': typeof c.value === 'string' ? c.value : JSON.stringify(c.value ?? null) }} />;
  });
}

/** The asked pick (DR-2; K-10): the value and its reasons, each tagged from its own basis. Nothing is set by it. */
function AskedPick({ pick, agentName }) {
  const value = Array.isArray(pick.value) ? pick.value.join(', ') : pick.part === 'timeFrame' ? horizonLabelOf(pick.value) ?? pick.value : pick.value;
  const reasonTag = basisTagOf(pick.basis, agentName);
  return (
    <div style={{ ...S.card, gap: 8, border: `1px dashed ${wash('teal', 0.5)}` }} data-sr-asked-pick={pick.part}>
      <div style={S.row}><Mark tone="teal">{B.pickTag(agentName)}</Mark><Mark>{B.suggested}</Mark></div>
      <p style={{ ...S.body, ...WRAP, fontWeight: 700 }}>{value}</p>
      {pick.reason && <p style={{ ...S.meta, ...WRAP }}>{pick.reason} <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Tag tone={reasonTag.tone}>{reasonTag.text}</Tag></span></p>}
      {(pick.reasons ?? []).map((r, i) => {
        const tag = basisTagOf(r.basis, agentName);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 6, fontSize: 13.5, lineHeight: 1.45, color: T.ink }} data-sr-pick-basis={r.basis}>
            <span style={{ fontSize: 12, color: T.ink3 }}>{String(i + 1)}</span>
            <span>{r.text} <span style={{ display: 'inline-flex', gap: 6, verticalAlign: 'middle' }}><Tag tone={tag.tone}>{tag.text}</Tag>{r.basis === 'source' && <Count n={r.findingIds?.length ?? 0} />}</span></span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A thesis Save's refusal (K-12), wherever the builder stands: the server's line, and `not_ready`'s blockers. The ready
 * view draws it beside Save; the work view draws it when the card the refusal brought is no longer ready (review 4B-3).
 */
export function SaveOutcome({ sr, sessionId, rev }) {
  if (sr.save.sessionId !== sessionId || !['failed', 'stale'].includes(sr.save.status) || sr.save.atRev !== rev) return null;
  const blockers = sr.save.status === 'failed' && Array.isArray(sr.save.blockers) ? sr.save.blockers : null;
  return (
    <>
      <Notice role="alert" tone={sr.save.status === 'stale' ? 'gold' : 'copper'} attrs={{ 'data-sr-save': sr.save.status }}>{sr.save.message}</Notice>
      {blockers && blockers.length > 0 && <p style={{ ...S.small, ...WRAP }} data-sr-blockers="">{B.stillToSet(blockers.map((b) => B.parts[b.part] ?? b.part).join(', '))}</p>}
    </>
  );
}

function BuilderWork({ sr, agentName, phone, wide, open, viewingEarlier, onBackToCurrent, onOpenEarlier, onDiscard, onNewInvestigation, onClose, onAllEvidence, onBackToThesis }) {
  const { session, record, companies, thesis, previous } = sr.inv;
  const state = stateOf(session, record);
  const [tapped, setTapped] = useState(null);
  const [clearAsk, setClearAsk] = useState(null);
  const [folded, setFolded] = useState(false);
  const cardRef = useRef(null);
  const stripRef = useRef(null);
  const footRef = useRef(null);
  const logRef = useRef(null);
  const seenRows = useRef(null);
  const panelId = `sr-part-panel${useId()}`;
  const leadId = `sr-lead${useId()}`;
  const foot = footOf(thesis);
  const stepsLeft = remainingOf(session);
  const busy = sr.pending !== null || sr.waiting;
  const running = sr.running;
  const working = running ? partOfGoal(sr.pending?.goal, sr.pending?.part) : null;
  const byId = findingsById(record);
  const deadEnd = open && Boolean(thesis.parts?.names?.blocked);
  const outOfSteps = open && (thesis.choices?.research ?? []).length === 0;
  const rows = conversationOf(session);
  const lastSaid = rows.reduce((at, r, i) => (r.kind === 'said' ? i : at), -1);
  const last = session.lastStep ?? null;
  const textChoice = deadEnd ? null : foot.text;
  const hasComposer = open && Boolean(textChoice || directionOffered(thesis));
  const themeLine = open ? themeLineOf(thesis) : null; // §B13 T-6: a suggested theme's line, at the top of the choices

  // K-7: in one column the card folds to its strip once the sheet has scrolled it away (P-1: the sheet's real width).
  useEffect(() => {
    if (wide) { setFolded(false); return undefined; }
    const card = cardRef.current;
    const scroller = scrollParentOf(card);
    if (!card || !scroller) return undefined;
    const check = () => {
      const c = card.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      const next = c.height !== 0 && s.top + 12 > c.bottom;
      // the strip is about to go with focus inside it (its unfold, its "⋯", Discard): focus goes to the card (5C-4)
      if (!next && stripRef.current?.contains(document.activeElement)) card.focus({ preventScroll: true });
      setFolded(next);
    };
    scroller.addEventListener('scroll', check, { passive: true });
    check();
    return () => scroller.removeEventListener('scroll', check);
  }, [wide]);
  const unfold = () => {
    cardRef.current?.scrollIntoView?.({ block: 'start' });
    cardRef.current?.focus?.({ preventScroll: true });
  };
  usePanelInView(tapped, panelId, footRef);
  // A new turn (a reply, a card line) scrolls in by its TOP, its choices under it (the phone round, P-2); not on the
  // first draw, which shows the card. The sheet's scroll padding keeps it clear of the strip.
  useEffect(() => {
    const before = seenRows.current;
    seenRows.current = rows.length;
    if (before === null || rows.length <= before) return;
    const first = logRef.current?.querySelector(`[data-sr-row="${before}"]`);
    if (!first?.scrollIntoView) return;
    first.style.scrollMarginTop = '8px';
    first.scrollIntoView({ block: 'start' });
  }, [rows.length]);

  // K-8: a Change that clears other parts (and a drop that clears the price lines) asks first; everything else is sent.
  // The confirm opens beside the control that asked (review 4C-2): in the choices for theirs, in the card for a panel's.
  const onFree = (choice, input, where = 'card') => {
    if (Array.isArray(choice.clears) && choice.clears.length > 0 && (choice.op === 'clear' || choice.reason === 'drop_unsourced')) {
      setClearAsk({ choice, where });
      return null;
    }
    return sr.cardOp(choice, input);
  };
  const onFreeInChoices = (choice, input) => onFree(choice, input, 'choices');
  const confirmClear = async () => {
    const choice = clearAsk?.choice ?? null;
    setClearAsk(null);
    if (choice) await sr.cardOp(choice);
  };
  const askFor = (where) => (open && clearAsk?.where === where
    ? <ClearConfirm choice={clearAsk.choice} disabled={busy} onConfirm={confirmClear} onCancel={() => setClearAsk(null)} />
    : null);
  // the panel's close puts focus back on its part (review 4C-1)
  const closePanel = () => {
    const part = tapped;
    setTapped(null);
    setTimeout(() => cardRef.current?.querySelector(`[data-sr-slot="${part}"]`)?.focus({ preventScroll: true }), 0);
  };
  useFootRoom(footRef, { top: wide ? 0 : STRIP_ROOM, active: open, anchorRef: cardRef, present: hasComposer });
  const research = (g) => sr.buildStep({ goal: g.goal, part: g.part ?? null });
  const more = (where) => (open ? <MoreActions onDiscard={onDiscard} disabled={busy} where={where} /> : null);

  // the failures (K-15): the one this page saw, or the session's (a reopened sheet)
  const seen = sr.failure?.action === 'step' && sr.failure.attempt?.builder ? sr.failure : null;
  const recordedDirection = last?.status === 'failed' ? directionOfStep(session, last.stepId) : null;
  const recorded = !seen && last?.status === 'failed'
    ? { code: 'step_failed', reason: last.error ?? null, message: last.error === 'findings_full' ? COPY.server.findings_full : COPY.server.step_failed, attempt: recordedDirection ? { builder: true, stepId: last.stepId, goal: 'direction', part: null, direction: recordedDirection } : null }
    : null;
  const stepFailure = seen ?? recorded;
  const retry = stepFailure && RETRYABLE.has(stepFailure.code) && stepFailure.reason !== 'findings_full' && stepFailure.attempt ? stepFailure.attempt : null;
  const staleRunning = !running && last?.status === 'running';
  const cardFailure = sr.failure?.action === 'card' ? sr.failure : null;
  const closeRefusal = sr.failure?.action === 'close' ? sr.failure : null;
  const readFailure = sr.failure?.action === 'read' ? sr.failure : null;
  const suggestionWaiting = sr.stepOutcome?.cardChanged === true && sr.stepOutcome.stepId === last?.stepId && hasSuggestedPart(thesis);
  // the choices that end the sentence read as its ending (the phone round, P-7)
  const lead = foot.values.length > 0 ? (foot.part === 'wrongIf' ? B.leadWrongIf : foot.part === 'timeFrame' ? B.leadTimeFrame : null) : null;

  const panel = tapped ? panelOf(thesis, tapped) : null;
  const card = (
    <section ref={cardRef} tabIndex={-1} aria-label={B.thesis} data-sr-card="" style={{ ...S.box, gap: 12, outline: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CardHead thesis={thesis} stepsLeft={stepsLeft} more={more('card')} />
        <Rail thesis={thesis} working={working} />
      </div>
      <Sentence thesis={thesis} working={working} tapped={tapped} onTap={setTapped} panelId={panelId} agentName={agentName} />
      {panel && (
        <PartPanel id={panelId} part={tapped} thesis={thesis} companies={companies} byId={byId} agentName={agentName} onClose={closePanel}
          change={open ? panel.change : null} onChange={() => onFree(panel.change)}>
          {open && panel.revised && (
            <>
              <WhyProposal proposal={thesis.parts.why.proposal} agentName={agentName} title={B.revised} attrs={{ 'data-sr-revised-proposal': '' }} />
              <FreeButton {...freeLabelOf(panel.revised, thesis, agentName)} disabled={busy} onClick={() => onFree(panel.revised)} attrs={{ 'data-sr-free': 'confirm:why:revised' }} />
            </>
          )}
          {open && panel.priceLines && <PriceLines choice={panel.priceLines} lines={thesis.parts.wrongIf.priceLines} disabled={busy} onSend={(value) => sr.cardOp(panel.priceLines, value)} />}
          {open && <FreeChoices choices={panel.values} thesis={thesis} companies={companies} agentName={agentName} onFree={onFree} disabled={busy} />}
          {open && panel.skip && <FreeButton label={B.skipSegment} disabled={busy} onClick={() => onFree(panel.skip)} attrs={{ 'data-sr-free': 'set:segment:skip' }} />}
          {open && panel.research.map((g) => <ResearchButton key={`${g.goal}:${g.part ?? ''}`} label={researchLabelOf(g)} stepsLeft={stepsLeft} disabled={busy} onClick={() => research(g)} attrs={{ 'data-sr-research': `${g.goal}${g.part ? `:${g.part}` : ''}` }} />)}
          {open && panel.text && <Composer textChoice={panel.text} directionOn={false} agentName={agentName} disabled={busy} onFree={(c, words) => sr.cardOp(c, { text: words })} onDirection={() => null} />}
        </PartPanel>
      )}
      {askFor('card')}
      {['set', 'stale'].includes(thesis.parts?.why?.state) && <WhyBlock thesis={thesis} agentName={agentName} folded={foot.part !== null && foot.part !== 'why'} />}
      <div style={{ ...S.row, justifyContent: 'flex-end' }}>
        {open && revisedWhyChoiceOf(thesis) && tapped !== 'why' && <LinkButton onClick={() => setTapped('why')} attrs={{ 'data-sr-revised-waiting': '' }}>{B.revisedWaiting}</LinkButton>}
        {(thesis.filled ?? 0) > 1 && <LinkButton onClick={onAllEvidence} attrs={{ 'data-sr-all-evidence-open': '' }}>{`${B.allEvidence} ›`}</LinkButton>}
      </div>
    </section>
  );

  const conversation = (
    <section ref={logRef} role="log" aria-label={COPY.exchanges} data-sr-conversation="" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, padding: '4px 0' }}>
      {viewingEarlier && (
        <>
          <div><LinkButton disabled={busy} onClick={onBackToCurrent}>{COPY.backToCurrent}</LinkButton></div>
          <Notice role="status" tone="teal">{COPY.earlierNote}</Notice>
        </>
      )}
      {onBackToThesis && <div><LinkButton onClick={onBackToThesis} attrs={{ 'data-sr-back-to-thesis': '' }}>{B.backToThesis}</LinkButton></div>}
      {readFailure && <Notice role="alert" attrs={{ 'data-sr-read-failed': readFailure.code }}>{readFailure.code === 'network' ? COPY.loadFailed : readFailure.message}</Notice>}
      {!viewingEarlier && previous && (
        <div style={S.row} data-sr-previous={previous.sessionId}>
          <span style={{ ...S.meta, ...WRAP }}>{COPY.previous(formatDay(previous.endedAt) ?? '')}</span>
          <LinkButton disabled={busy} onClick={() => onOpenEarlier(previous.sessionId)}>{COPY.openEarlier}</LinkButton>
        </div>
      )}
      {rows.map((row, i) => {
        const at = { 'data-sr-row': i };
        // the agent's latest reply in full; each earlier one folds to two lines with More (P-5)
        if (row.kind === 'said') return <Said key={row.key} name={agentName} text={row.text} folded={i !== lastSaid} attrs={{ ...at, 'data-sr-said': '' }} />;
        if (row.kind === 'card') return <CardLine key={row.key} attrs={{ ...at, 'data-sr-card-line': '' }}>{B.cardLine(row.text)}</CardLine>;
        if (row.kind === 'tap') return <Mine key={row.key} tag={B.stepUsed} attrs={{ ...at, 'data-sr-tap': row.goal }}>{researchLabelOf({ goal: row.goal, part: row.part })}</Mine>;
        if (row.kind === 'words') return <Mine key={row.key} tag={B.yourWordsTag} attrs={{ ...at, 'data-sr-words': '' }}>{row.text}</Mine>;
        if (row.kind === 'direction') return <Mine key={row.key} tag={B.directionTag} attrs={{ ...at, 'data-sr-direction': '' }}>{row.text}</Mine>;
        return <Mine key={row.key} attrs={at}>{row.text}</Mine>;
      })}
      {suggestionWaiting && <CardLine attrs={{ 'data-sr-suggestion-waiting': '' }}>{B.suggestionWaiting}</CardLine>}
      {open && foot.part === 'segment' && (thesis.parts.segment.map?.length ?? 0) > 0 && (
        <div style={S.row} data-sr-map=""><Tag tone="gold">{B.map(agentName)}</Tag><Count n={new Set(thesis.parts.segment.map.flatMap((m) => m.findingIds ?? [])).size} /></div>
      )}
      {open && thesis.pick?.asked && <AskedPick pick={thesis.pick} agentName={agentName} />}
      {open && foot.part === 'why' && thesis.parts.why.state === 'suggested' && <WhyProposal proposal={thesis.parts.why.proposal} agentName={agentName} attrs={{ 'data-sr-why-proposal': '' }} />}
      {state === 'completed' && <Notice role="status" tone="teal">{`${COPY.concluded} · ${formatDay(record.endedAt) ?? ''}. ${COPY.concludedBody}`}</Notice>}
      {state === 'abandoned' && <Notice role="status" tone="copper">{`${COPY.discarded} · ${formatDay(record.endedAt) ?? ''}. ${COPY.discardedBody}`}</Notice>}
      {!open && !viewingEarlier && (
        <div style={{ ...S.actions, paddingTop: 6, borderTop: `1px solid ${T.hair}` }}>
          <Button kind="primary" full={phone} onClick={onClose}>{COPY.returnCC}</Button>
          <LinkButton onClick={onNewInvestigation}>{COPY.newInv}</LinkButton>
        </div>
      )}
    </section>
  );

  // The choices (P-2): directly under the agent's latest turn, scrolling with the sheet. Outside the log, so a new set of
  // buttons is not read out as a new turn.
  const choices = open ? (
    <div data-sr-choices={foot.part ?? 'none'} style={CHOICES}>
      {running && <Running attrs={{ 'data-sr-working': '' }}>{B.workingLine(agentName)}</Running>}
      {!running && themeLine && (
        <ThemeLine confirm={themeLine.confirm} disabled={busy} onConfirm={() => onFreeInChoices(themeLine.confirm)}
          onWriteOwn={themeLine.text ? () => setTapped('theme') : null} />
      )}
      {!running && staleRunning && (
        <Notice role="status" tone="gold" attrs={{ 'data-sr-was-running': '' }}>
          <span>{COPY.wasRunning}</span> <span aria-hidden="true">·</span> <LinkButton disabled={busy} onClick={() => sr.loadSession(session.sessionId)} attrs={{ 'data-sr-check-again': '' }}>{B.checkAgain}</LinkButton>
        </Notice>
      )}
      {!running && stepFailure && (
        <>
          <Notice role="alert" attrs={{ 'data-sr-step-failed': stepFailure.code }}>{stepFailure.message}</Notice>
          {retry && <ResearchButton label={B.tryAgainGoal(B.goals[retry.goal] ?? retry.goal)} stepsLeft={stepsLeft} disabled={busy} onClick={() => sr.buildStep(retry)} attrs={{ 'data-sr-retry-step': '' }} />}
        </>
      )}
      {cardFailure && (
        <>
          <Notice role="alert" attrs={{ 'data-sr-card-failed': cardFailure.code }}>{cardFailure.message}</Notice>
          {cardFailure.attempt && ['network', 'server_error'].includes(cardFailure.code) && <Button kind="secondary" disabled={busy} onClick={() => sr.cardOp(cardFailure.attempt.choice, cardFailure.attempt.input)} attrs={{ 'data-sr-retry-card': '' }}>{COPY.retry}</Button>}
        </>
      )}
      {closeRefusal && <Notice role="alert" attrs={{ 'data-sr-refusal': closeRefusal.code }}>{closeRefusal.message}</Notice>}
      <SaveOutcome sr={sr} sessionId={session.sessionId} rev={thesis.rev} />
      {askFor('choices')}
      {!running && deadEnd && (
        <>
          <FreeButton label={B.conclude} trail={B.keepsResearch} strong disabled={busy} onClick={() => sr.close('concluded')} attrs={{ 'data-sr-conclude': '' }} />
          {foot.values.length === 0 && (thesis.choices?.free ?? []).filter((c) => c.op === 'clear' && c.part === 'segment').map((c) => (
            <FreeButton key="another" label={B.tryAnotherSegment} disabled={busy} onClick={() => onFreeInChoices(c)} attrs={{ 'data-sr-free': 'clear:segment' }} />
          ))}
        </>
      )}
      {!running && !deadEnd && (
        <>
          {outOfSteps && <Notice role="status" tone="gold" attrs={{ 'data-sr-out-of-steps': '' }}>{B.outOfSteps(session.stepBudget ?? 0)}</Notice>}
          {foot.change && <FreeButton label={B.change} sub={B.staleLine(B.parts[foot.part])} disabled={busy} onClick={() => onFreeInChoices(foot.change)} attrs={{ 'data-sr-free': `clear:${foot.part}` }} />}
          {lead
            ? (
              <div role="group" aria-labelledby={leadId} style={CHOICES}>
                <p id={leadId} style={{ ...S.meta, ...WRAP, fontWeight: 600, color: T.ink }} data-sr-lead={foot.part}>{lead}</p>
                <FreeChoices choices={foot.values} thesis={thesis} companies={companies} agentName={agentName} onFree={onFreeInChoices} disabled={busy} />
              </div>
            )
            : <FreeChoices choices={foot.values} thesis={thesis} companies={companies} agentName={agentName} onFree={onFreeInChoices} disabled={busy} />}
          {foot.research.map((g) => <ResearchButton key={`${g.goal}:${g.part ?? ''}`} label={researchLabelOf(g)} stepsLeft={stepsLeft} disabled={busy} onClick={() => research(g)} attrs={{ 'data-sr-research': `${g.goal}${g.part ? `:${g.part}` : ''}` }} />)}
          {foot.skip && <FreeButton label={B.skipSegment} disabled={busy} onClick={() => onFree(foot.skip)} attrs={{ 'data-sr-free': 'set:segment:skip' }} />}
          {outOfSteps && <FreeButton label={B.concludeWithWhatWeHave} trail={B.keepsResearch} disabled={busy} onClick={() => sr.close('concluded')} attrs={{ 'data-sr-conclude': '' }} />}
        </>
      )}
    </div>
  ) : null;

  // The pinned foot holds only the composer (P-2).
  const footer = hasComposer ? (
    <div ref={footRef} data-sr-foot={foot.part ?? 'none'} style={FOOT}>
      <Cover />
      <Composer textChoice={textChoice} directionOn={directionOffered(thesis)} agentName={agentName} disabled={busy}
        onFree={(c, words) => sr.cardOp(c, { text: words })} onDirection={(words) => sr.buildStep({ goal: 'direction', direction: words })} />
    </div>
  ) : null;

  const strip = !wide ? (
    <div ref={stripRef} style={{ position: 'sticky', top: 0, height: 0, zIndex: 2 }} data-sr-strip-holder="">
      {folded && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, background: T.bg }}><Cover side="above" /><Strip thesis={thesis} stepsLeft={stepsLeft} onOpen={unfold} more={more('strip')} /></div>}
    </div>
  ) : null;

  const label = `Builder · ${running ? 'running' : foot.part ?? 'all set'}`;
  if (wide) {
    return (
      <div data-screen-label={label} data-sr-builder="two-column" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 0 }}>{card}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>{conversation}{choices}{footer}</div>
      </div>
    );
  }
  return (
    <div data-screen-label={label} data-sr-builder="one-column" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {strip}
      {card}
      {conversation}
      {choices}
      {footer}
    </div>
  );
}

/** "All evidence" (V2-6: the existing evidence list), one tap back to the thesis. */
function AllEvidence({ sr, onBack }) {
  const findings = evidenceOf(sr.inv.record);
  return (
    <div data-screen-label="All evidence" style={S.col}>
      <div><LinkButton onClick={onBack} attrs={{ 'data-sr-back-to-thesis': '' }}>{B.backToThesis}</LinkButton></div>
      <div style={S.row}><h3 style={S.h3}>{B.allEvidence}</h3><Count n={findings.length} /></div>
      <EvidenceList findings={findings} />
    </div>
  );
}

export default function Builder({ sr, agentName, agentId, phone, viewingEarlier = false, onBackToCurrent, onOpenEarlier, onDiscard, onNewInvestigation, onClose }) {
  const { session, record, thesis } = sr.inv;
  const state = stateOf(session, record);
  const open = state === 'open' && !viewingEarlier;
  const [sub, setSub] = useState(null);
  const [keepResearching, setKeepResearching] = useState(false);
  const [edit, setEdit] = useState(null); // the player's own sentence, kept through a refusal (K-12; review 4B-3)
  useEffect(() => { if (!thesis?.ready) setKeepResearching(false); }, [thesis?.ready]);
  const saveHere = sr.save.sessionId === session?.sessionId ? sr.save.status : 'idle';
  const keptRef = useRef(null);
  useFocusKept(keptRef);
  // two columns only when the sheet itself is wide enough, and never on the phone (the phone round, P-1)
  const measuredWide = useWideEnough(keptRef);
  const wide = !phone && measuredWide;
  const kept = (view) => <div ref={keptRef} style={{ minWidth: 0 }} data-sr-builder-view="">{view}</div>;

  if (!thesis) {
    return kept(
      <div style={S.col}>
        <Notice role="alert" attrs={{ 'data-sr-read-failed': 'thesis' }}>{COPY.loadFailed}</Notice>
        <div><LinkButton disabled={sr.pending !== null || sr.waiting} onClick={() => sr.loadSession(session.sessionId)}>{COPY.retry}</LinkButton></div>
      </div>
    );
  }
  if (sub === 'evidence') return kept(<AllEvidence sr={sr} onBack={() => setSub(null)} />);
  if (saveHere === 'saved' || saveHere === 'recovered' || (state === 'saved' && !viewingEarlier)) {
    return kept(<ThesisSaved sr={sr} agentName={agentName} agentId={agentId} onClose={onClose} />);
  }
  if (open && thesis.ready && !keepResearching) {
    return kept(<ThesisReady sr={sr} agentName={agentName} phone={phone} edit={edit} setEdit={setEdit} onKeepResearching={() => setKeepResearching(true)} onAllEvidence={() => setSub('evidence')} />);
  }
  return kept(
    <BuilderWork sr={sr} agentName={agentName} phone={phone} wide={wide} open={open} viewingEarlier={viewingEarlier} onBackToCurrent={onBackToCurrent} onOpenEarlier={onOpenEarlier}
      onDiscard={onDiscard} onNewInvestigation={onNewInvestigation} onClose={onClose} onAllEvidence={() => setSub('evidence')}
      onBackToThesis={open && thesis.ready && keepResearching ? () => setKeepResearching(false) : null} />
  );
}
