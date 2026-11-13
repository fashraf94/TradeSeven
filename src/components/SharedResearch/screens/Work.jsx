// src/components/SharedResearch/screens/Work.jsx
//
// Shared Research — THE WORKSPACE (spec §4.2–§4.5, §7.2 Work and Companies):
// where it started · the short answer (or the opening, with what the records
// already hold) · companies connected · the four lines · the step · direction and
// the partner's reply · evidence and exchanges · the endings.
//
// What it renders is the server's answer only:
//   - companies are `companies.supported` / `.leads` as received (Correction A);
//   - each card's "Examine this connection" sends ITS OWN target
//     `{ symbol, relationshipFindingId, openFindingId }` (Correction B);
//   - running is the hook's in-flight step, never the stored `lastStep` (K-8);
//   - `record.answerStale`, `changed.summaryWithheld`, `previous` and the replaced
//     reply render as K-6 (b), (c), (a) and (d) say.

import React, { useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S, wash } from '../sharedResearchStyle';
import {
  evidenceOf, findingsById, formatDay, formatWhen, isAged, linesOf, partnerReplyOf, quotaStateOf,
  remainingOf, splitNext, startingPointOf, stateOf, directionOfStep, labelOf,
} from '../sharedResearchView';
import { Button, CompanyCard, Disclosure, Eyebrow, Finding, Lead, LinkButton, Notice, Running, StatusTag, Tag } from '../parts';

const RETRYABLE = new Set(['step_failed', 'network', 'step_in_flight', 'server_error']);
const paragraphs = (text) => String(text ?? '').split(/\n{2,}/).map((p, i) => <p key={i} style={{ ...S.body, fontSize: 15, lineHeight: 1.55, marginTop: i ? 10 : 0 }}>{p}</p>);

function Answer({ record, storedRows, entryKind, open, blocked, onRefresh }) {
  const [changes, setChanges] = useState(false);
  const summary = record.summary;
  if (!summary) {
    return (
      <section data-screen-label="Opening · no answer yet" style={S.box}>
        <Eyebrow>{COPY.openingHead}</Eyebrow>
        <p style={{ ...S.body, fontSize: 15 }}>{COPY.openingBody}</p>
        {entryKind !== 'observation' && (
          <div style={{ ...S.card, gap: 6 }} data-sr-stored="">
            <Eyebrow>{COPY.storedFacts}</Eyebrow>
            {storedRows.length ? storedRows.map((row) => (
              <p key={row.symbol} style={S.meta}>
                {[row.name !== row.symbol ? `${row.name} · ${row.symbol}` : row.symbol, row.peer?.sector, row.ranking?.score !== null && row.ranking?.score !== undefined ? COPY.storedScore(row.ranking.score) : null, row.ranking?.asOf ? COPY.asOf(formatDay(row.ranking.asOf)) : null].filter(Boolean).join(' · ')}
              </p>
            )) : <p style={S.small}>{COPY.storedNone}</p>}
          </div>
        )}
      </section>
    );
  }
  const earlier = (record.summaryRevisions ?? []).filter((r) => r.rev !== summary.rev).slice().reverse();
  return (
    <section data-screen-label="Short answer" style={{ ...S.box, border: `1px solid ${wash('teal', 0.3)}` }}>
      <div style={S.row}>
        <Eyebrow tone="teal">{COPY.shortAnswer}</Eyebrow>
        {formatDay(summary.at) && <span style={S.small}>{COPY.asOf(formatDay(summary.at))}</span>}
        {isAged(record) && <Tag tone="gold">{COPY.older(record.age)}</Tag>}
      </div>
      <div data-sr-answer="">{paragraphs(summary.text)}</div>
      {record.answerStale === true && <Notice role="status" tone="gold" attrs={{ 'data-sr-answer-stale': '' }}>{COPY.answerStale}</Notice>}
      <div style={S.row}>
        {earlier.length > 0 && <LinkButton expanded={changes} onClick={() => setChanges((v) => !v)}>{changes ? COPY.hideChanges : COPY.whatChanged(earlier.length)}</LinkButton>}
        {open && isAged(record) && (
          <>
            <Button kind="secondary" disabled={blocked} onClick={onRefresh} attrs={{ 'data-sr-refresh': '' }}>{COPY.refresh}</Button>
            <span style={S.small}>{COPY.refreshHelp}</span>
          </>
        )}
      </div>
      {changes && earlier.map((r) => (
        <div key={r.rev} style={{ ...S.card, borderStyle: 'dashed' }}>
          <Tag dim>{COPY.earlierAnswer(formatDay(r.at) ?? '')}</Tag>
          {paragraphs(r.text)}
        </div>
      ))}
    </section>
  );
}

