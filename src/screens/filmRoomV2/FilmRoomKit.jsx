// src/screens/filmRoomV2/FilmRoomKit.jsx
//
// Film Room v2 — the primitives, on the shipped Battle View V4 cockpit's
// language (Amendment E BA-41: the skin comes from the shipped tokens; the
// design of record is docs/design/20261008_FILM_ROOM_A2_MOCKUP.html). TOKENS
// ONLY: every colour is cssVar() or rgba(var(--ft-*-rgb), a), the
// src/screens/battleView precedent — no raw palette hex, and SVG colours go
// through `style`, never a presentation attribute (BUILD_RULES §10, H8).
//
// THE NUMBER (BA-42, F2): <TapeNum doc path /> reads the value AT THE PATH of
// the document and its class from THAT document's `numberClasses` — never a
// value passed beside a class, never a per-widget constant — so a number and
// its marker come from one source (BUILD_RULES §9). Sign colours belong to
// recorded scores only (BA-41).
//
// RECORDED WORDS (Amendment E addendum 2, R7): <Quotation doc path by at /> is
// the one way a stored sentence someone wrote reaches the screen — read at its
// path, verbatim, attributed. Everything outside a quotation is the screen's
// own voice, under the forbidden-word boundary.

import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { cssVar } from '../../theme/cssTokens';
import { MONO } from '../../components/Dashboard/commandUI';
import { numberAt, valueAt, etClock, isRecordedScore, fmtPoints, SCREEN_AGGREGATE_CLASSES, checkCounts } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY, CLASS_LETTER, PROVENANCE_LABELS } from './filmRoomCopy';
import { formatNumberPath } from '../../constants/filmTape';

export { MONO };

// ── the palette, as tokens ──────────────────────────────────────────────────
export const C = Object.freeze({
  bg: cssVar('bg-dashboard'),
  surface: cssVar('bg-card'),
  raised: cssVar('bg-agent'),
  ink: cssVar('text-primary'),
  ink2: cssVar('text-secondary-holo'),
  ink3: cssVar('text-muted'),
  teal: cssVar('teal'),
  gold: cssVar('gold'),
  copper: cssVar('copper'),
  purple: cssVar('purple'),
  up: cssVar('success'),
  down: cssVar('danger'),
  hair: 'rgba(var(--ft-scrim-rgb), 0.07)',
  hair2: 'rgba(var(--ft-scrim-rgb), 0.12)',
  wash: 'rgba(var(--ft-scrim-rgb), 0.04)',
  shade: 'rgba(var(--ft-shadow-rgb), 0.35)',
});
/** A translucent tint of a token that has an rgb triplet. */
export const tint = (name, a) => `rgba(var(--ft-${name}-rgb), ${a})`;

