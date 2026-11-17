// src/components/SharedResearch/builderParts.jsx
//
// Shared Research — THE THESIS BUILDER'S PARTS (B4 build prompt K-5 to K-11, K-17;
// design of record R3 / R3b on the sentence card C-B): the card's head, rail,
// sentence and why; the strip it folds to; a tapped part's panel; the two kinds of
// choice (a research step and a free tap never look alike, K-5); the names pick;
// the why proposal; the composer; the conversation's lines; Change's confirm.
//
// Every word is SR_COPY's, the shared vocabulary's or the server's; every colour a
// --ft-* token through the bridge; no motion of the body's own (the still dot of
// B2's running line), so reduced motion is instant by construction. Every button
// these parts draw is one entry of `thesis.choices` handed in by the caller.

import React, { useEffect, useId, useState } from 'react';
import { SR_COPY as COPY } from './sharedResearchCopy';
import { T, S, wash, buttonStyle, linkStyle } from './sharedResearchStyle';
import { Finding, LinkButton, Tag } from './parts';
import { withoutRole } from './sharedResearchView';
import { joinNames, horizonLabelOf, slotOf, sentenceRunsOf, confirmMarkOf, partFindingIdsOf } from './thesisView';
import { STATUS_LABELS, THESIS_PARTS } from '../../constants/sharedResearch';

const B = COPY.builder;
const SOURCE_BACKED = STATUS_LABELS.verified;

// ── small marks ───────────────────────────────────────────────────────────────

/** A small uppercase mark ("1 step", "free", "Atlas's pick"). */
export function Mark({ children, tone = 'ink3', solid = false, attrs = {} }) {
  const color = solid ? T.bg : tone === 'ink3' ? T.ink3 : T[tone];
  return (
    <span {...attrs} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', color, background: solid ? T[tone] : 'transparent', padding: solid ? '3px 7px' : 0, borderRadius: 6, lineHeight: 1.4 }}>
      {children}
    </span>
  );
}

/** A count of sources, as the card writes it ("3 sources"). */
export const Count = ({ n }) => <span style={{ fontSize: 12, color: T.ink2, whiteSpace: 'nowrap' }}>{B.sources(n)}</span>;

function SearchGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, color: T.teal }}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

// ── the two kinds of choice (K-5) ───────────────────────────────────────────────

/**
 * A RESEARCH choice: one step. Tinted, a search mark, a solid "1 step" tag and the steps left — never mistaken for a
 * free tap (K-5).
 */
export function ResearchButton({ label, stepsLeft, onClick, disabled = false, attrs = {} }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} {...attrs}
      style={{ ...buttonStyle('secondary', { full: true, disabled }), justifyContent: 'flex-start', minHeight: 50, padding: '8px 12px 8px 14px', background: wash('teal', 0.12), border: `1px solid ${wash('teal', 0.5)}` }}>
      <SearchGlyph />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{label}</span>
        <span style={{ fontSize: 12, color: T.ink2, lineHeight: 1.35 }}>{B.stepsLeft(stepsLeft)}</span>
      </span>
      <Mark tone="teal" solid attrs={{ 'data-sr-cost': 'step' }}>{B.oneStep}</Mark>
    </button>
  );
}

/**
 * A FREE choice: no step, no model call. A hairline outline and "free". A marked one (the agent's pick, a suggestion)
 * carries its mark, its one-line reason and that reason's tag (K-10).
 */
export function FreeButton({ label, sub = null, mark = null, reason = null, reasonTag = null, trail = B.free, strong = false, onClick, disabled = false, attrs = {} }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} {...attrs}
      style={{ ...buttonStyle('secondary', { full: true, disabled }), justifyContent: 'flex-start', minHeight: 46, padding: '7px 14px', background: 'transparent', border: `1px solid ${mark ? wash('teal', 0.5) : strong ? wash('ink', 0.4) : T.hair}` }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {mark && <Mark tone="teal" attrs={{ 'data-sr-mark': '' }}>{mark}</Mark>}
        <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{label}</span>
        {sub && <span style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.35 }}>{sub}</span>}
        {reason && (
          <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }} data-sr-pick-reason="">
            {reason} {reasonTag && <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Tag tone={reasonTag.tone}>{reasonTag.text}</Tag></span>}
          </span>
        )}
      </span>
      {trail && <Mark attrs={{ 'data-sr-cost': 'free' }}>{trail}</Mark>}
    </button>
  );
}

