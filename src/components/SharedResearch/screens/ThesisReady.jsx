// src/components/SharedResearch/screens/ThesisReady.jsx
//
// Shared Research — THE THESIS, READY (B4 build prompt K-12, K-13; R3b T5 / T5G).
// Drawn while `thesis.ready` is true and the investigation is open: the SERVER'S
// sentence (as received; its set parts tappable where they stand), "Edit the
// sentence · it's yours" (an edit goes as `statement`), the names, the why, and
// "How it will be judged" — the time frame, the wrong-if "in your words" (or "in
// words" when the player did not write it: §B13 T-8) and the
// price line "optional · add your own" (W-2: the idea book does not read saved
// theses yet, so nothing here says it is watched or held).
//
// Save sends `adopt` with the `rev` seen. `saveIssue` not null → Save is disabled
// with the line for its code. A refusal keeps the player's edit and shows the
// server's message; `not_ready` shows the blockers it carries; a stale card puts
// the fresh one on screen. An answer that never came is UNCERTAIN: only "Check the
// record" (B2's K-8), never a retry before it.

import React, { useEffect, useId, useRef, useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S } from '../sharedResearchStyle';
import { findingsById, holdsResearchOnlyIn, remainingOf, STATEMENT_MAX } from '../sharedResearchView';
import { partFindingIdsOf, panelOf, revisedWhyChoiceOf, themeLineOf } from '../thesisView';
import {
  CardHead, ClearConfirm, Composer, Count, Cover, FOOT, FreeButton, PartPanel, PriceLines, Rail, ResearchButton, Sentence, ThemeLine, WhyBlock, WhyProposal, freeLabelOf, researchLabelOf, usePanelInView,
  scrollParentOf, useFootRoom, WRAP,
} from '../builderParts';
import { Button, LinkButton, Notice, Running, Tag } from '../parts';
import { SaveStates } from './Adopt';

const B = COPY.builder;

