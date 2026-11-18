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

import React, { useEffect, useId, useRef, useState } from 'react';
import { SR_COPY as COPY } from './sharedResearchCopy';
import { T, S, wash, buttonStyle, linkStyle } from './sharedResearchStyle';
import { Finding, LinkButton, Tag } from './parts';
import { withoutRole } from './sharedResearchView';
import { joinNames, horizonLabelOf, slotOf, sentenceRunsOf, confirmMarkOf, partFindingIdsOf, proposalReasonHolds, sameNames, THESIS_PARTS } from './thesisView';
import { findingLabelOf } from '../../constants/sharedResearch';

const B = COPY.builder;
/** "Source-backed": the shared rule's label for a verified finding (findingLabelOf, already this chunk's; review 4D-1). */
const SOURCE_BACKED = findingLabelOf({ status: 'verified' });

/**
 * The foot (K-17; the phone round, P-2): pinned to the sheet's bottom while everything else scrolls with the sheet —
 * it holds only the composer (and, on the ready view, Save thesis and Keep researching). Its Cover paints the page
 * colour over the sheet's own bottom padding, so nothing shows through beneath it.
 */
export const FOOT = Object.freeze({
  position: 'sticky', bottom: 0, zIndex: 1, background: T.bg, borderTop: `1px solid ${T.hair}`,
  padding: '10px 0 4px', display: 'flex', flexDirection: 'column', gap: 8,
});
/** A band of the page colour just past a pinned element's edge ('below' the foot, 'above' the strip). */
export const Cover = ({ side = 'below' }) => <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, height: 40, background: T.bg, ...(side === 'below' ? { top: '100%' } : { bottom: '100%' }) }} />;
// The choices (P-2): the last item under the conversation, scrolling with the sheet — no box of their own, no cap,
// nothing inside the builder scrolls on its own. One minmax(0,1fr) column, so a long unbroken token wraps instead of
// widening every choice (review 4C-6).
export const CHOICES = Object.freeze({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, minWidth: 0 });
/** Text that wraps between words, breaking a word only when it alone is wider than its line (P-1: never 'anywhere'). */
export const WRAP = Object.freeze({ overflowWrap: 'break-word', minWidth: 0 });

/**
 * The room the sheet keeps at its top for the strip (scroll padding), so a focused control is never left under it.
 * The strip's OWN controls sit inside that room: they carry a negative scroll margin as deep, so focusing one does not
 * scroll the sheet (which would reveal the card, fold the strip away and drop the control).
 */
export const STRIP_ROOM = 84;
const IN_STRIP = Object.freeze({ scrollMarginTop: -STRIP_ROOM });

/** The width the builder needs for its two-column frame (P-1): the sheet's real width, not the device. */
export const TWO_COLUMNS_MIN = 880;
/**
 * Is the element at least `min` px wide? Measured on the element (a ResizeObserver), so it follows the sheet's real
 * width as it changes, with no reload (the phone round, P-1). Unmeasured — before the first measure, or where nothing
 * lays out (jsdom) — reads false: one column.
 */
export function useWideEnough(ref, min = TWO_COLUMNS_MIN) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const measure = () => setWide(el.getBoundingClientRect().width >= min);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, min]);
  return wide;
}

