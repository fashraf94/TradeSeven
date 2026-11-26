// api/_utils/practiceField/bookView.hub.test.js
//
// Practice Field build B5 — THE VIEW FOR THE HUB (rulings B5-1 to B5-3, B5-5; the Command Center chat's note,
// docs/design/20261126_NOTE_TO_PRACTICE_FIELD_BOOK_VIEW_FOR_THE_HUB.md), on the scenes with their epoch and agent
// (__testsupport__/bookViewScenesHub.js) and through the reader on the in-memory store:
//   B5-1  the archetype: the epoch's, for each of the six and an unknown code; never the agent's battle archetype
//   B5-2  the split: shares from the epoch (a different epoch proves it), each desk's use against the STORED rows (computed
//         here, not by the view's helpers), entering and bought-after-the-close at zero, above its share, a waiting line
//   B5-3  the names: named, unnamed, at and past the limit, markup as text, not plain text, not the caller's agent; the
//         scan for "Shadow" across the fixed words and every scene
// The 13-session run's figures are bookView.e2e.test.js's; the consistent read is bookViewRead.consistent.test.js's.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildBookView, epochSharesOf, plainGivenName, deskNamesOf, AGENT_GIVEN_NAME_MAX, BOOK_VIEW_VERSION } from './bookView.js';
import * as COPY from './bookViewCopy.js';
import { readBookView } from './bookViewRead.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { toCents } from './money.js';
import { deskOfIdea } from './agentConfig.js';
import { listArchetypeIds, getArchetypeDefinition } from '../archetypeRegistry.js';
import { makeMandateFakeDb } from './__testsupport__/fixtures.js';
import { SCENE_NAMES, sceneInput, SCENE_UID, SCENE_BOOK_ID, SCENE_AGENT_ID } from './__testsupport__/bookViewScenes.js';
import { hubSceneInput, hubSceneDocs, sceneEpoch, HUB_AGENT_NAME } from './__testsupport__/bookViewScenesHub.js';

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

const view = (name, opts) => buildBookView(hubSceneInput(name, opts));
const read = async (docs) => (await readBookView(makeMandateFakeDb(docs), { uid: SCENE_UID, agentOn: true })).book;
const part = (v, key) => v.split.parts.find((p) => p.key === key);
const group = (v, slot) => v.groups.find((g) => g.slot === slot);
/** A displayed amount back to whole cents. */
const cents = (text) => (text.startsWith('−') ? -1 : 1) * Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);
/** The book's marked value as the view's headline takes it: the last close's row, else the book's own. */
const equityCentsOf = (input) => toCents(input.dailyRows.last ? input.dailyRows.last.markedEquity : input.book.portfolio.totalValue);
/** A desk's positions at the last close, from the STORED rows: each of its ideas' row of that session, its holdings value. */
const storedUse = (input, desk) => input.ideas
  .filter((i) => deskOfIdea(i) === desk)
  .map((i) => input.rows.get(i.ideaId)?.last)
  .filter((r) => r && r.date === input.book.execState.lastCloseKey)
  .reduce((s, r) => s + toCents(r.markedHoldingsValue), 0);