function LinesTable({ lines }) {
  const next = lines.next ? splitNext(lines.next.fact) : null;
  const rows = [
    lines.support && { key: COPY.lines.support, text: lines.support.fact, finding: lines.support },
    lines.complication && { key: COPY.lines.complication, text: lines.complication.fact, finding: lines.complication },
    lines.missing && { key: COPY.lines.missing, text: lines.missing.fact, finding: lines.missing },
    next && { key: COPY.lines.next, text: next.purpose ?? next.label, finding: null },
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div data-screen-label="Four lines" style={{ borderRadius: 14, border: `1px solid ${T.hair}`, background: T.surface, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <div key={row.key} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '10px 14px', borderTop: i ? `1px solid ${T.hair}` : 'none' }}>
          <div style={{ ...S.eyebrow, flex: '0 0 128px', paddingTop: 3 }}>{row.key}</div>
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ ...S.body, fontSize: 13.5 }}>{row.text}</span>
            {row.finding && <span style={{ display: 'flex' }}><StatusTag finding={row.finding} /></span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Work({ sr, agentName, phone, viewingEarlier = false, onBackToCurrent, onOpenEarlier, onAdopt, onDiscard, onNewInvestigation, onClose }) {
  const [direction, setDirection] = useState('');
  const [earlierOpen, setEarlierOpen] = useState(false);
  const { session, record, companies, storedRows, previous } = sr.inv;
  const state = stateOf(session, record);
  const open = state === 'open' && !viewingEarlier;
  const byId = findingsById(record);
  const lines = linesOf(record);
  const next = lines.next;
  const noNext = record.nextAction?.statusReason === 'no_next_step';
  const remaining = remainingOf(session);
  const spent = remaining <= 0;
  const quota = quotaStateOf(sr.quota);
  const running = sr.running;
  const blocked = running || sr.pending !== null || sr.waiting || spent || quota.stepLimit || !open;
  const supported = companies?.supported ?? [];
  const leads = companies?.leads ?? [];
  const start = startingPointOf(record);
  const reply = partnerReplyOf(session);
  const last = session.lastStep ?? null;

  // A failure this page saw, or one the session records (a reopened sheet): Try again re-sends the same stepId.
  const seen = sr.failure?.action === 'step' ? sr.failure : null;
  const recorded = !seen && last?.status === 'failed'
    ? { code: 'step_failed', reason: last.error ?? null, message: last.error === 'findings_full' ? COPY.server.findings_full : COPY.server.step_failed, attempt: { stepId: last.stepId, intent: last.intent, direction: directionOfStep(session, last.stepId), target: null, label: null } }
    : null;
  const failure = seen ?? recorded;
  const staleRunning = !running && last?.status === 'running';
  const staleAttempt = staleRunning ? { stepId: last.stepId, intent: last.intent, direction: directionOfStep(session, last.stepId), target: null, label: null } : null;
  const runStep = async (attempt) => {
    const answer = await sr.step(attempt);
    if (attempt.intent === 'direction' && answer?.ok && !answer.body?.error) setDirection('');
    return answer;
  };
  const retryOf = (attempt) => () => runStep(attempt);
  const withheld = (sr.stepOutcome?.summaryWithheld === true && sr.stepOutcome.stepId === last?.stepId) || (last?.status === 'completed' && last.summaryWithheld === true);
  const runningLabel = (() => {
    const p = sr.pending;
    if (!running || !p) return null;
    if (p.intent === 'examine') return COPY.running.examine(p.label ?? '');
    return COPY.running[p.intent] ?? COPY.running.next;
  })();
  const closeRefusal = sr.failure?.action === 'close' ? sr.failure : null;
  const readFailure = sr.failure?.action === 'read' ? sr.failure : null; // the earlier one, or back, did not load (review b6)
  const examineTarget = (c) => ({ symbol: c.symbol, relationshipFindingId: c.relationshipFindingId, openFindingId: c.openQuestion?.findingId ?? null });
  // One count everywhere (review a7): every finding the record holds, current and corrected — the server's own
  // findingsCount on the Continue row (store.js listOpen). The Evidence disclosure splits it: current · Earlier.
  const findingsCount = (record.findings?.length ?? 0) + (record.superseded?.length ?? 0);

  return (
    <div data-screen-label={`Work · ${running ? 'running' : state}`} style={S.col}>
      {viewingEarlier && (
        <>
          <div><LinkButton disabled={sr.pending !== null || sr.waiting} onClick={onBackToCurrent}>{COPY.backToCurrent}</LinkButton></div>
          <Notice role="status" tone="teal">{COPY.earlierNote}</Notice>
        </>
      )}
      {readFailure && <Notice role="alert" attrs={{ 'data-sr-read-failed': readFailure.code }}>{readFailure.code === 'network' ? COPY.loadFailed : readFailure.message}</Notice>}
      <div style={{ ...S.row, justifyContent: 'space-between' }}>
        <span style={S.meta} data-sr-state={state}>{COPY.stateLine(COPY.states[state] ?? COPY.states.open, formatWhen(record.lastTurnAt), findingsCount)}</span>
      </div>
      <h3 style={{ ...S.h3, fontSize: 18, lineHeight: 1.35, overflowWrap: 'anywhere' }} data-sr-question="">{record.question}</h3>

      {!viewingEarlier && previous && (
        <div style={S.row} data-sr-previous={previous.sessionId}>
          <span style={S.meta}>{COPY.previous(formatDay(previous.endedAt) ?? '')}</span>
          <span aria-hidden="true" style={S.small}>·</span>
          <LinkButton disabled={sr.pending !== null || sr.waiting} onClick={() => onOpenEarlier(previous.sessionId)}>{COPY.openEarlier}</LinkButton>
        </div>
      )}

      <section style={S.section} aria-label={start.story ? COPY.fromStory : start.words ? labelOf(start.words) : COPY.yourObs}>
        {start.story && <Finding finding={start.story} />}
        {start.words && <Finding finding={start.words} />}
        {start.claims.map((f) => <Finding key={f.findingId} finding={f} />)}
      </section>

      {state === 'completed' && <Notice role="status" tone="teal">{`${COPY.concluded} · ${formatDay(record.endedAt) ?? ''}. ${COPY.concludedBody}`}</Notice>}
      {state === 'abandoned' && <Notice role="status" tone="copper">{`${COPY.discarded} · ${formatDay(record.endedAt) ?? ''}. ${COPY.discardedBody}`}</Notice>}
      {state === 'saved' && <Notice role="status" tone="pos">{`${COPY.savedNotice} · ${formatDay(record.endedAt) ?? ''}`}</Notice>}

      <Answer record={record} storedRows={storedRows ?? []} entryKind={session.entry?.kind} open={open} blocked={blocked}
        onRefresh={() => sr.step({ intent: 'refresh', label: null })} />

      {(record.summary || supported.length > 0 || leads.length > 0) && (
        <section aria-label={COPY.companies} data-screen-label={`Companies · ${supported.length} supported · ${leads.length} leads`} style={S.section}>
          <div style={S.row}>
            <Eyebrow tone="teal" as="h3">{COPY.companies}</Eyebrow>
            {supported.length > 0 && <span style={S.small}>{COPY.supportedCount(supported.length)}</span>}
          </div>
          {supported.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: !phone && supported.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 10 }}>
              {supported.map((c) => (
                <CompanyCard key={c.symbol} company={c} findings={byId}
                  canExamine={open && !spent && !quota.stepLimit}
                  disabled={blocked}
                  adoptDisabled={running || sr.pending !== null}
                  onExamine={() => sr.step({ intent: 'examine', target: examineTarget(c), label: c.name })}
                  onAdopt={open ? () => onAdopt(c.symbol) : null} />
              ))}
            </div>
          ) : (
            <div style={{ ...S.box, borderStyle: 'dashed' }}><p style={S.meta}>{state === 'completed' ? COPY.noCompaniesEnded : COPY.noCompanies}</p></div>
          )}
          {leads.length > 0 && (
            <div style={S.section}>
              <Eyebrow>{COPY.leads}</Eyebrow>
              {leads.map((l) => <Lead key={`${l.symbol ?? ''}:${l.name}`} lead={l} findings={byId} />)}
            </div>
          )}
          <p style={S.small}>{COPY.separateJudgments}</p>
        </section>
      )}

      <LinesTable lines={lines} />

      {open && (
        <section data-screen-label={`Step · ${running ? 'running' : failure ? 'failed' : spent ? 'budget spent' : 'ready'}`} style={S.section}>
          {running && <Running attrs={{ 'data-sr-running': '' }}>{runningLabel}</Running>}
          {!running && staleRunning && (
            <Notice role="status" tone="gold" attrs={{ 'data-sr-was-running': '' }}>
              <span>{COPY.wasRunning}</span>
              {sr.canRetry(staleAttempt) && <> <span aria-hidden="true">·</span> <LinkButton disabled={blocked} onClick={retryOf(staleAttempt)}>{COPY.retry}</LinkButton></>}
            </Notice>
          )}
          {!running && failure && (
            <>
              <Notice role="alert" attrs={{ 'data-sr-step-failed': failure.code }}>{failure.message}</Notice>
              <div style={S.actions}>
                {RETRYABLE.has(failure.code) && failure.reason !== 'findings_full' && sr.canRetry(failure.attempt) && (
                  <Button kind="primary" disabled={sr.pending !== null || sr.waiting || spent} onClick={retryOf(failure.attempt)} attrs={{ 'data-sr-retry-step': '' }}>{COPY.retry}</Button>
                )}
                <span style={S.small}>{COPY.remaining(remaining)}</span>
              </div>
            </>
          )}
          {!running && spent && <Notice role="status" tone="gold" attrs={{ 'data-sr-limit': 'budget_spent' }}>{COPY.server.budget_spent}</Notice>}
          {!running && !spent && quota.stepLimit && <Notice role="status" tone="gold" attrs={{ 'data-sr-limit': 'step_limit' }}>{COPY.server.step_limit}</Notice>}
          {!running && !spent && next && (
            <div style={S.section}>
              <Button kind="primary" full={phone} disabled={blocked} onClick={() => sr.step({ intent: 'next', label: null })} label={`${splitNext(next.fact).label}. ${COPY.remaining(remaining)}`} attrs={{ 'data-sr-next': '' }}>
                {splitNext(next.fact).label}
              </Button>
              <div style={S.row}>
                <span style={S.small}>{COPY.remaining(remaining)}</span>
                <span style={S.small}>{COPY.stepNote}</span>
              </div>
            </div>
          )}
          {!running && !spent && noNext && <Notice tone="teal" attrs={{ 'data-sr-no-next': '' }}>{COPY.noNext}</Notice>}
        </section>
      )}

      {open && (
        <section data-screen-label="Direction" style={S.section}>
          <label htmlFor="sr-direction" style={S.label}>{COPY.examineHead}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: phone ? 'wrap' : 'nowrap' }}>
            <input id="sr-direction" value={direction} onChange={(e) => setDirection(e.target.value)} maxLength={500} disabled={blocked} placeholder={COPY.examinePlaceholder} style={{ ...S.input, flex: '1 1 200px' }} />
            <Button kind="primary" full={phone} disabled={blocked || !direction.trim()} onClick={() => runStep({ intent: 'direction', direction: direction.trim(), label: null })} attrs={{ 'data-sr-send': '' }}>{COPY.send}</Button>
          </div>
          <p style={S.small}>{COPY.examineHelp}</p>
        </section>
      )}

      {reply && (
        <section data-screen-label="Partner reply" style={S.box} data-sr-reply="">
          <div style={S.row}><Eyebrow tone="teal">{agentName}</Eyebrow><span style={S.small}>{formatWhen(reply.at)}</span></div>
          {paragraphs(reply.text)}
          {withheld && <p style={{ ...S.small, color: T.gold }} data-sr-withheld="">{COPY.withheld}</p>}
        </section>
      )}

      <Disclosure label={COPY.evidence} count={`${evidenceOf(record).length}${record.superseded?.length ? ` · ${COPY.earlierFindings(record.superseded.length)}` : ''}`} attrs={{ 'data-sr-evidence': '' }}>
        {evidenceOf(record).map((f) => <Finding key={f.findingId} finding={f} />)}
        {record.superseded?.length > 0 && (
          <div>
            <LinkButton expanded={earlierOpen} onClick={() => setEarlierOpen((v) => !v)}>{earlierOpen ? COPY.hideEarlier : COPY.earlierFindings(record.superseded.length)}</LinkButton>
            {earlierOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>{record.superseded.map((f) => <Finding key={f.findingId} finding={f} superseded />)}</div>}
          </div>
        )}
        <p style={S.small}>{COPY.evidenceNote}</p>
      </Disclosure>
      <Disclosure label={COPY.exchanges} count={String(session.exchanges?.length ?? 0)}>
        {(session.exchanges ?? []).map((x, i) => (
          <div key={`${x.at}:${i}`} style={{ ...S.card, gap: 4 }}>
            <div style={S.row}><span style={{ fontSize: 12, fontWeight: 700, color: x.who === 'player' ? T.ink : T.teal }}>{x.who === 'player' ? COPY.you : agentName}</span><span style={S.small}>{formatWhen(x.at)}</span></div>
            <p style={{ ...S.meta }}>{x.text}</p>
          </div>
        ))}
      </Disclosure>

      {closeRefusal && <Notice role="alert" attrs={{ 'data-sr-refusal': closeRefusal.code }}>{closeRefusal.message}</Notice>}
      {open && (
        <div data-screen-label="Sheet actions" style={{ ...S.section, paddingTop: 6, borderTop: `1px solid ${T.hair}` }}>
          <div style={S.actions}>
            <Button kind="secondary" full={phone} disabled={running || sr.pending !== null} onClick={() => sr.close('concluded')} attrs={{ 'data-sr-conclude': '' }}>{COPY.conclude}</Button>
            <Button kind="primary" full={phone} disabled={running || sr.pending !== null || supported.length === 0} onClick={() => onAdopt(null)} attrs={{ 'data-sr-adopt': '' }}>{COPY.adopt}</Button>
            <Button kind="ghost" full={phone} onClick={onClose}>{COPY.later}</Button>
            <LinkButton tone="copper" disabled={running || sr.pending !== null} onClick={onDiscard}>{COPY.discard}</LinkButton>
          </div>
          {supported.length === 0 && <p style={S.small}>{COPY.adoptBlocked}</p>}
        </div>
      )}
      {!open && !viewingEarlier && (
        <div style={{ ...S.actions, paddingTop: 6, borderTop: `1px solid ${T.hair}` }}>
          <Button kind="primary" full={phone} onClick={onClose}>{COPY.returnCC}</Button>
          <LinkButton onClick={onNewInvestigation}>{COPY.newInv}</LinkButton>
          <span style={S.small}>{COPY.newInvHelp}</span>
        </div>
      )}
    </div>
  );
}