/** The sheet's scroll box (the nearest scrolling ancestor), or null. */
export function scrollParentOf(el) {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = typeof getComputedStyle === 'function' ? getComputedStyle(p).overflowY : '';
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

/**
 * Scroll padding on the sheet's own scroll box — the pinned foot's height below, `top` px above (the strip) — so a
 * control that takes focus is never left under the foot or the strip (review 4C-3). The box's own padding is put back
 * when the view goes, or when there is no foot (the refuter's 7). The foot holds no cap any more (P-2).
 */
export function useFootRoom(footRef, { top = 0, active = true, anchorRef = null, present = true } = {}) {
  useEffect(() => {
    if (!active) return undefined;
    // the foot finds the sheet's scroll box; with no foot (no composer on offer), the anchor does (5C-10)
    const scroller = scrollParentOf(footRef.current ?? anchorRef?.current ?? null);
    if (!scroller) return undefined;
    const before = { bottom: scroller.style.scrollPaddingBottom, top: scroller.style.scrollPaddingTop };
    const measure = () => {
      scroller.style.scrollPaddingBottom = `${(footRef.current?.offsetHeight ?? 0) + 28}px`;
      scroller.style.scrollPaddingTop = top ? `${top}px` : before.top;
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (footRef.current) ro?.observe(footRef.current);
    return () => { ro?.disconnect(); scroller.style.scrollPaddingBottom = before.bottom; scroller.style.scrollPaddingTop = before.top; };
  }, [footRef, top, active, anchorRef, present]); // `present`: a foot that leaves and comes back is a new node (refuter)
}

/**
 * Focus never falls to <body> inside a builder view (review 4C-1). The body's keeper runs when the BODY renders; a view's
 * own state (a panel closed, Change's confirm answered, the strip unfolded, the ready view left) can unmount the focused
 * control without that, and React dispatches no blur from an unmounted node. So after every click and key inside the
 * view, once it has settled, the body's own rule: focus on <body> goes to the sheet body's root.
 */
export function useFocusKept(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const keep = () => {
      const root = ref.current?.closest?.('[data-shared-research-body]') ?? null;
      if (document.activeElement === document.body && root?.isConnected && !root.closest('[inert]')) root.focus({ preventScroll: true });
    };
    const after = () => { setTimeout(keep, 0); };
    el.addEventListener('click', after, true);
    el.addEventListener('keydown', after, true);
    return () => { el.removeEventListener('click', after, true); el.removeEventListener('keydown', after, true); };
  }, [ref]);
}

/**
 * A tapped part's panel opens in view (K-7): scrolled clear of the pinned foot, so the panel is what lies under the
 * player's next tap. `footRef` is the foot; jsdom has no scrolling, so there it does nothing.
 */
export function usePanelInView(tapped, panelId, footRef) {
  useEffect(() => {
    if (!tapped || typeof document === 'undefined') return;
    const panel = document.getElementById(panelId);
    if (!panel?.scrollIntoView) return;
    panel.style.scrollMarginBottom = `${(footRef?.current?.offsetHeight ?? 0) + 20}px`;
    panel.scrollIntoView({ block: 'nearest' });
  }, [tapped, panelId, footRef]);
}

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
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.3, overflowWrap: 'break-word' }}>{label}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <Mark tone="teal" solid attrs={{ 'data-sr-cost': 'step' }}>{B.oneStep}</Mark>
        <span style={{ fontSize: 11, color: T.ink2, lineHeight: 1.2, whiteSpace: 'nowrap' }} data-sr-steps-left-choice="">{B.stepsLeft(stepsLeft)}</span>
      </span>
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
      style={{ ...buttonStyle('secondary', { full: true, disabled }), justifyContent: 'flex-start', minHeight: 46, padding: '7px 14px', background: 'transparent', border: `1px solid ${mark ? wash('teal', 0.5) : strong ? wash('ink-2', 0.55) : T.hair}` }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {mark && <Mark tone="teal" attrs={{ 'data-sr-mark': '' }}>{mark}</Mark>}
        <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, lineHeight: 1.3, overflowWrap: 'break-word' }}>{label}</span>
        {sub && <span style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.35, overflowWrap: 'break-word' }}>{sub}</span>}
        {reason && (
          <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4, overflowWrap: 'break-word' }} data-sr-pick-reason="">
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
  if (part === 'theme') return { label: B.themeConfirm(value), mark: B.suggestedTag(agentName) };
  if (part === 'segment') {
    const line = (thesis?.parts?.segment?.map ?? []).find((m) => m.label === value)?.line ?? null;
    if (mark === 'pick') return { label: value, sub: line, mark: B.pickTag(agentName), reason: pick.reason, reasonTag: reasoning };
    if (mark === 'asked') return { label: B.confirmValue(value), sub: line, strong: true };
    return { label: value, sub: line };
  }
  if (part === 'names') {
    if (choice.reason === 'drop_unsourced') return { label: B.dropUnsourced(joinNames(value)) };
    if (op === 'confirm') return mark === 'asked' ? { label: B.confirmValue(joinNames(value)), strong: true } : { label: B.pickButton(agentName, joinNames(value)) };
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
    // §B13 T-5: the confirm says whose answer it carries — "{agent} suggested" (above) or "{agent}'s pick"
    if (mark === 'asked') return { label: B.confirmValue(label), mark: B.pickTag(agentName), strong: true };
    return { label };
  }
  return { label: String(value ?? '') };
}

