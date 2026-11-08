// src/config/perGameLoadoutFlags.test.js
//
// Build A2 — THE FLAG PIN (BUILD_RULES §2) for PER_GAME_LOADOUT_ENABLED (src/config/perGameLoadoutFlags.js).
// LIVE — TRUE since the armory flip, with AGENT_FORM_ARMORY_ENABLED in the same commit (founder rulings FL1 and FL2,
// Nov 7, 2026), and both stay as kill switches. The rollback is two steps: PER_GAME_LOADOUT_ENABLED alone back to
// false returns A1's armory with one loadout; both back to false returns the app as it was before the flip. The armory
// never goes off while per-game loadouts are on (the pin row). A rollback moves a flag and its pin; the DARK_BY_DESIGN
// entry stays out.
//
// The source rows are the kill switch's shape: they keep the flag-off build what it was before the flip, byte for byte.
// The flag is a literal in a module of its own (not featureFlags.js, whose namespace App.jsx keeps in the entry chunk),
// and every CLIENT read is a literal ternary that
// Rollup folds — at the exact sites listed here, so a new reader has to be added on purpose. The server's reads are
// listed too: each is an `if`, a ternary or an `&&` on the literal, and with it false every writer and reader runs
// today's code (the flag-off rows in each suite).

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PER_GAME_LOADOUT_ENABLED } from './perGameLoadoutFlags.js';
import { AGENT_FORM_ARMORY_ENABLED } from './agentFormFlags.js';
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const FLAG = 'PER_GAME_LOADOUT_ENABLED';

/** Every non-comment line of a source that names the flag, minus its import. */
const readsOf = (rel) => strip(read(rel)).split('\n')
  .filter((line) => line.includes(FLAG) && !/^\s*import\b/.test(line))
  .map((line) => line.trim());

/** Every .js / .jsx file under `dir` (repo-relative), tests and fixtures excluded. */
function sourcesUnder(dir) {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(path.join(ROOT, rel))) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const child = `${rel}/${name}`;
      if (statSync(path.join(ROOT, child)).isDirectory()) { walk(child); continue; }
      if (/\.(jsx?|mjs)$/.test(name) && !/\.test\.|__fixtures__|__mocks__/.test(child)) out.push(child);
    }
  };
  walk(dir);
  return out;
}

describe('PER_GAME_LOADOUT_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is live: true since the flip, a kill switch (back to false alone returns A1\'s armory with one loadout)', () => {
    expect(PER_GAME_LOADOUT_ENABLED).toBe(true);
  });

  it('is the module\'s literal, in a module of its own, and featureFlags.js carries none', () => {
    expect(read('src/config/perGameLoadoutFlags.js')).toMatch(/^export const PER_GAME_LOADOUT_ENABLED = (?:true|false);$/m);
    expect(read('src/config/featureFlags.js')).not.toMatch(/PER_GAME_LOADOUT/);
    expect(strip(read('src/config/perGameLoadoutFlags.js'))).not.toMatch(/^\s*import\b/m);
  });

  it('flagPinGuard no longer lists it as dark by design, and still registers its module (a rollback leaves the entry out)', () => {
    const guard = read('src/config/flagPinGuard.test.js');
    expect(guard).not.toMatch(/\n {2}PER_GAME_LOADOUT_ENABLED:\n/);
    expect(guard).toMatch(/'src\/config\/perGameLoadoutFlags\.js',/);
  });

  it('is on only while the armory is on (the hub\'s surfaces sit behind both): the armory never goes off while per-game loadouts are on', () => {
    expect(!PER_GAME_LOADOUT_ENABLED || AGENT_FORM_ARMORY_ENABLED).toBe(true);
  });

  it('is on only while casual clones are on (FL3)', () => {
    // The BaggerBomb loadout is applied only on the casual clone (api/_utils/casualClone.js), and the deploy's refusal
    // (src/services/agentDeploy.js, A2R-3 (b)) sits inside the clone path. With CASUAL_CLONE_CONCURRENCY_ENABLED off,
    // every BaggerBomb deploy runs on the ranked record in the League loadout.
    expect(
      !PER_GAME_LOADOUT_ENABLED || CASUAL_CLONE_CONCURRENCY_ENABLED,
      'FL3: per-game loadouts never run without casual clones. With CASUAL_CLONE_CONCURRENCY_ENABLED off, every BaggerBomb deploy runs on the ranked record in the League loadout (the BaggerBomb loadout lives only on the clone). Turn PER_GAME_LOADOUT_ENABLED off (with its pin) before casual clones.',
    ).toBe(true);
  });
});

/**
 * The server's reads, exact. Each one leaves today's code path when the literal is false: the `loadout` field is not
 * read, the lock is not queried, the slot is not snapshotted or applied, the training override and the ledger's
 * predicate are today's.
 */
