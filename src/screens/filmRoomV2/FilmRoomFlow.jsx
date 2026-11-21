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
import { fmtPoints, fmtPrice } from './filmRoomModel';
import { formatNumberPath } from '../../constants/filmTape';
import { flowOf, layoutOf, groupPins, panelOf, FLOW_PIN_TOUCH } from './filmRoomFlow.js';

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
/** A declared aggregate the front computes, with its value — no mark. */
function FlowAgg({ a, text = String(a.value), style }) {
  return <span data-flow-agg={a.aggregate} data-flow-class={a.cls || 'none'} data-agg-value={a.value} style={{ ...NUM, ...style }}>{text}</span>;
}
/** A symbol, the tape's string at its path; "not recorded" where the tape holds none (§7). */
function FlowSym({ tape, path }) {
  if (!path) return <span>{F.notRecorded}</span>;
  return <span data-flow-text={formatNumberPath(path)}>{path.reduce((o, k) => o?.[k], tape)}</span>;
}

// ── the pin's shapes (§6): filled circle · hollow circle · diamond ──────────

export function PinMark({ kind, label = null, sel = false, size = 22, flat = false }) {
  const ring = flat ? 'none' : sel ? `0 0 0 2.5px ${C.bg}, 0 0 0 4.5px ${C.teal}` : `0 0 0 2px ${C.bg}`;
  const bw = size < 16 ? 1.5 : 1.75;
  const fill = flat ? 'transparent' : C.bg;
  const num = label ? <span aria-hidden="true" style={{ position: 'relative', fontSize: 11.5, fontWeight: 800, lineHeight: 1, ...NUM }}>{label}</span> : null;
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
    <span data-pin-shape={filled ? 'filled' : 'hollow'} style={{ width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: filled ? C.ink : fill, border: filled ? 'none' : `${bw}px solid ${C.ink}`, color: filled ? C.bg : C.ink, boxShadow: ring }}>
      {num}
    </span>
  );
}

/** A pin's number on the chart (§6): its bound ordinal, then "+" for a merged pin — read aloud by its fact line instead. */
const pinLabel = (group) => <><FlowAgg a={group.first.ordinal} />{group.merged ? F.plus : null}</>;

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

function pathOf(run, lay) {
  if (run.length === 1) {
    const px = lay.x(run[0].t); const py = lay.y(run[0].v);
    return `M${(px - 1).toFixed(1)} ${py.toFixed(1)} L${(px + 1).toFixed(1)} ${py.toFixed(1)}`;
  }
  return run.map((p, k) => `${k ? 'L' : 'M'}${lay.x(p.t).toFixed(1)} ${lay.y(p.v).toFixed(1)}`).join(' ');
}

