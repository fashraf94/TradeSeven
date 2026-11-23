// src/screens/filmRoomV2/FilmRoomFlow.jsx
//
// Film Room D1 — THE FRONT, the game's flow (Build D spec V1 §4 – §10; design
// of record docs/design/20261120_FILM_ROOM_FLOW_MOCKUP.html, round 3, where the
// spec does not govern). Top to bottom: the heading, the key, the chart with
// its pins, the legend, the selected pin's panel (a polite live region), the
// counts, the cards line, and one door to the unchanged tape.
//
// What it reads: the tape day the shell already holds — nothing else, and it
// asks nothing of anyone. What it says: the copy table's `flow` words
// (filmRoomCopy.js, §11), the tape's values bound by their paths, and the
// player's and the agent's words only as quotations of their tape paths (the
// kit's Quotation, clamped at three lines). Every number is the tape's
// (numberAt, through filmRoomFlow.js) or a declared derived aggregate, rendered
// WITHOUT the number-kind mark (FL-12) but bound for the sweeps:
//   data-flow-num="<path>"   a tape value at its path, data-flow-class its class
//   data-flow-agg="<name>"   a declared aggregate, data-agg-value its value
//   data-flow-text="<path>"  a symbol, the tape's string at its path
// TOKENS ONLY (BUILD_RULES §10): colours are the kit's cssVar tokens, SVG colours
// through `style`. Nothing animates (§5).

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, tint, plain, When, Quotation } from './FilmRoomKit';
import { fmtPoints, fmtPrice, etDateLabel } from './filmRoomModel';
import { formatNumberPath } from '../../constants/filmTape';
import { flowOf, layoutOf, panelOf, FLOW_PIN_TOUCH, FLOW_AXIS_INSET } from './filmRoomFlow.js';
// Film Room D2: the record's date, from its strict instant, in ET
import { etDateOf } from '../../utils/tapeSchedule.js';
import { instantMs } from '../../utils/filmRoomSubject.js';

const F = COPY.flow;
const NUM = { fontVariantNumeric: 'tabular-nums' };

/**
 * The front's layout at each width (the mock-up's): the page padding, the chart's height, and the chart's width
 * before it is measured — the width it lays out at at 390, at 320 (the chart runs 4 px past the text column on each
 * side) and on a 1440 desktop. The merge uses the MEASURED width; this is only the first paint's and jsdom's.
 */
export const FLOW_LAYOUT = Object.freeze({
  phone: { pad: 20, chartHeight: 150, bleed: 0, chartWidth: 350 },
  narrow: { pad: 16, chartHeight: 112, bleed: 4, chartWidth: 296 },
  desktop: { pad: 40, chartHeight: 230, bleed: 0, chartWidth: 639 },
});
const NARROW_QUERY = '(max-width: 359px)';

/** Phones under 360 px wide take the narrow layout (the mock-up's 320 frames); false wherever matchMedia is absent. */
function useNarrow() {
  const mq = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null);
  const [narrow, setNarrow] = useState(() => Boolean(mq()?.matches));
  useEffect(() => {
    const m = mq();
    if (!m) return undefined;
    const on = () => setNarrow(Boolean(m.matches));
    if (typeof m.addEventListener === 'function') m.addEventListener('change', on); else if (typeof m.addListener === 'function') m.addListener(on);
    return () => { if (typeof m.removeEventListener === 'function') m.removeEventListener('change', on); else if (typeof m.removeListener === 'function') m.removeListener(on); };
  }, []);
  return narrow;
}

/**
 * The chart's RENDERED width (§6: the merge uses it), measured and kept current; `fallback` until it is measured.
 * It follows the ELEMENT, through a callback ref: a live switch between the phone and desktop layouts mounts the
 * chart's block under another parent, and the width is measured again on the new element — never the old one's
 * (the review's CH-3: a ref object's effect kept observing the detached node).
 */
function useWidth(fallback) {
  const [el, setEl] = useState(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!el) return undefined;
    const fit = () => { if (el.clientWidth > 1) setW(el.clientWidth); };
    fit();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [w > 1 ? w : fallback, setEl];
}

// ── bound values (FL-12: no mark, but bound) ────────────────────────────────

