// @vitest-environment jsdom
// src/hooks/useBackingLit.test.jsx
//
// Backing activation — the lit hook and its provider, alone:
//   · useBackingLit() is the flag OR the context, the context's default is
//     false, and the flag is read at call time (the getter mock moves it);
//   · BackingLitProvider asks GET /api/backing/lit ONCE per signed-in uid
//     (a re-render asks again nothing; an account switch asks once more),
//     never for a signed-out viewer, never while the flag is on;
//   · the answer is the server's boolean and nothing else — a truthy string,
//     a missing key, a thrown ask all read dark;
//   · the provider renders its children and nothing of its own.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const flag = vi.hoisted(() => ({ on: false }));
const svc = vi.hoisted(() => ({ asks: 0, reply: { lit: false }, throws: false }));
const who = vi.hoisted(() => ({ user: { uid: 'viewer-1' } }));

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../services/backingService', () => ({
  fetchBackingLit: vi.fn(async () => {
    svc.asks += 1;
    if (svc.throws) throw Object.assign(new Error('network'), { code: 'network' });
    return svc.reply;
  }),
}));
vi.mock('../contexts/UserContext', () => ({ useUser: () => ({ user: who.user }) }));

const { useBackingLit, BackingLitContext } = await import('./useBackingLit');
const BackingLitProvider = (await import('../components/League/backing/BackingLitProvider')).default;

function Probe() {
  const lit = useBackingLit();
  return <span data-lit={lit ? 'yes' : 'no'}>{lit ? 'lit' : 'dark'}</span>;
}

let roots = [];
async function mount(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  roots.push({ root, container });
  return { container, root, rerender: async (next) => { await act(async () => { root.render(next); }); for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); }); } };
}
const litOf = (container) => container.querySelector('[data-lit]').getAttribute('data-lit');

beforeEach(() => { flag.on = false; svc.asks = 0; svc.reply = { lit: false }; svc.throws = false; who.user = { uid: 'viewer-1' }; });
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
  vi.restoreAllMocks();
});

describe('useBackingLit()', () => {
  it('is the flag OR the context; the default context is false', async () => {
    expect(litOf((await mount(<Probe />)).container)).toBe('no');
    expect(litOf((await mount(<BackingLitContext.Provider value><Probe /></BackingLitContext.Provider>)).container)).toBe('yes');
    expect(litOf((await mount(<BackingLitContext.Provider value={false}><Probe /></BackingLitContext.Provider>)).container)).toBe('no');
    // Only a strict `true` lights — never a truthy string.
    expect(litOf((await mount(<BackingLitContext.Provider value="true"><Probe /></BackingLitContext.Provider>)).container)).toBe('no');
  });

  it('reads the flag at CALL time — the flag on lights a bare mount with no provider and no ask', async () => {
    flag.on = true;
    expect(litOf((await mount(<Probe />)).container)).toBe('yes');
    expect(svc.asks).toBe(0);
  });
});

describe('BackingLitProvider', () => {
  it('asks once per signed-in uid, and lights its subtree only when the server says { lit: true }', async () => {
    svc.reply = { lit: true };
    const { container, rerender } = await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
    expect(svc.asks).toBe(1);
    expect(litOf(container)).toBe('yes');
    // A re-render asks nothing more.
    await rerender(<BackingLitProvider><Probe /></BackingLitProvider>);
    expect(svc.asks).toBe(1);
  });

  it('{ lit: false }, a missing key, a truthy string, and a thrown ask all read DARK', async () => {
    for (const reply of [{ lit: false }, {}, { lit: 'true' }, { lit: 1 }, null]) {
      svc.reply = reply;
      const { container } = await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
      expect(litOf(container), JSON.stringify(reply)).toBe('no');
    }
    svc.throws = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
    expect(litOf(container)).toBe('no');
    expect(warn).toHaveBeenCalled();
  });

  it('asks NOTHING for a signed-out viewer, and asks again ONCE when the uid changes', async () => {
    who.user = null;
    const { container, rerender } = await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
    expect(svc.asks).toBe(0);
    expect(litOf(container)).toBe('no');
    who.user = { uid: 'viewer-2' };
    svc.reply = { lit: true };
    await rerender(<BackingLitProvider><Probe key="again" /></BackingLitProvider>);
    expect(svc.asks).toBe(1);
    expect(litOf(container)).toBe('yes');
    // Signing out darkens and asks nothing.
    who.user = null;
    await rerender(<BackingLitProvider><Probe key="out" /></BackingLitProvider>);
    expect(svc.asks).toBe(1);
    expect(litOf(container)).toBe('no');
  });

  it('asks NOTHING while the flag is on — every viewer is lit by the flag itself', async () => {
    flag.on = true;
    const { container } = await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
    expect(svc.asks).toBe(0);
    expect(litOf(container)).toBe('yes');
  });

  it('renders its children and nothing of its own', async () => {
    const { container } = await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
    expect(container.innerHTML).toBe('<span data-lit="no">dark</span>');
  });

  it('never reads the hostname, the env, or the flag file for the decision — the server\'s answer is the whole story', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hook = strip(readFileSync(path.join(here, 'useBackingLit.js'), 'utf8'));
    const provider = strip(readFileSync(path.join(here, '..', 'components', 'League', 'backing', 'BackingLitProvider.jsx'), 'utf8'));
    for (const src of [hook, provider]) {
      expect(src).not.toMatch(/window\.location|hostname|import\.meta\.env|VERCEL_ENV|BACKING_SMOKE/);
    }
    expect(hook).not.toMatch(/fetch|backingService|UserContext/);
    expect(provider).toContain("from '../../../services/backingService'");
  });

  it('the app root mounts the provider ONCE, inside UserProvider and around <App /> — the mount the founder\'s smoke depends on (LIGHT-2; the wrong ORDER is a crash for every viewer, not a dark app: useUser throws outside UserProvider — LIGHT-R-1)', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const main = readFileSync(path.join(here, '..', 'main.jsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(main).toContain("import BackingLitProvider from './components/League/backing/BackingLitProvider'");
    expect(main).toMatch(/<UserProvider>[\s\S]*<BackingLitProvider>[\s\S]*<App \/>[\s\S]*<\/BackingLitProvider>[\s\S]*<\/UserProvider>/);
    expect(main.match(/<BackingLitProvider>/g)).toHaveLength(1);
    // …and never on the no-auth fixture page's branch (it has no UserProvider).
    expect(main).not.toMatch(/<BackingLitProvider>[\s\S]*<BackingPreviewScreen \/>/);
  });
});
