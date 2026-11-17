// src/components/SharedResearch/screens/Builder.jsx
//
// Shared Research — THE THESIS BUILDER'S VIEW (B4 build prompt K-2, K-4 to K-17;
// Amendment B §B7; design of record R3 / R3b on C-B, phone 390 and desktop D1).
// The body draws it for a session whose view carries `shape: 'builder'` — the
// SESSION decides, never the flag (K-2). Every other session keeps today's Work.
//
//   the work view — the sentence card (folding to its strip as the conversation
//     scrolls), the conversation (session.exchanges as stored), and the foot: the
//     part in front's choices, research and free drawn apart, and the composer;
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
  frontPartOf, footOf, panelOf, conversationOf, hasSuggestedPart, partOfGoal, directionOffered, revisedWhyChoiceOf,
} from '../thesisView';
import {
  CardHead, CardLine, ClearConfirm, Composer, Count, EvidenceList, FreeButton, KeepReasons, Mark, Mine, NamesPick, PartPanel,
  PriceLines, Rail, ResearchButton, Said, Sentence, Strip, WhyBlock, WhyProposal, basisTagOf, freeLabelOf, researchLabelOf,
} from '../builderParts';
import { Button, LinkButton, Notice, Running, Tag } from '../parts';
import ThesisReady from './ThesisReady';
import ThesisSaved from './ThesisSaved';

const B = COPY.builder;
const RETRYABLE = new Set(['step_failed', 'network', 'server_error']);
const paragraphs = (text) => String(text ?? '').split(/\n{2,}/).map((p, i) => <span key={i} style={{ display: 'block' }}>{p}</span>);

/** The nearest scrolling ancestor (the sheet's own scroll box), else null — for the card's fold (K-7). */
function scrollParentOf(el) {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = typeof getComputedStyle === 'function' ? getComputedStyle(p).overflowY : '';
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

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
      return <KeepReasons key={key} choice={c} proposal={thesis?.parts?.why?.proposal} agentName={agentName} disabled={disabled} onSend={(value) => onFree(c, value)} />;
    }
    const look = freeLabelOf(c, thesis, agentName);
    return <FreeButton key={key} {...look} disabled={disabled} onClick={() => onFree(c)} attrs={{ 'data-sr-free': `${c.op}:${c.part}`, 'data-sr-free-value': typeof c.value === 'string' ? c.value : JSON.stringify(c.value ?? null) }} />;
  });
}