/**
 * §B13 T-6: a suggested theme does not hold the front. Its confirm and its "write your own" sit as one small line at the
 * top of the choices — "Use “{suggestion}” as the theme · free", and Write your own, which opens the theme's part (its
 * text box is there). The confirm is the server's free choice, sent as offered.
 */
export function ThemeLine({ confirm, onConfirm, onWriteOwn = null, disabled = false }) {
  const off = disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {};
  return (
    <div role="group" aria-label={B.themeLineLabel} data-sr-theme-line="" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, minWidth: 0 }}>
      <button type="button" onClick={disabled ? undefined : onConfirm} disabled={disabled} data-sr-free="confirm:theme" data-sr-free-value={confirm.value}
        style={{ ...linkStyle, ...off, textDecoration: 'none', gap: 6, fontSize: 13.5, minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, overflowWrap: 'break-word', minWidth: 0 }}>{B.themeConfirm(confirm.value)}</span>
        <span aria-hidden="true" style={{ color: T.ink3 }}>·</span>
        <Mark attrs={{ 'data-sr-cost': 'free' }}>{B.free}</Mark>
      </button>
      {onWriteOwn && (
        <button type="button" onClick={disabled ? undefined : onWriteOwn} disabled={disabled} data-sr-theme-own=""
          style={{ ...linkStyle, ...off, fontSize: 13.5, color: T.ink2 }}>{B.writeOwnTheme}</button>
      )}
    </div>
  );
}

/** A research choice's words (K-5): the goal's label; strengthen names its part. */
export const researchLabelOf = (g) => (g.goal === 'strengthen' ? B.strengthenPart(B.parts[g.part] ?? g.part) : B.goals[g.goal] ?? g.goal);

// ── the conversation's lines (K-9; R3 Said / Mine / Changed) ──────────────────────

/**
 * The agent's reply, drawn as stored. `text` is the reply; an EARLIER reply (`folded`) shows its first two lines with
 * More (the phone round, P-5) — only its display folds, never the text. More shows unless the folded text is measured
 * to fit (where nothing lays out, it shows).
 */
export function Said({ name, text, folded = false, attrs = {} }) {
  const [open, setOpen] = useState(false);
  const [fits, setFits] = useState(false);
  const boxRef = useRef(null);
  const id = `sr-said${useId()}`;
  const clamp = folded && !open;
  // measured again whenever the box changes size (5C-1: a reply that fits at one width may not at the next)
  useEffect(() => {
    const el = boxRef.current;
    if (!clamp || !el) return undefined;
    const measure = () => {
      const spill = el.scrollHeight - el.clientHeight;
      setFits(Boolean(el.clientHeight) && spill <= 1);
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [clamp, text]);
  const paras = String(text ?? '').split(/\n{2,}/);
  // the same nodes folded or not — only their style changes — so the log never hears the reply again (5C-2)
  const box = clamp
    ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', gap: 8 };
  return (
    <div {...attrs} data-sr-said-folded={clamp ? 'true' : 'false'} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ ...S.eyebrow, color: T.teal }}>{name}</span>
      <div ref={boxRef} id={id} data-sr-said-text="" style={{ fontSize: 15, color: T.ink, lineHeight: 1.5, ...WRAP, ...box }}>
        {paras.map((p, i) => <React.Fragment key={i}>{i > 0 ? ' ' : null}<span style={{ display: clamp ? 'inline' : 'block' }}>{p}</span></React.Fragment>)}
      </div>
      <div hidden={!folded || (clamp && fits)} data-sr-said-more-box="">
          <button type="button" aria-expanded={open} aria-controls={id} aria-label={open ? B.lessReplyLabel(name) : B.moreReplyLabel(name)} onClick={() => setOpen((v) => !v)} data-sr-said-more=""
            style={{ ...linkStyle, minWidth: 44, minHeight: 44, justifyContent: 'flex-start' }}>{open ? B.lessReply : B.moreReply}</button>
      </div>
    </div>
  );
}