/** A tape value at its path, formatted by the screen's own formatter (FL-13), with no number-kind mark. */
function FlowNum({ num, fmt = fmtPoints, style }) {
  if (!num) return <span data-flow-missing="" style={style}>{fmt(null)}</span>;
  return <span data-flow-num={formatNumberPath(num.path)} data-flow-doc="tape" data-flow-class={num.cls || 'none'} style={{ ...NUM, ...style }}>{fmt(num.value)}</span>;
}
/** A declared aggregate the front computes, with its value — no mark. A pin's ordinal names the member it numbers. */
function FlowAgg({ a, text = String(a.value), style, member = null }) {
  return <span data-flow-agg={a.aggregate} data-flow-class={a.cls || 'none'} data-agg-value={a.value} data-flow-member={member ? `${member.src}:${member.index}` : undefined} style={{ ...NUM, ...style }}>{text}</span>;
}
/** A symbol, the tape's string at its path; "not recorded" where the tape holds none (§7). */
function FlowSym({ tape, path }) {
  if (!path) return <span>{F.notRecorded}</span>;
  return <span data-flow-text={formatNumberPath(path)}>{path.reduce((o, k) => o?.[k], tape)}</span>;
}

// ── the pin's shapes (§6): filled circle · hollow circle · diamond ──────────

/** How much a merged pin's mark widens to hold its range, "2–4" (Amendment A DA-15) — inside the 44 px touch area. */
export const PIN_RANGE_WIDEN = 12;

/**
 * A pin's mark (§6). `wide`: a merged pin's, widened to hold its range (DA-15) — the shape kept: a pill for the two
 * circles, a lozenge (the diamond's points, its middle widened) for a directive.
 */
export function PinMark({ kind, label = null, sel = false, size = 22, flat = false, wide = false }) {
  const ring = flat ? 'none' : sel ? `0 0 0 2.5px ${C.bg}, 0 0 0 4.5px ${C.teal}` : `0 0 0 2px ${C.bg}`;
  const bw = size < 16 ? 1.5 : 1.75;
  const fill = flat ? 'transparent' : C.bg;
  const width = wide ? size + PIN_RANGE_WIDEN : size;
  const num = label ? <span aria-hidden="true" style={{ position: 'relative', zIndex: 1, fontSize: 11.5, fontWeight: 800, lineHeight: 1, whiteSpace: 'nowrap', ...NUM }}>{label}</span> : null;
  if (kind === 'directive' && wide) {
    const pad = 5;
    const lozenge = (x0, y0, x1, y1) => { const m = (y1 - y0) / 2; return [[x0, y0 + m], [x0 + m, y0], [x1 - m, y0], [x1, y0 + m], [x1 - m, y1], [x0 + m, y1]].map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' '); };
    return (
      <span data-pin-shape="diamond" data-pin-wide="" style={{ width, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.ink }}>
        {num}
        <svg width={width + 2 * pad} height={size + 2 * pad} aria-hidden="true" focusable="false" style={{ position: 'absolute', left: -pad, top: -pad, zIndex: 0, overflow: 'visible' }}>
          {flat ? null : <polygon points={lozenge(pad - (sel ? 4.5 : 2), pad - (sel ? 4.5 : 2), pad + width + (sel ? 4.5 : 2), pad + size + (sel ? 4.5 : 2))} style={{ fill: sel ? C.teal : C.bg }} />}
          {sel && !flat ? <polygon points={lozenge(pad - 2.5, pad - 2.5, pad + width + 2.5, pad + size + 2.5)} style={{ fill: C.bg }} /> : null}
          <polygon points={lozenge(pad, pad, pad + width, pad + size)} style={{ fill, stroke: C.ink, strokeWidth: bw }} />
        </svg>
      </span>
    );
  }
  if (kind === 'directive') {
    return (
      <span data-pin-shape="diamond" style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.ink }}>
        <span style={{ position: 'absolute', width: size * 0.76, height: size * 0.76, transform: 'rotate(45deg)', borderRadius: 2.5, boxSizing: 'border-box', background: fill, border: `${bw}px solid ${C.ink}`, boxShadow: ring }} />
        {num}
      </span>
    );
  }
  const filled = kind === 'agent';
  return (
    <span data-pin-shape={filled ? 'filled' : 'hollow'} data-pin-wide={wide ? '' : undefined} style={{ width, height: size, borderRadius: size / 2, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: filled ? C.ink : fill, border: filled ? 'none' : `${bw}px solid ${C.ink}`, color: filled ? C.bg : C.ink, boxShadow: ring }}>
      {num}
    </span>
  );
}

