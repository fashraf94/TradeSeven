// src/components/SharedResearch/screens/ThesisReady.jsx
//
// Shared Research — THE THESIS, READY (B4 build prompt K-12, K-13; R3b T5 / T5G).
// Drawn while `thesis.ready` is true and the investigation is open: the SERVER'S
// sentence (as received; its set parts tappable where they stand), "Edit the
// sentence · it's yours" (an edit goes as `statement`), the names, the why, and
// "How it will be judged" — the time frame, the wrong-if "in your words" and the
// price line "optional · add your own" (W-2: the idea book does not read saved
// theses yet, so nothing here says it is watched or held).
//
// Save sends `adopt` with the `rev` seen. `saveIssue` not null → Save is disabled
// with the line for its code. A refusal keeps the player's edit and shows the
// server's message; `not_ready` shows the blockers it carries; a stale card puts
// the fresh one on screen. An answer that never came is UNCERTAIN: only "Check the
// record" (B2's K-8), never a retry before it.

import React, { useId, useRef, useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S } from '../sharedResearchStyle';
import { findingsById, remainingOf, STATEMENT_MAX } from '../sharedResearchView';
import { partFindingIdsOf, panelOf, revisedWhyChoiceOf } from '../thesisView';
import {
  CardHead, ClearConfirm, Count, Cover, FOOT, FreeButton, PartPanel, PriceLines, Rail, ResearchButton, Sentence, WhyBlock, WhyProposal, freeLabelOf, researchLabelOf, usePanelInView,
} from '../builderParts';
import { Button, LinkButton, Notice, Running, Tag } from '../parts';
import { SaveStates } from './Adopt';

const B = COPY.builder;

