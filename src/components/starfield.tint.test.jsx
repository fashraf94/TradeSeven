// @vitest-environment jsdom
//
// Acceptance row A5 — THE TINT REACHES THE CANVAS AS A COMPUTED COLOR.
// Delight Layer arc, Task 2 (Phase 3). Spec V2 §6, decision D3, hazard H2.
//
// Three things, per the row: the tint is sourced from readToken('warp-tint');
// no `var(` string ever reaches a canvas op; and `ft-accent-changed` re-reads it.
//
// WHY THIS MATTERS MORE THAN A UNIT TEST OF resolveTint. Canvas has NO CSS
// parser. Assigning `ctx.strokeStyle = 'var(--ft-accent)'` is not an error — the
// assignment is silently IGNORED and the previous style persists. So the failure
// mode is an invisible or wrong-coloured field with no throw, no warning and no
// failing unit row: exactly the silent-failure class BUILD_RULES §10 was written
// for. This test therefore records what actually lands on the context object,
// rather than what the helper returns.
//
// FIXTURE STRATEGY is inherited from src/theme/cssTokens.test.js:6-16 — fs-read
// tokens.css and inject it as a <style>. vitest's `test.css` is never set, so
// `import './tokens.css'` would resolve to an empty module and every assertion
// here would pass vacuously. Do not "simplify" it into an import.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import StarfieldBackground from './StarfieldBackground';
import { WARP_TINT_FALLBACK } from './warpStateMachine';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = readFileSync(path.join(HERE, '..', 'theme', 'tokens.css'), 'utf8');

/** Every value assigned to a color-bearing canvas property, in order. */
let styleWrites;
let rafQueue;
let rafNextId;

function makeRecordingContext() {
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalCompositeOperation: '',
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: '',
  };
  // strokeStyle / fillStyle are the two properties a tint can reach.
  let strokeStyle = '';
  let fillStyle = '';
  Object.defineProperty(ctx, 'strokeStyle', {
    get: () => strokeStyle,
    set: (v) => { strokeStyle = v; styleWrites.push(String(v)); },
  });
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => fillStyle,
    set: (v) => { fillStyle = v; styleWrites.push(String(v)); },
  });
  return ctx;
}

let container;
let root;

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = TOKENS_CSS;
  document.head.appendChild(style);
});

beforeEach(() => {
  styleWrites = [];
  rafQueue = new Map();
  rafNextId = 0;

  vi.stubGlobal('requestAnimationFrame', (cb) => {
    rafNextId += 1;
    rafQueue.set(rafNextId, cb);
    return rafNextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => { rafQueue.delete(id); });

  HTMLCanvasElement.prototype.getContext = makeRecordingContext;
  window.matchMedia = (q) => ({
    matches: false, media: q,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = null;
  root = null;
  document.documentElement.style.removeProperty('--ft-accent');
  document.documentElement.style.removeProperty('--ft-warp-tint');
  vi.unstubAllGlobals();
});

function flushFrame() {
  const entry = rafQueue.entries().next();
  if (entry.done) return;
  const [id, cb] = entry.value;
  rafQueue.delete(id);
  cb(0);
}

const mount = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<StarfieldBackground mode="desktop" seed={11} />);
  });
  flushFrame(); // one painted frame, so styles actually land on the context
};

describe('A5 — the tint is sourced from readToken(\'warp-tint\')', () => {
  it('paints the resolved token value, not the alias chain', async () => {
    // tokens.css: --ft-warp-tint -> var(--ft-accent) -> var(--ft-cyan) -> #00d9ff
    await mount();
    expect(styleWrites.length).toBeGreaterThan(0);
    expect(styleWrites).toContain('#00d9ff');
  });

  it('actually WALKS the var() chain — not just falls back to the same literal', async () => {
    // The default resolved value (#00d9ff) happens to equal WARP_TINT_FALLBACK,
    // so the row above cannot tell a real chain-walk from a total resolution
    // failure that falls back to the identical literal. Rebind the mid-chain
    // alias to a DISTINCT colour before mount: only a genuine walk of
    // --ft-warp-tint -> var(--ft-accent) -> #ff00aa can land #ff00aa. A broken
    // readToken would fall back to #00d9ff and fail here.
    document.documentElement.style.setProperty('--ft-accent', '#ff00aa');
    await mount();
    expect(styleWrites).toContain('#ff00aa');
    expect(styleWrites).not.toContain('#00d9ff');
  });

  it('NEVER assigns a var() string to a canvas style property', async () => {
    await mount();
    for (const written of styleWrites) {
      expect(written, `a var() string reached a canvas op: ${written}`).not.toContain('var(');
    }
  });

  it('only ever writes values canvas can actually parse', async () => {
    await mount();
    // The field paints exactly three kinds of colour: the tint, the white
    // near-star core, and the rgba() used for the translucent trail clear.
    for (const written of styleWrites) {
      expect(written).toMatch(/^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/);
    }
  });
});

describe('A5 — ft-accent-changed re-reads the token', () => {
  it('repaints with the new accent after a rebind + event', async () => {
    await mount();
    expect(styleWrites).toContain('#00d9ff');

    // The D4 rebind mechanism: retarget ONE variable at the root.
    styleWrites = [];
    await act(async () => {
      document.documentElement.style.setProperty('--ft-accent', '#ff00aa');
      window.dispatchEvent(new Event('ft-accent-changed'));
    });
    flushFrame();

    expect(styleWrites).toContain('#ff00aa');
    expect(styleWrites).not.toContain('#00d9ff');
  });

  it('does NOT change tint without the event (values are read, not guessed)', async () => {
    await mount();
    styleWrites = [];

    // Rebind but stay silent — the component has no way to know yet.
    document.documentElement.style.setProperty('--ft-accent', '#123456');
    flushFrame();

    expect(styleWrites).not.toContain('#123456');
  });

  it('reverts when the override is removed and the event fires again', async () => {
    await mount();
    await act(async () => {
      document.documentElement.style.setProperty('--ft-accent', '#ff00aa');
      window.dispatchEvent(new Event('ft-accent-changed'));
    });
    flushFrame();

    styleWrites = [];
    await act(async () => {
      document.documentElement.style.removeProperty('--ft-accent');
      window.dispatchEvent(new Event('ft-accent-changed'));
    });
    flushFrame();

    expect(styleWrites).toContain('#00d9ff');
  });

  it('removes the accent listener on unmount', async () => {
    await mount();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    await act(async () => root.unmount());
    root = null;
    expect(removeSpy).toHaveBeenCalledWith('ft-accent-changed', expect.any(Function));
  });
});

describe('A5 — degrading safely when the token is unreadable', () => {
  it('falls back to a literal rather than painting nothing', async () => {
    // An undeclared token reads as '' — the component must still paint a real
    // colour, because an empty fillStyle assignment is silently ignored by
    // canvas and would leave the previous (or default black) style in place.
    document.documentElement.style.setProperty('--ft-warp-tint', 'var(--nope)');
    await mount();

    for (const written of styleWrites) {
      expect(written).not.toContain('var(');
    }
    expect(styleWrites).toContain(WARP_TINT_FALLBACK);
  });
});