/**
 * A pin's number on the chart (§6): its bound ordinal; a merged pin's RANGE, "2–4" — its first and its last
 * member's bound ordinals and one fixed en dash (Amendment A DA-15), so the number the panel names ("3") can be
 * placed on the chart. Read aloud by the members' fact lines instead.
 */
const pinLabel = (group) => (group.merged
  ? <><FlowAgg a={group.first.ordinal} member={group.first} />{F.range}<FlowAgg a={group.last.ordinal} member={group.last} /></>
  : <FlowAgg a={group.first.ordinal} member={group.first} />);

// ── the fact lines (§7) ─────────────────────────────────────────────────────

/** One part of a fact line: it never breaks inside, so a line breaks only between its parts (the mock-up's FlFact). */
const Part = ({ children }) => <span style={{ whiteSpace: 'nowrap' }}>{children}</span>;

/** "{maker} · {out} → {in} · {clock}" (+ " · sold at {price}") or "Your directive · {clock} · filed|not filed". */
function FactLine({ tape, panel }) {
  if (panel.src === 'action') {
    return (
      <>
        <Part>{F.makers[panel.maker]}</Part>{F.dot}<Part><FlowSym tape={tape} path={panel.out} />{F.arrow}<FlowSym tape={tape} path={panel.in} /></Part>{F.dot}<Part><When>{panel.clock ?? ''}</When></Part>
        {panel.price ? <>{F.dot}<Part>{F.soldAt} <FlowNum num={panel.price} fmt={fmtPrice} /></Part></> : null}
      </>
    );
  }
  return <><Part>{F.yourDirective}</Part>{F.dot}<Part><When>{panel.clock ?? ''}</When></Part>{F.dot}<Part>{panel.filed ? F.filed : F.notFiled}</Part></>;
}

const hidden = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

// ── the chart (§5, §6) ──────────────────────────────────────────────────────

/** A run of two points or more, as one SVG path through its points — and nothing past its ends (DB-7: butt caps). */
function pathOf(run, lay) {
  return run.map((p, k) => `${k ? 'L' : 'M'}${lay.x(p.t).toFixed(1)} ${lay.y(p.v).toFixed(1)}`).join(' ');
}