/** The tag a reason wears, from its own `basis` as the server labels it (§B10 S-B3; K-10). */
export const basisTagOf = (basis, agentName) => (basis === 'source' ? { tone: 'teal', text: SOURCE_BACKED } : { tone: 'gold', text: B.reasoningTag(agentName) });

/**
 * The words a free choice is drawn with — read off the server's entry and the card it came with. Marked confirms
 * (K-10) say whose pick or suggestion they are and why; nothing here decides what is offered.
 */
export function freeLabelOf(choice, thesis, agentName) {
  const { op, part, value } = choice;
  const mark = confirmMarkOf(choice, thesis);
  const pick = thesis?.pick ?? null;
  const reasoning = pick ? basisTagOf(pick.basis, agentName) : null;
  if (part === 'theme') return { label: B.useTheme(value), mark: B.suggestedTag(agentName) };
  if (part === 'segment') {
    const line = (thesis?.parts?.segment?.map ?? []).find((m) => m.label === value)?.line ?? null;
    if (mark === 'pick') return { label: value, sub: line, mark: B.pickTag(agentName), reason: pick.reason, reasonTag: reasoning };
    if (mark === 'asked') return { label: B.confirmValue(value), sub: line, strong: true };
    return { label: value, sub: line };
  }
  if (part === 'names') {
    if (choice.reason === 'drop_unsourced') return { label: B.dropUnsourced(joinNames(value)) };
    if (op === 'confirm') return mark === 'asked' ? { label: B.confirmValue(joinNames(value)), strong: true } : { label: B.namesPick(joinNames(value)), mark: B.pickTag(agentName), reason: pick?.reason ?? null, reasonTag: reasoning };
  }
  if (part === 'why') return op === 'confirm' ? { label: choice.revised ? B.useRevised : B.confirmWhy, strong: true } : { label: B.keepSome };
  if (part === 'wrongIf') {
    const text = op === 'confirm' ? value : thesis?.parts?.wrongIf?.options?.[value?.option]?.text ?? '';
    if (mark === 'pick') return { label: text, mark: B.pickTag(agentName), reason: pick.reason, reasonTag: reasoning };
    if (mark === 'asked') return { label: B.confirmValue(text), strong: true };
    return { label: text };
  }
  if (part === 'timeFrame') {
    const label = horizonLabelOf(value) ?? String(value ?? '');
    if (mark === 'suggestion') {
      const s = thesis?.parts?.timeFrame?.suggestion;
      return { label, mark: B.suggestedTag(agentName), reason: s?.reason ?? null, reasonTag: s?.reason ? { tone: 'gold', text: B.reasoningTag(agentName) } : null };
    }
    if (mark === 'pick') return { label, mark: B.pickTag(agentName), reason: pick.reason, reasonTag: reasoning };
    if (mark === 'asked') return { label: B.confirmValue(label), strong: true };
    return { label };
  }
  return { label: String(value ?? '') };
}

/** A research choice's words (K-5): the goal's label; strengthen names its part. */
export const researchLabelOf = (g) => (g.goal === 'strengthen' ? B.strengthenPart(B.parts[g.part] ?? g.part) : B.goals[g.goal] ?? g.goal);

// ── the conversation's lines (K-9; R3 Said / Mine / Changed) ──────────────────────