const SERVER_READS = {
  'api/agent/change-archetype.js': [
    'if (PER_GAME_LOADOUT_ENABLED && code === LEAGUE_LOCKED) return [409, leagueLockedBody(txErr.lock)];',
    'const loadout = PER_GAME_LOADOUT_ENABLED ? loadoutKindOf(req.body?.loadout) : LOADOUT_KINDS.LEAGUE;',
    'if (PER_GAME_LOADOUT_ENABLED) {',
    '...(PER_GAME_LOADOUT_ENABLED ? materializeOnLeagueWrite(agent) : {}),',
  ],
  'api/agent/equip-watchlist.js': [
    'if (PER_GAME_LOADOUT_ENABLED && code === LEAGUE_LOCKED) return [409, leagueLockedBody(txErr.lock)];',
    'const loadout = PER_GAME_LOADOUT_ENABLED ? loadoutKindOf(req.body?.loadout) : LOADOUT_KINDS.LEAGUE;',
    'if (PER_GAME_LOADOUT_ENABLED) {',
    '...(PER_GAME_LOADOUT_ENABLED ? materializeOnLeagueWrite(agent) : {}),',
  ],
  'api/agent/unequip-watchlist.js': [
    'if (PER_GAME_LOADOUT_ENABLED && code === LEAGUE_LOCKED) return [409, leagueLockedBody(txErr.lock)];',
    'const loadout = PER_GAME_LOADOUT_ENABLED ? loadoutKindOf(req.body?.loadout) : LOADOUT_KINDS.LEAGUE;',
    'if (PER_GAME_LOADOUT_ENABLED) {',
    '...(PER_GAME_LOADOUT_ENABLED ? materializeOnLeagueWrite(agent) : {}),',
  ],
  'api/_utils/casualClone.js': [
    '...(PER_GAME_LOADOUT_ENABLED ? applyBaggerbombLoadout(loadout, rankedAgent) : loadout),',
    'return PER_GAME_LOADOUT_ENABLED ? applyBaggerbombLoadout(out, rankedAgent) : out;',
    'if (PER_GAME_LOADOUT_ENABLED) {',
    'if (PER_GAME_LOADOUT_ENABLED) {',
  ],
  'api/_utils/trainingClone.js': [
    'const loadoutSpec = PER_GAME_LOADOUT_ENABLED ? null : (loadoutSpecByUser ? loadoutSpecByUser[odUserId] : null);',
  ],
  'api/tournament/lobby-quickplay-training.js': [
    'const shape = PER_GAME_LOADOUT_ENABLED ? { valid: true, value: null } : validateLoadoutSpecShape(body?.loadoutSpec);',
  ],
  'api/_utils/filmRoom/cardStore.js': [
    'return { data, archetype, shelf: PER_GAME_LOADOUT_ENABLED ? loadoutArchetypesOf(data) : archetype };',
    "if (PER_GAME_LOADOUT_ENABLED ? payload.archetypeCodeId !== battleArchetype : payload.archetypeCodeId !== agent.archetype) throw fail(409, 'archetype_changed', { archetypeCodeId: payload.archetypeCodeId, current: PER_GAME_LOADOUT_ENABLED ? battleArchetype : agent.archetype });",
  ],
};

/**
 * The client's reads: each a literal ternary (or `FLAG && …` inside one) that Rollup folds to today's expression — and
 * two literal `if`s in agentDeploy.js: A2R-3 (b)'s refusal, whose test folds to false, so the statement leaves the
 * bundle; and FL4-b's `if (FLAG) try {…} catch {…} else try {…} catch {…}` (founder ruling, Nov 7 2026), whose else arm
 * is today's clone-ensure block verbatim. Rollup keeps a ternary inside a `try` as written (tryCatchDeoptimization), so
 * FL4's log lines choose the whole block outside it instead; flag off, Rollup cuts `if (…) … else ` and leaves the else
 * arm's text. The lobbies' A2R-1 reads swap the group read for one that tells a failure apart, count a failure as a
 * known seat, and provide the line's group-known context; each flag-off arm is today's text.
 */