/** The line's stroke and its single points' dots (§5): the player's solid, the CPU's dashed. Caps are butt (DB-7). */
const LINE = Object.freeze({
  you: { path: { fill: 'none', stroke: C.ink, strokeWidth: 2.2, strokeLinecap: 'butt', strokeLinejoin: 'round' }, dot: { r: 2.4, style: { fill: C.ink } } },
  cpu: { path: { fill: 'none', stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 4', strokeLinecap: 'butt' }, dot: { r: 2, style: { fill: C.ink2 } } },
});

/**
 * One line's runs (Amendment B DB-7, Astra's F7): a run of two points or more is a path; a run of ONE scored check is
 * a dot at its own instant — never a path, whose stub would reach across a neighbouring missing check; an isolated
 * final point is drawn by its end dot (data-flow-end). Butt caps: no line's end reaches into the gap it stops at. A run
 * whose points all coincide (two scored checks at one instant with one value) has no length for a butt-capped stroke to
 * paint — it is a point too, a dot (the fix round review's FRB-1).
 */
function LineRuns({ line, who, lay }) {
  return line.runs.map((run, k) => {
    const point = run.every((p) => p.t === run[0].t && p.v === run[0].v);
    if (!point) return <path key={k} data-flow-line={who} d={pathOf(run, lay)} style={LINE[who].path} />;
    if (run.some((p) => p.final)) return null;
    return <circle key={k} data-flow-dot={who} cx={lay.x(run[0].t)} cy={lay.y(run[0].v)} r={LINE[who].dot.r} style={LINE[who].dot.style} />;
  });
}

/** The low mark's label text (§5) — measured by layoutOf for its overlap test, drawn by the chart. */
const lowTextOf = (flow) => (flow.low && flow.low.value ? `${F.low} ${fmtPoints(flow.low.value.value)}${F.dot}${flow.low.clock ?? ''}` : '');

/** The chart, drawn from the front's ONE layout `lay` (DA-11): its x-range, its groups — the panel steps through the same. */
function FlowChart({ tape, flow, lay, height, selectedN, onSelectGroup }) {
  const low = flow.low && flow.low.value ? flow.low : null;
  const sel = lay.groups.find((g) => g.members.some((m) => m.n === selectedN)) ?? null;
  // the selected pin's drop line never strikes through the low mark's label: where it would cross it, it stops short of
  // the label (or starts below it) — the fix round review's FRB-2, after DA-11's inset drew the Sep 23 low at 390
  const lowBox = lay.low && lay.low.shown ? lay.low.box : null;
  let drop = sel ? { from: sel.y + 14, to: height } : null;
  if (drop && lowBox && sel.x >= lowBox.left && sel.x <= lowBox.right) {
    if (drop.from < lowBox.top) drop = { ...drop, to: Math.max(drop.from, lowBox.top - 2) };
    else if (drop.from <= lowBox.bottom) drop = { ...drop, from: lowBox.bottom + 2 };
  }
  const finalOf = (line) => (line ? line.points.find((p) => p.final) ?? null : null);
  const youEnd = finalOf(flow.lines.you);
  const cpuEnd = finalOf(flow.lines.cpu);
  return (
    <div data-flow-chart="" data-chart-width={lay.width} style={{ position: 'relative', width: '100%', height }}>
      <svg width={lay.width} height={height} aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
        {lay.guides.map((g) => <line key={g} data-flow-guide="" x1={0} x2={lay.width} y1={lay.y(g)} y2={lay.y(g)} style={{ stroke: C.hair, strokeWidth: 1 }} />)}
        <line data-flow-zero="" x1={0} x2={lay.width} y1={lay.zeroY} y2={lay.zeroY} style={{ stroke: tint('scrim', 0.24), strokeWidth: 1 }} />
        {drop ? <line data-flow-drop="" x1={sel.x} x2={sel.x} y1={drop.from} y2={drop.to} style={{ stroke: tint('teal', 0.55), strokeWidth: 1 }} /> : null}
        {flow.lines.cpu ? <g data-flow-runs="cpu"><LineRuns line={flow.lines.cpu} who="cpu" lay={lay} /></g> : null}
        <g data-flow-runs="you"><LineRuns line={flow.lines.you} who="you" lay={lay} /></g>
        {cpuEnd ? <circle data-flow-end="cpu" cx={lay.x(cpuEnd.t)} cy={lay.y(cpuEnd.v)} r="3" style={{ fill: C.bg, stroke: C.ink2, strokeWidth: 1.6 }} /> : null}
        {youEnd ? <circle data-flow-end="you" cx={lay.x(youEnd.t)} cy={lay.y(youEnd.v)} r="3.4" style={{ fill: C.ink }} /> : null}
        {lay.low && lay.low.shown ? <line data-flow-low-tick="" x1={lay.low.x} x2={lay.low.x} y1={lay.low.y + 1} y2={lay.low.y + 5} style={{ stroke: C.ink2, strokeWidth: 1.5 }} /> : null}
      </svg>
      {lay.low && lay.low.shown ? (
        <span data-flow-low="" style={{ position: 'absolute', left: lay.low.box.left, top: lay.low.box.top, width: lay.low.box.right - lay.low.box.left, textAlign: 'center', fontSize: 11, lineHeight: '14px', color: C.ink2, whiteSpace: 'nowrap', ...NUM }}>
          {F.low} <FlowNum num={low.value} />{F.dot}<When>{low.clock ?? ''}</When>
        </span>
      ) : null}
      {lay.groups.map((g) => {
        const on = g === sel;
        return (
          <button
            key={g.n}
            type="button"
            data-flow-pin={g.n}
            data-flow-pin-members={g.members.map((m) => `${m.src}:${m.index}`).join(' ')}
            data-flow-pin-kind={g.kind}
            aria-pressed={on}
            onClick={() => onSelectGroup(g)}
            style={{ ...plain, position: 'absolute', left: g.x - FLOW_PIN_TOUCH / 2, top: g.y - FLOW_PIN_TOUCH / 2, width: FLOW_PIN_TOUCH, height: FLOW_PIN_TOUCH, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: on ? 3 : 2, borderRadius: 8 }}
          >
            <PinMark kind={g.kind} label={pinLabel(g)} sel={on} size={on ? 24 : 22} wide={g.merged} />
            <span data-flow-pin-name="" style={hidden}>
              {g.members.map((m, k) => <React.Fragment key={m.n}>{k ? ' ' : null}<FactLine tape={tape} panel={panelOf(tape, m)} /></React.Fragment>)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LineMark({ dashed }) {
  return (
    <svg width="22" height="6" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <line x1="1" x2="21" y1="3" y2="3" style={{ stroke: dashed ? C.ink2 : C.ink, strokeWidth: dashed ? 1.6 : 2.2, strokeDasharray: dashed ? '5 4' : undefined, strokeLinecap: 'round' }} />
    </svg>
  );
}

/** The key (§4.2): "You {total}" with the solid mark, then "CPU {opponent}" dashed — only under the CPU condition. */
function FlowKey({ flow, size = 13.5 }) {
  const item = (dashed, who, num, k) => (
    <span data-flow-key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <LineMark dashed={dashed} />
      <span>{who} <FlowNum num={num} style={{ color: C.ink, fontWeight: 600 }} /></span>
    </span>
  );
  return (
    <div data-flow-keyrow="" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', fontSize: size, color: C.ink2, ...NUM }}>
      {item(false, F.key.you, flow.key.you, 'you')}
      {flow.key.cpu ? item(true, F.key.cpu, flow.key.cpu, 'cpu') : null}
    </div>
  );
}

/** The heading (§4.1). */
function FlowHeading({ flow, size }) {
  const h = flow.heading;
  let text;
  // DB-1 / DA-4: no margin to show (no CPU entry in the key, or two finals that display equal) — the result word alone
  if (h.kind === 'won' || h.kind === 'lost') text = h.margin ? <>{F.heading[h.kind]} <FlowAgg a={h.margin} text={h.margin.text} /></> : F.heading[`${h.kind}Alone`];
  else if (h.kind === 'draw') text = F.heading.draw;
  else if (h.kind === 'final') text = <>{F.heading.final} <FlowNum num={h.total} /></>;
  else text = <When>{h.date ?? ''}</When>;
  return <h1 data-flow-heading={h.kind} style={{ margin: 0, fontSize: size, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: C.ink, ...NUM }}>{text}</h1>;
}

function Legend({ kinds }) {
  return (
    <div data-flow-legend="" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {kinds.map((k) => (
        <span key={k} data-flow-legend-kind={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.ink2, whiteSpace: 'nowrap' }}>
          <PinMark kind={k} size={11} flat />{F.legend[k]}
        </span>
      ))}
    </div>
  );
}

function Chevron() {
  return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block' }}><path d="M9 5l7 7-7 7" style={{ fill: 'none', stroke: C.teal, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }} /></svg>;
}

/** A link-styled button (the mock-up's FlLink): teal, 44 px tall, a chevron after it. */
const FlowLink = React.forwardRef(function FlowLink({ label, onClick, size = 13.5, style, id, data }, ref) {
  return (
    <button ref={ref} id={id} type="button" onClick={onClick} {...data} style={{ ...plain, alignSelf: 'flex-start', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 2, color: C.teal, borderRadius: 6, ...style }}>
      <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.2 }}>{label}</span><Chevron />
    </button>
  );
});

// ── the agent's words (Film Room D2 spec §1; DW-1, DW-2) ────────────────────

/**
 * What a swap pin shows of the day's debrief record (D2 spec §1's states): `{ kind: 'line', i }` — the record holds a
 * line bound to THIS swap's tape row key (`actions[].key`) at `lines[i]`; `{ kind: 'notYet' }` — no record yet, before
 * the next run; null — everything else: the words off (no `words`), a read still loading or failed, a record that is
 * `nothing` or `failed`, no line for this swap, a line whose key the tape no longer holds, a record of another battle,
 * another day or another owner (Amendment F DF-1). A directive pin never shows any (DW-2).
 */
export function wordsOfPin(words, tape, pin) {
  if (!words || pin?.src !== 'action') return null;
  if (words.state === 'missing') return words.notYet === true ? { kind: 'notYet' } : null;
  const record = words.state === 'ready' ? words.record : null;
  if (!record || record.status !== 'written' || !Array.isArray(record.lines)) return null;
  // the record's battle, day AND owner are the tape's on screen (Amendment F DF-1, Astra's F1) — still the one read
  if (typeof record.battleId !== 'string' || !record.battleId || typeof record.etDate !== 'string' || !record.etDate) return null;
  if (record.battleId !== tape?.battleId || record.etDate !== tape?.etDate) return null;
  if (typeof record.ownerId !== 'string' || !record.ownerId || record.ownerId !== tape?.ownerId) return null;
  const key = tape?.actions?.[pin.index]?.key;
  if (typeof key !== 'string' || !key) return null;
  const i = record.lines.findIndex((l) => l !== null && typeof l === 'object' && l.key === key && typeof l.text === 'string' && l.text);
  return i < 0 ? null : { kind: 'line', i };
}

/** The record's date in the design's small treatment ("Sep 23"): its writtenAt's ET date — only from a strict instant. */
const debriefDateOf = (record) => (instantMs(record?.writtenAt) === null ? null : etDateLabel(etDateOf(record.writtenAt), { short: true }));

/**
 * One line of the agent's words (D2 spec §1): the agent's mark, as beside a directive's reply; the words as a quotation
 * bound to the record's `lines[i].text` in the document labelled `debrief` — its attribution ("the agent", the instant)
 * kept for assistive technology, hidden visually (`preview`) —; beside them the record's date.
 */
function AgentWords({ record, i, renderAgentMark, narrow }) {
  const date = debriefDateOf(record);
  return (
    <div data-flow-said="agent-words" data-flow-debrief-line={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
      <span style={{ width: 26, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>{renderAgentMark(22)}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {/* never clamped (the review's P2): the words are shown nowhere else, so the whole line — at most 160 code points
            (§5) — is the player's to read; `preview` keeps the attribution for assistive technology only */}
        <Quotation doc={record} path={['lines', i, 'text']} by="agent" at={['writtenAt']} size={narrow ? 14.5 : 15.5} weight={500} color={C.ink} docLabel="debrief" preview />
        {date ? <span data-flow-debrief-date="" style={{ fontSize: 11, lineHeight: 1.4, color: C.ink3 }}><When>{date}</When></span> : null}
      </div>
    </div>
  );
}

/** The pin panel (§7): the selected pin's fact, its quotations, its link; the stepper for a merged pin; "n more". */
function FlowPanel({ tape, flow, group, pin, onStep, onOpenAt, renderAgentMark, narrow, words = null }) {
  const panel = panelOf(tape, pin);
  // D2: the agent's words on a swap pin — between the fact line and the link (D2 spec §1)
  const said = wordsOfPin(words, tape, pin);
  const at = group.members.indexOf(pin);
  const step = (d) => { const to = at + d; if (to >= 0 && to < group.members.length) onStep(group.members[to]); };
  const quote = (who, words) => (
    <div data-flow-said={who} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
      <span style={{ width: 26, flexShrink: 0, display: 'inline-flex', justifyContent: 'center', paddingTop: who === 'player' ? 3 : 0 }}>
        {who === 'player' ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink2 }}>{F.speakerYou}</span> : renderAgentMark(22)}
      </span>
      {/* DA-16 / DB-13: three lines, no disclosure (the pin's link is the way to the rest); the attribution kept for
          assistive technology and the oracle, hidden visually — the speaker's mark and the fact line's time say it */}
      <Quotation doc={tape} path={words.path} by={who} at={words.at} lines={3} size={narrow ? 14.5 : 15.5} weight={500} color={C.ink} preview />
    </div>
  );
  return (
    <div data-flow-panel={pin.n} data-flow-panel-member={`${pin.src}:${pin.index}`} style={{ borderRadius: 16, background: C.surface, border: `1px solid ${C.hair2}`, padding: narrow ? '10px 12px 0' : '14px 16px 2px', display: 'flex', flexDirection: 'column', gap: narrow ? 7 : 9, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <span style={{ width: 26, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}><PinMark kind={pin.kind} label={<FlowAgg a={pin.ordinal} member={pin} />} flat /></span>
        <span data-flow-fact="" style={{ fontSize: 13.5, lineHeight: '22px', color: C.ink2, minWidth: 0, ...NUM }}><FactLine tape={tape} panel={panel} /></span>
      </div>
      {panel.src === 'directive' && panel.player ? quote('player', panel.player) : null}
      {panel.src === 'directive' && panel.reply ? quote('agent', panel.reply) : null}
      {said?.kind === 'line' ? <AgentWords record={words.record} i={said.i} renderAgentMark={renderAgentMark} narrow={narrow} /> : null}
      {said?.kind === 'notYet' ? <p data-flow-debrief-notyet="" style={{ margin: '0 0 0 36px', fontSize: 12.5, lineHeight: 1.45, color: C.ink2 }}>{COPY.debrief.notYet}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginLeft: 36 }}>
        <FlowLink label={F.openThis} onClick={() => onOpenAt(panel.link.anchor)} data={{ 'data-flow-pin-link': panel.link.anchor }} />
        {group.merged ? (
          <span data-flow-stepper="" style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto' }}>
            {[[-1, F.previous], [1, F.next]].map(([d, label]) => {
              const end = at + d < 0 || at + d >= group.members.length;
              return <button key={label} type="button" aria-disabled={end || undefined} onClick={() => step(d)} style={{ ...plain, minHeight: 44, minWidth: 44, padding: '0 8px', color: end ? C.ink3 : C.ink, borderRadius: 8 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span></button>;
            })}
          </span>
        ) : null}
      </div>
      {flow.more.value > 0 ? <div data-flow-more="" style={{ borderTop: `1px solid ${C.hair}`, padding: narrow ? '8px 0 10px 36px' : '10px 0 12px 36px', fontSize: 12.5, color: C.ink2 }}><FlowAgg a={flow.more} /> {F.more}</div> : null}
    </div>
  );
}

function Tiles({ counts, cols }) {
  if (!counts.tiles.length) return null;
  return (
    <section data-flow-counts="" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: C.ink2 }}>{F.counts[counts.heading]}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 10 }}>
        {counts.tiles.map((t) => (
          <div key={t.job} data-flow-tile={t.job} style={{ borderRadius: 14, background: C.surface, border: `1px solid ${C.hair2}`, padding: '12px 12px 13px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, boxSizing: 'border-box' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink2 }}>{F.counts[t.job]}</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, color: C.ink, ...NUM }}>
              <FlowAgg a={t.x} /><span style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0, color: C.ink2 }}>{F.counts.of}</span><FlowAgg a={t.y} />
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.35, color: C.ink2 }}>{F.counts[t.caption]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The front for one written tape day.
 * @param {object}   props.tape            the day's tape (written: `checks` is an array)
 * @param {object}   [props.battle]        the battle document the shell holds — DB-2's evidence for a tape written
 *                                         before `isFinalDay` (its validated final trading day); nothing else is read
 * @param {boolean}  props.desktop         the shell's ≥ 1024 px layout
 * @param {boolean}  props.oneDay          a one-day battle ("This game"), else "This day"
 * @param {object|null} props.moments      the cards line's count (a declared aggregate) — only when cards are on and the
 *                                         tape view would offer at least one moment (§9); null otherwise
 * @param {Function} props.onOpenTape      the door (and the cards line): the tape, on Glance
 * @param {Function} props.onOpenAt        a pin's link: the tape, at that anchor (`swap-n` or `directives`)
 * @param {string}   props.doorId          the door's id — focus comes back to it from the tape (§10)
 * @param {Function} props.renderAgentMark the agent's mark at a size, beside its quoted reply
 * @param {object|null} [props.words]    Film Room D2: the day's debrief record as the shell read it —
 *                                         `{ state, record, notYet }` — only where the words are on for the owner;
 *                                         null (the words off) renders the front exactly as D1 did
 */
export default function FilmRoomFlow({ tape, battle = null, desktop = false, oneDay = true, moments = null, onOpenTape, onOpenAt, doorId, renderAgentMark = () => null, words = null }) {
  const narrow = useNarrow() && !desktop;
  const L = desktop ? FLOW_LAYOUT.desktop : narrow ? FLOW_LAYOUT.narrow : FLOW_LAYOUT.phone;
  const flow = flowOf(tape, { oneDay, battle });
  const [selectedN, setSelectedN] = useState(() => flow.selected?.n ?? null);
  const pin = flow.pins.find((p) => p.n === selectedN) ?? flow.selected;
  // the chart's RENDERED width — measured once, here, on the chart's block (the chart is its full width): the chart
  // draws its groups at it and the panel steps through the same groups (§6)
  const [width, chartRef] = useWidth(L.chartWidth);
  // ONE layout, ONE grouping (Amendment A DA-11 as Astra qualified it, DB-14): the chart draws these groups and the panel
  // steps through the same ones — never a second grouping at another width
  const lay = flow.domain ? layoutOf(flow, width, L.chartHeight, lowTextOf(flow)) : null;
  const group = pin && lay ? lay.groups.find((g) => g.members.includes(pin)) ?? null : null;
  const onSelectGroup = (g) => setSelectedN(g.members.some((m) => m.n === selectedN) ? selectedN : g.first.n);

  const heading = <FlowHeading flow={flow} size={desktop ? 56 : narrow ? 32 : 40} />;
  const key = <FlowKey flow={flow} size={desktop ? 15 : 13.5} />;
  // DB-8: no time basis (a date the calendar does not know, fewer than two distinct check instants) — no chart, no
  // axis, no legend; the rows are counted below, and the key above keeps a recorded final
  const chartBlock = !flow.domain ? null : (
    <div ref={chartRef} data-flow-chart-block="" style={{ display: 'flex', flexDirection: 'column', gap: L.bleed ? 5 : 7, margin: L.bleed ? `0 -${L.bleed}px` : 0, minWidth: 0 }}>
      <FlowChart tape={tape} flow={flow} lay={lay} height={L.chartHeight} selectedN={pin?.n ?? null} onSelectGroup={onSelectGroup} />
      {/* the axis's labels sit on the one x-range: the open at its start, the close at its end (DA-11) */}
      <div data-flow-axis="" style={{ display: 'flex', justifyContent: 'space-between', padding: `0 ${FLOW_AXIS_INSET}px`, fontSize: 11, color: C.ink2, ...NUM }}>{flow.axis.map((t, k) => <When key={k}>{t ?? ''}</When>)}</div>
      {flow.legend.length ? <Legend kinds={flow.legend} /> : null}
    </div>
  );
  const below = (
    <div data-flow-below="" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {/* §7: with no pin, the quiet line — but never beside rows the chart could not place (no instant): then the
          count of them alone, on the full tape (the review's NUM-3: "Nothing stood out" next to "6 more" contradicted) */}
      {pin && group
        ? <FlowPanel tape={tape} flow={flow} group={group} pin={pin} onStep={(m) => setSelectedN(m.n)} onOpenAt={onOpenAt} renderAgentMark={renderAgentMark} narrow={narrow} words={words} />
        : flow.more.value > 0
          ? <p data-flow-more="" style={{ margin: 0, fontSize: 12.5, color: C.ink2 }}><FlowAgg a={flow.more} /> {F.more}</p>
          : <p data-flow-quiet="" style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: C.ink }}>{F.nothing}</p>}
      {flow.incomplete ? <p data-flow-incomplete="" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: C.ink2 }}>{F.incomplete}</p> : null}
    </div>
  );
  const cardsLine = moments && moments.value > 0
    ? <FlowLink label={<><FlowAgg a={moments} /> {F.moments(moments.value)}</>} onClick={onOpenTape} data={{ 'data-flow-cards-line': '' }} />
    : null;
  const foot = (
    <div data-flow-foot="" style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 8, display: 'flex' }}>
      <FlowLink id={doorId} label={F.door} onClick={onOpenTape} size={14} data={{ 'data-flow-door': '' }} />
    </div>
  );

  if (desktop) {
    return (
      <div data-flow-front="desktop" style={{ width: '100%', maxWidth: 1120, margin: '0 auto', padding: '32px 40px 36px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>{heading}{key}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.75fr) minmax(0,1fr)', gap: 36, alignItems: 'start' }}>{chartBlock}<div style={{ paddingTop: 16, minWidth: 0 }}>{below}</div></div>
        <Tiles counts={flow.counts} cols={Math.max(1, flow.counts.tiles.length)} />
        {cardsLine}
        {foot}
      </div>
    );
  }
  return (
    <div data-flow-front={narrow ? 'narrow' : 'phone'} style={{ padding: narrow ? '12px 16px 22px' : '20px 20px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: narrow ? 10 : 14 }}>
        {heading}
        {key}
        {chartBlock}
        {below}
      </div>
      <Tiles counts={flow.counts} cols={2} />
      {cardsLine}
      {foot}
    </div>
  );
}
