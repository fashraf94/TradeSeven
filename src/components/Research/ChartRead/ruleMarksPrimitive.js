// src/components/Research/ChartRead/ruleMarksPrimitive.js
//
// The Chart view's read — THE RULE'S MARKS ON THE CANDLES (build prompt §4, MK-4 – MK-6, CR-4; Phase 0 point 5;
// spec docs/specs/CHART_READ_SPEC_V1.md). lightweight-charts 5 draws a marker (a shape at a bar) and a price line
// (full width), never a short tick, a bracket or a numbered square. So the marks are a SERIES PRIMITIVE
// (series.attachPrimitive): the library calls its pane view inside its own render pass, after every pan, zoom,
// resize and price-scale drag, and the view places every mark with the library's own timeToCoordinate /
// priceToCoordinate at that moment — a mark cannot drift off its bar, because nothing positions it but the chart.
//
// STYLE (MK-4, CR-4): neutral ink, solid, never red and never dashed. A tick is about seven bars wide, centred
// on its bar, on the record's day (never a line to the chart's edge). Each carries its number in a small square;
// a lit mark is thicker, its square filled, and its value shows on the price scale. The touch is a bracket under
// its three sessions with a short tick at the lowest low. On the Battle chart nothing but one labelled stub at
// the right edge (MK-5): "20-day · daily · Tue close".
//
// Two parts: layoutRuleMarks (pure geometry, Node-testable) and RuleMarksPrimitive (the library's interface).

/** A tick spans this many bars, centred on its own (MK-4). */
export const TICK_BARS = 7;
/** The touch's low tick spans fewer bars, so it sits inside its bracket. */
export const LOW_TICK_BARS = 3;
export const SQUARE = 13;
export const LINE = Object.freeze({ plain: 1.3, lit: 2.4 });
/** The bracket hangs this far under the lowest low (px). */
export const BRACKET_DROP = 8;
/** The Battle chart's stub: this long, at the right edge (px). */
export const STUB_LEN = 34;
/**
 * A lit mark's value label on the price scale is about this tall (px): the library's 12 px axis font with its own
 * paddings (about 21 px), and a pixel to spare. Two labels closer than this overlap (FX-8 fault 2).
 */
export const AXIS_LABEL_H = 22;
/** A moved label's leader runs this far into the pane from the price scale, starting at its own price (px). */
export const LEADER = 10;
/** A square keeps this gap from anything it must not touch (px). */
const GAP = 1;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Does an axis-aligned segment, drawn `w` wide, meet a square at (x, cy)? (FX-8 fault 1) */
function segmentMeetsSquare(s, x, cy) {
  const half = s.w / 2 + GAP;
  return Math.min(s.x0, s.x1) - half < x + SQUARE && Math.max(s.x0, s.x1) + half > x
    && Math.min(s.y0, s.y1) - half < cy + SQUARE / 2 && Math.max(s.y0, s.y1) + half > cy - SQUARE / 2;
}

/**
 * The drawing for one scene, in media (CSS) pixels. Pure.
 *
 * FX-8 (the founder's PANW screenshot, 19 Nov): every line and bracket is drawn first and every square last, so a square
 * always sits over a line, never under one; a square goes at its preferred side of its own mark (a tick: left of the
 * tick, else right; the touch: right of its bracket, else left), on the first side that stays inside the pane and meets
 * neither another square nor ANOTHER mark's line — else it steps left from its first side inside the pane until it is
 * clear (review L2-8's rule); a square and a bracket never leave the pane (a square under the price scale is cut off).
 * @param {{ items: Array<{ n, kind: 'tick'|'bracket', time, value, lit, times?: number[] }>, stub?: { value, label } | null }} scene
 * @param {{ toX: (time) => number|null, toY: (price) => number|null, spacing: number, width: number, height?: number }} at
 * @returns {Array<object>} ops: { op: 'line', x0, x1, y, w } | { op: 'path', points, w } | { op: 'square', x, y, n, lit } | { op: 'text', x, y, text, align }
 */