export function Mine({ children, tag = null, attrs = {} }) {
  return (
    <div {...attrs} style={{ alignSelf: 'flex-end', maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 0 }}>
      <div style={{ padding: '8px 12px', borderRadius: '14px 14px 4px 14px', background: T.raised, fontSize: 14.5, color: T.ink, lineHeight: 1.4, overflowWrap: 'break-word' }}>{children}</div>
      {tag && <Mark>{tag}</Mark>}
    </div>
  );
}

export function CardLine({ children, tone = 'teal', attrs = {} }) {
  return (
    <div {...attrs} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, letterSpacing: '0.02em', color: T.ink2, lineHeight: 1.4 }}>
      <span aria-hidden="true" style={{ width: 14, height: 1.5, background: T[tone], flexShrink: 0 }} />
      <span style={{ overflowWrap: 'break-word' }}>{children}</span>
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
        const blocked = p === 'names' && Boolean(thesis?.parts?.names?.blocked);
        const bg = st === 'set' ? T.teal : st === 'stale' || blocked ? T.copper : st === 'suggested' || working === p ? wash('teal', 0.45) : T.hair;
        return <span key={p} data-sr-rail={p} data-sr-rail-state={st ?? 'unset'} style={{ flex: 1, height: 4, borderRadius: 2, background: bg }} />;
      })}
    </div>
  );
}

export function CardHead({ thesis, stepsLeft, ready = false, more = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ ...S.eyebrow, color: T.teal }}>{ready ? B.thesisReady : B.thesis}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap' }} data-sr-filled={thesis?.filled ?? 0}>{B.filled(thesis?.filled ?? 0)}</span>
      <span style={{ fontSize: 12, color: T.ink2, marginLeft: 'auto', whiteSpace: 'nowrap' }} data-sr-steps-left={stepsLeft}>{B.stepsLeft(stepsLeft)}</span>
      {more}
    </div>
  );
}

/**
 * "⋯" (the phone round, P-3): a small disclosure in the card's head and the strip that reveals one item, Discard, which
 * opens B2's discard confirm. `where` names it for the rows.
 */
export function MoreActions({ onDiscard, disabled = false, where }) {
  const [open, setOpen] = useState(false);
  const id = `sr-more${useId()}`;
  const boxRef = useRef(null);
  // closed by a tap elsewhere, or by focus leaving it (5C-9)
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);
  const onBlur = (e) => { if (e.relatedTarget && !boxRef.current?.contains(e.relatedTarget)) setOpen(false); };
  return (
    <span ref={boxRef} onBlur={onBlur} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button type="button" aria-label={B.moreActions} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} data-sr-more={where}
        style={{ ...linkStyle, color: T.ink2, textDecoration: 'none', width: 44, minWidth: 44, height: 44, justifyContent: 'center', margin: '-12px -10px -12px 0', fontSize: 18, letterSpacing: '0.05em', ...(where === 'strip' ? IN_STRIP : {}) }}>⋯</button>
      {open && (
        <span id={id} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 3, marginTop: 4, background: T.raised, border: `1px solid ${T.hair}`, borderRadius: 10, padding: '4px 12px', whiteSpace: 'nowrap' }}>
          <button type="button" disabled={disabled} onClick={disabled ? undefined : () => { setOpen(false); onDiscard(); }} data-sr-discard={where}
            style={{ ...linkStyle, color: T.copper, minHeight: 44, ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}), ...(where === 'strip' ? IN_STRIP : {}) }}>{COPY.discard}</button>
        </span>
      )}
    </span>
  );
}