export const card = { borderRadius: 14, background: C.surface, border: `1px solid ${C.hair2}`, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', minWidth: 0 };
export const eyebrow = { fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.3 };
export const foot = { fontFamily: MONO, fontSize: 10.5, color: C.ink3, lineHeight: 1.45 };
export const body = { margin: 0, fontSize: 13, lineHeight: 1.5, color: C.ink };
export const mono = (size = 11, color = C.ink2, extra = {}) => ({ fontFamily: MONO, fontSize: size, color, ...extra });
/** A button reset by hand (no `all: unset`): the browser keeps its focus ring — the CockpitFeed plainButton precedent. */
export const plain = Object.freeze({ background: 'transparent', border: 'none', margin: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' });

// ── the marker (BA-42) ──────────────────────────────────────────────────────

/** The class marker: one letter in a hairline box (rebuilt dashed). An undeclared number shows its defect. */
export function KindMark({ cls, size = 12 }) {
  const letter = CLASS_LETTER[cls];
  const label = letter ? PROVENANCE_LABELS[cls] : 'no declared class';
  return (
    <span
      data-kind-mark={cls || 'none'}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: size + 3, height: size, padding: '0 2px',
        borderRadius: 3, boxSizing: 'border-box', border: `1px ${cls === 'rebuilt' ? 'dashed' : 'solid'} ${C.hair2}`,
        fontFamily: MONO, fontSize: Math.max(7.5, Math.round(size * 0.62)), fontWeight: 700, lineHeight: 1, color: letter ? C.ink2 : C.down,
        verticalAlign: 'middle', flexShrink: 0,
      }}
    >
      {letter || '?'}
    </span>
  );
}

/**
 * A number from a tape or series document, by path, with the marker of the
 * class that document declares for that path. A missing value renders '—'
 * (no number, so no marker).
 */
export function TapeNum({ doc, path, fmt = fmtPoints, size = 13, weight = 700, color, docLabel = 'tape', style }) {
  const n = numberAt(doc, path);
  const where = formatNumberPath(path);
  if (!n) {
    return <span data-num-missing={where} style={{ fontFamily: MONO, fontSize: size, color: C.ink3, ...style }}>—</span>;
  }
  const signed = isRecordedScore(doc, path);
  const ink = color || (signed ? (n.value > 0 ? C.up : n.value < 0 ? C.down : C.ink) : C.ink);
  return (
    <span
      data-num={where}
      data-num-doc={docLabel}
      data-num-class={n.cls || 'none'}
      data-sign-color={signed ? 'yes' : 'no'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(4, Math.round(size * 0.14)), fontFamily: MONO, fontSize: size, fontWeight: weight, color: ink, fontVariantNumeric: 'tabular-nums', letterSpacing: size > 20 ? '-0.02em' : 'normal', lineHeight: 1, whiteSpace: 'nowrap', ...style }}
    >
      <span data-num-text="">{fmt(n.value)}</span>
      <KindMark cls={n.cls} size={Math.max(12, Math.round(size * 0.4))} />
    </span>
  );
}

/**
 * A number the screen computes from the record (Amendment E addendum R4(a)) —
 * its class from the one screen declaration, SCREEN_AGGREGATE_CLASSES, by the
 * name of what it computes; never a widget's own.
 */
export function AggNum({ value, aggregate, fmt = String, size = 10.5, weight = 600, color = C.ink2 }) {
  const cls = SCREEN_AGGREGATE_CLASSES[aggregate] ?? null;
  return (
    <span data-num-aggregate={aggregate} data-num-class={cls || 'none'} data-agg-value={value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: size, fontWeight: weight, color, whiteSpace: 'nowrap' }}>
      <span data-num-text="">{fmt(value)}</span>
      <KindMark cls={cls} />
    </span>
  );
}

/** A count the screen makes of the tape's own rows — its class from the one screen declaration. */
export const CountNum = ({ value, aggregate, size, color }) => <AggNum value={value} aggregate={aggregate} size={size} color={color} />;