/** floor(equity × ppm / 10⁶), in integers. */
const shareCents = (equityCents, ppm) => Number((BigInt(equityCents) * BigInt(ppm)) / 1_000_000n);
/** Every string a player reads: the desk ids (`desk`) are the engine's keys. */
const playerStrings = (v, key = null, out = []) => {
  if (typeof v === 'string') { if (key !== 'desk') out.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => playerStrings(x, key, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) playerStrings(x, k, out);
  return out;
};
const deskIds = (v, out = []) => {
  if (Array.isArray(v)) v.forEach((x) => deskIds(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'desk') out.push(x); else deskIds(x, out); }
  return out;
};
const cp = (...codes) => String.fromCodePoint(...codes);

// ── B5-1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B5-1: the archetype the book runs under — the epoch\'s code id and the registry\'s name', () => {
  it('each of the six archetypes, built and read back; its desk by its name; never the agent\'s battle archetype', async () => {
    const ids = listArchetypeIds();
    expect(ids).toHaveLength(6);
    for (const codeId of ids) {
      const name = getArchetypeDefinition(codeId).displayName;
      const v = view('sample', { archetypeCodeId: codeId });
      expect(v.archetype, codeId).toEqual({ codeId, name });
      expect(v.desks.find((d) => d.desk === 'archetype'), codeId).toMatchObject({ deskName: `${name}’s desk`, lane: `${name} · Short` });
      expect(group(v, 'short').deskName, codeId).toBe(`${name}’s desk`);
      // Through the store: the agent document says 'degen' (its battle archetype); the view says the epoch's.
      const stored = await read(hubSceneDocs('sample', { archetypeCodeId: codeId }));
      expect(stored.archetype, codeId).toEqual({ codeId, name });
      expect(JSON.stringify(stored), codeId).toBe(JSON.stringify(v));
    }
  });

  it('an archetype the registry no longer knows: its code id, a null name, its desk\'s fallback name — and no throw', async () => {
    const epoch = sceneEpoch();
    epoch.archetypeCodeId = 'retired_archetype';
    const v = await read(hubSceneDocs('sample', { epoch }));
    expect(v.archetype).toEqual({ codeId: 'retired_archetype', name: null });
    expect(v.desks.find((d) => d.desk === 'archetype')).toMatchObject({ deskName: 'Your archetype’s desk', lane: 'Short' });
    // The shares are still the epoch's.
    expect(v.split.parts.map((p) => p.share.text)).toEqual(['70%', '20%', '10%']);
  });

  it('no epoch: no archetype and no split; the archetype desk by its fallback name', async () => {
    const v = await read(hubSceneDocs('sample', { epoch: null }));
    expect([v.archetype, v.split]).toEqual([null, null]);
    expect(group(v, 'short').deskName).toBe('Your archetype’s desk');
    expect(v.version).toBe(BOOK_VIEW_VERSION);
    expect(BOOK_VIEW_VERSION).toBe(3);
  });
});

