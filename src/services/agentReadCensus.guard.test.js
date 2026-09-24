// src/services/agentReadCensus.guard.test.js
//
// PRE-FLIP HONESTY FIX B (Backing spec V1.3 §11 gate 3) — THE CLIENT `agents`
// READ CENSUS. firestore.rules admits a client read of agents/{id} only when
// the document's ownerId is the caller's uid (test/rules/agentsOwnerRead.
// rules.mjs proves the rule). This guard pins the census that proved the rule
// breaks no live screen: every client-side handle on an `agents` document in
// src/ is keyed on the signed-in user's OWN agent (or is dead), so no screen
// renders another user's agent from a client read — cross-user agent facts
// arrive only through server projections (team-card, battle-view, the backing
// team-label resolver).
//
// Two halves:
//   · SOURCE CENSUS — every file under src/ (tests and *.ARCHIVED.* aside) that
//     takes a top-level `agents` handle — collection(db, 'agents') or
//     doc(db, 'agents', id), the AGENTS_COLLECTION constant included — is in
//     the pinned table below with its ownership evidence; a NEW site (or a new
//     handle in a listed file) reds this row until it is routed through a
//     projection or added here with evidence. Every LIST query that is not an
//     addDoc create either filters on ownerId, or is the one DEAD reader named.
//   · THE FIRESTORE MOCK — the live query readers run against a stubbed
//     firebase/firestore: subscribeToUserAgent(uid) and assembleBoardPrefill(uid)
//     build exactly `where('ownerId', '==', uid)` on `agents` — own-scoped by
//     construction, never a bare scan; and the dead leaderboard reader, which
//     the rule now denies, degrades to [] rather than throwing.
//
// MUTATION CHECK: add `collection(db, 'agents')` to a new file, or drop the
// ownerId filter from subscribeToUserAgent → a row reds.
//
// Subcollection handles (agents/{id}/rules, /bundles, /battlePatterns) are OUT
// of this census: their rules already required the parent's ownerId to match
// (the get() in each subcollection rule), and this change did not touch them.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');

// ── the pinned census (2026-09-24; every line VERIFIED at its file:line) ─────
// handles = top-level `agents` collection/doc references (reads AND writers'
// refs, since a doc ref serves both); listQueries = collection(db, 'agents')
// occurrences, classified below.
const CENSUS = Object.freeze({
  'services/agentService.js': {
    handles: 15, listQueries: 5,
    evidence: 'subscribeToUserAgent: where(ownerId == uid) — every useAgent() caller passes user.uid / user.odUserId; '
      + 'subscribeToAgentDoc / getAgentById / directive+memory writers: by id — the deploy target is the owner\'s ranked agent or '
      + 'casual-agent-{uid} (ownerId = the player, api/_utils/casualClone.js); createAgent / seedTestAgent: addDoc creates; '
      + 'getLeaderboard: DEAD (archived caller only) — an unfiltered list the rule now denies.',
  },
  'components/Forge/ForgeLanding.jsx': {
    handles: 1, listQueries: 1,
    evidence: 'the default-tab existence check: where(ownerId == user.uid).',
  },
  'services/tournamentGroupService.js': {
    handles: 1, listQueries: 1,
    evidence: 'assembleBoardPrefill(uid): where(ownerId == uid) — BoardEditor passes the viewer\'s own uid (its own board).',
  },
  'hooks/useTraits.js': {
    handles: 2, listQueries: 0,
    evidence: 'equipped-traits load + battle-lock check on agentId = agent.id from useAgent(user.uid) (ForgeScreen, ForgeWorkshop, TraitsSheet).',
  },
  'services/forgeService.js': {
    handles: 2, listQueries: 0,
    evidence: 'resolveArchetypeForCompat + the touch-agent ref, on the Forge\'s own agentId.',
  },
  'screens/PitStopScreen.jsx': {
    handles: 1, listQueries: 0,
    evidence: 'the debrief bubble\'s agent name, on entry.agentId of the viewer\'s OWN season entry (App.jsx: seasonEntries where userId == user.uid).',
  },
});

