// src/components/AgentPresence/faceEngineCore.js
//
// Agent Presence — the non-view engine core (pure JS, no JSX). Holds the expression
// parameters, easings, stakes-tier table, the reactive reduced-motion default, the
// FaceCtl controller, and the shared rAF loop. The React view (ReactiveFace) lives in
// faceEngine.jsx and imports from here — split out so the view file exports ONLY a
// component (react-refresh/only-export-components) while these shared values/classes
// live in a plain module.
//
// See faceEngine.jsx for the two-layer (mood baseline + transient offsets) design and
// the port notes.

import { DISPO, MOVES, REACTIONS, EVENT_TIER, REACT_MINOR } from './faceMoves';

// Module-load reduced-motion default (SSR-guarded). Instances seed `this.reduced`
// from this and may be updated reactively via ctl.setReduced().
export const REDUCED_MOTION = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── expression parameters (0-centred at rest) ──────────────────────────────
//  eyeOpen 1=open 0=shut · gx/gy gaze (-1..1) · glow 0..1 eye/bulb brightness ·
//  ant antenna angle deg · mouth -0.4..1 (curve) · lean -1..1 · shutter 0..1 visor ·
//  tilt deg (head cant — recoil/shake/doubletake) · escale eye pop · asym one-eye squint
export const REST = { eyeOpen: 1, gx: 0, gy: 0.04, glow: 0.5, ant: 0, mouth: 0.34, lean: 0, shutter: 0, tilt: 0, escale: 1, asym: 0 };
const CLAMP = { eyeOpen: [0, 1.2], glow: [0, 1.2], shutter: [0, 1], escale: [0.72, 1.5], mouth: [-0.4, 1.1], asym: [0, 1.3] };
const clampK = (k, v) => { const c = CLAMP[k]; return c ? Math.max(c[0], Math.min(c[1], v)) : v; };

export const EASE = {
  lin: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t,
  io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: (t) => 1 + 2.6 * Math.pow(t - 1, 3) + 1.6 * Math.pow(t - 1, 2),   // overshoot & settle
  snap: (t) => 1 - Math.pow(1 - t, 5),                                     // hard, no ease-in
};

// ── stakes ladder — every event maps to a tier; the tier sets the ceiling.
//    k is the intensity multiplier on energy moves. ~10:1 between minor and peak.
export const TIER = {
  0: { k: 0.0,  name: 'Ambient'  },   // idle / breathing / mood only
  1: { k: 0.18, name: 'Minor'    },   // a flicker, easy to miss
  2: { k: 0.5,  name: 'Notable'  },   // clearly readable — roughly the old default
  3: { k: 1.0,  name: 'Major'    },   // unmistakable
  4: { k: 1.9,  name: 'Peak'     },   // most dramatic thing on screen; + environment
};

// global RAF driving every mounted face. Skips work while the tab is hidden.
export const FACE_REG = new Set();
let RAF = 0;
function faceLoop(now) {
  if (FACE_REG.size === 0) { RAF = 0; return; } // stop when idle — ensureLoop() restarts on the next mount
  if (typeof document === 'undefined' || !document.hidden) {
    FACE_REG.forEach((c) => { try { c.tick(now); } catch { /* keep the loop alive */ } });
  }
  RAF = requestAnimationFrame(faceLoop);
}
export function ensureLoop() { if (!RAF) RAF = requestAnimationFrame(faceLoop); }

// ── controller ──────────────────────────────────────────────────────────────
export class FaceCtl {
  constructor(disp) {
    this.disp = disp || DISPO.neutral;
    this.reduced = REDUCED_MOTION;                             // reactive per instance
    this.base = { ...REST };                                   // mood layer
    this.off = Object.fromEntries(Object.keys(REST).map((k) => [k, 0]));   // transient layer
    this.d = { ...REST };                                      // displayed
    this.baseTw = []; this.offTw = [];
    this.refs = null; this.idleAt = 0; this.standing = 0; this.curK = 1;
    this.shakeUntil = 0; this.shakeAmp = 0; this.shakeDur = 1;
    this.onEvent = null; this.onImpact = null;
    this.timers = new Set();   // pending react()-latency timeouts, cleared on dispose()
  }

  setReduced(v) { this.reduced = !!v; }

