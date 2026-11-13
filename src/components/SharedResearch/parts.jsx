// src/components/SharedResearch/parts.jsx
//
// Shared Research — the sheet's small parts (spec §7.1 parts): tags, notices,
// the running line, disclosures, fields, buttons, a finding, a company card and
// a lead. Every word is SR_COPY's or the server's; every colour a token.
// Accessibility (K-10): role="status" on running lines, role="alert" on
// failures, aria-expanded on disclosures, 44 px targets.

import React, { useId, useState } from 'react';
import { SR_COPY as COPY } from './sharedResearchCopy';
import { T, S, wash, buttonStyle, linkStyle } from './sharedResearchStyle';
import { labelOf, toneOf, dateLineOf, sourceLabelOf, safeUrlOf, formatDay, withoutRole } from './sharedResearchView';
import { ELIGIBILITY_LABELS } from '../../constants/sharedResearch';

export function Eyebrow({ children, tone = null, as = 'div' }) {
  return React.createElement(as, { style: { ...S.eyebrow, color: tone ? T[tone] : T.ink3 } }, children);
}

export function Tag({ tone = 'ink3', children, dim = false }) {
  const color = T[tone] ?? T.ink3;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, lineHeight: 1.5, color, background: dim ? 'transparent' : wash(tone === 'ink3' ? 'ink-2' : tone, 0.1), border: `1px solid ${dim ? T.hair : wash(tone === 'ink3' ? 'ink-2' : tone, 0.35)}`, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
      {children}
    </span>
  );
}

/** The label a finding wears, from (kind, status, statusReason) only. */
export function StatusTag({ finding }) {
  return <Tag tone={toneOf(finding)}>{labelOf(finding)}</Tag>;
}

export function Notice({ tone = 'copper', role = undefined, children, attrs = {} }) {
  return (
    <div role={role} {...attrs} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: wash(tone, 0.08), border: `1px solid ${wash(tone, 0.35)}`, minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: T[tone], flexShrink: 0, marginTop: 7 }} />
      <div style={{ ...S.body, fontSize: 13.5, flex: 1 }}>{children}</div>
    </div>
  );
}

/** A request in flight — and only then (K-8). A still dot: no motion to reduce. */
export function Running({ children, attrs = {} }) {
  return (
    <div role="status" aria-live="polite" {...attrs} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '10px 14px', borderRadius: 14, background: wash('teal', 0.08), border: `1px solid ${wash('teal', 0.4)}` }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: T.teal, flexShrink: 0 }} />
      <span style={{ ...S.body, fontWeight: 600 }}>{children}</span>
    </div>
  );
}

export function Button({ kind = 'secondary', full = false, disabled = false, onClick, children, label, attrs = {} }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={label} {...attrs} style={buttonStyle(kind, { full, disabled })}>
      {children}
    </button>
  );
}