// The only list queries allowed WITHOUT an ownerId filter: creates, and the
// one dead reader (its two queries).
const UNFILTERED_ALLOWED = Object.freeze({
  'services/agentService.js': ['createAgent', 'seedTestAgent', 'getLeaderboard', 'getLeaderboard'],
});

const HANDLE = /\b(collection|doc)\(\s*db\s*,\s*(?:'agents'|"agents"|AGENTS_COLLECTION)\s*(?:,\s*[^,()]+\s*)?\)/g;
const LIST = /\bcollection\(\s*db\s*,\s*(?:'agents'|"agents"|AGENTS_COLLECTION)\s*\)/g;

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const isSubject = (f) => !/\.(test|spec)\.[jt]sx?$|\.rules\.mjs$|\.ARCHIVED\.|__fixtures__|__mocks__/.test(f);

/** The nearest enclosing exported function name before `index` in `src`. */
function enclosingName(src, index) {
  const before = src.slice(0, index);
  const re = /export\s+(?:const|function|async\s+function)\s+(\w+)/g;
  let name = null;
  for (const m of before.matchAll(re)) name = m[1];
  return name;
}

describe('SOURCE CENSUS — every client `agents` handle is own-scoped (or dead), and the set is pinned', () => {
  const files = walk(SRC).filter(isSubject);
  const found = {};
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const handles = [...src.matchAll(HANDLE)].length;
    if (handles === 0) continue;
    found[path.relative(SRC, f)] = { handles, listQueries: [...src.matchAll(LIST)].length };
  }

  it('the set of files taking a top-level `agents` handle, and the handle counts, equal the pinned census (a new read site → route it through a projection, or add it here with evidence)', () => {
    const pinned = Object.fromEntries(Object.entries(CENSUS).map(([k, v]) => [k, { handles: v.handles, listQueries: v.listQueries }]));
    expect(found).toEqual(pinned);
  });

  it('every `agents` LIST query filters on ownerId, except a create (addDoc) and the one dead reader', () => {
    for (const rel of Object.keys(CENSUS)) {
      const src = stripComments(readFileSync(path.join(SRC, rel), 'utf8'));
      const unfiltered = [];
      for (const m of src.matchAll(LIST)) {
        const after = src.slice(m.index, m.index + 320);
        if (/where\(\s*'ownerId'\s*,\s*'=='\s*,/.test(after)) continue;
        unfiltered.push(enclosingName(src, m.index));
      }
      expect([...unfiltered].sort(), `${rel}: an agents list query without an ownerId filter`).toEqual([...(UNFILTERED_ALLOWED[rel] || [])].sort());
    }
  });

  it('the dead reader\'s only caller is archived, and nothing imports the archived component', () => {
    const live = walk(SRC).filter(isSubject).map((f) => [path.relative(SRC, f), stripComments(readFileSync(f, 'utf8'))]);
    const callers = live.filter(([rel, src]) => rel !== 'services/agentService.js' && /\bgetLeaderboard\b/.test(src)).map(([rel]) => rel);
    expect(callers).toEqual([]);
    const importers = live.filter(([, src]) => /AgentLeaderboardTab/.test(src)).map(([rel]) => rel);
    expect(importers).toEqual([]);
  });

  it('no client file reads an agent by ANOTHER user\'s id — every by-id handle is keyed on the signed-in user\'s own agent (pinned by file)', () => {
    // By-id handles outside agentService: useTraits (agentId from useAgent(user.uid)),
    // forgeService (the Forge's own agentId), PitStopScreen (the own season entry).
    // The pin is the census itself; this row keeps the evidence column honest —
    // every listed file names its scope.
    for (const [rel, row] of Object.entries(CENSUS)) {
      expect(row.evidence, `${rel}: no ownership evidence recorded`).toMatch(/own|uid|ownerId|DEAD/i);
    }
  });
});

