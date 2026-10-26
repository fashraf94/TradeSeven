// @vitest-environment jsdom
//
// Command Center hub, slice S7 — what ShadowCanvas hands the pure drawing module (hub/shadowCanvas.js), argument by
// argument (the lens T review: a stand-in context sees the strokes but not WHY, so a wrong `dt`, a stale `sel` or a
// clock handed to the wrong call could draw plausibly). The module's functions are wrapped, not replaced: they still
// run, and each call's arguments are read back.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({}));
vi.mock('./hub/shadowCanvas', async (importOriginal) => {
  const actual = await importOriginal();
  for (const name of ['createShadowRig', 'createFx', 'fitFx', 'stepFx', 'drawShadow', 'triggerBloom', 'shadowColors']) spies[name] = vi.fn(actual[name]);
  return { ...actual, ...spies };
});

import ShadowCanvas from './ShadowCanvas';
import { injectTokens, mount } from './__fixtures__/hubTestKit';
import { installFakeCanvas } from './__fixtures__/shadowCanvasKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let removeTokens;
let kit;
let mounted = [];
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  kit = installFakeCanvas();
  for (const fn of Object.values(spies)) fn.mockClear();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  kit.restore();
});

const quiet = () => 0.99;
const element = (props = {}) => <ShadowCanvas size={200} tier="low" random={quiet} {...props} />;
function draw(props) {
  const m = mount(element(props));
  mounted.push(m);
  return m;
}
const tick = (n = 1, ms = 16) => { for (let i = 0; i < n; i += 1) kit.tick(ms); };
const stepArgs = (i = 0) => spies.stepFx.mock.calls[i];
const lastStep = () => spies.stepFx.mock.calls.at(-1);
const lastDraw = () => spies.drawShadow.mock.calls.at(-1);

describe('setup — what each run builds from', () => {
  it('builds its rig from the tier, its colours from the three tokens (teal near, teal-2 far, white core), and fits the effects to the rig', () => {
    draw({ tier: 'mid' });
    expect(spies.createShadowRig).toHaveBeenCalledTimes(1);
    expect(spies.createShadowRig).toHaveBeenCalledWith('mid');
    expect(spies.shadowColors).toHaveBeenCalledTimes(1);
    expect(spies.shadowColors).toHaveBeenCalledWith('#5eead4', '#7fd4ff', '#ffffff');
    const rig = spies.createShadowRig.mock.results[0].value;
    expect(spies.fitFx).toHaveBeenCalledTimes(1);
    expect(spies.fitFx.mock.calls[0][1]).toBe(rig.strands.length);
    expect(rig.strands.length).toBe(21);
  });

  it('a tier change builds a new rig and refits the SAME effects state to its strand count; a size change rebuilds the rig too', () => {
    const m = draw({ tier: 'mid' });
    const fx = spies.fitFx.mock.calls[0][0];
    m.rerender(element({ tier: 'low' }));
    expect(spies.createShadowRig).toHaveBeenLastCalledWith('low');
    expect(spies.fitFx).toHaveBeenCalledTimes(2);
    expect(spies.fitFx.mock.calls[1][0]).toBe(fx);
    expect(spies.fitFx.mock.calls[1][1]).toBe(15);
    m.rerender(element({ tier: 'low', size: 260 }));
    expect(spies.createShadowRig).toHaveBeenCalledTimes(3);
    expect(spies.fitFx.mock.calls[2][0]).toBe(fx);
    expect(spies.createFx).toHaveBeenCalledTimes(1);
  });
});

