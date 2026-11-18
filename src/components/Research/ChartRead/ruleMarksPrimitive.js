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

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * The drawing for one scene, in media (CSS) pixels. Pure.
 * @param {{ items: Array<{ n, kind: 'tick'|'bracket', time, value, lit, times?: number[] }>, stub?: { value, label } | null }} scene
 * @param {{ toX: (time) => number|null, toY: (price) => number|null, spacing: number, width: number }} at
 * @returns {Array<object>} ops: { op: 'line', x0, x1, y, w } | { op: 'path', points, w } | { op: 'square', x, y, n, lit } | { op: 'text', x, y, text, align }
 */
export function layoutRuleMarks(scene, { toX, toY, spacing, width }) {
  const ops = [];
  const pitch = isNum(spacing) && spacing > 0 ? spacing : 6;
  for (const m of scene?.items || []) {
    const y = toY(m.value);
    if (!isNum(y)) continue;
    const w = m.lit ? LINE.lit : LINE.plain;
    if (m.kind === 'bracket') {
      const xs = (m.times || []).map(toX);
      const x = toX(m.time);
      if (xs.length !== 3 || !xs.every(isNum) || !isNum(x)) continue;
      const x0 = Math.min(...xs) - pitch / 2;
      const x1 = Math.max(...xs) + pitch / 2;
      const yb = y + BRACKET_DROP;
      ops.push({ op: 'line', x0: x - (LOW_TICK_BARS / 2) * pitch, x1: x + (LOW_TICK_BARS / 2) * pitch, y, w, n: m.n });
      ops.push({ op: 'path', points: [[x0, yb - 4], [x0, yb], [x1, yb], [x1, yb - 4]], w, n: m.n });
      ops.push({ op: 'square', x: x1 + 3, y: yb, n: m.n, lit: !!m.lit });
      continue;
    }
    const x = toX(m.time);
    if (!isNum(x)) continue;
    const x0 = x - (TICK_BARS / 2) * pitch;
    const x1 = x + (TICK_BARS / 2) * pitch;
    ops.push({ op: 'line', x0, x1, y, w, n: m.n });
    ops.push({ op: 'square', x: x0 - SQUARE - 3, y, n: m.n, lit: !!m.lit });
  }
  if (scene?.stub && isNum(scene.stub.value)) {
    const y = toY(scene.stub.value);
    if (isNum(y) && isNum(width)) {
      ops.push({ op: 'line', x0: width - STUB_LEN, x1: width, y, w: LINE.plain, n: 'stub' });
      ops.push({ op: 'text', x: width - STUB_LEN - 6, y, text: scene.stub.label, align: 'right' });
    }
  }
  return ops;
}

/** The lit marks' values on the price scale (MK-4): [{ y, text }]. Pure. */
export function axisLabels(scene, { toY, format }) {
  const out = [];
  for (const m of scene?.items || []) {
    if (!m.lit) continue;
    const y = toY(m.value);
    if (isNum(y)) out.push({ y, text: format(m.value) });
  }
  return out;
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

  paneViews() { return [this._paneView]; }

  priceAxisViews() {
    const a = this.attachedTo;
    if (!a) return [];
    const toY = (p) => a.series.priceToCoordinate(p);
    return axisLabels(this.scene, { toY, format: this.format }).map((l) => ({
      coordinate: () => l.y, text: () => l.text, textColor: () => this.colors.paper, backColor: () => this.colors.ink, visible: () => true, tickVisible: () => true,
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
      const ops = layoutRuleMarks(this.scene, { ...at, width: mediaSize.width });
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