// ── B5-2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B5-2: the split — shares from the epoch, each desk\'s use at the last close from the stored rows', () => {
  it('the sample day: three parts in order, the shares as the epoch states them (summing to 1), both desks\' use to the cent', () => {
    const input = hubSceneInput('sample');
    const v = buildBookView(input);
    expect(v.split.parts.map((p) => [p.key, p.desk ?? null, p.name, p.share.text])).toEqual([
      ['agent', 'shadow', 'Atlas’s desk', '70%'], ['archetype', 'archetype', 'Trend Follower’s desk', '20%'], ['cash', null, 'Cash', '10%'],
    ]);
    const ppm = v.split.parts.map((p) => Math.round(p.share.number * 1e6));
    expect(ppm.reduce((s, x) => s + x, 0)).toBe(1_000_000);
    expect(Math.abs(v.split.parts.reduce((s, p) => s + p.share.number, 0) - 1)).toBeLessThan(1e-12);
    // §9: the denominator is the headline's own cents.
    const equity = equityCentsOf(input);
    expect(cents(v.line.value)).toBe(equity);
    for (const [key, desk, sharePpm] of [['agent', 'shadow', 700_000], ['archetype', 'archetype', 200_000]]) {
      const use = storedUse(input, desk);
      const of = shareCents(equity, sharePpm);
      expect(use, key).toBeGreaterThan(0);
      expect(cents(part(v, key).use.amount.text), key).toBe(use);
      expect(cents(part(v, key).use.of.text), key).toBe(of);
      expect(part(v, key).use.bar, key).toBe(Math.min(1, use / of)); // (the sample's energy idea has gained past its 20%)
      expect(part(v, key).use.pct, key).toBe(`${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format((use * 100) / of)}%`);
      // …and it is the sum of the position values the desk's groups show (BUILD_RULES §9).
      const shown = v.groups.filter((g) => g.desk === desk).flatMap((g) => g.names).filter((n) => n.positionValue).reduce((s, n) => s + cents(n.positionValue), 0);
      expect(shown, key).toBe(use);
    }
    expect(part(v, 'cash')).toEqual({ key: 'cash', name: 'Cash', share: { text: '10%', number: 0.1 } });
    // A figure of $10,000 or more also comes without cents (the table's fit rule): the hub's band.
    expect(part(v, 'agent').use.of.short).toMatch(/^\$[0-9,]+$/);
  });

  it('a full book: the agent\'s desk holds two ideas — its use is both, to the cent', () => {
    const input = hubSceneInput('full');
    const v = buildBookView(input);
    expect(cents(part(v, 'agent').use.amount.text)).toBe(storedUse(input, 'shadow'));
    expect(input.ideas.filter((i) => deskOfIdea(i) === 'shadow')).toHaveLength(2);
    expect(cents(part(v, 'archetype').use.amount.text)).toBe(storedUse(input, 'archetype'));
  });

  it('the shares come from the epoch: a different epoch\'s caps give its own shares and denominators', () => {
    const epoch = sceneEpoch({ slotCapShare: { short: 0.25, medium: 0.25, long: 0.40 }, cashFloorPct: 0.10 });
    const input = hubSceneInput('sample', { epoch });
    const v = buildBookView(input);
    expect(v.split.parts.map((p) => p.share.text)).toEqual(['65%', '25%', '10%']);
    expect(cents(part(v, 'agent').use.of.text)).toBe(shareCents(equityCentsOf(input), 650_000));
    expect(cents(part(v, 'archetype').use.of.text)).toBe(shareCents(equityCentsOf(input), 250_000));
    expect(epochSharesOf(epoch)).toEqual({ shadow: 650_000, archetype: 250_000, cash: 100_000 });
  });

  it('an epoch whose shares do not sum to exactly 1, or do not read, gives no split (never a scaled one)', () => {
    const cases = [
      ['sum 0.95', sceneEpoch({ cashFloorPct: 0.05 })],
      ['sum 1.05', sceneEpoch({ slotCapShare: { short: 0.25, medium: 0.30, long: 0.40 } })],
      ['a cap of 0', sceneEpoch({ slotCapShare: { short: 0, medium: 0.50, long: 0.40 } })],
      ['seven decimals', sceneEpoch({ slotCapShare: { short: 0.2000001, medium: 0.30, long: 0.3999999 } })],
      ['a slot no desk owns', sceneEpoch({ slotCapShare: { short: 0.20, medium: 0.30, long: 0.30, extra: 0.10 } })],
      ['no floor', (() => { const e = sceneEpoch(); delete e.gateConfig.cashFloorPct; return e; })()],
      ['a cap as text', sceneEpoch({ slotCapShare: { short: '0.20', medium: 0.30, long: 0.40 } })],
    ];
    for (const [what, epoch] of cases) {
      expect(epochSharesOf(epoch), what).toBeNull();
      expect(buildBookView(hubSceneInput('sample', { epoch })).split, what).toBeNull();
    }
  });

  it('a new book: every use is zero — its one idea is entering; and a book with no close yet', () => {
    const v = view('newBook');
    expect(group(v, 'medium').state).toBe('entering');
    for (const key of ['agent', 'archetype']) expect(part(v, key).use, key).toMatchObject({ amount: { text: '$0.00' }, pct: '0%', bar: 0 });
    // No close yet: the denominator is the book's own value (the headline's), and nothing is in use.
    const input = hubSceneInput('newBook');
    input.dailyRows = {};
    input.book = { ...input.book, execState: { lastCloseKey: null } };
    const w = buildBookView(input);
    expect(cents(part(w, 'agent').use.of.text)).toBe(shareCents(toCents(input.book.portfolio.totalValue), 700_000));
    expect(cents(part(w, 'agent').use.amount.text)).toBe(0);
  });

  it('an entering idea counts zero, and counts from the first close after its buy; one bought after the close counts zero', () => {
    // Admitted, entering at the next window: zero.
    expect(part(view('desksAdmit'), 'archetype').use).toMatchObject({ amount: { text: '$0.00' }, bar: 0 });
    // Bought at this session's window and valued at this close: counted.
    const today = hubSceneInput('newToday');
    expect(cents(part(buildBookView(today), 'archetype').use.amount.text)).toBe(storedUse(today, 'archetype'));
    expect(storedUse(today, 'archetype')).toBeGreaterThan(0);
    // Bought at a window after the last close (no row there): zero.
    const after = hubSceneInput('boughtToday');
    expect(part(buildBookView(after), 'archetype').use).toMatchObject({ amount: { text: '$0.00' }, bar: 0 });
  });

  it('a desk above its share: the true figures in text, the bar\'s number stops at 1', () => {
    const epoch = sceneEpoch({ slotCapShare: { short: 0.05, medium: 0.45, long: 0.40 }, cashFloorPct: 0.10 });
    const input = hubSceneInput('sample', { epoch });
    const p = part(buildBookView(input), 'archetype');
    const use = storedUse(input, 'archetype');
    const of = shareCents(equityCentsOf(input), 50_000);
    expect(use).toBeGreaterThan(of);
    expect([cents(p.use.amount.text), cents(p.use.of.text), p.use.bar]).toEqual([use, of, 1]);
    expect(Number(p.use.pct.replace(/[^0-9]/g, ''))).toBeGreaterThan(100);
  });

  it('a book line that waits (B3-11) shows each part\'s share and no use figure', () => {
    for (const scene of ['waiting', 'ledgerHold', 'unobserved']) {
      const v = view(scene);
      expect(v.line.waiting, scene).not.toBeNull();
      expect(v.split.parts.map((p) => [p.share.text, p.use ?? null]), scene).toEqual([['70%', null], ['20%', null], ['10%', null]]);
    }
  });

  it('an idea finished since the last close held its positions there: counted by its row of that close; not without one', () => {
    const input = hubSceneInput('sample');
    const energy = input.ideas.find((i) => i.ideaId === 'i_energy');
    const atClose = input.rows.get('i_energy').last;
    const expected = storedUse(input, 'archetype');
    const moved = { ...input, ideas: input.ideas.filter((i) => i !== energy), finished: [{ idea: energy, packet: null, parts: {}, atClose }] };
    expect(cents(part(buildBookView(moved), 'archetype').use.amount.text)).toBe(expected);
    // Control: the same idea finished with no row of that close counts zero, and a row of another session is not counted.
    expect(cents(part(buildBookView({ ...moved, finished: [{ ...moved.finished[0], atClose: null }] }), 'archetype').use.amount.text)).toBe(0);
    expect(cents(part(buildBookView({ ...moved, finished: [{ ...moved.finished[0], atClose: { ...atClose, date: '2026-11-25' } }] }), 'archetype').use.amount.text)).toBe(0);
  });
});