/**
 * A part of the sentence the player can tap (K-7). A span with the button role, not a <button>: Chromium lays a button
 * out as an inline block, which broke the sentence's lines at every part (seen in the B4 renders). Enter and Space open
 * it as a button would; the padding widens the target without moving the line.
 */
function InlinePart({ part, state, open, panelId, onTap, label = null, children }) {
  const toggle = () => onTap(open ? null : part);
  return (
    <span role="button" tabIndex={0} aria-expanded={open} aria-controls={panelId} data-sr-slot={part} data-sr-slot-state={state} aria-label={label ? B.partLabel(B.parts[part], label) : undefined}
      onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
      style={{ cursor: 'pointer', padding: '6px 0', margin: '-6px 0', borderRadius: 4 }}>
      {children}
    </span>
  );
}

/** One part's slot in the sentence while the card fills in: its value, its suggestion (never drawn as filled), its stale mark, or a blank. */
function Slot({ thesis, part, working, tapped, onTap, panelId, agentName }) {
  const slot = slotOf(thesis, part);
  const open = tapped === part;
  let inner;
  if (working === part) {
    inner = <span style={{ fontSize: '0.8em', fontWeight: 600, color: T.teal, borderBottom: `1.5px dashed ${wash('teal', 0.6)}` }}><span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: T.teal, marginRight: 6, verticalAlign: 'middle' }} />{B.working(agentName)}</span>;
  } else if (part === 'names' && thesis?.parts?.names?.blocked && slot.state === 'unset') {
    // the dead end (§B4.5), as the server says it: names.blocked — no listed company has a sourced connection
    inner = <span style={{ color: T.copper, borderBottom: `1.5px dashed ${wash('copper', 0.6)}` }} data-sr-blocked="">{B.blocked[thesis.parts.names.blocked] ?? B.blank.names}</span>;
  } else if (slot.state === 'set') {
    inner = <span style={{ color: T.ink, borderBottom: `2px solid ${open ? T.teal : wash('teal', 0.5)}`, background: open ? wash('teal', 0.2) : 'transparent', borderRadius: open ? '4px 4px 0 0' : 0 }}>{slot.skipped ? B.skipped : slot.text}</span>;
  } else if (slot.state === 'stale') {
    inner = <span style={{ color: T.ink2, borderBottom: `1.5px dashed ${T.copper}` }}>{slot.skipped ? B.skipped : slot.text} <span style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.copper }} data-sr-stale-mark="">{B.stale}</span></span>;
  } else if (slot.state === 'suggested' && slot.text) {
    inner = <span style={{ color: T.ink2, borderBottom: `1.5px dashed ${wash('teal', 0.7)}` }}>{slot.text} <span style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.teal }} data-sr-suggested-mark="">{B.suggested}</span></span>;
  } else {
    inner = <span style={{ color: T.ink3, borderBottom: `1.5px dotted ${T.ink3}`, whiteSpace: 'nowrap' }} data-sr-blank={part}>{B.blank[part]}</span>;
  }
  return <InlinePart part={part} state={slot.state} open={open} panelId={panelId} onTap={onTap} label={slot.skipped ? B.skipped : slot.text ?? B.blank[part]}>{inner}</InlinePart>;
}

/**
 * The card's sentence (K-7). While the card fills in, the sentence is its parts in the card's frame, each a slot to tap.
 * Once the server composes it (`thesis.sentence`), that sentence is drawn AS RECEIVED, its set parts found in it and
 * made tappable where they stand (sentenceRunsOf) — never composed here.
 */