/** "Checks · n of m", or "n recorded" when the close pass records no minted range (R4(a); checkCounts). */
export function CheckCount({ tape }) {
  const { n, m } = checkCounts(tape);
  return (
    <span data-check-count={m === null ? 'recorded' : 'of'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <CountNum value={n} aggregate="count(checks[] with a record)" size={10} />
      {m === null ? COPY.countRecorded : <>{COPY.countOf} <CountNum value={m} aggregate="count(tickSeqs in the minted range)" size={10} /></>}
    </span>
  );
}

/** An instant or a date the record carries, as text — never a number (the sweep exempts it by this mark). */
export function When({ children, style }) {
  return <span data-time="" style={style}>{children}</span>;
}

/** A string the record carries verbatim (a symbol, an id, a stored note) — exempt from the number sweep as the record's own words. */
export function Rec({ children, style }) {
  return <span data-record-text="" style={style}>{children}</span>;
}

/** One legend per screen (BA-42): the four classes and their labels. */
export function KindLegend({ style }) {
  return (
    <div data-legend="number-kinds" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', ...style }}>
      <span style={mono(8.5, C.ink3, { letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 })}>{COPY.legend}</span>
      {Object.keys(CLASS_LETTER).map((cls) => (
        <span key={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <KindMark cls={cls} />
          <span style={mono(9.5, C.ink3, { whiteSpace: 'nowrap' })}>{PROVENANCE_LABELS[cls]}</span>
        </span>
      ))}
    </div>
  );
}

// ── coverage (BA-20) ────────────────────────────────────────────────────────

const COVERAGE_COLOR = { complete: C.ink2, partial: C.gold, unavailable: C.ink3 };

/** The coverage line every section opens with: the tape's own status and note. */
export function Coverage({ coverage, fallbackNote, style, label = COPY.coverage }) {
  const status = coverage && COVERAGE_COLOR[coverage.status] ? coverage.status : 'unavailable';
  const c = COVERAGE_COLOR[status];
  const note = coverage?.note || fallbackNote || null;
  return (
    <div data-coverage={status} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0, ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 15 }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, display: 'inline-block', background: status === 'complete' ? c : status === 'partial' ? `linear-gradient(90deg, ${c} 50%, transparent 50%)` : 'transparent', boxShadow: `inset 0 0 0 1px ${c}` }} />
      </span>
      <span style={mono(10.5, C.ink3, { lineHeight: 1.45 })}>
        {label} · <span style={{ color: c, fontWeight: 600 }}>{COPY.coverageLabel[status]}</span>
        {note ? <> · <Rec>{note}</Rec></> : null}
        {coverage?.preservedFrom ? <> · {COPY.preservedFrom} <When>{coverage.preservedFrom}</When></> : null}
      </span>
    </div>
  );
}

/** A section: its title (with its count, when it has one), its coverage line, an optional note, its body. */
export function Section({ id, title, count, coverage, coverageNote, note, right, children, label }) {
  return (
    <section id={id} data-section={id || label || title} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, padding: '4px 2px 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...mono(10.5, C.ink2, { letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }) }}>{title}</h3>
          {count != null ? <span data-section-count="" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px', borderRadius: 6, background: tint('scrim', 0.06), whiteSpace: 'nowrap', ...mono(10, C.ink2, { fontWeight: 700 }) }}>{count}</span> : null}
        </div>
        {right}
      </div>
      {(coverage !== undefined || coverageNote) && <Coverage coverage={coverage} fallbackNote={coverageNote} style={{ padding: '0 2px' }} />}
      {note && <span style={{ ...foot, padding: '0 2px', display: 'block' }}>{note}</span>}
      {children}
    </section>
  );
}

export function Row({ k, v, sub, border = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: border ? `1px solid ${C.hair}` : 'none', minWidth: 0 }}>
      <span style={mono(10.5, C.ink2, { minWidth: 0 })}>{k}{sub ? <span style={{ color: C.ink3 }}> · {sub}</span> : null}</span>
      {v}
    </div>
  );
}

export function EmptyCard({ children }) {
  return <div style={{ ...card, border: `1px dashed ${C.hair2}`, background: 'transparent', padding: '12px 14px' }}><p style={{ ...body, color: C.ink2 }}>{children}</p></div>;
}

// ── recorded words (Amendment E addendum 2, R7) ─────────────────────────────

/**
 * RECORDED WORDS — the ONE component every recorded-text channel renders through (R7): the agent's rationale and
 * hypothesis, the player's directive text, the stored directive text, the agent's replies, plan prose, and the
 * platform's words at completion. It takes a document and a PATH, never a string: it reads the value stored at that
 * path and renders it verbatim — the element that carries `data-quote-path` holds that value and nothing else, byte
 * for byte, so the screen composes nothing inside a quotation — with the attribution beside it: who, as the tape
 * records it (COPY.quoteBy; "the stored plan" / "the stored directive" where the tape records no author, never a
 * guess), and when, the record's own instant read from the document at `at`, marked as an instant. A clamped
 * preview (`lines`) clamps the FULL value with CSS (R6), measured again whenever its box changes size, so "Read
 * more" appears exactly when the value runs past it (review A2P3-1). Recorded words go nowhere else: no other
 * element's text, no aria-label, no title. A path that holds no text renders nothing.
 */