// ── B5-3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B5-3: the desks by their names, finished by the server', () => {
  it('a named agent: "Atlas’s desk" in the strip, the groups, the open slot, the calls, the Desks tab, History and the bylines', () => {
    const sample = view('sample');
    expect(sample.strip.map((s) => s.deskName)).toEqual(['Trend Follower’s desk', 'Atlas’s desk']);
    expect(group(sample, 'long').text).toBe('Long · open · Atlas’s desk looks tonight.');
    expect(group(sample, 'medium').call.deskName).toBe('Atlas’s desk');
    expect(sample.desks.find((d) => d.desk === 'shadow').calls.find((c) => c.state === 'open').text).toBe('Open. Atlas’s desk looks for an idea at tonight’s close.');
    const history = view('history');
    expect(history.history.items.find((i) => i.namesText === 'KO · PEP · PG')).toMatchObject({ deskName: 'Atlas’s desk', lastCall: { deskName: 'Atlas’s desk' }, thesis: { byline: 'Atlas’s desk' } });
    expect(view('desksAdmit').desks.find((d) => d.desk === 'archetype').deskName).toBe('Trend Follower’s desk');
  });

  it('an unnamed agent — no name, empty, blank, not text — reads "Your agent’s desk", lower-cased inside a sentence', () => {
    for (const agentName of [null, '', '   ', 42, { name: 'x' }]) {
      const v = view('sample', { agentName });
      expect(group(v, 'medium').deskName, String(agentName)).toBe('Your agent’s desk');
      expect(group(v, 'long').text, String(agentName)).toBe('Long · open · your agent’s desk looks tonight.');
      expect(v.desks.find((d) => d.desk === 'shadow').calls.find((c) => c.state === 'open').text).toBe('Open. Your agent’s desk looks for an idea at tonight’s close.');
    }
    // The archetype's fallback, inside the open short slot's sentence.
    const epoch = sceneEpoch();
    epoch.archetypeCodeId = 'retired_archetype';
    const input = hubSceneInput('newBook', { epoch });
    expect(input.archetype).toEqual({ codeId: 'retired_archetype', name: null });
    expect(group(buildBookView(input), 'short').text).toBe('Short · open · your archetype’s desk looks tonight.');
  });

  it(`a name at the limit (${AGENT_GIVEN_NAME_MAX} code points) is used; one past it falls back; the count is of code points`, () => {
    const at = 'W'.repeat(AGENT_GIVEN_NAME_MAX);
    expect(group(view('sample', { agentName: at }), 'medium').deskName).toBe(`${at}’s desk`);
    expect(group(view('sample', { agentName: `${at}W` }), 'medium').deskName).toBe('Your agent’s desk');
    const smile = cp(0x1f600);
    expect(plainGivenName(smile.repeat(AGENT_GIVEN_NAME_MAX))).toBe(smile.repeat(AGENT_GIVEN_NAME_MAX)); // 40 UTF-16 units
    expect(plainGivenName(smile.repeat(AGENT_GIVEN_NAME_MAX + 1))).toBeNull();
    expect(plainGivenName('  Atlas  ')).toBe('Atlas');
    expect(AGENT_GIVEN_NAME_MAX).toBe(20);
  });

  it('a name with markup is plain text: passed through as written, never stripped or interpreted', () => {
    const v = view('sample', { agentName: '<b>Ace</b>' });
    expect(group(v, 'medium').deskName).toBe('<b>Ace</b>’s desk');
    expect(view('sample', { agentName: '<img src=x>' }).strip[1].deskName).toBe('<img src=x>’s desk');
  });

  it('a name that is not plain text falls back: a control, a line break, a bidi override, a zero-width space, a lone surrogate', () => {
    for (const bad of [`Ace${cp(0x0a)}B`, `A${cp(0x09)}ce`, `Ace${cp(0x202e)}eciA`, `Ace${cp(0x2066)}x`, `A${cp(0x200b)}ce`, `Ace${String.fromCharCode(0xd800)}`, `A${cp(0x2028)}ce`, `${cp(0x00ad)}Ace`]) {
      expect(plainGivenName(bad), JSON.stringify(bad)).toBeNull();
      expect(group(view('sample', { agentName: bad }), 'medium').deskName).toBe('Your agent’s desk');
    }
    // A joiner inside an emoji sequence is part of one character, and stays.
    const coder = cp(0x1f469, 0x200d, 0x1f4bb);
    expect(plainGivenName(`Ada ${coder}`)).toBe(`Ada ${coder}`);
    expect(deskNamesOf({ agentName: 'Ada', archetypeName: 'Contrarian' })).toEqual({
      shadow: { name: 'Ada’s desk', mid: 'Ada’s desk' }, archetype: { name: 'Contrarian’s desk', mid: 'Contrarian’s desk' },
    });
  });

  it('through the reader: the caller\'s own agent names its desk; an agent that is not the caller\'s, or none, falls back', async () => {
    expect(group(await read(hubSceneDocs('sample')), 'medium').deskName).toBe(`${HUB_AGENT_NAME}’s desk`);
    const foreign = await read(hubSceneDocs('sample', { agent: { ownerId: 'someone-else', name: 'Mallory' } }));
    expect(group(foreign, 'medium').deskName).toBe('Your agent’s desk');
    expect(JSON.stringify(foreign)).not.toContain('Mallory');
    const docs = hubSceneDocs('sample');
    delete docs[`agents/${SCENE_AGENT_ID}`];
    expect(group(await read(docs), 'medium').deskName).toBe('Your agent’s desk');
    // An unusable name through the store falls back too.
    expect(group(await read(hubSceneDocs('sample', { agentName: 'W'.repeat(21) })), 'medium').deskName).toBe('Your agent’s desk');
  });

  it('no fixed word and no scene\'s view says "Shadow" or "archetype desk", in any case; the desk ids are the engine\'s keys only', { timeout: 60_000 }, () => {
    const fixed = [];
    const add = (v) => {
      if (typeof v === 'string') fixed.push(v);
      else if (typeof v === 'function') {
        for (const args of [['X', 'Y', true], ['Atlas'], [null], ['Short', 'your agent’s desk', true]]) {
          try { const out = v(...args); if (typeof out === 'string') fixed.push(out); else add(out); } catch { /* a function that needs other arguments */ }
        }
      } else if (v && typeof v === 'object') Object.values(v).forEach(add);
    };
    Object.values(COPY).forEach(add);
    expect(fixed.length).toBeGreaterThan(150);
    for (const s of fixed) expect(s).not.toMatch(/shadow|archetype desk/i);
    for (const n of SCENE_NAMES) {
      for (const [how, input] of [['named', hubSceneInput(n)], ['fallback', sceneInput(n)], ['agent off', { ...hubSceneInput(n), agentOn: false }]]) {
        const v = buildBookView(input);
        for (const s of playerStrings(v)) expect(s, `${n} ${how}: ${s}`).not.toMatch(/shadow|archetype desk/i);
        for (const d of deskIds(v)) expect(['shadow', 'archetype'], `${n} ${how}`).toContain(d);
      }
    }
  });

  it('every scene draws as it drew before, but for the names, the archetype\'s lane and the two new fields', { timeout: 60_000 }, () => {
    for (const n of SCENE_NAMES) {
      const named = buildBookView(hubSceneInput(n));
      const { archetype, split, ...rest } = named;
      expect(archetype, n).toEqual({ codeId: 'momentum_chaser', name: 'Trend Follower' });
      expect(split, n).not.toBeNull();
      const back = JSON.stringify(rest)
        .split('open · Atlas’s desk').join('open · your agent’s desk')
        .split('open · Trend Follower’s desk').join('open · your archetype’s desk')
        .split('Atlas’s desk').join('Your agent’s desk')
        .split('Trend Follower’s desk').join('Your archetype’s desk')
        .split('Trend Follower · Short').join('Short');
      const { archetype: a0, split: s0, ...fallback } = buildBookView(sceneInput(n));
      expect([a0, s0], n).toEqual([null, null]);
      expect(back, n).toBe(JSON.stringify(fallback));
    }
  });
});

// ── Privacy ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('privacy: no id in the answer; the agent\'s name is the caller\'s own agent\'s', () => {
  it('every scene read back with its epoch and agent: no uid, book, agent or idea id in any string; the code id is a catalogue key', async () => {
    const ids = [SCENE_UID, SCENE_BOOK_ID, SCENE_AGENT_ID, 'i_energy', 'i_banks', 'i_insurers', 'i_fit', 'f_nvda', 'f_kopep', 'f_energy', 'f_early', 'f_late', 'f_tampered', 'f_today', 'epoch-0001'];
    for (const n of SCENE_NAMES) {
      const v = await read(hubSceneDocs(n));
      for (const s of playerStrings(v)) for (const id of ids) expect(s.includes(id), `${n}: ${s}`).toBe(false);
      expect(listArchetypeIds(), n).toContain(v.archetype.codeId);
    }
  }, 60_000);
});