export function layoutRuleMarks(scene, { toX, toY, spacing, width, height = null }) {
  const W = isNum(width) && width > 0 ? width : null;
  const H = isNum(height) && height > 0 ? height : null;
  const lines = [];
  const segments = []; // { n, x0, x1, y0, y1, w } — every mark's strokes, for the squares to keep off
  const wants = []; // { n, lit, y, sides: [x, …] } — each square's candidate places, in preference
  const pitch = isNum(spacing) && spacing > 0 ? spacing : 6;
  // Review L2B-1: does any of a mark's own strokes fall in the pane? One that does not (panned or zoomed away, or its value
  // off the price scale) draws no square and is never pulled in — the library clips its strokes, as before FX-8.
  const inPane = (x0, x1, y0, y1) => (W === null || (x1 >= 0 && x0 <= W)) && (H === null || (y1 >= 0 && y0 <= H));
  for (const m of scene?.items || []) {
    const y = toY(m.value);
    if (!isNum(y)) continue;
    const w = m.lit ? LINE.lit : LINE.plain;
    if (m.kind === 'bracket') {
      const xs = (m.times || []).map(toX);
      const x = toX(m.time);
      if (xs.length !== 3 || !xs.every(isNum) || !isNum(x)) continue;
      const yb = y + BRACKET_DROP;
      const lx0 = x - (LOW_TICK_BARS / 2) * pitch;
      const lx1 = x + (LOW_TICK_BARS / 2) * pitch;
      const rx0 = Math.min(...xs) - pitch / 2;
      const rx1 = Math.max(...xs) + pitch / 2;
      const seen = inPane(Math.min(rx0, lx0), Math.max(rx1, lx1), y, yb);
      // A bracket in view stays inside the pane: the latest bar's half pitch can reach under the price scale.
      const x0 = W === null || !seen ? rx0 : clamp(rx0, 0.5, W - 0.5);
      const x1 = W === null || !seen ? rx1 : clamp(rx1, 0.5, W - 0.5);
      lines.push({ op: 'line', x0: lx0, x1: lx1, y, w, n: m.n });
      lines.push({ op: 'path', points: [[x0, yb - 4], [x0, yb], [x1, yb], [x1, yb - 4]], w, n: m.n });
      segments.push({ n: m.n, x0: lx0, x1: lx1, y0: y, y1: y, w }, { n: m.n, x0, x1, y0: yb, y1: yb, w },
        { n: m.n, x0, x1: x0, y0: yb - 4, y1: yb, w }, { n: m.n, x0: x1, x1, y0: yb - 4, y1: yb, w });
      if (seen) wants.push({ n: m.n, lit: !!m.lit, y: yb, sides: [x1 + 3, x0 - SQUARE - 3] });
      continue;
    }
    const x = toX(m.time);
    if (!isNum(x)) continue;
    const x0 = x - (TICK_BARS / 2) * pitch;
    const x1 = x + (TICK_BARS / 2) * pitch;
    lines.push({ op: 'line', x0, x1, y, w, n: m.n });
    segments.push({ n: m.n, x0, x1, y0: y, y1: y, w });
    if (inPane(x0, x1, y, y)) wants.push({ n: m.n, lit: !!m.lit, y, sides: [x0 - SQUARE - 3, x1 + 3] });
  }
  const placed = [];
  const STEP = SQUARE + 2;
  const fit = (y) => (H === null ? y : clamp(y, SQUARE / 2, H - SQUARE / 2));
  const inside = (x) => x >= 0 && (W === null || x + SQUARE <= W);
  const onSquare = (x, cy) => placed.some((p) => Math.abs(p.x - x) < SQUARE + GAP && Math.abs(p.y - cy) < SQUARE + GAP);
  const squares = wants.map((s) => {
    const onLine = (x, cy) => segments.some((g) => g.n !== s.n && segmentMeetsSquare(g, x, cy));
    // Always BESIDE its own mark (the compact chart crowds all seven into a few dollars): its first end at its own height,
    // the other end, each end a square above and below, then one or two squares further out from the first end.
    const [a, b] = s.sides;
    const out = a <= b ? -STEP : STEP;
    const at = (list) => list.map(([x, v]) => [x, fit(s.y + v * STEP)]);
    const near = at([[a, 0], [b, 0], [a, -1], [a, 1], [b, -1], [b, 1], [a + out, 0], [a + 2 * out, 0]]);
    // Only when every nearby place holds a square: further out along its first end, at its height or a square off it.
    const far = at(Array.from({ length: 40 }, (_, k) => [-1, 0, 1].map((v) => [a + (k + 3) * out, v])).flat());
    const clear = ([px, py]) => inside(px) && !onSquare(px, py) && !onLine(px, py);
    const noSquare = ([px, py]) => inside(px) && !onSquare(px, py);
    // Nearby and clear of every square and every other mark's line; else nearby and clear of every square (a line then
    // passes UNDER it — the squares are drawn last, so no line is ever drawn across a number); else further out. With no
    // room left anywhere, no square — never one on another square (review L2B-1).
    const spot = near.find(clear) ?? near.find(noSquare) ?? far.find(clear) ?? far.find(noSquare) ?? null;
    if (!spot) return null;
    const [x, cy] = spot;
    placed.push({ x, y: cy });
    return { op: 'square', x, y: cy, n: s.n, lit: s.lit };
  }).filter(Boolean);
  const ops = [...lines, ...squares];
  if (scene?.stub && isNum(scene.stub.value)) {
    const y = toY(scene.stub.value);
    if (isNum(y) && isNum(width)) {
      ops.push({ op: 'line', x0: width - STUB_LEN, x1: width, y, w: LINE.plain, n: 'stub' });
      ops.push({ op: 'text', x: width - STUB_LEN - 6, y, text: scene.stub.label, align: 'right' });
    }
  }
  return ops;
}

