// src/components/AgentPresence/faceMoves.js
//
// Agent Presence — the MOVE VOCABULARY, DISPOSITIONS, and EVENT→REACTION map.
// Ported from the Design reference (face-moves.jsx). Moves push OFFSET deltas from
// the mood baseline and relax to 0, so every reaction rides on top of the persistent
// mood. Energy moves auto-scale by disposition.amp · tier(k); structural moves
// (blink, gaze) stay literal.
//
// PORT NOTE — the standing model is REAL now, not faked. The reference threaded
// `nudge(c, d)` / `c.setStanding(...)` through the reaction map (face-moves.jsx
// lines 56, 62–80) as a placeholder standing model. Per the Phase 1 wiring, standing
// is owned EXTERNALLY by the read-only binding (it derives from the exact score the
// mounted surface renders — league youRank/youLiveScore, 1v1 displayPlayerScore,
// etc.) and is pushed in via ctl.setStanding(). So every `nudge`/`setStanding` call
// is REMOVED from the reactions here — reactions are pure transient-move players.
// The reference's `even`/`ahead`/`behind` events (which only set standing) are
// dropped: they were regions of the continuous standing value, not discrete events;
// the discrete "you just pulled ahead/behind" transition is `standingflip` (the real
// `lead` beat). `won`/`lost` reactions are KEPT as ready vocabulary but are NOT
// emitted by the V1 binding — battle `status` carries only active/completed with
// win/loss as derived text (no structured signal). See the binding + the logged
// follow-up. `disagree` is likewise future (no clean real source at launch).

// ── dispositions — the SAME face, different reflexes AND different mood ──────
//  amp: energy of moves · dur: time-stretch · recover: return speed · idle: micro freq ·
//  thresh: min intensity to react · lat: latency ms · antennaLife: idle antenna ·
//  moodSwing: how far standing moves the baseline · guardBias: guarded even when ahead ·
//  moodDur: mood timescale stretch · shutterProne: guards under pressure ·
//  leanBias: persistent resting lean — a posture tell visible even at rest/standing 0 (default 0)
//
// SIX DISTINCT dispositions, one per archetype (archetypeToDisposition in presenceBinding.js
// maps each of the six 1:1 — no two share one). neutral remains the fallback for unknown
// archetypes. The three below the divider were added July 2026 to complete the set so the
// archetype-picker hero cards (and the live heads) differentiate at rest; before that,
// Trend Follower fell to speculator and Contrarian / Diversifier / Fundamental Investor
// fell to shared reflexes (Fundamental Investor had no real baseline — it landed on flat
// neutral). Values founder-approved; freely tunable (reflex only, zero scoring effect).
export const DISPO = {
  neutral:             { id: 'neutral',            name: 'Baseline',          amp: 1.0,  dur: 1.0, recover: 1.0, idle: 1.0,  thresh: 0.16, lat: 110, antennaLife: 1.0,  calm: false, shutterProne: 0.3,  moodSwing: 1.0, guardBias: 0.0,  moodDur: 1.0 },
  speculator:          { id: 'speculator',         name: 'Speculator',        amp: 1.5,  dur: 0.6, recover: 0.7, idle: 2.1,  thresh: 0.06, lat: 25,  antennaLife: 2.4,  calm: false, shutterProne: 0.05, moodSwing: 1.4, guardBias: 0.0,  moodDur: 0.7, jitter: true },
  'capital-preserver': { id: 'capital-preserver',  name: 'Capital Preserver', amp: 0.55, dur: 1.6, recover: 2.0, idle: 0.45, thresh: 0.34, lat: 300, antennaLife: 0.35, calm: true,  shutterProne: 1.0,  moodSwing: 0.7, guardBias: 0.45, moodDur: 1.5 },
  // ── the four completing the six-distinct set (July 2026, founder-approved) ──
  // Trend Follower — decisive and clean: quicker than neutral, low bar to act, snappy
  // recovery, NO jitter (that's the tell vs Speculator — crisp, not twitchy).
  'trend-follower':       { id: 'trend-follower',       name: 'Trend Follower',       amp: 1.15, dur: 0.85, recover: 0.8, idle: 1.3, thresh: 0.11, lat: 70,  antennaLife: 1.4,  calm: false, shutterProne: 0.1,  moodSwing: 1.15, guardBias: 0.0, moodDur: 0.9 },
  // Contrarian — rests against the room: the tell is POSTURE (leanBias), not intensity;
  // calm and unbothered when others react (higher thresh, normal-cadence blink).
  'contrarian':           { id: 'contrarian',           name: 'Contrarian',           amp: 0.9,  dur: 1.1,  recover: 1.2, idle: 0.8, thresh: 0.22, lat: 150, antennaLife: 0.8,  calm: false, shutterProne: 0.2,  moodSwing: 0.9,  guardBias: 0.0, moodDur: 1.1, leanBias: -0.28 },
  // Diversifier — distributed attention: highest idle (frequent glances) at the LOWEST
  // amplitude (small moves) — watches everything a little. idle bumped to 1.8 to widen
  // the gap against Speculator (the closest neighbor).
  'diversifier':          { id: 'diversifier',          name: 'Diversifier',          amp: 0.75, dur: 1.0,  recover: 1.1, idle: 1.8, thresh: 0.18, lat: 100, antennaLife: 1.1,  calm: false, shutterProne: 0.2,  moodSwing: 0.85, guardBias: 0.0, moodDur: 1.0 },
  // Fundamental Investor — deliberate: slowest NON-guarded reflex, high bar to act, slow
  // blink, steady. Near Capital Preserver's tempo but guardBias 0 — patient, not defensive
  // (that guardBias gap is the tell vs Capital Preserver at rest). The real "slow/level"
  // baseline that replaces the old fall-through to flat neutral.
  'fundamental-investor': { id: 'fundamental-investor', name: 'Fundamental Investor', amp: 0.7,  dur: 1.5,  recover: 1.7, idle: 0.5, thresh: 0.3,  lat: 260, antennaLife: 0.45, calm: true,  shutterProne: 0.15, moodSwing: 0.8,  guardBias: 0.0, moodDur: 1.4 },
};

