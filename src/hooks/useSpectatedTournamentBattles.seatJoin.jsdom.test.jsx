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

const net = vi.hoisted(() => ({ reply: { battles: {} }, urls: [], byGroup: {} }));
const groups = vi.hoisted(() => ({ doc: null }));
vi.mock('../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(async (url) => {
    net.urls.push(url);
    const per = net.byGroup[decodeURIComponent(url.split('groupId=')[1] || '')];
    if (per === 'hang') return new Promise(() => {});
    if (per === 'fail') return { ok: false, status: 500, json: async () => ({ error: 'server_error' }) };
    return { ok: true, status: 200, json: async () => per ?? net.reply };
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
function Probe({ groupId = 'g1', players, enabled = true }) {
  seen = useSpectatedTournamentBattles(groupId, enabled, players).battles;
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

beforeEach(() => { net.reply = SEAT_REPLY; net.urls = []; net.byGroup = {}; seen = null; groups.doc = null; });
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

  // The join reads the CURRENT `players` (its memo depends on them). It is NOT
  // a guard against a mid-battle reorder: a reply computed under one order and
  // joined under another would seat battles on the wrong players. That cannot
  // happen because no writer reorders `players` once battles exist (every
  // in-battle writer maps or deep-copies; only FORMING-phase writers insert or
  // remove — the security-pack report, Fix 1). This row pins the memo
  // dependency only (test lens, finding 4).
  it('the join follows the group document\'s current `players` without a refetch (memo dependency)', async () => {
    const rerender = await mount(<Probe players={PLAYERS} />);
    await rerender(<Probe players={[PLAYERS[1], PLAYERS[0], PLAYERS[2]]} />);
    expect(symbolsByOwner(seen)).toEqual({ 'p-rival': 'NVDA', 'p-viewer': 'XLE', 'cpu-3': 'GLD' });
    expect(net.urls).toHaveLength(1);
  });
});

// Security-pack review, wiring lens W1: seat '1' of one group is a different
// player from seat '1' of the next. When the hook moves to another group it
// must never join the OLD group's reply to the NEW group's players — not while
// the new fetch is in flight, not after it fails, not when the hook is disabled
// there.
describe('W1 — a reply joins only to the group it was fetched for', () => {
  const B_PLAYERS = [{ odUserId: 'p-stranger' }, { odUserId: 'p-viewer' }, { odUserId: 'p-other' }];
  const B_REPLY = { battles: { 0: book('TSLA'), 1: book('AMD'), 2: book('KO') } };

  it('the new fetch in flight: nothing placed', async () => {
    net.byGroup = { g2: 'hang' };
    const rerender = await mount(<Probe groupId="g1" players={PLAYERS} />);
    expect(symbolsByOwner(seen)).toEqual({ 'p-viewer': 'NVDA', 'p-rival': 'XLE', 'cpu-3': 'GLD' });
    await rerender(<Probe groupId="g2" players={B_PLAYERS} />);
    expect(seen).toEqual({});
  });

  it('the new group\'s own reply lands: its own seats, under its own players', async () => {
    net.byGroup = { g2: B_REPLY };
    const rerender = await mount(<Probe groupId="g1" players={PLAYERS} />);
    await rerender(<Probe groupId="g2" players={B_PLAYERS} />);
    expect(symbolsByOwner(seen)).toEqual({ 'p-stranger': 'TSLA', 'p-viewer': 'AMD', 'p-other': 'KO' });
  });

  it('the new fetch FAILS: nothing placed — never the old group\'s battles under the new players', async () => {
    net.byGroup = { g2: 'fail' };
    const rerender = await mount(<Probe groupId="g1" players={PLAYERS} />);
    await rerender(<Probe groupId="g2" players={B_PLAYERS} />);
    expect(seen).toEqual({});
  });

  it('the hook disabled on the new group: nothing placed', async () => {
    const rerender = await mount(<Probe groupId="g1" players={PLAYERS} />);
    await rerender(<Probe groupId="g2" players={B_PLAYERS} enabled={false} />);
    expect(seen).toEqual({});
    expect(net.urls).toEqual(['/api/tournament/battle-view?groupId=g1']);
  });

  it('disabled on the SAME group (the arena stops polling at the bell): the last reply still joins', async () => {
    const rerender = await mount(<Probe groupId="g1" players={PLAYERS} />);
    await rerender(<Probe groupId="g1" players={PLAYERS} enabled={false} />);
    expect(symbolsByOwner(seen)).toEqual({ 'p-viewer': 'NVDA', 'p-rival': 'XLE', 'cpu-3': 'GLD' });
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