export function Said({ name, children, attrs = {} }) {
  return (
    <div {...attrs} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ ...S.eyebrow, color: T.teal }}>{name}</span>
      <div style={{ fontSize: 15, color: T.ink, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 8, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

export function Mine({ children, tag = null, attrs = {} }) {
  return (
    <div {...attrs} style={{ alignSelf: 'flex-end', maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 0 }}>
      <div style={{ padding: '8px 12px', borderRadius: '14px 14px 4px 14px', background: T.raised, fontSize: 14.5, color: T.ink, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{children}</div>
      {tag && <Mark>{tag}</Mark>}
    </div>
  );
}

export function CardLine({ children, tone = 'teal', attrs = {} }) {
  return (
    <div {...attrs} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, letterSpacing: '0.02em', color: T.ink2, lineHeight: 1.4 }}>
      <span aria-hidden="true" style={{ width: 14, height: 1.5, background: T[tone], flexShrink: 0 }} />
      <span style={{ overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

// ── the card (K-7; R3b CardB2) ─────────────────────────────────────────────────

/** The rail: one bar per part, by the state the server derives (set teal, stale copper, suggested a teal wash). */
export function Rail({ thesis, working = null }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
      {THESIS_PARTS.map((p) => {
        const st = thesis?.parts?.[p]?.state;
        const bg = st === 'set' ? T.teal : st === 'stale' ? T.copper : st === 'suggested' || working === p ? wash('teal', 0.45) : T.hair;
        return <span key={p} data-sr-rail={p} data-sr-rail-state={st ?? 'unset'} style={{ flex: 1, height: 4, borderRadius: 2, background: bg }} />;
      })}
    </div>
  );
}

export function CardHead({ thesis, stepsLeft, ready = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ ...S.eyebrow, color: T.teal }}>{ready ? B.thesisReady : B.thesis}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap' }} data-sr-filled={thesis?.filled ?? 0}>{B.filled(thesis?.filled ?? 0)}</span>
      <span style={{ fontSize: 12, color: T.ink2, marginLeft: 'auto', whiteSpace: 'nowrap' }} data-sr-steps-left={stepsLeft}>{B.stepsLeft(stepsLeft)}</span>
    </div>
  );
}

const slotButton = {
  appearance: 'none', font: 'inherit', background: 'none', border: 'none', margin: '-6px 0', padding: '6px 0', cursor: 'pointer', display: 'inline',
  textAlign: 'left', lineHeight: 'inherit', color: 'inherit',
};

/** One part's slot in the sentence while the card fills in: its value, its suggestion (never drawn as filled), its stale mark, or a blank. */
function Slot({ thesis, part, working, tapped, onTap, panelId, agentName }) {
  const slot = slotOf(thesis, part);
  const open = tapped === part;
  let inner;
  if (working === part) {
    inner = <span style={{ fontSize: '0.8em', fontWeight: 600, color: T.teal, borderBottom: `1.5px dashed ${wash('teal', 0.6)}` }}><span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: T.teal, marginRight: 6, verticalAlign: 'middle' }} />{B.working(agentName)}</span>;
  } else if (slot.state === 'set') {
    inner = <span style={{ color: T.ink, fontWeight: 700, borderBottom: `2px solid ${open ? T.teal : wash('teal', 0.5)}`, background: open ? wash('teal', 0.2) : 'transparent', borderRadius: open ? '4px 4px 0 0' : 0 }}>{slot.skipped ? B.skipped : slot.text}</span>;
  } else if (slot.state === 'stale') {
    inner = <span style={{ color: T.ink2, fontWeight: 600, borderBottom: `1.5px dashed ${T.copper}` }}>{slot.skipped ? B.skipped : slot.text} <span style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.copper }} data-sr-stale-mark="">{B.stale}</span></span>;
  } else if (slot.state === 'suggested' && slot.text) {
    inner = <span style={{ color: T.ink2, fontWeight: 600, borderBottom: `1.5px dashed ${wash('teal', 0.7)}` }}>{slot.text} <span style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.teal }} data-sr-suggested-mark="">{B.suggested}</span></span>;
  } else {
    inner = <span style={{ fontSize: '0.7em', letterSpacing: '0.03em', color: T.ink3, borderBottom: `1.5px dashed ${T.hair}`, padding: '0 6px 1px', whiteSpace: 'nowrap' }}>{B.blank[part]}</span>;
  }
  return (
    <button type="button" style={slotButton} aria-expanded={open} aria-controls={panelId} onClick={() => onTap(open ? null : part)}
      data-sr-slot={part} data-sr-slot-state={slot.state}>
      {inner}
    </button>
  );
}

/**
 * The card's sentence (K-7). While the card fills in, the sentence is its parts in the card's frame, each a slot to tap.
 * Once the server composes it (`thesis.sentence`), that sentence is drawn AS RECEIVED, its set parts found in it and
 * made tappable where they stand (sentenceRunsOf) — never composed here.
 */