// ── the vocabulary — deltas from baseline. lit=true ⇒ literal (no amp/tier scale).
export const MOVES = {
  // structural / ambient
  blink:     (c, o = {}) => { const d = o.slow ? 240 : 95; c.pOff('eyeOpen', -1.15, d, 'in', 0, true); c.pOff('eyeOpen', 0, d * 1.5, 'out', d + (o.slow ? 130 : 45), true); },
  slowblink: (c) => MOVES.blink(c, { slow: true }),
  narrow:    (c, o = {}) => { c.pOff('eyeOpen', -0.55 * (o.mag || 1), 240, 'out'); c.pRelax('eyeOpen', o.hold == null ? 1000 : o.hold, 520); },
  widen:     (c, o = {}) => { const h = o.hold == null ? 520 : o.hold; c.pOff('eyeOpen', 0.18, 120, 'back'); c.pOff('escale', 0.34 * (o.mag || 1), 150, 'back'); c.pOff('glow', 0.3 * (o.mag || 1), 170, 'out'); c.pRelax('escale', h, 440); c.pRelax('eyeOpen', h, 440); c.pRelax('glow', h, 620); },
  glance:    (c, o = {}) => { const dir = o.dir == null ? 0.7 : o.dir, h = o.hold == null ? 700 : o.hold; c.pOff('gx', dir, 190, 'out', 0, true); if (o.dy != null) c.pOff('gy', o.dy, 190, 'out', 0, true); c.pOff('gx', 0, 620, 'io', h, true); if (o.dy != null) c.pOff('gy', 0, 620, 'io', h, true); },
  track:     (c) => { [-0.6, 0.55, -0.4, 0.32, 0].forEach((x, i) => c.pOff('gx', x, 520, 'io', i * 560, true)); c.pOff('eyeOpen', -0.18, 300, 'io', 0, true); c.pRelax('eyeOpen', 2600, 640); },
  anttwitch: (c, o = {}) => { const a = (o.tiny ? 5 : 12) * (o.mag || 1); c.pOff('ant', a, 90, 'out'); c.pOff('ant', -a * 0.5, 120, 'io', 100); c.pOff('ant', 0, 220, 'io', 240); },
  antperk:   (c, o = {}) => { const h = o.hold == null ? 600 : o.hold; c.pOff('ant', 7 * (o.mag || 1), 160, 'back'); c.pOff('glow', 0.16 * (o.mag || 1), 170, 'out'); c.pRelax('ant', h, 520); c.pRelax('glow', h, 560); },
  antdroop:  (c, o = {}) => { c.pOff('ant', -11 * (o.mag || 1), 440, 'io'); c.pRelax('ant', o.hold == null ? 1200 : o.hold, 920); },
  shutter:   (c, o = {}) => { c.pOff('shutter', 0.62 * (o.mag || 1), 360, 'out'); c.pRelax('shutter', o.hold == null ? 1400 : o.hold, 780); },
  brighten:  (c, o = {}) => { const m = o.mag || 1, h = o.hold == null ? 900 : o.hold; c.pOff('glow', 0.5 * m, 200, 'out'); c.pOff('mouth', 0.46 * m, 260, 'out'); c.pOff('escale', 0.06 * m, 220, 'back'); c.pRelax('glow', h, 720); c.pRelax('mouth', h, 780); c.pRelax('escale', h, 520); },
  dim:       (c, o = {}) => { const m = o.mag || 1, h = o.hold == null ? 1400 : o.hold; c.pOff('glow', -0.42 * m, 420, 'io'); c.pOff('mouth', -0.32 * m, 420, 'io'); c.pRelax('glow', h, 1000); c.pRelax('mouth', h, 900); },
  lean:      (c, o = {}) => { const dir = o.dir == null ? 0.7 : o.dir; c.pOff('lean', dir, 260, 'out'); c.pRelax('lean', o.hold == null ? 800 : o.hold, 660); },
  smile:     (c, o = {}) => { c.pOff('mouth', (o.v == null ? 0.5 : o.v), 300, 'out'); c.pRelax('mouth', o.hold == null ? 900 : o.hold, 720); },
  microack:  (c) => { c.pOff('ant', 4, 120, 'out', 0, true); c.pOff('ant', 0, 320, 'io', 150, true); c.pOff('gx', 0.12, 320, 'io', 0, true); c.pOff('gx', 0, 520, 'io', 440, true); },

  // ── impact verbs — percussive. Snap in (no ease-in), settle with overshoot. ──
  recoil:    (c, o = {}) => { const m = o.mag || 1; c.pOff('tilt', -6 * m, 70, 'snap'); c.pOff('lean', -0.3 * m, 70, 'snap'); c.pOff('tilt', 0, 540, 'back', 90); c.pOff('lean', 0, 520, 'back', 100); },
  flinch:    (c, o = {}) => { const m = o.mag || 1; c.pOff('eyeOpen', -0.55, 55, 'snap', 0, true); c.pOff('lean', -0.42 * m, 65, 'snap'); c.pOff('eyeOpen', 0, 300, 'out', 95, true); c.pOff('lean', 0, 460, 'back', 110); c.pOff('ant', 9 * m, 60, 'snap'); c.pOff('ant', 0, 420, 'back', 90); },
  shake:     (c, o = {}) => c.shake(o.amp == null ? 1.6 : o.amp, o.dur == null ? 1200 : o.dur),
  snap:      (c, o = {}) => { const dir = o.dir == null ? 0.85 : o.dir, h = o.hold == null ? 340 : o.hold; c.pOff('gx', dir, 65, 'snap', 0, true); c.pOff('escale', 0.08, 65, 'snap'); c.pOff('gx', 0, 420, 'io', h, true); c.pOff('escale', 0, 360, 'io', h); },
  overshoot: (c, o = {}) => { const m = o.mag || 1; c.pOff('ant', 13 * m, 260, 'back'); c.pOff('glow', 0.2 * m, 200, 'out'); c.pOff('ant', 0, 620, 'io', 320); c.pRelax('glow', 360, 560); },
  hold:      (c, o = {}) => { const h = o.hold == null ? 1600 : o.hold; c.pOff('eyeOpen', -0.4, 300, 'out', 0, true); c.pOff('mouth', -0.14, 300, 'out'); c.pRelax('eyeOpen', h, 700); c.pRelax('mouth', h, 700); },
  doubletake:(c, o = {}) => { const dir = o.dir == null ? 0.8 : o.dir; c.pOff('gx', dir, 80, 'snap', 0, true); c.pOff('gx', -dir * 0.55, 180, 'back', 250, true); c.pOff('escale', 0.13, 160, 'back', 250); c.pOff('eyeOpen', 0.15, 160, 'out', 250); c.pOff('gx', 0, 420, 'io', 640, true); c.pOff('escale', 0, 420, 'io', 640); c.pRelax('eyeOpen', 640, 420); },
};