/**
 * The lit marks' values on the price scale (MK-4): [{ n, y, labelY, text }], highest first. Pure.
 *
 * FX-8 fault 2: labels closer than AXIS_LABEL_H overlap, and the library's own stacking moves a label's tick with it (it
 * then points at no price). So each run of close labels is stacked here, a full label apart and centred on its prices'
 * mean, kept inside the pane's height; `y` stays the value's own coordinate, and a moved label gets a leader from it
 * (leaderOps), so each label still points at its own price.
 */
export function axisLabels(scene, { toY, format, height = null }) {
  const H = isNum(height) && height > 0 ? height : null;
  const out = [];
  for (const m of scene?.items || []) {
    if (!m.lit) continue;
    const y = toY(m.value);
    if (isNum(y)) out.push({ n: m.n, y, labelY: y, text: format(m.value) });
  }
  out.sort((a, b) => a.y - b.y);
  let groups = out.map((l) => [l]);
  const lay = (g) => {
    const mean = g.reduce((s, l) => s + l.y, 0) / g.length;
    let top = mean - ((g.length - 1) * AXIS_LABEL_H) / 2;
    if (H !== null) top = clamp(top, AXIS_LABEL_H / 2, Math.max(AXIS_LABEL_H / 2, H - AXIS_LABEL_H / 2 - (g.length - 1) * AXIS_LABEL_H));
    g.forEach((l, i) => { l.labelY = g.length === 1 && H === null ? l.y : top + i * AXIS_LABEL_H; });
  };
  for (let merged = true; merged;) {
    merged = false;
    groups.forEach(lay);
    for (let i = 0; i + 1 < groups.length; i++) {
      if (groups[i].at(-1).labelY + AXIS_LABEL_H > groups[i + 1][0].labelY) {
        groups = [...groups.slice(0, i), [...groups[i], ...groups[i + 1]], ...groups.slice(i + 2)];
        merged = true;
        break;
      }
    }
  }
  return out;
}

/** A leader for each moved label (FX-8 fault 2): from its own price at the pane's right edge to its label. Pure. */
export function leaderOps(labels, width) {
  if (!isNum(width)) return [];
  return (labels || []).filter((l) => Math.abs(l.labelY - l.y) > 0.5)
    .map((l) => ({ op: 'path', points: [[width - LEADER, l.y], [width - LEADER / 2, l.y], [width, l.labelY]], w: 1, n: l.n }));
}

/** The library's interface. One instance per candle series; setScene + requestUpdate, never a rebuild. */
export class RuleMarksPrimitive {
  constructor({ ink, paper, font, format }) {
    this.colors = { ink, paper };
    this.font = font;
    this.format = format;
    this.scene = { items: [], stub: null };
    this.attachedTo = null;
    const self = this;
    this._paneView = {
      zOrder: () => 'top',
      renderer: () => ({ draw: (target) => self._draw(target) }),
    };
  }

  attached(param) { this.attachedTo = param; }

  detached() { this.attachedTo = null; }

  setScene(scene) {
    this.scene = scene || { items: [], stub: null };
    if (this.attachedTo && typeof this.attachedTo.requestUpdate === 'function') this.attachedTo.requestUpdate();
  }

  updateAllViews() {}