  // ── transient offset tween. Energy moves scale by amp·tier(k); lit moves stay literal
  //    (blink must fully close regardless of disposition or stakes). Under reduced-motion
  //    the tween SNAPS (dur → instant, mirroring pMood): the reaction pose still shows and
  //    holds, but the animated sweep — the vestibular trigger — is gone. (The old
  //    `Math.max(reduced?1:34, …)` floor never bound: every move dur exceeds 34, so it
  //    neither shortened nor suppressed transients — the reduced-motion gap the port fixes.)
  pOff(key, delta, dur, ease = 'out', delay = 0, lit = false) {
    const m = this.disp;
    const scale = lit ? 1 : m.amp * this.curK;
    const d = this.reduced ? 1 : Math.max(34, dur * (lit ? 1 : m.dur));
    this.offTw.push({ key, from: null, to: delta * scale, start: performance.now() + delay * (lit ? 1 : m.dur), dur: d, ease });
  }
  // return one offset to 0 after `hold` ms, at recovery speed (instant under reduced)
  pRelax(key, hold, dur = 520) { this.offTw.push({ key, from: null, to: 0, start: performance.now() + hold * this.disp.dur, dur: this.reduced ? 1 : Math.max(34, dur * this.disp.recover), ease: 'io' }); }
  // slow MOOD tween on the baseline (absolute target, not amp-scaled — mood has its own swing)
  pMood(key, target, dur, ease = 'io') { this.baseTw.push({ key, from: null, to: target, start: performance.now(), dur: this.reduced ? 1 : dur, ease }); }

  play(name, opt = {}) { const mv = MOVES[name]; if (mv) mv(this, opt); }

  // ── the mood baseline: REST as a function of standing (-1 well behind .. +1 well ahead)
  setStanding(s, opt = {}) {
    s = Math.max(-1, Math.min(1, s));
    this.standing = s;
    const m = this.disp;
    const se = Math.max(-1, Math.min(1, s * (m.moodSwing || 1)));   // disposition widens/compresses the swing
    const pos = Math.max(0, se), neg = Math.max(0, -se);
    const guard = m.guardBias || 0;                                 // CP carries a guarded baseline even when ahead
    const t = { ...REST };
    t.glow    = REST.glow + se * 0.32 - guard * 0.06;
    t.ant     = se * 11 - guard * 4;
    t.mouth   = REST.mouth + se * 0.5 - guard * 0.12;              // behind → downturn, ahead → real smile
    t.eyeOpen = 1 - neg * 0.28 - guard * 0.14;                     // narrows when behind / guarded
    t.gy      = REST.gy + neg * 0.34 - pos * 0.06;                 // behind looks down; ahead level
    t.lean    = pos * 0.16 - neg * 0.14;                           // ahead leans in, behind pulls back
    t.shutter = neg * 0.22 * (m.shutterProne || 0) + guard * 0.16; // partial visor when behind & prone
    t.escale  = 1 + pos * 0.04 - neg * 0.03;
    Object.keys(t).forEach((k) => { t[k] = clampK(k, t[k]); });
    if (opt.instant || this.reduced) { Object.keys(t).forEach((k) => { this.base[k] = t[k]; }); }   // write baseline directly — correct pose without waiting on rAF
    else { const dur = 7000 * (m.moodDur || 1); Object.keys(t).forEach((k) => this.pMood(k, t[k], dur, 'io')); }
  }

  react(ev, opt = {}) {
    const tier = opt.tier != null ? opt.tier : (EVENT_TIER[ev] != null ? EVENT_TIER[ev] : 2);
    const go = () => {
      if (this.onEvent) this.onEvent(ev, tier);
      if (opt.standing != null) this.setStanding(opt.standing);      // events can re-target mood
      this.curK = (opt.k != null ? opt.k : TIER[tier].k) * (opt.boost || 1);
      // high-threshold agent waves off truly minor events with a micro-ack
      if (this.curK < this.disp.thresh * 0.6 && !opt.force && REACT_MINOR[ev]) { this.curK = 1; this.play('microack'); }
      else { const r = REACTIONS[ev]; if (r) r(this, { ...opt, tier }); }
      this.curK = 1;
      if (tier >= 3 && this.onImpact && !opt.noEnv) this.onImpact(tier, ev, opt.tone);
    };
    if (this.disp.lat && !this.reduced && !opt.now) {
      const id = setTimeout(() => { this.timers.delete(id); go(); }, this.disp.lat);
      this.timers.add(id);
    } else go();
  }

  // sustained low-amplitude vibration for held tension (decays over dur)
  shake(amp = 1.4, dur = 900) { if (this.reduced) return; this.shakeAmp = amp * this.disp.amp; this.shakeDur = dur; this.shakeUntil = performance.now() + dur; }
  // clear transients, keep mood. Also DROPS not-yet-started (delayed) tweens so a reset
  // actually quiets the transient layer — else queued move keyframes resume after relax.
  rest() {
    const now = performance.now();
    this.offTw = this.offTw.filter((t) => t.start <= now);
    Object.keys(this.off).forEach((k) => this.pRelax(k, 0, 560));
  }
  neutralize() { this.rest(); this.shakeUntil = 0; this.setStanding(0, { instant: true }); }
  // Cancel pending latency timeouts so a queued reaction can't fire on a detached ctl
  // after unmount. Called from ReactiveFace's cleanup.
  dispose() { this.timers.forEach((id) => clearTimeout(id)); this.timers.clear(); }
  attach(refs) { this.refs = refs; }