// ── stakes ladder — event → tier (opt.tier overrides). k comes from TIER in engine.
// Every key here has a REAL binding source (see presenceBinding.js) except the ones
// noted FUTURE below, which are defined for completeness but never emitted in V1.
export const EVENT_TIER = {
  ambient: 0, reading: 1,
  scoreup: 1, scoredown: 1, typing: 1, composing: 1, quota: 1,
  swap: 2, standingflip: 2, volatility: 2, thresholdnear: 2, disagree: 2,
  thresholdgood: 3, thresholdbad: 3, bigadverse: 3,
  won: 4, lost: 4, baggerbomb: 4,
};

// scoreup/scoredown are "minor" — a high-threshold (calm) agent waves them off with
// a micro-ack rather than a full reaction (see FaceCtl.react).
export const REACT_MINOR = { scoreup: 1, scoredown: 1 };

// ── events → reactions (composed from moves; branch on disposition & mood). ──
// NO standing writes here — standing is the binding's job (mood glides with the real
// rendered score). Reactions are pure transients that ride ON TOP of that mood.
export const REACTIONS = {
  ambient:      (c) => { if (Math.random() < 0.5) c.play('blink', { slow: true }); else c.play('microack'); },
  reading:      (c) => { c.play('track'); c.play('smile', { v: 0.24, hold: 2800 }); },
  scoreup:      (c) => { c.play('brighten', { hold: 640 }); c.play('antperk', { hold: 620 }); },
  scoredown:    (c) => { c.play('dim', { hold: 820 }); c.play('antdroop', { hold: 900 }); if (c.disp.calm) c.play('narrow', { hold: 700 }); },
  swap:         (c) => { c.play('doubletake'); c.play('antperk', { hold: 700 }); },
  standingflip: (c) => { c.play('doubletake'); c.play('widen', { hold: 700 }); c.play('anttwitch'); },
  volatility:   (c, o = {}) => {
    const big = (o.tier || 2) >= 3;
    if (c.disp.shutterProne > 0.6) { c.play('shutter', { hold: 1400 }); c.play('dim', { mag: 0.4, hold: 1200 }); c.play('narrow', { hold: 1100 }); if (big) c.play('flinch', { mag: 0.6 }); }
    else { c.play('widen', { hold: 560 }); c.play('anttwitch'); c.play('lean', { dir: 0.5, hold: 520 }); if (c.disp.jitter) c.play('snap', { dir: -0.4, hold: 260 }); if (big) c.play('shake', { amp: 1.4, dur: 800 }); }
  },
  thresholdnear:(c) => { c.play('widen', { hold: 700 }); c.play('glance', { dir: 0.5, dy: -0.3, hold: 800 }); c.play('anttwitch', { tiny: !c.disp.jitter }); },
  thresholdgood:(c) => { c.play('brighten', { hold: 1100 }); c.play('widen', { hold: 700 }); c.play('overshoot'); c.play('lean', { dir: 0.6, hold: 900 }); },
  thresholdbad: (c) => { c.play('recoil', { mag: 0.9 }); c.play('dim', { hold: 1400 }); c.play('shutter', { hold: 1100 }); c.play('narrow', { hold: 1200 }); },
  bigadverse:   (c) => { c.play('recoil'); c.play('flinch'); c.play('dim', { hold: 1500 }); c.play('shake', { amp: 1.5, dur: 900 }); },
  baggerbomb:   (c) => { c.play('brighten', { mag: 1.25, hold: 2000 }); c.play('widen', { mag: 1.2, hold: 1500 }); c.play('shake', { amp: 2.1, dur: 1200 }); c.play('overshoot', { mag: 1.3 }); },
  typing:       (c) => { c.play('glance', { dir: 0, dy: 0.5, hold: 1400 }); c.play('antperk', { hold: 1200 }); },
  composing:    (c) => { c.play('glance', { dir: -0.4, dy: -0.42, hold: 1600 }); c.play('slowblink'); },
  quota:        (c) => { c.play('dim', { hold: 3000 }); c.play('slowblink'); c.play('antdroop', { hold: 3000 }); },

  // ── FUTURE — kept as ready vocabulary; NOT emitted by the V1 binding ──────────
  // No structured source at launch (Phase 0): win/loss is derived free text on the
  // battle_complete feed (battle.status is only active|completed); "disagrees" has
  // no clean signal (authority mode is auto-pilot only). If a structured win/loss
  // or disagree signal lands, the binding can emit these — see the logged follow-up.
  won:          (c) => { c.play('brighten', { mag: 1.15, hold: 1900 }); c.play('widen', { hold: 1400 }); c.play('overshoot', { mag: 1.2 }); c.play('shake', { amp: 1.9, dur: 1100 }); c.play('doubletake', { dir: 0.5 }); },
  lost:         (c) => { c.play('recoil', { mag: 0.8 }); c.play('dim', { mag: 1.1, hold: 2200 }); c.play('slowblink'); c.play('antdroop', { hold: 2100 }); c.play('shutter', { hold: 1600 }); },
  disagree:     (c) => { c.play('narrow', { hold: 1300 }); c.pOff('asym', 1, 240, 'out'); c.pRelax('asym', 1300, 620); c.play('lean', { dir: -0.5, hold: 1000 }); c.play('doubletake', { dir: -0.6 }); },
};