export function LinkButton({ onClick, children, expanded, controls, disabled = false, tone = null, label, attrs = {} }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-expanded={expanded} aria-controls={controls} aria-label={label} {...attrs} style={{ ...linkStyle, ...(tone ? { color: T[tone] } : {}), ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
      {children}
    </button>
  );
}

export function Disclosure({ label, count = null, children, attrs = {} }) {
  const [open, setOpen] = useState(false);
  const id = `sr-disclosure${useId()}`;
  return (
    <section {...attrs} style={{ borderRadius: 14, border: `1px solid ${T.hair}`, background: T.surface, overflow: 'hidden' }}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} style={{ appearance: 'none', font: 'inherit', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '8px 14px', textAlign: 'left', color: T.ink }}>
        <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
        {count !== null && <span style={{ fontSize: 12, color: T.ink3 }}>{count}</span>}
        <span aria-hidden="true" style={{ color: T.ink3 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div id={id} style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </section>
  );
}

export function Field({ id, label, help = null, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={S.label}>{label}</label>
      {children}
      {help && <p style={{ ...S.small, marginTop: 6 }}>{help}</p>}
    </div>
  );
}

/** A finding's date line (K-6 g): its own date (and "published"), or "Undated · read {date}" — never the read as the fact's date. */
export function DateLine({ finding }) {
  const d = dateLineOf(finding);
  if (!d) return null;
  if (d.kind === 'undated') return <span data-sr-date="undated">{COPY.undated(d.text)}</span>;
  return <span data-sr-date="dated">{d.published && d.published !== d.text ? `${d.text} · ${COPY.published(d.published)}` : d.text}</span>;
}

/** One finding: its label, its fact, its source and dates, its reason when unresolved. */
export function Finding({ finding, superseded = false }) {
  const url = safeUrlOf(finding);
  const source = sourceLabelOf(finding);
  const words = finding.kind === 'observation';
  return (
    <div data-sr-finding={finding.findingId} style={{ padding: '10px 12px', borderRadius: 12, background: T.bg, border: `1px solid ${superseded ? T.hair : wash(toneOf(finding), 0.3)}`, display: 'flex', flexDirection: 'column', gap: 6, opacity: superseded ? 0.8 : 1, minWidth: 0 }}>
      <div style={S.row}>
        <StatusTag finding={finding} />
        {superseded && <Tag dim>{COPY.superseded}</Tag>}
      </div>
      <p style={{ ...S.body, fontSize: 13.5, color: superseded ? T.ink2 : T.ink }}>{finding.fact}</p>
      <div style={{ ...S.small, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {words && formatDay(finding.at) ? <span>{COPY.youWhen(formatDay(finding.at))}</span> : null}
        {!words && source && <span>{source}</span>}
        {!words && <DateLine finding={finding} />}
        {url && <a href={url} target="_blank" rel="noreferrer noopener" style={{ color: T.teal }}>{COPY.openSource}</a>}
      </div>
    </div>
  );
}

/** A supported company (spec §4.4): the server's card, its evidence, its open question, its eligibility, its two actions. */
export function CompanyCard({ company, findings, canExamine, onExamine, onAdopt, disabled = false }) {
  const [open, setOpen] = useState(false);
  const id = `sr-company${useId()}`;
  const evidence = company.evidence.map((fid) => findings.get(fid)).filter(Boolean);
  return (
    <div data-sr-company={company.symbol} style={{ ...S.card, border: `1px solid ${wash('teal', 0.3)}` }}>
      <div style={S.row}>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, overflowWrap: 'anywhere' }}>{company.name}</span>
        <Tag tone="teal" dim>{company.role}</Tag>
        <span style={{ fontSize: 12.5, color: T.ink3 }}>{company.symbol}</span>
      </div>
      <p style={S.body}>{company.relationship}</p>
      {company.openQuestion && (
        <p style={{ ...S.meta }}><span style={{ color: T.ink3 }}>{COPY.stillOpen}</span>{withoutRole(company.openQuestion.fact)}</p>
      )}
      <div style={S.row}>
        <span style={S.small}>{ELIGIBILITY_LABELS[company.eligibility] ?? ELIGIBILITY_LABELS.unresolved}</span>
        <LinkButton expanded={open} controls={id} onClick={() => setOpen((v) => !v)}>{open ? COPY.hideEvidence : COPY.evidenceN(evidence.length)}</LinkButton>
      </div>
      {open && <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{evidence.map((f) => <Finding key={f.findingId} finding={f} />)}</div>}
      <div style={S.actions}>
        {canExamine && <Button kind="primary" disabled={disabled} onClick={onExamine} label={COPY.examineLabel(company.name)} attrs={{ 'data-sr-examine': company.symbol }}>{COPY.examine}</Button>}
        {onAdopt && <Button kind="secondary" disabled={disabled} onClick={onAdopt} label={COPY.toIdeaLabel(company.name)} attrs={{ 'data-sr-adopt-from': company.symbol }}>{COPY.toIdea}</Button>}
      </div>
    </div>
  );
}

/**
 * A lead (spec §4.4): named, never an adoption choice. The lead's own label is the server's: a company it could not
 * identify (`unresolved: 'identity_unresolved'`) is Unresolved with that reason; otherwise the status of its best
 * finding. That finding keeps its own label below it — a sourced fact ABOUT a lead (that it is privately held) is
 * Source-backed, while the lead stays unresolved.
 */
export function Lead({ lead, findings }) {
  const best = lead.findingIds.map((fid) => findings.get(fid)).filter(Boolean).find((f) => f.status === lead.status) ?? null;
  const own = lead.unresolved
    ? { kind: 'relationship', status: 'unavailable', statusReason: lead.unresolved }
    : { kind: best?.kind ?? 'relationship', status: lead.status, statusReason: lead.statusReason };
  return (
    <div data-sr-lead={lead.name} style={{ ...S.card, border: `1px dashed ${T.hair}` }}>
      <div style={S.row}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, overflowWrap: 'anywhere' }}>{lead.name}</span>
        <StatusTag finding={own} />
      </div>
      {best && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <StatusTag finding={best} />
          <p style={{ ...S.meta, flex: '1 1 200px' }}>{best.fact}</p>
        </div>
      )}
      <p style={S.small}>{COPY.leadNote}</p>
    </div>
  );
}