/** The asked pick (DR-2; K-10): the value and its reasons, each tagged from its own basis. Nothing is set by it. */
function AskedPick({ pick, agentName }) {
  const value = Array.isArray(pick.value) ? pick.value.join(', ') : pick.value;
  return (
    <div style={{ ...S.card, gap: 8, border: `1px dashed ${wash('teal', 0.5)}` }} data-sr-asked-pick={pick.part}>
      <div style={S.row}><Mark tone="teal">{B.pickTag(agentName)}</Mark><Mark>{B.suggested}</Mark></div>
      <p style={{ ...S.body, fontWeight: 700 }}>{value}</p>
      {pick.reason && <p style={S.meta}>{pick.reason}</p>}
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

function BuilderWork({ sr, agentName, phone, open, viewingEarlier, onBackToCurrent, onOpenEarlier, onDiscard, onNewInvestigation, onClose, onAllEvidence, onBackToThesis }) {
  const { session, record, companies, thesis, previous } = sr.inv;
  const state = stateOf(session, record);
  const [tapped, setTapped] = useState(null);
  const [clearAsk, setClearAsk] = useState(null);
  const [folded, setFolded] = useState(false);
  const cardRef = useRef(null);
  const panelId = `sr-part-panel${useId()}`;
  const foot = footOf(thesis);
  const stepsLeft = remainingOf(session);
  const busy = sr.pending !== null || sr.waiting;
  const running = sr.running;
  const working = running ? partOfGoal(sr.pending?.goal, sr.pending?.part) : null;
  const byId = findingsById(record);
  const deadEnd = open && Boolean(thesis.parts?.names?.blocked);
  const outOfSteps = open && (thesis.choices?.research ?? []).length === 0;
  const rows = conversationOf(session);
  const last = session.lastStep ?? null;

  // K-7: the card folds to its strip once the conversation has scrolled it away (the phone's single column).
  useEffect(() => {
    if (!phone) return undefined;
    const card = cardRef.current;
    const scroller = scrollParentOf(card);
    if (!card || !scroller) return undefined;
    const check = () => {
      const c = card.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      setFolded(c.height !== 0 && s.top + 12 > c.bottom);
    };
    scroller.addEventListener('scroll', check, { passive: true });
    check();
    return () => scroller.removeEventListener('scroll', check);
  }, [phone]);
  const unfold = () => cardRef.current?.scrollIntoView?.({ block: 'start' });

  // K-8: a Change that clears other parts (and a drop that clears the price lines) asks first; everything else is sent.
  const onFree = (choice, input) => {
    if (Array.isArray(choice.clears) && choice.clears.length > 0 && (choice.op === 'clear' || choice.reason === 'drop_unsourced')) {
      setClearAsk(choice);
      return null;
    }
    return sr.cardOp(choice, input);
  };
  const confirmClear = async () => {
    const choice = clearAsk;
    setClearAsk(null);
    if (choice) await sr.cardOp(choice);
  };
  const research = (g) => sr.buildStep({ goal: g.goal, part: g.part ?? null });

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

  const panel = tapped ? panelOf(thesis, tapped) : null;
  const card = (
    <section ref={cardRef} aria-label={B.thesis} data-sr-card="" style={{ ...S.box, gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CardHead thesis={thesis} stepsLeft={stepsLeft} />
        <Rail thesis={thesis} working={working} />
      </div>
      <Sentence thesis={thesis} working={working} tapped={tapped} onTap={setTapped} panelId={panelId} agentName={agentName} />
      {panel && (
        <PartPanel id={panelId} part={tapped} thesis={thesis} companies={companies} byId={byId} agentName={agentName} onClose={() => setTapped(null)}
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
      {clearAsk && <ClearConfirm choice={clearAsk} disabled={busy} onConfirm={confirmClear} onCancel={() => setClearAsk(null)} />}
      {['set', 'stale'].includes(thesis.parts?.why?.state) && <WhyBlock thesis={thesis} agentName={agentName} folded={foot.part !== null && foot.part !== 'why'} />}
      <div style={{ ...S.row, justifyContent: 'flex-end' }}>
        {open && revisedWhyChoiceOf(thesis) && tapped !== 'why' && <LinkButton onClick={() => setTapped('why')} attrs={{ 'data-sr-revised-waiting': '' }}>{B.revisedWaiting}</LinkButton>}
        {(thesis.filled ?? 0) > 1 && <LinkButton onClick={onAllEvidence} attrs={{ 'data-sr-all-evidence-open': '' }}>{`${B.allEvidence} ›`}</LinkButton>}
      </div>
    </section>
  );

  const conversation = (
    <section aria-label={COPY.exchanges} data-sr-conversation="" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, padding: '4px 0' }}>
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
          <span style={S.meta}>{COPY.previous(formatDay(previous.endedAt) ?? '')}</span>
          <LinkButton disabled={busy} onClick={() => onOpenEarlier(previous.sessionId)}>{COPY.openEarlier}</LinkButton>
        </div>
      )}
      {rows.map((row) => {
        if (row.kind === 'said') return <Said key={row.key} name={agentName} attrs={{ 'data-sr-said': '' }}>{paragraphs(row.text)}</Said>;
        if (row.kind === 'card') return <CardLine key={row.key} attrs={{ 'data-sr-card-line': '' }}>{B.cardLine(row.text)}</CardLine>;
        if (row.kind === 'tap') return <Mine key={row.key} tag={B.stepUsed} attrs={{ 'data-sr-tap': row.goal }}>{researchLabelOf({ goal: row.goal, part: row.part })}</Mine>;
        if (row.kind === 'words') return <Mine key={row.key} tag={B.yourWordsTag} attrs={{ 'data-sr-words': '' }}>{row.text}</Mine>;
        if (row.kind === 'direction') return <Mine key={row.key} tag={B.directionTag} attrs={{ 'data-sr-direction': '' }}>{row.text}</Mine>;
        return <Mine key={row.key}>{row.text}</Mine>;
      })}
      {suggestionWaiting && <CardLine attrs={{ 'data-sr-suggestion-waiting': '' }}>{B.suggestionWaiting}</CardLine>}
      {open && foot.part === 'segment' && (thesis.parts.segment.map?.length ?? 0) > 0 && (
        <div style={S.row} data-sr-map=""><Tag tone="gold">{B.map(agentName)}</Tag><Count n={new Set(thesis.parts.segment.map.flatMap((m) => m.findingIds ?? [])).size} /></div>
      )}
      {open && thesis.pick?.asked && <AskedPick pick={thesis.pick} agentName={agentName} />}
      {open && foot.part === 'why' && thesis.parts.why.state === 'suggested' && <WhyProposal proposal={thesis.parts.why.proposal} agentName={agentName} attrs={{ 'data-sr-why-proposal': '' }} />}
      {state === 'completed' && <Notice role="status" tone="teal">{`${COPY.concluded} · ${formatDay(record.endedAt) ?? ''}. ${COPY.concludedBody}`}</Notice>}
      {state === 'abandoned' && <Notice role="status" tone="copper">{`${COPY.discarded} · ${formatDay(record.endedAt) ?? ''}. ${COPY.discardedBody}`}</Notice>}
      {open && (
        <div style={{ ...S.actions, paddingTop: 4 }}>
          <Button kind="ghost" onClick={onClose}>{COPY.later}</Button>
          <LinkButton tone="copper" disabled={busy} onClick={onDiscard}>{COPY.discard}</LinkButton>
        </div>
      )}
      {!open && !viewingEarlier && (
        <div style={{ ...S.actions, paddingTop: 6, borderTop: `1px solid ${T.hair}` }}>
          <Button kind="primary" full={phone} onClick={onClose}>{COPY.returnCC}</Button>
          <LinkButton onClick={onNewInvestigation}>{COPY.newInv}</LinkButton>
        </div>
      )}
    </section>
  );

  const footer = open ? (
    <div data-sr-foot={foot.part ?? 'none'} style={{ position: 'sticky', bottom: 0, zIndex: 1, background: T.bg, borderTop: `1px solid ${T.hair}`, padding: '10px 0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {running && <Running attrs={{ 'data-sr-working': '' }}>{B.workingLine(agentName)}</Running>}
      {!running && staleRunning && <Notice role="status" tone="gold" attrs={{ 'data-sr-was-running': '' }}>{COPY.wasRunning}</Notice>}
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
      {!running && deadEnd && (
        <>
          <FreeButton label={B.conclude} trail={B.keepsResearch} strong disabled={busy} onClick={() => sr.close('concluded')} attrs={{ 'data-sr-conclude': '' }} />
          {foot.values.length === 0 && (thesis.choices?.free ?? []).filter((c) => c.op === 'clear' && c.part === 'segment').map((c) => (
            <FreeButton key="another" label={B.tryAnotherSegment} disabled={busy} onClick={() => onFree(c)} attrs={{ 'data-sr-free': 'clear:segment' }} />
          ))}
        </>
      )}
      {!running && !deadEnd && (
        <>
          {outOfSteps && <Notice role="status" tone="gold" attrs={{ 'data-sr-out-of-steps': '' }}>{B.outOfSteps(session.stepBudget ?? 0)}</Notice>}
          {foot.change && <FreeButton label={B.change} sub={B.staleLine(B.parts[foot.part])} disabled={busy} onClick={() => onFree(foot.change)} attrs={{ 'data-sr-free': `clear:${foot.part}` }} />}
          <FreeChoices choices={foot.values} thesis={thesis} companies={companies} agentName={agentName} onFree={onFree} disabled={busy} />
          {foot.research.map((g) => <ResearchButton key={`${g.goal}:${g.part ?? ''}`} label={researchLabelOf(g)} stepsLeft={stepsLeft} disabled={busy} onClick={() => research(g)} attrs={{ 'data-sr-research': `${g.goal}${g.part ? `:${g.part}` : ''}` }} />)}
          {foot.skip && <FreeButton label={B.skipSegment} disabled={busy} onClick={() => onFree(foot.skip)} attrs={{ 'data-sr-free': 'set:segment:skip' }} />}
          {outOfSteps && <FreeButton label={B.concludeWithWhatWeHave} trail={B.keepsResearch} disabled={busy} onClick={() => sr.close('concluded')} attrs={{ 'data-sr-conclude': '' }} />}
        </>
      )}
      <Composer textChoice={deadEnd ? null : foot.text} directionOn={directionOffered(thesis)} agentName={agentName} disabled={busy}
        onFree={(c, words) => sr.cardOp(c, { text: words })} onDirection={(words) => sr.buildStep({ goal: 'direction', direction: words })} />
    </div>
  ) : null;

  const strip = phone ? (
    <div style={{ position: 'sticky', top: 0, height: 0, zIndex: 2 }} data-sr-strip-holder="">
      {folded && <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}><Strip thesis={thesis} stepsLeft={stepsLeft} onOpen={unfold} /></div>}
    </div>
  ) : null;

  if (!phone) {
    return (
      <div data-screen-label={`Builder · ${running ? 'running' : foot.part ?? 'all set'}`} data-sr-builder="desktop" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 0 }}>{card}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>{conversation}{footer}</div>
      </div>
    );
  }
  return (
    <div data-screen-label={`Builder · ${running ? 'running' : foot.part ?? 'all set'}`} data-sr-builder="phone" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {strip}
      {card}
      {conversation}
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
  useEffect(() => { if (!thesis?.ready) setKeepResearching(false); }, [thesis?.ready]);
  const saveHere = sr.save.sessionId === session?.sessionId ? sr.save.status : 'idle';

  if (!thesis) {
    return (
      <div style={S.col}>
        <Notice role="alert" attrs={{ 'data-sr-read-failed': 'thesis' }}>{COPY.loadFailed}</Notice>
        <div><LinkButton disabled={sr.pending !== null || sr.waiting} onClick={() => sr.loadSession(session.sessionId)}>{COPY.retry}</LinkButton></div>
      </div>
    );
  }
  if (sub === 'evidence') return <AllEvidence sr={sr} onBack={() => setSub(null)} />;
  if (saveHere === 'saved' || saveHere === 'recovered' || (state === 'saved' && !viewingEarlier)) {
    return <ThesisSaved sr={sr} agentName={agentName} agentId={agentId} onClose={onClose} />;
  }
  if (open && thesis.ready && !keepResearching) {
    return <ThesisReady sr={sr} agentName={agentName} phone={phone} onKeepResearching={() => setKeepResearching(true)} onAllEvidence={() => setSub('evidence')} />;
  }
  return (
    <BuilderWork sr={sr} agentName={agentName} phone={phone} open={open} viewingEarlier={viewingEarlier} onBackToCurrent={onBackToCurrent} onOpenEarlier={onOpenEarlier}
      onDiscard={onDiscard} onNewInvestigation={onNewInvestigation} onClose={onClose} onAllEvidence={() => setSub('evidence')}
      onBackToThesis={open && thesis.ready && keepResearching ? () => setKeepResearching(false) : null} />
  );
}