describe('each frame — the step, then the draw, from one clock', () => {
  it('steps the effects with the frame\'s own seconds (the first frame\'s 0.016, then the gap), the clock after it, the rate, the live flags and the rig\'s strands', () => {
    draw({ tier: 'low', selectedArea: 1 });
    const rig = spies.createShadowRig.mock.results[0].value;
    tick(1, 16);
    const [fx, a, random] = stepArgs(0);
    expect(fx).toBe(spies.fitFx.mock.calls[0][0]);
    expect(random).toBe(quiet);
    expect(a.dt).toBeCloseTo(0.016, 12);
    expect(a.t).toBeCloseTo(0.016, 12);
    expect(a.speed).toBe(1);
    expect(a.processing).toBe(false);
    expect(a.sel).toBe(1);
    expect(a.strands).toBe(rig.strands);
    tick(1, 33);
    const b = stepArgs(1)[1];
    expect(b.dt).toBeCloseTo(0.033, 12);
    expect(b.t).toBeCloseTo(0.016 + 0.033, 12);
  });

  it('the draw gets the same clock the step ended on, the same rig, effects and colours, and the live selection and processing flag', () => {
    draw({ tier: 'low', selectedArea: 2, status: 'processing' });
    tick(3);
    const rig = spies.createShadowRig.mock.results[0].value;
    const colors = spies.shadowColors.mock.results[0].value;
    expect(spies.drawShadow).toHaveBeenCalledTimes(4);
    const [ctx, size, t, rigArg, P, fx, colorsArg] = lastDraw();
    expect(ctx).toBe(kit.ctx);
    expect(size).toBe(200);
    expect(t).toBe(lastStep()[1].t);
    expect(rigArg).toBe(rig);
    expect(P).toEqual({ sel: 2, processing: true });
    expect(fx).toBe(lastStep()[0]);
    expect(colorsArg).toBe(colors);
    // The mount's draw is at the clock's zero.
    expect(spies.drawShadow.mock.calls[0][2]).toBe(0);
  });

  it('processing runs the clock at 1.6× and tells the step so; ambient at 1×', () => {
    draw({ status: 'processing' });
    tick(1, 20);
    expect(lastStep()[1].speed).toBe(1.6);
    expect(lastStep()[1].t).toBeCloseTo(0.016 * 1.6, 12);
    expect(lastStep()[1].processing).toBe(true);
  });

  it('a long gap is capped at 0.05 s before it reaches the step, not only in the clock', () => {
    draw({});
    tick(1, 16);
    tick(1, 5000);
    expect(lastStep()[1].dt).toBe(0.05);
  });

  it('the live props reach the next frame without a restart: selection, processing and the injected random', () => {
    const other = () => 0.5;
    const m = draw({ selectedArea: 0, status: 'ambient' });
    tick(2);
    m.rerender(element({ selectedArea: 2, status: 'processing', random: other }));
    tick(1);
    const a = lastStep()[1];
    expect(a.sel).toBe(2);
    expect(a.processing).toBe(true);
    expect(a.speed).toBe(1.6);
    expect(lastStep()[2]).toBe(other);
    expect(lastDraw()[4]).toEqual({ sel: 2, processing: true });
    expect(spies.createShadowRig).toHaveBeenCalledTimes(1);
  });

  it('an area that is no area reaches the module as null', () => {
    draw({ selectedArea: 7 });
    tick(1);
    expect(lastStep()[1].sel).toBeNull();
    expect(lastDraw()[4].sel).toBeNull();
  });
});

describe('the response — triggerBloom, on the clock now', () => {
  it('fires once per response with the effects state and Shadow\'s clock at that moment — never at mount, never under the still', () => {
    const m = draw({});
    expect(spies.triggerBloom).not.toHaveBeenCalled();
    tick(10);
    const clock = lastStep()[1].t;
    m.rerender(element({ areaEvent: 1 }));
    expect(spies.triggerBloom).toHaveBeenCalledTimes(1);
    const [fx, t] = spies.triggerBloom.mock.calls[0];
    expect(fx).toBe(spies.fitFx.mock.calls[0][0]);
    expect(t).toBeCloseTo(clock, 12);
    m.rerender(element({ areaEvent: 1, selectedArea: 2 }));
    expect(spies.triggerBloom).toHaveBeenCalledTimes(1);
  });

  it('a response asked for while the loop is stopped is stamped with the stopped clock (the clock stands still with the loop)', () => {
    const m = draw({});
    tick(10);
    const clock = lastStep()[1].t;
    m.rerender(element({ paused: true }));
    m.rerender(element({ paused: true, areaEvent: 1 }));
    tick(5, 400);
    expect(spies.triggerBloom.mock.calls[0][1]).toBeCloseTo(clock, 12);
  });

  it('under the still it is never called, and nothing is stepped or drawn', () => {
    const m = draw({ reducedMotion: true });
    m.rerender(element({ reducedMotion: true, areaEvent: 1 }));
    expect(spies.triggerBloom).not.toHaveBeenCalled();
    expect(spies.stepFx).not.toHaveBeenCalled();
    expect(spies.drawShadow).not.toHaveBeenCalled();
    expect(spies.createShadowRig).not.toHaveBeenCalled();
  });
});