// ── THE FIRESTORE MOCK — the live readers are own-scoped by construction ─────
const fs = vi.hoisted(() => ({ calls: [], getDocsImpl: null }));
vi.mock('../firebase/config', () => ({ auth: { currentUser: null }, db: { __handle: 'db' }, default: {} }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: vi.fn((_db, ...segments) => ({ kind: 'collection', segments })),
    doc: vi.fn((_db, ...segments) => ({ kind: 'doc', segments })),
    where: vi.fn((field, op, value) => ({ kind: 'where', field, op, value })),
    orderBy: vi.fn((field, dir) => ({ kind: 'orderBy', field, dir })),
    limit: vi.fn((n) => ({ kind: 'limit', n })),
    query: vi.fn((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
    onSnapshot: vi.fn((q, cb) => { fs.calls.push({ type: 'onSnapshot', q }); cb({ docs: [] }); return () => {}; }),
    getDocs: vi.fn(async (q) => { fs.calls.push({ type: 'getDocs', q }); if (fs.getDocsImpl) return fs.getDocsImpl(q); return { docs: [], empty: true }; }),
    getDoc: vi.fn(async (ref) => { fs.calls.push({ type: 'getDoc', ref }); return { exists: () => false, data: () => null }; }),
  };
});
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));

const agentsQueries = () => fs.calls
  .filter((c) => c.q && c.q.kind === 'query' && c.q.ref.segments[0] === 'agents' && c.q.ref.segments.length === 1)
  .map((c) => ({ type: c.type, constraints: c.q.constraints }));
const ownerFilter = (constraints, uid) => constraints.some((k) => k.kind === 'where' && k.field === 'ownerId' && k.op === '==' && k.value === uid);

describe('THE FIRESTORE MOCK — the live `agents` readers scope every query to the caller\'s own uid', () => {
  beforeEach(() => { fs.calls.length = 0; fs.getDocsImpl = null; });

  it('subscribeToUserAgent(uid) subscribes to `agents` with exactly where(ownerId == uid) — the rule admits it, and nothing broader', async () => {
    const { subscribeToUserAgent } = await import('./agentService');
    const unsub = subscribeToUserAgent('uid-me', () => {});
    unsub();
    const qs = agentsQueries();
    expect(qs).toHaveLength(1);
    expect(qs[0].type).toBe('onSnapshot');
    expect(ownerFilter(qs[0].constraints, 'uid-me')).toBe(true);
    expect(qs[0].constraints.filter((k) => k.kind === 'where')).toHaveLength(1);
  });

  it('assembleBoardPrefill(uid) reads `agents` with where(ownerId == uid) only — the viewer\'s own ranked agent', async () => {
    const { assembleBoardPrefill } = await import('./tournamentGroupService');
    await assembleBoardPrefill('uid-me', { userPool: ['NVDA'] });
    const qs = agentsQueries();
    expect(qs).toHaveLength(1);
    expect(qs[0].type).toBe('getDocs');
    expect(ownerFilter(qs[0].constraints, 'uid-me')).toBe(true);
    expect(qs[0].constraints.filter((k) => k.kind === 'where')).toHaveLength(1);
  });

  it('the dead leaderboard reader\'s queries carry NO ownerId filter (the rule denies them) and the denial degrades to [] — no screen can throw on it', async () => {
    fs.getDocsImpl = async () => { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getLeaderboard } = await import('./agentService');
    const rows = await getLeaderboard(50);
    errSpy.mockRestore();
    expect(rows).toEqual([]);
    const qs = agentsQueries();
    expect(qs.length).toBeGreaterThanOrEqual(1);
    for (const q of qs) expect(q.constraints.some((k) => k.kind === 'where' && k.field === 'ownerId')).toBe(false);
  });
});