export function Sentence({ thesis, working = null, tapped, onTap, panelId, agentName, size = 16.5 }) {
  const p = { margin: 0, fontSize: size, lineHeight: 1.6, fontWeight: 500, color: T.ink2, overflowWrap: 'break-word' };
  if (typeof thesis?.sentence === 'string' && thesis.sentence && !working) {
    return (
      <p style={p} data-sr-sentence="server">
        {sentenceRunsOf(thesis.sentence, thesis).map((r, i) => (r.part
          ? <InlinePart key={i} part={r.part} state={r.state} open={tapped === r.part} panelId={panelId} onTap={onTap} label={r.text}>
            {r.state === 'stale'
              ? <span style={{ color: T.ink2, borderBottom: `1.5px dashed ${T.copper}` }}>{r.text}</span>
              : <span style={{ color: T.ink, borderBottom: `2px solid ${tapped === r.part ? T.teal : wash('teal', 0.5)}`, background: tapped === r.part ? wash('teal', 0.2) : 'transparent' }}>{r.text}</span>}
            {r.state === 'stale' && <span style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.copper, marginLeft: 4 }} data-sr-stale-mark="">{B.stale}</span>}
          </InlinePart>
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
function ReasonLine({ lead, text, findingIds, basis = null, agentName, attrs = {} }) {
  const tag = basis ? basisTagOf(basis, agentName) : null;
  return (
    <div {...attrs} style={{ display: 'grid', gridTemplateColumns: `${lead.length > 2 ? 46 : 16}px minmax(0,1fr)`, gap: 6, fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: lead.length > 2 ? T.ink : T.ink3, paddingTop: 1 }}>{lead}</span>
      <span style={{ overflowWrap: 'break-word' }}>{text} <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', verticalAlign: 'middle', flexWrap: 'wrap' }}>{tag && <Tag tone={tag.tone}>{tag.text}</Tag>}{findingIds?.length > 0 && <Count n={findingIds.length} />}</span></span>
    </div>
  );
}

/** The point against, or "No point against found yet" (§B4.2 rule 2: never hide the absence). */
function AgainstLine({ against }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-sr-against="">
      <span style={{ ...S.eyebrow, color: T.copper }}>{B.against}</span>
      {against
        ? <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45, overflowWrap: 'break-word' }}>{against.text} <span style={{ display: 'inline-flex', gap: 6, verticalAlign: 'middle' }}><Count n={against.findingIds?.length ?? 0} /></span></div>
        : <span style={{ ...S.small, ...WRAP }}>{B.noAgainst}</span>}
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
          {reasons.map((r, i) => <ReasonLine key={`${r.symbol}:${i}`} lead={group ? r.symbol : String(i + 1)} text={r.text} findingIds={r.findingIds} basis={why.state === 'set' ? 'source' : null} agentName={agentName} attrs={{ 'data-sr-reason': r.symbol }} />)}
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
      {proposal.shared && <p style={{ ...S.body, ...WRAP, fontWeight: 600 }} data-sr-proposal-shared="">{proposal.shared}</p>}
      {(proposal.reasons ?? []).map((r, i) => <ReasonLine key={`${r.symbol}:${i}`} lead={group ? r.symbol : String(i + 1)} text={r.text} findingIds={r.findingIds} basis={proposalReasonHolds(proposal, r) ? 'source' : null} agentName={agentName} attrs={{ 'data-sr-proposal-reason': r.symbol }} />)}
      {incomplete.map((s) => <p key={s} style={{ ...S.small, ...WRAP, color: T.copper }} data-sr-incomplete={s}>{`${s} · ${B.noReasonYet}`}</p>)}
      <AgainstLine against={proposal.against ?? null} />
    </div>
  );
}

/** The strip the card folds to while the conversation scrolls (R3 StripB): the rail, what is set, the counts. */
export function Strip({ thesis, stepsLeft, onOpen, more = null }) {
  const crumbs = ['theme', 'segment', 'names'].map((p) => slotOf(thesis, p)).filter((s) => s.state === 'set' && (s.text || s.skipped)).map((s) => (s.skipped ? B.skipped : s.text));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 12, padding: '0 14px 0 0' }}>
      <button type="button" onClick={onOpen} data-sr-strip=""
        style={{ appearance: 'none', font: 'inherit', flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 4px 10px 14px', background: 'transparent', border: 'none', color: T.ink, boxSizing: 'border-box', ...IN_STRIP }}>
        <Rail thesis={thesis} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crumbs.length ? crumbs.join(' › ') : B.strip}</span>
          <span style={{ fontSize: 11.5, color: T.ink2, whiteSpace: 'nowrap' }}>{`${B.filled(thesis?.filled ?? 0)} · ${B.stepsLeft(stepsLeft)}`}</span>
          <span aria-hidden="true" style={{ color: T.ink3 }}>▾</span>
        </span>
      </button>
      {more}
    </div>
  );
}