const CLIENT_READS = {
  "src/adapters/baggerbombAdapter.js": [
    "archetype: PER_GAME_LOADOUT_ENABLED ? battle?.agentContext?.archetype ?? agent?.archetype ?? null : agent?.archetype ?? battle?.agentContext?.archetype ?? null,",
  ],
  "src/App.jsx": [
    "agentLoadout={primaryAgent ? (PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? { name: primaryAgent.name, archetype: primaryAgent.archetype, equippedWatchlistId: primaryAgent.equippedWatchlistId, equippedWatchlistName: primaryAgent.equippedWatchlistName, openLoadout: () => setScreen('dashboard') } : { name: primaryAgent.name, archetype: primaryAgent.archetype, equippedWatchlistId: primaryAgent.equippedWatchlistId, equippedWatchlistName: primaryAgent.equippedWatchlistName }) : null}",
  ],
  "src/components/CommandCenter/Armory.jsx": [
    "const card = PER_GAME_LOADOUT_ENABLED ? armoryCardOf(use(PerGameLoadoutContext)) : null;",
    "const card = PER_GAME_LOADOUT_ENABLED ? armoryCardOf(use(PerGameLoadoutContext)) : null;",
  ],
  "src/components/CommandCenter/CommandCenterHub.jsx": [
    "loadoutLine: PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? scopeDeployLine(use(PerGameLoadoutContext)) ?? loadoutLineOf(sections.loadout) : loadoutLineOf(sections.loadout),",
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
    "const panel = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
    "deploy: PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
    "PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
  ],
  "src/components/CommandCenter/hub/useHubRuntime.js": [
    "loadout: loadout.status === LOADOUT_STATUS.READY ? { ...loadout, summary: PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? scopeSummary(use(PerGameLoadoutContext)) ?? loadoutLineOf(loadout) : loadoutLineOf(loadout) } : loadout,",
    "changeArchetype: (PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? ready : unlocked) ? sheets.open(HUB_SHEETS.ARCHETYPE) : undefined,",
    "changeWatchlist: (PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? ready : unlocked) ? sheets.open(HUB_SHEETS.WATCHLIST) : undefined,",
  ],
  "src/components/CommandCenter/LoadoutSheets.jsx": [
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
  ],
  "src/components/CommandCenter/panels/LoadoutPanel.jsx": [
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? null : (",
  ],
  "src/components/CommandCenter/sections/DeploySection.jsx": [
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? <DeployLoadoutLine onOpen={onOpenLoadout} /> : (",
  ],
  "src/components/League/LeagueDeskParts.jsx": [
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? <TrainingLoadoutSlot agentLoadout={agentLoadout} /> : (",
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? null : (",
  ],
  "src/components/League/leagueLoadoutSlot.jsx": [
    "const LazyLeagueLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED",
    "const LazyTrainingLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED",
    "export const LeagueGroupKnownContext = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED",
  ],
  "src/components/League/LeagueHome.jsx": [
    "return PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED",
    "const seatKnown = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? !uid || seatFor === uid || seatFor?.failedFor === uid : !uid || seatFor === uid;",
    ": PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? <LeagueGroupKnownContext.Provider value={!uid || seatFor === uid}>{lobby}</LeagueGroupKnownContext.Provider> : lobby;",
  ],
  "src/components/League/LeagueLobbyDesktop.jsx": [
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
    "return PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED",
    "const seatKnown = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? !uid || seatFor === uid || seatFor?.failedFor === uid : !uid || seatFor === uid;",
    "return PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
  ],
  "src/components/League/LeagueLobbyRedesign.jsx": [
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? <TrainingLoadoutSlot agentLoadout={agentLoadout} /> : (",
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? null : (",
    "{PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED ? (",
  ],
  "src/services/agentDeploy.js": [
    'if (PER_GAME_LOADOUT_ENABLED) try {',
    "if (PER_GAME_LOADOUT_ENABLED && cloneId === null) return { outcome: DEPLOY_OUTCOMES.REFUSED, success: false, postIssued: false, error: 'casual_clone_unavailable', details: LOADOUT_COPY.deployCloneFailed };",
  ],
};

describe('PER_GAME_LOADOUT_ENABLED — every read, exact', () => {
  for (const [file, lines] of Object.entries(SERVER_READS)) {
    it(`${file}: the server's reads`, () => {
      expect(readsOf(file)).toEqual(lines);
    });
  }

  for (const [file, lines] of Object.entries(CLIENT_READS)) {
    it(`${file}: the client's reads, each a literal ternary`, () => {
      expect(readsOf(file)).toEqual(lines);
      // the ternary's `?` on the line, or opening the next (a multi-line declaration); or FL4-b's `if (FLAG) try {`
      for (const line of lines) expect(line).toMatch(/PER_GAME_LOADOUT_ENABLED(?: && AGENT_FORM_ARMORY_ENABLED)?(?: && [^?]+)?(?: \?|\) try \{$|$)/);
    });
  }

  it('nothing else under api/ or src/ reads it', () => {
    const readers = [...sourcesUnder('api'), ...sourcesUnder('src')]
      .filter((rel) => rel !== 'src/config/perGameLoadoutFlags.js' && readsOf(rel).length > 0)
      .sort();
    expect(readers).toEqual([...Object.keys(SERVER_READS), ...Object.keys(CLIENT_READS)].sort());
  });
});