function FlowChart({ tape, flow, height, width, selectedN, onSelectGroup }) {
  const low = flow.low && flow.low.value ? flow.low : null;
  const lowText = low ? `${F.low} ${fmtPoints(low.value.value)}${F.dot}${low.clock ?? ''}` : '';
  const lay = layoutOf(flow, width, height, lowText);
  const sel = lay.groups.find((g) => g.members.some((m) => m.n === selectedN)) ?? null;
  const finalOf = (line) => (line ? line.points.find((p) => p.final) ?? null : null);
  const youEnd = finalOf(flow.lines.you);
  const cpuEnd = finalOf(flow.lines.cpu);
  return (
    <div data-flow-chart="" data-chart-width={lay.width} style={{ position: 'relative', width: '100%', height }}>
      <svg width={lay.width} height={height} aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
        {lay.guides.map((g) => <line key={g} data-flow-guide="" x1={0} x2={lay.width} y1={lay.y(g)} y2={lay.y(g)} style={{ stroke: C.hair, strokeWidth: 1 }} />)}
        <line data-flow-zero="" x1={0} x2={lay.width} y1={lay.zeroY} y2={lay.zeroY} style={{ stroke: tint('scrim', 0.24), strokeWidth: 1 }} />
        {sel ? <line data-flow-drop="" x1={sel.x} x2={sel.x} y1={sel.y + 14} y2={height} style={{ stroke: tint('teal', 0.55), strokeWidth: 1 }} /> : null}
        {flow.lines.cpu ? flow.lines.cpu.runs.map((run, k) => <path key={`c${k}`} data-flow-line="cpu" d={pathOf(run, lay)} style={{ fill: 'none', stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 4', strokeLinecap: 'round' }} />) : null}
        {flow.lines.you.runs.map((run, k) => <path key={`y${k}`} data-flow-line="you" d={pathOf(run, lay)} style={{ fill: 'none', stroke: C.ink, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }} />)}
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
            <PinMark kind={g.kind} label={pinLabel(g)} sel={on} size={on ? 24 : 22} />
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
  if (h.kind === 'won' || h.kind === 'lost') text = <>{F.heading[h.kind]} <FlowAgg a={h.margin} text={h.margin.text} /></>;
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

/** The pin panel (§7): the selected pin's fact, its quotations, its link; the stepper for a merged pin; "n more". */
function FlowPanel({ tape, flow, group, pin, onStep, onOpenAt, renderAgentMark, narrow }) {
  const panel = panelOf(tape, pin);
  const at = group.members.indexOf(pin);
  const step = (d) => { const to = at + d; if (to >= 0 && to < group.members.length) onStep(group.members[to]); };
  const quote = (who, words) => (
    <div data-flow-said={who} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
      <span style={{ width: 26, flexShrink: 0, display: 'inline-flex', justifyContent: 'center', paddingTop: who === 'player' ? 3 : 0 }}>
        {who === 'player' ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink2 }}>{F.speakerYou}</span> : renderAgentMark(22)}
      </span>
      <Quotation doc={tape} path={words.path} by={who} at={words.at} lines={3} size={narrow ? 14.5 : 15.5} weight={500} color={C.ink} />
    </div>
  );
  return (
    <div data-flow-panel={pin.n} data-flow-panel-member={`${pin.src}:${pin.index}`} style={{ borderRadius: 16, background: C.surface, border: `1px solid ${C.hair2}`, padding: narrow ? '10px 12px 0' : '14px 16px 2px', display: 'flex', flexDirection: 'column', gap: narrow ? 7 : 9, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <span style={{ width: 26, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}><PinMark kind={pin.kind} label={<FlowAgg a={pin.ordinal} />} flat /></span>
        <span data-flow-fact="" style={{ fontSize: 13.5, lineHeight: '22px', color: C.ink2, minWidth: 0, ...NUM }}><FactLine tape={tape} panel={panel} /></span>
      </div>
      {panel.src === 'directive' && panel.player ? quote('player', panel.player) : null}
      {panel.src === 'directive' && panel.reply ? quote('agent', panel.reply) : null}
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
 * @param {boolean}  props.desktop         the shell's ≥ 1024 px layout
 * @param {boolean}  props.oneDay          a one-day battle ("This game"), else "This day"
 * @param {object|null} props.moments      the cards line's count (a declared aggregate) — only when cards are on and the
 *                                         tape view would offer at least one moment (§9); null otherwise
 * @param {Function} props.onOpenTape      the door (and the cards line): the tape, on Glance
 * @param {Function} props.onOpenAt        a pin's link: the tape, at that anchor (`swap-n` or `directives`)
 * @param {string}   props.doorId          the door's id — focus comes back to it from the tape (§10)
 * @param {Function} props.renderAgentMark the agent's mark at a size, beside its quoted reply
 */
export default function FilmRoomFlow({ tape, desktop = false, oneDay = true, moments = null, onOpenTape, onOpenAt, doorId, renderAgentMark = () => null }) {
  const narrow = useNarrow() && !desktop;
  const L = desktop ? FLOW_LAYOUT.desktop : narrow ? FLOW_LAYOUT.narrow : FLOW_LAYOUT.phone;
  const flow = flowOf(tape, { oneDay });
  const [selectedN, setSelectedN] = useState(() => flow.selected?.n ?? null);
  const pin = flow.pins.find((p) => p.n === selectedN) ?? flow.selected;
  // the chart's RENDERED width — measured once, here, on the chart's block (the chart is its full width): the chart
  // draws its groups at it and the panel steps through the same groups (§6)
  const [width, chartRef] = useWidth(L.chartWidth);
  const group = pin ? groupPins(flow.pins, width).find((g) => g.members.includes(pin)) : null;
  const onSelectGroup = (g) => setSelectedN(g.members.some((m) => m.n === selectedN) ? selectedN : g.first.n);

  const heading = <FlowHeading flow={flow} size={desktop ? 56 : narrow ? 32 : 40} />;
  const key = <FlowKey flow={flow} size={desktop ? 15 : 13.5} />;
  const chartBlock = (
    <div ref={chartRef} data-flow-chart-block="" style={{ display: 'flex', flexDirection: 'column', gap: L.bleed ? 5 : 7, margin: L.bleed ? `0 -${L.bleed}px` : 0, minWidth: 0 }}>
      <FlowChart tape={tape} flow={flow} height={L.chartHeight} width={width} selectedN={pin?.n ?? null} onSelectGroup={onSelectGroup} />
      <div data-flow-axis="" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.ink2, ...NUM }}>{flow.axis.map((t, k) => <When key={k}>{t ?? ''}</When>)}</div>
      {flow.legend.length ? <Legend kinds={flow.legend} /> : null}
    </div>
  );
  const below = (
    <div data-flow-below="" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {/* §7: with no pin, the quiet line — but never beside rows the chart could not place (no instant): then the
          count of them alone, on the full tape (the review's NUM-3: "Nothing stood out" next to "6 more" contradicted) */}
      {pin && group
        ? <FlowPanel tape={tape} flow={flow} group={group} pin={pin} onStep={(m) => setSelectedN(m.n)} onOpenAt={onOpenAt} renderAgentMark={renderAgentMark} narrow={narrow} />
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