export function Sentence({ thesis, working = null, tapped, onTap, panelId, agentName, size = 16.5 }) {
  const p = { margin: 0, fontSize: size, lineHeight: 1.6, fontWeight: 500, color: T.ink2, overflowWrap: 'anywhere' };
  if (typeof thesis?.sentence === 'string' && thesis.sentence && !working) {
    return (
      <p style={p} data-sr-sentence="server">
        {sentenceRunsOf(thesis.sentence, thesis).map((r, i) => (r.part
          ? <button key={i} type="button" style={slotButton} aria-expanded={tapped === r.part} aria-controls={panelId} onClick={() => onTap(tapped === r.part ? null : r.part)} data-sr-slot={r.part} data-sr-slot-state={r.state}>
            {r.state === 'stale'
              ? <span style={{ color: T.ink2, fontWeight: 600, borderBottom: `1.5px dashed ${T.copper}` }}>{r.text}</span>
              : <span style={{ color: T.ink, fontWeight: 700, borderBottom: `2px solid ${tapped === r.part ? T.teal : wash('teal', 0.5)}`, background: tapped === r.part ? wash('teal', 0.2) : 'transparent' }}>{r.text}</span>}
            {r.state === 'stale' && <span style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.copper, marginLeft: 4 }} data-sr-stale-mark="">{B.stale}</span>}
          </button>
          : <React.Fragment key={i}>{r.text}</React.Fragment>))}
      </p>
    );
  }
  const slot = (part) => <Slot thesis={thesis} part={part} working={working} tapped={tapped} onTap={onTap} panelId={panelId} agentName={agentName} />;
  return (
    <p style={p} data-sr-sentence="slots">
      {B.frame.theme} {slot('theme')}{B.frame.segment} {slot('segment')}{B.frame.names} {slot('names')}{B.frame.why} {slot('why')}{B.frame.wrongIf} {slot('wrongIf')}{B.frame.timeFrame} {slot('timeFrame')}{B.frame.end}
    </p>
  );
}

/** One reason line: the name (in a group), the text, its tag and its sources. */
function ReasonLine({ lead, text, findingIds, basis = 'source', agentName, attrs = {} }) {
  const tag = basisTagOf(basis, agentName);
  return (
    <div {...attrs} style={{ display: 'grid', gridTemplateColumns: `${lead.length > 2 ? 46 : 16}px minmax(0,1fr)`, gap: 6, fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: lead.length > 2 ? T.ink : T.ink3, paddingTop: 1 }}>{lead}</span>
      <span style={{ overflowWrap: 'anywhere' }}>{text} <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', verticalAlign: 'middle', flexWrap: 'wrap' }}><Tag tone={tag.tone}>{tag.text}</Tag>{findingIds?.length > 0 && <Count n={findingIds.length} />}</span></span>
    </div>
  );
}

/** The point against, or "No point against found yet" (§B4.2 rule 2: never hide the absence). */
function AgainstLine({ against }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-sr-against="">
      <span style={{ ...S.eyebrow, color: T.copper }}>{B.against}</span>
      {against
        ? <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{against.text} <span style={{ display: 'inline-flex', gap: 6, verticalAlign: 'middle' }}><Tag tone="teal">{SOURCE_BACKED}</Tag><Count n={against.findingIds?.length ?? 0} /></span></div>
        : <span style={S.small}>{B.noAgainst}</span>}
    </div>
  );
}

/**
 * The why block (R3b WhyBlock2), once the why holds a value: its reasons — numbered for one name, one per name for a
 * group — and the point against. `folded` rests the reasons on a count (R3 T4); the point against stays in full.
 */
