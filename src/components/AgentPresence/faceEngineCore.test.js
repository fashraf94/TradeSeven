// src/components/AgentPresence/faceEngineCore.test.js
//
// Focused unit checks for the STATIC-head seam (Placement 1, finding 13). A static CPU
// head must paint ONE truly motionless frame — no breath — while a reactive head breathes
// at the same instant. FACE_REG membership (the "never joins the loop" half) is a plain
// branch in faceEngine.jsx (isStatic → return before FACE_REG.add); here we lock the
// engine-core half: `still` suppresses the ambient breath so the single painted frame has
// a zero vertical bob. Pure JS + mock refs — no DOM, no framer, no rAF.

import { describe, it, expect } from 'vitest';
import { FaceCtl } from './faceEngineCore';
import { DISPO } from './faceMoves';

// Minimal ref stand-ins: apply() only calls setAttribute on each node.
function mockRefs() {
  const make = () => { const attrs = {}; return { attrs, setAttribute: (k, v) => { attrs[k] = v; } }; };
  const refs = {};
  for (const k of ['face', 'ant', 'bulbGlow', 'bulb', 'eyeL', 'eyeR', 'glowL', 'glowR', 'lidTL', 'lidBL', 'lidTR', 'lidBR', 'mouth']) refs[k] = make();
  return refs;
}

// now=1234 → sin(1234 * 0.00126) ≈ sin(1.555) ≈ 0.9999, so a BREATHING head shows a clearly
// non-zero vertical bob (~1.5px) at this instant. A still head must show 0.00.
const NOW = 1234;
const bobOf = (transform) => {
  const m = /translate\([^ ]+ (-?\d+\.\d+)\)/.exec(transform || '');
  return m ? parseFloat(m[1]) : NaN;
};

describe('FaceCtl — static (still) paint (finding 13)', () => {
  it('renderStatic paints a motionless frame (zero breath bob) when still', () => {
    const ctl = new FaceCtl(DISPO.neutral);
    ctl.still = true;
    const refs = mockRefs();
    ctl.attach(refs);
    ctl.setStanding(0, { instant: true });
    ctl.renderStatic(NOW);
    expect(refs.face.attrs.transform).toBeTruthy();
    expect(bobOf(refs.face.attrs.transform)).toBe(0);
  });

  it('a reactive (non-still) head DOES breathe at the same instant — the control', () => {
    const ctl = new FaceCtl(DISPO.neutral);
    ctl.reduced = false; ctl.still = false;
    const refs = mockRefs();
    ctl.attach(refs);
    ctl.setStanding(0, { instant: true });
    ctl.tick(NOW);
    expect(Math.abs(bobOf(refs.face.attrs.transform))).toBeGreaterThan(0);
  });

  it('still also silences the antenna-life + glow-breath (reduced parity)', () => {
    const ctl = new FaceCtl(DISPO.speculator); // speculator has the liveliest antenna
    ctl.still = true;
    const refs = mockRefs();
    ctl.attach(refs);
    ctl.setStanding(0, { instant: true });
    ctl.renderStatic(NOW);
    // neutral standing → base antenna 0; still → no antenna-life term → rotate 0.00.
    expect(refs.ant.attrs.transform).toBe('rotate(0.00 100 54)');
  });
});