function JudgedRow({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: 10 }}>
      <span style={{ ...S.eyebrow, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.45, overflowWrap: 'break-word', minWidth: 0 }}>{children}</span>
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
  const sentenceRef = useRef(null);
  const editRef = useRef(null);
  const readyRef = useRef(null);
  // the ready card arrives at its own top, not where the work view was scrolled (the phone round, P-2: a new turn's top) —
  // only when its top is above the sheet's view: a sheet opened on a ready card keeps its header and Close in view
  useEffect(() => {
    const el = readyRef.current;
    const box = scrollParentOf(el);
    if (el?.scrollIntoView && box && el.getBoundingClientRect().top < box.getBoundingClientRect().top) el.scrollIntoView({ block: 'start' });
  }, []);
  // the edit box takes focus when it opens (review 4C-1: the link that opened it is gone)
  useEffect(() => { if (editing) editRef.current?.focus({ preventScroll: true }); }, [editing]);
  usePanelInView(tapped, panelId, footRef);
  useFootRoom(footRef);
  const issueId = `sr-save-issue${useId()}`;
  // the panel's close puts focus back on what opened it (review 4C-1): its part, or the theme block's "Write your own"
  // (§B14 Q-4 — a theme only suggested has no slot in the server's sentence)
  const openerRef = useRef(null);
  const tapPart = (part) => { openerRef.current = null; setTapped(part); };
  const closePanel = () => {
    const part = tapped;
    const opener = openerRef.current;
    openerRef.current = null;
    setTapped(null);
    setTimeout(() => {
      const back = opener?.isConnected ? opener : sentenceRef.current?.querySelector(`[data-sr-slot="${part}"]`);
      back?.focus({ preventScroll: true });
    }, 0);
  };
  // §B14 Q-4: a ready card whose theme is only suggested draws the theme's block here too (the work view's, §B13 T-6)
  const themeLine = themeLineOf(thesis);
  const byId = findingsById(record);
  const stepsLeft = remainingOf(session);
  const status = sr.save.sessionId === session.sessionId ? sr.save.status : 'idle';
  const uncertain = status === 'uncertain' || status === 'checking';
  // a 429's wait holds these controls too (review 4B-4); a step started here goes on in the work view (review 4A-2)
  const busy = sr.pending !== null || sr.waiting || status === 'saving' || status === 'checking';
  const names = thesis.parts.names.value ?? [];
  const lines = thesis.parts.wrongIf.priceLines ?? [];
  const priceChoice = (thesis.choices?.free ?? []).find((c) => c.input === 'priceLines') ?? null;
  const over = edit !== null && edit.trim().length > STATEMENT_MAX; // the server trims first (refuter 2)
  const statement = edit !== null && edit.trim() && edit.trim() !== thesis.sentence ? edit.trim() : null;
  // saveIssue judges the server's composed sentence (the refuter's R2): it holds Save unless the player's own sentence
  // differs from it — and always for too_many_evidence_refs, which no wording changes (the server checks it first)
  const issueHolds = Boolean(thesis.saveIssue) && (thesis.saveIssue.code === 'too_many_evidence_refs' || statement === null);
  const canSave = thesis.ready === true && !issueHolds && !busy && !uncertain && status !== 'closed' && !sr.waiting && !sr.gated
    && !(edit !== null && (!edit.trim() || over));
  const panel = tapped ? panelOf(thesis, tapped) : null;
  const onFree = (choice, input) => {
    if (Array.isArray(choice.clears) && choice.clears.length > 0) { setClearAsk(choice); return null; }
    return sr.cardOp(choice, input);
  };
  const confirmClear = async () => { const c = clearAsk; setClearAsk(null); if (c) await sr.cardOp(c); };
  const cardFailure = sr.failure?.action === 'card' ? sr.failure : null;
  // a Save refusal speaks of one card (the refuter's R3): shown only while that card is the one on screen
  const refusalHere = ['failed', 'stale'].includes(status) && sr.save.atRev === thesis.rev;
  const blockers = refusalHere && status === 'failed' && Array.isArray(sr.save.blockers) ? sr.save.blockers : null;

  return (
    <div data-screen-label={`Thesis ready · ${status}`} style={S.col}>
      <section ref={readyRef} aria-label={B.thesisReady} data-sr-ready="" style={{ ...S.box, gap: 12, scrollMarginTop: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CardHead thesis={thesis} stepsLeft={stepsLeft} ready />
          <Rail thesis={thesis} />
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="sr-thesis-edit" style={S.label}>{B.editLabel}</label>
            <textarea id="sr-thesis-edit" ref={editRef} value={edit ?? thesis.sentence ?? ''} disabled={busy} rows={6} onChange={(e) => setEdit(e.target.value)}
              aria-describedby="sr-thesis-edit-count" style={{ ...S.input, minHeight: 150, resize: 'vertical' }} />
            <div style={S.row}>
              <span id="sr-thesis-edit-count" style={{ ...S.small, ...WRAP, color: over ? T.neg : T.ink3 }}>{COPY.count((edit ?? thesis.sentence ?? '').length)}{over ? COPY.over : ''}</span>
              {edit !== null && <LinkButton disabled={busy} onClick={() => { setEdit(null); setEditing(false); }} attrs={{ 'data-sr-edit-reset': '' }}>{B.backToComposed}</LinkButton>}
            </div>
          </div>
        ) : (
          <div ref={sentenceRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Sentence thesis={thesis} tapped={tapped} onTap={tapPart} panelId={panelId} agentName={agentName} size={phone ? 16 : 16.5} />
            <div><LinkButton disabled={busy} onClick={() => setEditing(true)} attrs={{ 'data-sr-edit': '' }}>{B.edit}</LinkButton></div>
          </div>
        )}
        {themeLine && !editing && (
          <ThemeLine confirm={themeLine.confirm} agentName={agentName} disabled={busy} onConfirm={() => sr.cardOp(themeLine.confirm)}
            onWriteOwn={themeLine.text ? (e) => { openerRef.current = e?.currentTarget ?? null; setTapped('theme'); } : null}
            expanded={tapped === 'theme'} controls={panelId} />
        )}
        {panel && !editing && (
          <PartPanel id={panelId} part={tapped} thesis={thesis} companies={companies} byId={byId} agentName={agentName} onClose={closePanel}
            change={panel.change} onChange={() => onFree(panel.change)}>
            {/* §B14 Q-4: "Write your own" opens the theme's part with its text box (the player's own phrase, free) */}
            {tapped === 'theme' && panel.text && (
              <Composer textChoice={panel.text} directionOn={false} agentName={agentName} disabled={busy} onFree={(c, words) => sr.cardOp(c, { text: words })} onDirection={() => null} />
            )}
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
        {holdsResearchOnlyIn(names, companies?.supported) && <p style={{ ...S.small, ...WRAP }} data-sr-research-only="">{COPY.research.holdsResearchOnly}</p>}
        <WhyBlock thesis={thesis} agentName={agentName} />
        {revisedWhyChoiceOf(thesis) && tapped !== 'why' && <div><LinkButton disabled={busy} onClick={() => tapPart('why')} attrs={{ 'data-sr-revised-waiting': '' }}>{B.revisedWaiting}</LinkButton></div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 11, borderTop: `1px solid ${T.hair}` }} data-sr-judged="">
          <span style={S.eyebrow}>{B.judged}</span>
          <JudgedRow label={B.parts.timeFrame}>{thesis.parts.timeFrame.label}</JudgedRow>
          {/* §B13 T-8 (b): "in your words" only when the player wrote it; otherwise "in words" — never "watched" (W-2) */}
          <JudgedRow label={B.parts.wrongIf}>{thesis.parts.wrongIf.text} <span style={{ display: 'inline-flex', verticalAlign: 'middle' }} data-sr-wrongif-tag={thesis.parts.wrongIf.by ?? ''}><Tag dim>{thesis.parts.wrongIf.by === 'player_wrote' ? B.inYourWords : B.inWords}</Tag></span></JudgedRow>
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

      {cardFailure && <Notice role="alert" attrs={{ 'data-sr-card-failed': cardFailure.code }}>{cardFailure.message}</Notice>}
      {refusalHere && status === 'failed' && <Notice role="alert" attrs={{ 'data-sr-save': 'failed' }}>{sr.save.message}</Notice>}
      {blockers && blockers.length > 0 && <p style={{ ...S.small, ...WRAP }} data-sr-blockers="">{B.stillToSet(blockers.map((b) => B.parts[b.part] ?? b.part).join(', '))}</p>}
      {refusalHere && status === 'stale' && <Notice role="alert" tone="gold" attrs={{ 'data-sr-save': 'stale' }}>{sr.save.message}</Notice>}
      {status === 'notsaved' && <Notice role="status" tone="teal" attrs={{ 'data-sr-save': 'notsaved' }}>{COPY.notSaved}</Notice>}
      <SaveStates sr={sr} phone={phone} />

      <div ref={footRef} data-sr-foot="ready" style={FOOT}>
        <Cover />
        {issueHolds && <Notice role="status" tone="gold" attrs={{ 'data-sr-save-issue': thesis.saveIssue.code, id: issueId }}>{B.saveIssue[thesis.saveIssue.code] ?? COPY.server.step_failed}</Notice>}
        {status === 'saving' && <Running>{B.saving}</Running>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          {!uncertain && status !== 'saving' && status !== 'closed' && (
            <Button kind="primary" full disabled={!canSave} onClick={() => sr.adoptThesis({ statement })} attrs={{ 'data-sr-save-thesis': '', ...(issueHolds ? { 'aria-describedby': issueId } : {}) }}>
              {(refusalHere && status === 'failed') || status === 'notsaved' ? COPY.retry : B.save}
            </Button>
          )}
          <Button kind="secondary" full disabled={busy} onClick={onKeepResearching} attrs={{ 'data-sr-keep-researching': '' }}>{B.keepResearching}</Button>
        </div>
      </div>
    </div>
  );
}