  tick(now) {
    const adv = (arr, store) => {
      for (const t of arr) {
        if (now < t.start) continue;
        if (t.from == null) t.from = store[t.key];
        const p = t.dur <= 0 ? 1 : Math.min(1, (now - t.start) / t.dur);
        store[t.key] = t.from + (t.to - t.from) * EASE[t.ease](p);
        if (p >= 1) t.done = true;
      }
      return arr.filter((t) => !t.done);
    };
    this.baseTw = adv(this.baseTw, this.base);
    this.offTw = adv(this.offTw, this.off);
    // compose displayed = base + off
    for (const k in this.d) this.d[k] = clampK(k, this.base[k] + this.off[k]);
    // idle micro-behaviour — only when transients are quiet
    if (!this.reduced && this.offTw.length === 0) {
      const beh = this.standing < -0.35 ? 1.4 : this.standing > 0.35 ? 1.12 : 1;   // behind fidgets more
      if (!this.idleAt) this.idleAt = now + 1700 + Math.random() * 2400;
      else if (now > this.idleAt) { this.idle(); this.idleAt = now + (2600 + Math.random() * 3800) / (this.disp.idle * beh); }
    }
    this.apply(now);
  }
  idle() {
    const r = Math.random();
    if (r < 0.5) this.play('blink', { slow: this.disp.calm || this.standing < -0.35 });
    else if (r < 0.8) { const g = (Math.random() * 2 - 1) * (this.standing < -0.35 ? 0.5 : 0.34); this.pOff('gx', g, 900, 'io', 0, true); this.pOff('gx', 0, 1400, 'io', 1400 + Math.random() * 1200, true); }
    else this.play('anttwitch', { tiny: true });
  }
  apply(now) {
    const R = this.refs; if (!R) return;
    const d = this.d, ph = now * 0.00126, breath = this.reduced ? 0 : Math.sin(ph);
    const bob = breath * 1.5;
    // sustained shake (decays)
    let shk = 0;
    if (this.shakeUntil && now < this.shakeUntil) { const rem = (this.shakeUntil - now) / this.shakeDur; shk = Math.sin(now * 0.055) * this.shakeAmp * rem; }
    // whole face: lean + breathe + tilt + shake (pivot at chin)
    R.face.setAttribute('transform', `translate(${(d.lean * 7 + shk * 0.5).toFixed(2)} ${bob.toFixed(2)}) rotate(${(d.tilt + d.lean * 2.6 + shk).toFixed(2)} 100 150)`);
    const antA = d.ant + (this.reduced ? 0 : Math.sin(ph * 0.8 + 0.5) * 1.4 * this.disp.antennaLife);
    R.ant.setAttribute('transform', `rotate(${antA.toFixed(2)} 100 54)`);
    const g = clampK('glow', d.glow + (this.reduced ? 0 : breath * 0.04));
    R.bulbGlow.setAttribute('opacity', (0.22 + g * 0.78).toFixed(3));
    R.bulb.setAttribute('r', (4.3 + g * 1.1).toFixed(2));
    const eScale = d.escale;
    const place = (grp, cx, cy) => grp.setAttribute('transform', `translate(${(cx + d.gx * 8.5).toFixed(2)} ${(cy + d.gy * 6).toFixed(2)}) scale(${eScale.toFixed(3)})`);
    place(R.eyeL, 74, 95); place(R.eyeR, 126, 95);
    const eyeOp = (0.2 + g * 0.8).toFixed(3);
    R.glowL.setAttribute('opacity', eyeOp); R.glowR.setAttribute('opacity', eyeOp);
    const effTopL = Math.max(0, Math.min(1, (1 - d.eyeOpen) * 0.6 + d.shutter * 0.72));
    const effBotL = Math.max(0, Math.min(1, (1 - d.eyeOpen) * 0.42));
    const effTopR = Math.max(0, Math.min(1, effTopL + d.asym * 0.4));
    const lid = (topEl, botEl, effTop, effBot, y0, h) => { topEl.setAttribute('y', (y0 - h + effTop * h).toFixed(2)); botEl.setAttribute('y', (y0 + h - effBot * h).toFixed(2)); };
    lid(R.lidTL, R.lidBL, effTopL, effBotL, 78, 34);
    lid(R.lidTR, R.lidBR, effTopR, effBotL, 78, 34);
    R.mouth.setAttribute('d', `M80 128 Q100 ${(128 + d.mouth * 12).toFixed(2)} 120 128`);
  }
}