export function Quotation({ doc, path, by, at, lines = 0, color = C.ink2, weight = 400, size = 13, docLabel = 'tape' }) {
  const stored = valueAt(doc, path);
  const text = typeof stored === 'string' && stored ? stored : null;
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef(null);
  const id = useId();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!lines || !el || open) return undefined;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines, open]);
  if (text === null) return null;
  const clock = at ? etClock(valueAt(doc, at)) : null;
  const clamp = lines ? { display: open ? 'block' : '-webkit-box', WebkitLineClamp: open ? 'unset' : lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null;
  return (
    <div data-quotation={by} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <p ref={ref} id={id} data-quote-path={formatNumberPath(path)} data-quote-doc={docLabel} data-collapsed={lines ? (open ? 'no' : 'yes') : undefined} style={{ ...body, fontSize: size, fontWeight: weight, color, ...clamp }}>{text}</p>
      {lines && (clamped || open) ? <TextButton onClick={() => setOpen(!open)} expanded={open} controls={id}>{open ? COPY.showLess : COPY.readMore}</TextButton> : null}
      <span data-quote-attribution="" data-quote-at={at ? formatNumberPath(at) : undefined} style={mono(9.5, C.ink3, { lineHeight: 1.4 })}>
        — {COPY.quoteBy[by]} · {clock ? <When>{clock}</When> : COPY.notRecorded}
      </span>
    </div>
  );
}

export function StateTag({ children, color = C.ink2, dim }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, color: dim ? C.ink3 : color, background: dim ? 'transparent' : C.wash, border: `1px solid ${dim ? C.hair2 : color}`, padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
      {children}
    </span>
  );
}

/** A button's label at its own size — the global `button { font-size: 16px !important }` (src/index.css) only reaches the button itself. */
export const Label = ({ size = 11.5, weight = 600, children, style }) => <span style={{ fontSize: size, fontWeight: weight, lineHeight: 1.2, ...style }}>{children}</span>;

export function Door({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...plain, minHeight: 30, padding: '0 10px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${C.hair2}`, color: C.ink, whiteSpace: 'nowrap' }}>
      <Label>{label}</Label><Label style={{ color: C.ink3 }}><span aria-hidden="true">›</span></Label>
    </button>
  );
}

export function Chip({ on, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!on} title={title} style={{ ...plain, minHeight: 30, padding: '0 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, color: on ? C.ink : C.ink2, background: on ? tint('teal', 0.14) : 'transparent', border: `1px solid ${on ? tint('teal', 0.45) : C.hair2}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <Label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{children}</Label>
    </button>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div role="tablist" style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, padding: 3, borderRadius: 11, background: C.shade, border: `1px solid ${C.hair}`, minWidth: 0 }}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value} onClick={() => onChange(o.id)} style={{ ...plain, minHeight: 34, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: o.id === value ? C.ink : C.ink3, background: o.id === value ? tint('teal', 0.14) : 'transparent', boxShadow: o.id === value ? `inset 0 0 0 1px ${tint('teal', 0.35)}` : 'none', whiteSpace: 'nowrap' }}>
          <Label size={12.5} weight={o.id === value ? 700 : 500}>{o.label}</Label>
        </button>
      ))}
    </div>
  );
}

/** A text-styled button; `expanded` / `controls` make it a disclosure (aria-expanded, aria-controls — review A2P3-5). */
export function TextButton({ children, onClick, color = C.teal, expanded, controls }) {
  return <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={controls} style={{ ...plain, color, textDecoration: 'underline', minHeight: 24, alignSelf: 'flex-start' }}><Label>{children}</Label></button>;
}

export function PrimaryButton({ children, onClick }) {
  return <button type="button" onClick={onClick} style={{ ...plain, minHeight: 34, padding: '0 14px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: tint('teal', 0.12), border: `1px solid ${tint('teal', 0.4)}`, color: C.ink }}><Label size={12.5}>{children}</Label></button>;
}
