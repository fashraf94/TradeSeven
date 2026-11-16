// @vitest-environment jsdom
// src/hooks/useSpectatedTournamentBattles.seatJoin.jsdom.test.jsx
//
// Security pack, founder ruling R-F (15 Nov 2026): GET /api/tournament/battle-view
// keys its battles by SEAT ('0'..'3', the owner's index in the group's
// `players`), never by account id. The league surfaces read an owner-keyed
// map, so every client reader joins the seats back through the `players` of
// the group document it already holds. Every consumer test mocks the hook, so
// this file drives the REAL joins:
//   · the polling hook — seat-keyed reply + players → owner-keyed battles; no
//     players → nothing placed; an owner-keyed reply (the old shape) places
//     nothing; a re-ordered `players` re-joins without a refetch;
//   · backing's tape pod (fetchTapePod) — the same join before groupToPod;
//   · THE CALL-SITE CENSUS — every production call of the hook hands it the
//     group's players (a caller that forgets them would silently lose every
//     rival's book), pinned per call site.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const net = vi.hoisted(() => ({ reply: { battles: {} }, urls: [] }));
const groups = vi.hoisted(() => ({ doc: null }));
vi.mock('../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(async (url) => {
    net.urls.push(url);
    return { ok: true, status: 200, json: async () => net.reply };
  }),
}));
vi.mock('../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
vi.mock('../services/tournamentGroupService', () => ({
  getGroup: vi.fn(async () => groups.doc),
  fetchDisplayNames: vi.fn(async () => ({})),
}));

const useSpectatedTournamentBattles = (await import('./useSpectatedTournamentBattles')).default;
const { fetchTapePod } = await import('../services/backingService');

const book = (symbol) => ({ status: 'completed', agentContext: { archetype: 'guardian', initialPortfolio: { star: [{ symbol }] } }, portfolio: { star: [{ symbol }], core: [], support: [] }, _whyConcealed: true });
const PLAYERS = [{ odUserId: 'p-viewer', picks: [] }, { odUserId: 'p-rival', picks: [] }, { odUserId: 'cpu-3', isCpu: true, picks: [] }];
const SEAT_REPLY = { groupId: 'g1', battles: { 0: book('NVDA'), 1: book('XLE'), 2: book('GLD') } };

let roots = [];
let seen = null;
function Probe({ groupId = 'g1', players }) {
  seen = useSpectatedTournamentBattles(groupId, true, players).battles;
  return null;
}
async function mount(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  roots.push({ root, container });
  return async (next) => {
    await act(async () => { root.render(next); });
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  };
}

beforeEach(() => { net.reply = SEAT_REPLY; net.urls = []; seen = null; groups.doc = null; });
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
});

const symbolsByOwner = (battles) => Object.fromEntries(Object.entries(battles).map(([o, b]) => [o, b.portfolio.star[0].symbol]));

describe('the polling hook joins the seat-keyed reply back to the group\'s players (R-F)', () => {
  it('seat-keyed reply + players → the owner-keyed map the league surfaces read', async () => {
    await mount(<Probe players={PLAYERS} />);
    expect(net.urls).toEqual(['/api/tournament/battle-view?groupId=g1']);
    expect(symbolsByOwner(seen)).toEqual({ 'p-viewer': 'NVDA', 'p-rival': 'XLE', 'cpu-3': 'GLD' });
  });

  it('without the players nothing is placed — a seat is never guessed', async () => {
    await mount(<Probe players={undefined} />);
    expect(seen).toEqual({});
  });

  it('an owner-keyed reply (the pre-R-F shape) places nothing', async () => {
    net.reply = { battles: { 'p-rival': book('XLE') } };
    await mount(<Probe players={PLAYERS} />);
    expect(seen).toEqual({});
  });

  it('a new seat order re-joins at once, without a refetch', async () => {
    const rerender = await mount(<Probe players={PLAYERS} />);
    await rerender(<Probe players={[PLAYERS[1], PLAYERS[0], PLAYERS[2]]} />);
    expect(symbolsByOwner(seen)).toEqual({ 'p-rival': 'NVDA', 'p-viewer': 'XLE', 'cpu-3': 'GLD' });
    expect(net.urls).toHaveLength(1);
  });
});

describe('backing\'s tape pod joins the same way (fetchTapePod → groupToPod)', () => {
  it('each seat of the pod carries ITS OWN battle\'s book', async () => {
    groups.doc = { id: 'g1', status: 'complete', players: PLAYERS, dailyScores: {} };
    const pod = await fetchTapePod('g1', 'p-viewer');
    const byId = Object.fromEntries(pod.seats.filter(Boolean).map((s) => [s.id, s.agentBook.map((b) => b.tk)]));
    expect(byId).toEqual({ 'p-viewer': ['NVDA'], 'p-rival': ['XLE'], 'cpu-3': ['GLD'] });
  });

  it('an owner-keyed reply leaves every book empty rather than mis-seated', async () => {
    groups.doc = { id: 'g1', status: 'complete', players: PLAYERS, dailyScores: {} };
    net.reply = { battles: { 'p-rival': book('XLE') } };
    const pod = await fetchTapePod('g1', 'p-viewer');
    for (const s of pod.seats.filter(Boolean)) expect(s.agentBook).toEqual([]);
  });
});

// ── THE CALL-SITE CENSUS ─────────────────────────────────────────────────────
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\.|\.spec\./.test(name)) out.push(p);
  }
  return out;
}
/** The argument text of every `useSpectatedTournamentBattles(` call in a source text (balanced parentheses). */
function callArgs(text) {
  const out = [];
  const re = /\buseSpectatedTournamentBattles\s*\(/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 1; let i = re.lastIndex;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') depth -= 1;
    }
    out.push(text.slice(re.lastIndex, i - 1));
  }
  return out;
}
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// Each call site and the players it must hand the hook (its own group document's).
const CALL_SITES = {
  'components/League/backing/YourBacking.jsx': ['group?.players', 'group?.players'],
  'components/League/battleArena/useArenaModel.js': ['group?.players'],
  'components/Tournament/SpectatorView.jsx': ['group?.players'],
  'hooks/useRealLeagueState.js': ['myGroup?.players'],
};

describe('THE CALL-SITE CENSUS — every production call hands the hook its group\'s players', () => {
  const found = {};
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    if (rel === 'hooks/useSpectatedTournamentBattles.js') continue;
    const calls = callArgs(stripComments(readFileSync(f, 'utf8')));
    if (calls.length) found[rel] = calls;
  }

  it('the set of calling files is exactly the census', () => {
    expect(Object.keys(found).sort()).toEqual(Object.keys(CALL_SITES).sort());
  });

  it.each(Object.entries(CALL_SITES))('%s passes its group\'s players as the third argument at every call', (rel, want) => {
    const thirds = (found[rel] || []).map((args) => {
      const parts = args.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s, i, a) => !(i === a.length - 1 && s === ''));
      return (parts[2] || '').split(/\s*\/\//)[0].trim();
    });
    expect(thirds).toEqual(want);
  });
});