  /**
   * The price scale takes in the shown marks whose bars are in view, and the Battle stub always (review L2-5: a value
   * outside the bars' own range was drawn off the pane — the stub vanished). The Battle chart's scale already takes in
   * its entry and rung lines the same way (StockChart BC2-5).
   */
  autoscaleInfo(start, end) {
    const a = this.attachedTo;
    const ts = a?.chart?.timeScale?.();
    const values = [];
    for (const m of this.scene.items || []) {
      const i = ts && typeof ts.timeToIndex === 'function' ? ts.timeToIndex(m.time, false) : null;
      if (isNum(m.value) && isNum(i) && i >= start && i <= end) values.push(m.value);
    }
    if (this.scene.stub && isNum(this.scene.stub.value)) values.push(this.scene.stub.value);
    return values.length ? { priceRange: { minValue: Math.min(...values), maxValue: Math.max(...values) } } : null;
  }

  paneViews() { return [this._paneView]; }

  /** The pane's height from the library (FX-8: a label is kept inside it), or null. */
  _paneHeight() {
    try {
      const h = this.attachedTo?.chart?.paneSize?.()?.height;
      return isNum(h) ? h : null;
    } catch {
      return null;
    }
  }

  /**
   * The lit marks' labels, already stacked (FX-8 fault 2): each at a FIXED coordinate, so the library's own overlap
   * fixing never moves it (and its tick) again; a moved label shows no library tick — its leader, drawn in the pane,
   * runs from its own price to it.
   */
  priceAxisViews() {
    const a = this.attachedTo;
    if (!a) return [];
    const toY = (p) => a.series.priceToCoordinate(p);
    return axisLabels(this.scene, { toY, format: this.format, height: this._paneHeight() }).map((l) => ({
      coordinate: () => l.labelY, fixedCoordinate: () => l.labelY, text: () => l.text, textColor: () => this.colors.paper, backColor: () => this.colors.ink,
      visible: () => true, tickVisible: () => Math.abs(l.labelY - l.y) <= 0.5,
    }));
  }

  /** The current spacing between two bars, from the library itself (it changes with every zoom). */
  _spacing() {
    const ts = this.attachedTo?.chart?.timeScale?.();
    if (!ts || typeof ts.logicalToCoordinate !== 'function') return null;
    const a = ts.logicalToCoordinate(0);
    const b = ts.logicalToCoordinate(1);
    return isNum(a) && isNum(b) ? Math.abs(b - a) : null;
  }

  _draw(target) {
    const a = this.attachedTo;
    if (!a) return;
    const ts = a.chart.timeScale();
    const at = { toX: (t) => ts.timeToCoordinate(t), toY: (p) => a.series.priceToCoordinate(p), spacing: this._spacing() };
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      // The marks, then each moved axis label's leader (FX-8 fault 2), placed with the same pane height as the labels.
      const labels = axisLabels(this.scene, { toY: at.toY, format: this.format, height: mediaSize.height });
      const ops = [...layoutRuleMarks(this.scene, { ...at, width: mediaSize.width, height: mediaSize.height }), ...leaderOps(labels, mediaSize.width)];
      const { ink, paper } = this.colors;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]); // never dashed (MK-4)
      for (const o of ops) {
        if (o.op === 'line') {
          ctx.strokeStyle = ink; ctx.lineWidth = o.w;
          ctx.beginPath(); ctx.moveTo(o.x0, o.y); ctx.lineTo(o.x1, o.y); ctx.stroke();
        } else if (o.op === 'path') {
          ctx.strokeStyle = ink; ctx.lineWidth = o.w;
          ctx.beginPath(); o.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        } else if (o.op === 'square') {
          const top = o.y - SQUARE / 2;
          ctx.lineWidth = 1;
          ctx.fillStyle = o.lit ? ink : paper;
          ctx.strokeStyle = ink;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(o.x, top, SQUARE, SQUARE, 3); else ctx.rect(o.x, top, SQUARE, SQUARE);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = o.lit ? paper : ink;
          ctx.font = `700 9px ${this.font}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(o.n), o.x + SQUARE / 2, o.y + 0.5);
        } else if (o.op === 'text') {
          ctx.font = `9.5px ${this.font}`;
          ctx.textAlign = o.align === 'right' ? 'right' : 'left'; ctx.textBaseline = 'middle';
          const w = ctx.measureText(o.text).width;
          ctx.fillStyle = paper;
          ctx.globalAlpha = 0.84;
          ctx.fillRect(o.align === 'right' ? o.x - w - 3 : o.x - 3, o.y - 7, w + 6, 14);
          ctx.globalAlpha = 1;
          ctx.fillStyle = ink;
          ctx.fillText(o.text, o.x, o.y + 0.5);
        }
      }
      ctx.restore();
    });
  }
}