export function WhyBlock({ thesis, agentName, folded = false }) {
  const why = thesis?.parts?.why ?? {};
  const [open, setOpen] = useState(!folded);
  useEffect(() => { setOpen(!folded); }, [folded]);
  const reasons = Array.isArray(why.reasons) ? why.reasons : [];
  const group = (thesis?.parts?.names?.value?.length ?? 0) > 1;
  const total = [...reasons.flatMap((r) => r.findingIds ?? []), ...(why.against?.findingIds ?? [])].filter((x, i, a) => a.indexOf(x) === i).length;
  const id = `sr-why${useId()}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-sr-why-block="">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...S.eyebrow, color: T.teal }}>{B.why}</span>
        <span style={{ fontSize: 12.5, color: T.ink2 }}>{group ? B.perName : B.reasons(reasons.length)}</span>
        <Count n={total} />
        {folded && <LinkButton expanded={open} controls={id} onClick={() => setOpen((v) => !v)}>{open ? B.hideReasons : B.showReasons}</LinkButton>}
      </div>
      {open && (
        <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reasons.map((r, i) => <ReasonLine key={`${r.symbol}:${i}`} lead={group ? r.symbol : String(i + 1)} text={r.text} findingIds={r.findingIds} agentName={agentName} attrs={{ 'data-sr-reason': r.symbol }} />)}
        </div>
      )}
      <AgainstLine against={why.against ?? null} />
    </div>
  );
}

/**
 * A why PROPOSAL (K-11): the shared reason, one reason per name with its sources, the names that have no Source-backed
 * reason yet (the server's `incomplete`), and the point against. Nothing in it is set until the player confirms.
 */
export function WhyProposal({ proposal, agentName, title = null, attrs = {} }) {
  if (!proposal) return null;
  const incomplete = Array.isArray(proposal.incomplete) ? proposal.incomplete : [];
  const group = (proposal.forNames?.length ?? 0) > 1 || new Set((proposal.reasons ?? []).map((r) => r.symbol)).size > 1;
  return (
    <div {...attrs} style={{ ...S.card, gap: 8, border: `1px dashed ${wash('teal', 0.5)}` }}>
      <div style={S.row}><Mark tone="teal">{title ?? B.proposal(agentName)}</Mark><Mark>{B.suggested}</Mark></div>
      {proposal.shared && <p style={{ ...S.body, fontWeight: 600 }} data-sr-proposal-shared="">{proposal.shared}</p>}
      {(proposal.reasons ?? []).map((r, i) => <ReasonLine key={`${r.symbol}:${i}`} lead={group ? r.symbol : String(i + 1)} text={r.text} findingIds={r.findingIds} agentName={agentName} attrs={{ 'data-sr-proposal-reason': r.symbol }} />)}
      {incomplete.map((s) => <p key={s} style={{ ...S.small, color: T.copper }} data-sr-incomplete={s}>{`${s} · ${B.noReasonYet}`}</p>)}
      <AgainstLine against={proposal.against ?? null} />
    </div>
  );
}

/** The strip the card folds to while the conversation scrolls (R3 StripB): the rail, what is set, the counts. */
export function Strip({ thesis, stepsLeft, onOpen }) {
  const crumbs = ['theme', 'segment', 'names'].map((p) => slotOf(thesis, p)).filter((s) => s.state === 'set' && (s.text || s.skipped)).map((s) => (s.skipped ? B.skipped : s.text));
  return (
    <button type="button" onClick={onOpen} aria-label={B.stripOpen} data-sr-strip=""
      style={{ appearance: 'none', font: 'inherit', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 12, color: T.ink, boxSizing: 'border-box' }}>
      <Rail thesis={thesis} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crumbs.length ? crumbs.join(' › ') : B.strip}</span>
        <span style={{ fontSize: 11.5, color: T.ink2, whiteSpace: 'nowrap' }}>{`${B.filled(thesis?.filled ?? 0)} · ${B.stepsLeft(stepsLeft)}`}</span>
        <span aria-hidden="true" style={{ color: T.ink3 }}>▾</span>
      </span>
    </button>
  );
}

// ── Change asks first (K-8) ─────────────────────────────────────────────────────

/** "Changing Segment also clears Names and Why." — from the choice's own `clears`, before anything is sent. */
export function ClearConfirm({ choice, onConfirm, onCancel, disabled = false }) {
  const others = (choice.clears ?? []).map((p) => B.parts[p] ?? B.priceLinesName);
  return (
    <div role="alertdialog" aria-label={B.change} data-sr-clear-confirm={choice.part} style={{ ...S.card, gap: 10, border: `1px solid ${wash('copper', 0.5)}`, background: wash('copper', 0.06) }}>
      <p style={S.body}>{B.clearsAlso(choice.reason === 'drop_unsourced' ? B.parts.names : B.parts[choice.part], joinNames(others))}</p>
      <div style={S.actions}>
        <button type="button" disabled={disabled} onClick={disabled ? undefined : onConfirm} style={buttonStyle('danger', { disabled })} data-sr-clear-yes="">{B.changeIt}</button>
        <button type="button" onClick={onCancel} style={buttonStyle('ghost')} data-sr-clear-no="">{B.keepIt}</button>
      </div>
    </div>
  );
}

// ── the names pick (K-10b; R3 T3) ────────────────────────────────────────────────

/**
 * The server's `set names` choice drawn as rows to tick — each supported company with its symbol, name, one-line
 * relationship and source count (`companies.supported`) — with the count allowed and ONE free button that sends the
 * ticked symbols. The agent's names pick is marked on its rows and has its own confirm. Leads are shown, not tickable.
 */
export function NamesPick({ choice, pickConfirm, thesis, companies, agentName, onSend, onConfirmPick, disabled = false }) {
  const [ticked, setTicked] = useState([]);
  const supported = Array.isArray(companies?.supported) ? companies.supported : [];
  const leads = Array.isArray(companies?.leads) ? companies.leads : [];
  const picked = thesis?.pick?.part === 'names' && !thesis.pick.asked && Array.isArray(thesis.pick.value) ? thesis.pick.value : [];
  const min = Number.isSafeInteger(choice.min) ? choice.min : 1;
  const max = Number.isSafeInteger(choice.max) ? choice.max : 4;
  const ok = ticked.length >= min && ticked.length <= max;
  const toggle = (s) => setTicked((t) => (t.includes(s) ? t.filter((x) => x !== s) : (choice.options ?? []).filter((x) => x === s || t.includes(x))));
  const pickLabel = pickConfirm ? freeLabelOf(pickConfirm, thesis, agentName) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-sr-names-pick="">
      <p style={S.small}>{B.namesHelp(min, max)}</p>
      <div role="group" aria-label={B.parts.names} style={{ display: 'flex', flexDirection: 'column' }}>
        {(choice.options ?? []).map((s) => {
          const c = supported.find((x) => x.symbol === s);
          const on = ticked.includes(s);
          return (
            <label key={s} data-sr-name-row={s} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'start', padding: '9px 0', borderTop: `1px solid ${T.hair}`, cursor: disabled ? 'not-allowed' : 'pointer', minHeight: 44 }}>
              <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(s)} style={{ width: 18, height: 18, marginTop: 2 }} />
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={S.row}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{s}</span>
                  {c?.name && <span style={{ fontSize: 12.5, color: T.ink2, overflowWrap: 'anywhere' }}>{c.name}</span>}
                  {picked.includes(s) && <Mark tone="teal" attrs={{ 'data-sr-name-pick': s }}>{B.pickTag(agentName)}</Mark>}
                </span>
                {c?.relationship && <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{withoutRole(c.relationship)}</span>}
              </span>
              <Count n={c?.evidence?.length ?? 0} />
            </label>
          );
        })}
        {leads.map((l) => (
          <div key={`${l.symbol ?? ''}:${l.name}`} data-sr-name-lead={l.name} style={{ padding: '9px 0 0 30px', borderTop: `1px dashed ${T.hair}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink2, overflowWrap: 'anywhere' }}>{l.name}</span>
            <Tag dim>{B.lead}</Tag>
          </div>
        ))}
      </div>
      {pickConfirm && <FreeButton {...pickLabel} disabled={disabled} onClick={onConfirmPick} attrs={{ 'data-sr-free': 'confirm:names' }} />}
      <FreeButton label={B.namesBuild(Math.max(ticked.length, 1))} strong disabled={disabled || !ok} onClick={() => onSend(ticked)} attrs={{ 'data-sr-free': 'set:names' }} />
    </div>
  );
}