// ── Change asks first (K-8) ─────────────────────────────────────────────────────

/** "Changing Segment also clears Names and Why." — from the choice's own `clears`, before anything is sent. */
export function ClearConfirm({ choice, onConfirm, onCancel, disabled = false }) {
  const others = (choice.clears ?? []).map((p) => B.parts[p] ?? B.priceLinesName);
  const keepRef = useRef(null);
  useEffect(() => {
    keepRef.current?.focus({ preventScroll: true });
    keepRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  return (
    <div role="alertdialog" aria-label={B.change} data-sr-clear-confirm={choice.part} style={{ ...S.card, gap: 10, border: `1px solid ${wash('copper', 0.5)}`, background: wash('copper', 0.06) }}>
      <p style={{ ...S.body, ...WRAP }}>{B.clearsAlso(choice.reason === 'drop_unsourced' ? B.parts.names : B.parts[choice.part], joinNames(others))}</p>
      <div style={S.actions}>
        <button type="button" disabled={disabled} onClick={disabled ? undefined : onConfirm} style={buttonStyle('danger', { disabled })} data-sr-clear-yes="">{B.changeIt}</button>
        <button ref={keepRef} type="button" onClick={onCancel} style={buttonStyle('ghost')} data-sr-clear-no="">{B.keepIt}</button>
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
  const reasonId = `sr-pick-reason${useId()}`;
  const pickLabel = pickConfirm ? freeLabelOf(pickConfirm, thesis, agentName) : null;
  const pickReason = pickConfirm && !thesis?.pick?.asked ? thesis?.pick?.reason ?? null : null;
  const reasonTag = thesis?.pick ? basisTagOf(thesis.pick.basis, agentName) : null;
  // ticking exactly the agent's pick sends the server's confirm (routine choice 7: one button per value)
  const build = () => (pickConfirm && sameNames(ticked, pickConfirm.value) ? onConfirmPick() : onSend(ticked));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-sr-names-pick="">
      <p style={{ ...S.small, ...WRAP }}>{B.namesHelp(min, max)}</p>
      <div role="group" aria-label={B.parts.names} style={{ display: 'flex', flexDirection: 'column' }}>
        {(choice.options ?? []).map((s) => {
          const c = supported.find((x) => x.symbol === s);
          const on = ticked.includes(s);
          return (
            <label key={s} data-sr-name-row={s} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'start', padding: '9px 0', borderTop: `1px solid ${T.hair}`, cursor: disabled ? 'not-allowed' : 'pointer', minHeight: 44 }}>
              <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(s)} style={{ width: 18, height: 18, marginTop: 2 }} />
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', minWidth: 0 }} data-sr-name-line="">
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{s}</span>
                  {picked.includes(s) && <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}><Mark tone="teal" attrs={{ 'data-sr-name-pick': s }}>{B.pickTag(agentName)}</Mark></span>}
                </span>
                {c?.name && <span style={{ fontSize: 12.5, color: T.ink2, ...WRAP }} data-sr-name-company="">{c.name}</span>}
                {c?.relationship && <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4, overflowWrap: 'break-word' }}>{withoutRole(c.relationship)}</span>}
              </span>
              <Count n={c?.evidence?.length ?? 0} />
            </label>
          );
        })}
        {leads.map((l) => (
          <div key={`${l.symbol ?? ''}:${l.name}`} data-sr-name-lead={l.name} style={{ padding: '9px 0 0 30px', borderTop: `1px dashed ${T.hair}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink2, overflowWrap: 'break-word' }}>{l.name}</span>
            <Tag dim>{B.lead}</Tag>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }} data-sr-names-buttons="">
        {pickConfirm && <FreeButton label={pickLabel.label} strong={pickLabel.strong} disabled={disabled} onClick={onConfirmPick} attrs={{ 'data-sr-free': 'confirm:names', ...(pickReason ? { 'aria-describedby': reasonId } : {}) }} />}
        {pickReason && (
          <p id={reasonId} style={{ ...S.meta, ...WRAP, color: T.ink }} data-sr-pick-reason="">{pickReason} {reasonTag && <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Tag tone={reasonTag.tone}>{reasonTag.text}</Tag></span>}</p>
        )}
        <FreeButton label={B.namesBuild(joinNames(ticked))} strong disabled={disabled || !ok} onClick={build} attrs={{ 'data-sr-free': 'set:names' }} />
      </div>
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
          <ReasonLine lead={reasons[i]?.symbol ?? String(i + 1)} text={reasons[i]?.text ?? ''} findingIds={reasons[i]?.findingIds ?? []} basis={reasons[i] && proposalReasonHolds(proposal, reasons[i]) ? 'source' : null} agentName={agentName} />
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
  const inputId = `sr-composer${useId()}`;
  const inputRef = useRef(null);
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
    if (answer?.ok && !answer.body?.error) {
      setValue('');
      inputRef.current?.focus({ preventScroll: true });
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-sr-composer={effective}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input ref={inputRef} id={inputId} data-sr-composer-input="" value={value} onChange={(e) => setValue(e.target.value)} maxLength={max} disabled={disabled} placeholder={placeholder} aria-label={placeholder}
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
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{slot.skipped ? B.skipped : slot.text ?? B.blank[part]}</span>
        <button type="button" onClick={onClose} aria-label={B.closePart(B.parts[part])} data-sr-panel-close={part} style={{ ...linkStyle, color: T.ink3, textDecoration: 'none', padding: 0, width: 44, minWidth: 44, height: 44, justifyContent: 'center', margin: '-12px -8px -12px 0', flexShrink: 0 }}>×</button>
      </div>
      {slot.state === 'stale' && <p style={{ ...S.small, ...WRAP, color: T.copper }} data-sr-stale-line="">{B.staleLine(B.parts[part])}</p>}
      {isSet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {who && <span style={{ fontSize: 13, color: T.ink2 }} data-sr-who={p.by}>{who}</span>}
          {ids.length > 0
            ? <LinkButton expanded={evidence} controls={evId} onClick={() => setEvidence((v) => !v)} attrs={{ 'data-sr-part-evidence': part }}>{evidence ? B.hideEvidence : B.sources(ids.length)}</LinkButton>
            : <span style={{ ...S.small, ...WRAP }} data-sr-no-sources="">{p.by === 'player_wrote' ? B.yourWords : B.noSources}</span>}
          {part === 'theme'
            ? <span style={{ ...S.small, ...WRAP }} data-sr-theme-fixed="">{B.themeFixed}</span>
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
        <label key={symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...S.meta, ...WRAP }}>
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
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-sr-all-evidence="">{findings.map((f) => <Finding key={f.findingId} finding={f} />)}<p style={{ ...S.small, ...WRAP }}>{COPY.evidenceNote}</p></div>;
}

export { joinNames, horizonLabelOf };