function JudgedRow({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: 10 }}>
      <span style={{ ...S.eyebrow, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

export default function ThesisReady({ sr, agentName, phone, edit, setEdit, onKeepResearching, onAllEvidence }) {
  const { session, record, companies, thesis } = sr.inv;
  const [tapped, setTapped] = useState(null);
  const [editing, setEditing] = useState(edit !== null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [clearAsk, setClearAsk] = useState(null);
  const panelId = `sr-ready-panel${useId()}`;
  const footRef = useRef(null);
  usePanelInView(tapped, panelId, footRef);
  const byId = findingsById(record);
  const stepsLeft = remainingOf(session);
  const status = sr.save.sessionId === session.sessionId ? sr.save.status : 'idle';
  const uncertain = status === 'uncertain' || status === 'checking';
  const busy = sr.pending !== null || sr.waiting || status === 'saving' || status === 'checking';
  // a step started from a tapped part here: its working line while in flight, its failure and Try again (review 4B-4)
  const stepFailure = sr.failure?.action === 'step' && sr.failure.attempt?.builder ? sr.failure : null;
  const stepRetry = stepFailure && ['step_failed', 'network', 'step_in_flight', 'server_error'].includes(stepFailure.code) && stepFailure.reason !== 'findings_full' ? stepFailure.attempt : null;
  const names = thesis.parts.names.value ?? [];
  const lines = thesis.parts.wrongIf.priceLines ?? [];
  const priceChoice = (thesis.choices?.free ?? []).find((c) => c.input === 'priceLines') ?? null;
  const over = edit !== null && edit.length > STATEMENT_MAX;
  const statement = edit !== null && edit.trim() && edit.trim() !== thesis.sentence ? edit.trim() : null;
  const canSave = thesis.ready === true && !(thesis.saveIssue && edit === null) && !busy && !uncertain && status !== 'closed' && !sr.waiting && !sr.gated
    && !(edit !== null && (!edit.trim() || over));
  const panel = tapped ? panelOf(thesis, tapped) : null;
  const onFree = (choice, input) => {
    if (Array.isArray(choice.clears) && choice.clears.length > 0) { setClearAsk(choice); return null; }
    return sr.cardOp(choice, input);
  };
  const confirmClear = async () => { const c = clearAsk; setClearAsk(null); if (c) await sr.cardOp(c); };
  const cardFailure = sr.failure?.action === 'card' ? sr.failure : null;
  const blockers = status === 'failed' && Array.isArray(sr.save.blockers) ? sr.save.blockers : null;

  return (
    <div data-screen-label={`Thesis ready · ${status}`} style={S.col}>
      <section aria-label={B.thesisReady} data-sr-ready="" style={{ ...S.box, gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CardHead thesis={thesis} stepsLeft={stepsLeft} ready />
          <Rail thesis={thesis} />
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="sr-thesis-edit" style={S.label}>{B.editLabel}</label>
            <textarea id="sr-thesis-edit" value={edit ?? thesis.sentence ?? ''} disabled={busy} rows={6} onChange={(e) => setEdit(e.target.value)}
              aria-describedby="sr-thesis-edit-count" style={{ ...S.input, minHeight: 150, resize: 'vertical' }} />
            <div style={S.row}>
              <span id="sr-thesis-edit-count" style={{ ...S.small, color: over ? T.neg : T.ink3 }}>{COPY.count((edit ?? thesis.sentence ?? '').length)}{over ? COPY.over : ''}</span>
              {edit !== null && <LinkButton disabled={busy} onClick={() => { setEdit(null); setEditing(false); }} attrs={{ 'data-sr-edit-reset': '' }}>{B.backToComposed}</LinkButton>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Sentence thesis={thesis} tapped={tapped} onTap={setTapped} panelId={panelId} agentName={agentName} />
            <div><LinkButton disabled={busy} onClick={() => setEditing(true)} attrs={{ 'data-sr-edit': '' }}>{B.edit}</LinkButton></div>
          </div>
        )}
        {panel && !editing && (
          <PartPanel id={panelId} part={tapped} thesis={thesis} companies={companies} byId={byId} agentName={agentName} onClose={() => setTapped(null)}
            change={panel.change} onChange={() => onFree(panel.change)}>
            {panel.revised && (
              <>
                <WhyProposal proposal={thesis.parts.why.proposal} agentName={agentName} title={B.revised} attrs={{ 'data-sr-revised-proposal': '' }} />
                <FreeButton {...freeLabelOf(panel.revised, thesis, agentName)} disabled={busy} onClick={() => onFree(panel.revised)} attrs={{ 'data-sr-free': 'confirm:why:revised' }} />
              </>
            )}
            {panel.research.map((g) => <ResearchButton key={`${g.goal}:${g.part ?? ''}`} label={researchLabelOf(g)} stepsLeft={stepsLeft} disabled={busy} onClick={() => { onKeepResearching(); sr.buildStep({ goal: g.goal, part: g.part ?? null }); }} attrs={{ 'data-sr-research': `${g.goal}${g.part ? `:${g.part}` : ''}` }} />)}
          </PartPanel>
        )}
        {clearAsk && <ClearConfirm choice={clearAsk} disabled={busy} onConfirm={confirmClear} onCancel={() => setClearAsk(null)} />}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }} data-sr-ready-names="">
          <span style={S.eyebrow}>{B.parts.names}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{names.join(', ')}</span>
          <span style={{ fontSize: 12.5, color: T.ink2 }}>{names.length === 1 ? B.oneStock : B.nNames(names.length)}</span>
          <Count n={partFindingIdsOf(thesis, 'names', companies).length} />
        </div>
        <WhyBlock thesis={thesis} agentName={agentName} />
        {revisedWhyChoiceOf(thesis) && tapped !== 'why' && <div><LinkButton disabled={busy} onClick={() => setTapped('why')} attrs={{ 'data-sr-revised-waiting': '' }}>{B.revisedWaiting}</LinkButton></div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 11, borderTop: `1px solid ${T.hair}` }} data-sr-judged="">
          <span style={S.eyebrow}>{B.judged}</span>
          <JudgedRow label={B.parts.timeFrame}>{thesis.parts.timeFrame.label}</JudgedRow>
          <JudgedRow label={B.parts.wrongIf}>{thesis.parts.wrongIf.text} <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Tag dim>{B.inYourWords}</Tag></span></JudgedRow>
          <JudgedRow label={B.priceLine}>
            {lines.length > 0 && lines.map((l) => <span key={l.symbol} style={{ display: 'block' }} data-sr-price-line={l.symbol}>{B.priceSet(l.symbol, l.level)}</span>)}
            {priceChoice && (
              <LinkButton expanded={priceOpen} disabled={busy} onClick={() => setPriceOpen((v) => !v)} attrs={{ 'data-sr-price-open': '' }}>{B.priceOptional}</LinkButton>
            )}
          </JudgedRow>
          {priceOpen && priceChoice && <PriceLines choice={priceChoice} lines={lines} disabled={busy} onSend={async (value) => { const a = await sr.cardOp(priceChoice, value); if (a?.ok) setPriceOpen(false); }} />}
        </div>
        {(thesis.filled ?? 0) > 1 && <div style={{ ...S.row, justifyContent: 'flex-end' }}><LinkButton onClick={onAllEvidence} attrs={{ 'data-sr-all-evidence-open': '' }}>{`${B.allEvidence} ›`}</LinkButton></div>}
      </section>

      {thesis.saveIssue && edit === null && <Notice role="status" tone="gold" attrs={{ 'data-sr-save-issue': thesis.saveIssue.code }}>{B.saveIssue[thesis.saveIssue.code] ?? COPY.server.step_failed}</Notice>}
      {cardFailure && <Notice role="alert" attrs={{ 'data-sr-card-failed': cardFailure.code }}>{cardFailure.message}</Notice>}
      {sr.running && <Running attrs={{ 'data-sr-working': '' }}>{B.workingLine(agentName)}</Running>}
      {!sr.running && stepFailure && (
        <>
          <Notice role="alert" attrs={{ 'data-sr-step-failed': stepFailure.code }}>{stepFailure.message}</Notice>
          {stepRetry && <ResearchButton label={B.tryAgainGoal(B.goals[stepRetry.goal] ?? stepRetry.goal)} stepsLeft={stepsLeft} disabled={busy} onClick={() => sr.buildStep(stepRetry)} attrs={{ 'data-sr-retry-step': '' }} />}
        </>
      )}
      {status === 'failed' && <Notice role="alert" attrs={{ 'data-sr-save': 'failed' }}>{sr.save.message}</Notice>}
      {blockers && blockers.length > 0 && <p style={S.small} data-sr-blockers="">{B.stillToSet(blockers.map((b) => B.parts[b.part] ?? b.part).join(', '))}</p>}
      {status === 'stale' && <Notice role="alert" tone="gold" attrs={{ 'data-sr-save': 'stale' }}>{sr.save.message}</Notice>}
      {status === 'notsaved' && <Notice role="status" tone="teal" attrs={{ 'data-sr-save': 'notsaved' }}>{COPY.notSaved}</Notice>}
      <SaveStates sr={sr} phone={phone} />

      <div ref={footRef} data-sr-foot="ready" style={FOOT}>
        <Cover />
        {status === 'saving' && <Running>{B.saving}</Running>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          {!uncertain && status !== 'saving' && status !== 'closed' && (
            <Button kind="primary" full disabled={!canSave} onClick={() => sr.adoptThesis({ statement })} attrs={{ 'data-sr-save-thesis': '' }}>
              {status === 'failed' || status === 'notsaved' ? COPY.retry : B.save}
            </Button>
          )}
          <Button kind="secondary" full disabled={busy} onClick={onKeepResearching} attrs={{ 'data-sr-keep-researching': '' }}>{B.keepResearching}</Button>
        </div>
      </div>
    </div>
  );
}