/** The why's "Keep some of the reasons": the proposal's reasons to tick, then one free button with `{ keep }`. */
export function KeepReasons({ choice, proposal, agentName, onSend, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState(() => (choice.options ?? []).slice());
  const reasons = proposal?.reasons ?? [];
  if (!open) return <FreeButton label={B.keepSome} disabled={disabled} onClick={() => setOpen(true)} attrs={{ 'data-sr-free': 'set:why:open' }} />;
  return (
    <div style={{ ...S.card, gap: 6 }} data-sr-keep-reasons="">
      {(choice.options ?? []).map((i) => (
        <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={keep.includes(i)} disabled={disabled} onChange={() => setKeep((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i].sort((a, b) => a - b)))} style={{ width: 18, height: 18, marginTop: 2 }} />
          <ReasonLine lead={reasons[i]?.symbol ?? String(i + 1)} text={reasons[i]?.text ?? ''} findingIds={reasons[i]?.findingIds ?? []} agentName={agentName} />
        </label>
      ))}
      <FreeButton label={B.keepTicked} strong disabled={disabled || keep.length === 0} onClick={() => onSend({ keep })} attrs={{ 'data-sr-free': 'set:why' }} />
    </div>
  );
}

// ── the composer (K-6) ──────────────────────────────────────────────────────────

