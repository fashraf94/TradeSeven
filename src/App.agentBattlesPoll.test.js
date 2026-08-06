// src/App.agentBattlesPoll.test.js
//
// Regression guards for the `activeAgentBattles` liveness poll — the source the
// "No battle live" card reads and the battle-weather starfield reads. Two
// invariants, each paid for by a filed defect:
//
//   * defect #2 (ruling R-T2-S11): the poll must RETAIN its last-known-good
//     state on a fetch error, not reset to []. A transient Firestore blip must
//     not flip the card — and the sky that reads the same state — to calm for
//     up to the 120s poll interval while a battle is genuinely live.
//   * defect D-6 (Task 4 Phase 0 §11): the poll must NOT apply a server-side
//     limit() before its client-side training-clone filter. A user with ≥5
//     active training clones could have the limit return only clone docs, all
//     dropped by the filter → activeAgentBattles=[] while a ranked battle is
//     live (card lies; sky reads calm). A battle doc's only clone marker is its
//     agentId prefix, so the clones cannot be dropped server-side without a
//     range query + new composite index — hence the unbounded owner+status
//     query feeds the filter.
//
// WHY A SOURCE GUARD, NOT A BEHAVIOURAL TEST. The poll's error path is an inline
// `catch` inside an async closure inside a useEffect inside PortfolioDuel (the
// ~12k-line root component in src/App.jsx). It is not exported, and no test in
// the repo mounts App.jsx — reaching the catch at runtime would require standing
// up the whole app with firebase/auth mocked, i.e. new scaffolding the task's
// scope fence rules out. So this pins the fix the way the repo already guards
// un-mountable code: by asserting on source text (the cssTokens.test.js /
// tokens.guard.test.js idiom). It cannot prove the runtime behaviour, only that
// the reset-on-error line does not come back; the behaviour itself was verified
// by reading and is recorded in the build report.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(path.join(HERE, 'App.jsx'), 'utf8');

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The body of the `fetchAgentBattles` closure, comments stripped. */
function agentBattlesPollBody() {
  const start = APP.indexOf('const fetchAgentBattles = async () => {');
  expect(start, 'fetchAgentBattles closure must exist in App.jsx').toBeGreaterThan(-1);
  // The closure is immediately followed by its own invocation `fetchAgentBattles();`.
  const end = APP.indexOf('fetchAgentBattles();', start);
  expect(end, 'the fetchAgentBattles() invocation must follow the closure').toBeGreaterThan(start);
  return stripComments(APP.slice(start, end));
}

describe('defect #2 — agentBattles poll retains last-known-good on error', () => {
  const body = agentBattlesPollBody();

  it('does NOT reset activeAgentBattles to [] on a fetch error', () => {
    // The regression itself: setActiveAgentBattles([]) inside the catch is what
    // wrongly calmed the card/sky on a transient blip.
    expect(
      /setActiveAgentBattles\(\s*\[\s*\]\s*\)/.test(body),
      'the agentBattles poll must not blank its state — retain last-known-good (R-T2-S11)'
    ).toBe(false);
  });

  it('still logs the error (house console pattern)', () => {
    expect(body).toMatch(/catch\s*\(\s*error\s*\)\s*\{/);
    // The house pattern is console.error('<message>', error). Non-greedy across
    // the message (which itself contains parentheses) to the trailing `, error)`.
    expect(body).toMatch(/console\.error\([\s\S]*?,\s*error\s*\)/);
  });

  it('sets state only on the SUCCESS path, never in the catch', () => {
    // Exactly one setActiveAgentBattles call remains, and it is the success
    // assignment (setActiveAgentBattles(liveBattles) — the voided-group-excluded
    // list, L-A follow-up B), not a reset.
    const setters = body.match(/setActiveAgentBattles\(/g) || [];
    expect(setters.length).toBe(1);
    expect(body).toMatch(/setActiveAgentBattles\(\s*liveBattles\s*\)/);
  });
});

describe('L-A follow-up B — the poll excludes VOIDED-group battles (read-time group lookup)', () => {
  const body = agentBattlesPollBody();

  it('performs a READ-TIME group-status lookup (getDoc on tournamentGroups)', () => {
    // The void lives ONLY on the group doc — voidGroup never writes the battle doc
    // (the createAgentBattle shape is fenced), so the poll must look the group up
    // at read time to propagate the void to the live card.
    expect(body).toMatch(/getDoc\(/);
    expect(body).toMatch(/tournamentGroups/);
  });

  it('excludes via the shared pure helper and feeds the setter the EXCLUDED list', () => {
    expect(body).toMatch(/excludeVoidedGroupBattles\(/);
    expect(body).toMatch(/setActiveAgentBattles\(\s*liveBattles\s*\)/);
  });

  it('does NOT write the battle doc (fence: createAgentBattle shape) — the exclusion is read-only', () => {
    // The whole poll is a read (getDocs / getDoc). Any client write here would be
    // fence contact; assert there is none.
    expect(/\b(setDoc|updateDoc|addDoc)\s*\(/.test(body)).toBe(false);
  });
});

describe('defect D-6 — no server-side limit precedes the client-side clone filter', () => {
  const body = agentBattlesPollBody();

  it('does NOT apply a limit() to the agentBattles query', () => {
    // The regression: limit(5) (or any limit) runs on the SERVER, before the
    // training-clone filter runs on the CLIENT. A user with ≥5 active training
    // clones can have the limit return only clone docs, all dropped by the
    // filter → activeAgentBattles=[] while a ranked battle is live. The comment
    // block is comment-stripped before this assertion, so the word "limit" in
    // the explanatory prose cannot mask a re-added limit() CALL.
    expect(
      /\blimit\s*\(/.test(body),
      'the agentBattles poll must not limit before the client-side clone filter (D-6)'
    ).toBe(false);
  });

  it('still drops training-clone battles client-side (filter intact)', () => {
    // The fix must not "solve" the crowding by dropping the filter — that would
    // surface off-ladder training pods on the ranked dashboard.
    expect(body).toMatch(/\.filter\(/);
    expect(body).toMatch(/startsWith\(\s*TRAINING_CLONE_ID_PREFIX\s*\)/);
  });

  it('keeps the query scoped to the owner and active status', () => {
    // Removing the limit must not widen the read: the owner + status equality
    // filters are what keep the unbounded query small (and index-free).
    expect(body).toMatch(/where\(\s*['"]ownerId['"]\s*,\s*['"]==['"]/);
    expect(body).toMatch(/where\(\s*['"]status['"]\s*,\s*['"]==['"]\s*,\s*['"]active['"]/);
  });
});
