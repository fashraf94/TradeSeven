// src/App.agentBattlesPoll.test.js
//
// Regression guard for defect #2 (ruling R-T2-S11): the `activeAgentBattles`
// liveness poll must RETAIN its last-known-good state on a fetch error, not
// reset to []. A transient Firestore blip must not flip the "No battle live"
// card — and the battle-weather starfield that reads the same state — to calm
// for up to the 120s poll interval while a battle is genuinely live.
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
    // assignment (setActiveAgentBattles(battles)), not a reset.
    const setters = body.match(/setActiveAgentBattles\(/g) || [];
    expect(setters.length).toBe(1);
    expect(body).toMatch(/setActiveAgentBattles\(\s*battles\s*\)/);
  });
});