/**
 * One mode at a time, shown beside Send: FREE — the part in front's own text box (the theme, the wrong if), with its
 * placeholder — or DIRECTION, one step. With the mode free and direction on offer, "Point {agent} somewhere · 1 step"
 * switches it. A direction is never sent as free text, nor the reverse.
 */
export function Composer({ textChoice, directionOn, agentName, onFree, onDirection, disabled = false }) {
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState('');
  const key = textChoice ? `${textChoice.part}` : 'none';
  useEffect(() => { setMode(null); setValue(''); }, [key]);
  const effective = textChoice ? (mode === 'direction' && directionOn ? 'direction' : 'free') : (directionOn ? 'direction' : null);
  if (!effective) return null;
  const max = effective === 'free' && Number.isSafeInteger(textChoice?.max) ? textChoice.max : 500;
  const placeholder = effective === 'free' ? B.placeholder[textChoice.part] ?? '' : B.directionPlaceholder(agentName);
  const send = async () => {
    const words = value.trim();
    if (!words) return;
    const answer = effective === 'free' ? await onFree(textChoice, words) : await onDirection(words);
    if (answer?.ok && !answer.body?.error) setValue('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-sr-composer={effective}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input id="sr-composer" value={value} onChange={(e) => setValue(e.target.value)} maxLength={max} disabled={disabled} placeholder={placeholder} aria-label={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!disabled) send(); } }}
          style={{ ...S.input, flex: '1 1 160px', minWidth: 0 }} />
        <button type="button" disabled={disabled || !value.trim()} onClick={send} data-sr-composer-send={effective}
          style={{ ...buttonStyle(effective === 'free' ? 'secondary' : 'primary', { disabled: disabled || !value.trim() }), flexDirection: 'column', gap: 0, minWidth: 64, padding: '4px 10px' }}>
          <span>{B.send}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }} data-sr-cost={effective === 'free' ? 'free' : 'step'}>{effective === 'free' ? B.free : B.oneStep}</span>
        </button>
      </div>
      {textChoice && directionOn && (
        <div>
          <LinkButton onClick={() => setMode(effective === 'free' ? 'direction' : null)} attrs={{ 'data-sr-composer-switch': effective === 'free' ? 'direction' : 'free' }}>
            {effective === 'free' ? `${B.pointAgent(agentName)} · ${B.oneStep}` : `${B.writeItMyself} · ${B.free}`}
          </LinkButton>
        </div>
      )}
    </div>
  );
}

// ── a tapped part (K-7) ─────────────────────────────────────────────────────────

/** Who set a part, in words (`by` → "you wrote" · "you chose" · "{agent} suggested · you confirmed"). */
export const whoSetOf = (by, agentName) => (Object.hasOwn(B.by, by ?? '') ? B.by[by](agentName) : null);

/**
 * The panel a tapped part opens: who set it, its sources (the count, or "Your words · no sources"), its evidence (the
 * part's finding ids resolved on the record, drawn with today's finding rows), and Change — or, for the theme, that a
 * different theme is a new investigation. The part's other choices ride along (`children`).
 */
export function PartPanel({ id, part, thesis, companies, byId, agentName, onClose, change, onChange, children }) {
  const [evidence, setEvidence] = useState(false);
  const slot = slotOf(thesis, part);
  const p = thesis?.parts?.[part] ?? {};
  const ids = partFindingIdsOf(thesis, part, companies);
  const findings = ids.map((x) => byId.get(x)).filter(Boolean);
  const isSet = slot.state === 'set' || slot.state === 'stale';
  const who = isSet ? whoSetOf(p.by, agentName) : null;
  const evId = `${id}-ev`;
  return (
    <div id={id} role="region" aria-label={B.parts[part]} data-sr-panel={part} style={{ marginTop: 8, background: T.raised, border: `1px solid ${T.hair}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ ...S.eyebrow, color: T.teal }}>{B.parts[part]}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{slot.skipped ? B.skipped : slot.text ?? B.blank[part]}</span>
        <button type="button" onClick={onClose} aria-label={B.closePanel} style={{ ...linkStyle, color: T.ink3, textDecoration: 'none', padding: '0 4px' }}>×</button>
      </div>
      {slot.state === 'stale' && <p style={{ ...S.small, color: T.copper }} data-sr-stale-line="">{B.staleLine(B.parts[part])}</p>}
      {isSet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {who && <span style={{ fontSize: 13, color: T.ink2 }} data-sr-who={p.by}>{who}</span>}
          {ids.length > 0
            ? <LinkButton expanded={evidence} controls={evId} onClick={() => setEvidence((v) => !v)} attrs={{ 'data-sr-part-evidence': part }}>{evidence ? B.hideEvidence : B.sources(ids.length)}</LinkButton>
            : <span style={S.small} data-sr-no-sources="">{p.by === 'player_wrote' ? B.yourWords : B.noSources}</span>}
          {part === 'theme'
            ? <span style={S.small} data-sr-theme-fixed="">{B.themeFixed}</span>
            : (change && <span style={{ marginLeft: 'auto' }}><LinkButton onClick={onChange} attrs={{ 'data-sr-change': part }}>{B.change}</LinkButton></span>)}
        </div>
      )}
      {evidence && <div id={evId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{findings.map((f) => <Finding key={f.findingId} finding={f} />)}</div>}
      {children}
    </div>
  );
}

/**
 * The price lines (K-13: "optional · add your own"): one level per set name, a daily close below it — the server's
 * `{ input: 'priceLines', options: [names] }` choice, sent as `{ priceLines: [{ symbol, level }] }`. Empty unless the
 * player types a level; nothing here fills a number in.
 */
export function PriceLines({ choice, lines = [], onSend, disabled = false }) {
  const [levels, setLevels] = useState(() => Object.fromEntries((lines ?? []).map((l) => [l.symbol, String(l.level)])));
  const level = (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const priceLines = (choice.options ?? []).map((symbol) => ({ symbol, level: level(levels[symbol]) })).filter((l) => l.level !== null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-sr-price-lines="">
      {(choice.options ?? []).map((symbol) => (
        <label key={symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...S.meta }}>
          <span style={{ whiteSpace: 'nowrap' }}>{B.priceLevel(symbol)}</span>
          <input inputMode="decimal" value={levels[symbol] ?? ''} disabled={disabled} aria-label={B.priceLevel(symbol)} data-sr-price-level={symbol}
            onChange={(e) => setLevels((v) => ({ ...v, [symbol]: e.target.value.replace(/[^0-9.]/g, '') }))}
            style={{ ...S.input, minHeight: 40, flex: '1 1 90px', minWidth: 80, maxWidth: 160 }} />
        </label>
      ))}
      <FreeButton label={B.setPriceLines} disabled={disabled} onClick={() => onSend({ priceLines })} attrs={{ 'data-sr-free': 'set:wrongIf:priceLines' }} />
    </div>
  );
}

/** The evidence list, as the ledger draws it: every current finding but a next action ("All evidence"). */
export function EvidenceList({ findings }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-sr-all-evidence="">{findings.map((f) => <Finding key={f.findingId} finding={f} />)}<p style={S.small}>{COPY.evidenceNote}</p></div>;
}

export { joinNames, horizonLabelOf };
