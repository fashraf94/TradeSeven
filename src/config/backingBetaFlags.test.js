// src/config/backingBetaFlags.test.js
//
// Backing Beta PR 1 — BACKING_BETA_ENABLED: THE FLAG PIN (BUILD_RULES §2).
//
// BACKING_BETA_ENABLED ships FALSE by design (spec V1.3 §12 / §11, as amended
// by Amendment A §A7): PR 1–5 all merge dark and the founder flips it —
// together with ELIGIBILITY_ATTESTATION_ENABLED — in the flip PR after every
// §11 gate. The flag-pin guard (flagPinGuard.test.js) tracks this row against
// the live value and, because the flag sits in DARK_BY_DESIGN there, an
// accidental flip fails loudly with the runway note; a DELIBERATE flip moves
// the first row below to `true` and drops the DARK_BY_DESIGN entry in the same
// commit.
//
// Deliberately pins ONLY this flag (the eligibilityFlags.test.js / showItFlags
// precedent): pinning a flag obliges its docstring to name this file, so an
// unrelated flag added here "as context" would couple its future flip to this
// arc. ELIGIBILITY_ATTESTATION_ENABLED (PR 0) keeps its own pin suite — the two
// flags flip in one commit but are pinned apart.
//
// PR 1 HAD NO DOOR; PR 2 LANDED THE FIRST TWO, and the rows below moved with
// it — in PR 2's own commit, exactly as each of their comments instructed
// (BUILD_RULES §2's same-commit pin discipline, applied to a darkness pin
// rather than to a flag value).
//
// The substantive claim is therefore no longer "there is no door" but "EVERY
// door is gated, and the enumeration of what can reach the foundation is
// complete":
//   · every backing route under api/ reads the flag at CALL time, inside its
//     handler, AFTER auth, and is covered by a darkness suite;
//   · no backing HELPER reads the flag — the routes gate, the helpers do not,
//     so a flag read in a helper would be a second gate no dark suite covers;
//   · the importer lists are enumerated exactly, so an unreviewed caller (a
//     cron, a client bundle, a new endpoint) reds a row rather than shipping;
//   · and the CLIENT importers are enumerated too: PR 4 landed the backing
//     surfaces, which read the zero-import CONSTANTS module (and only it) —
//     no client file imports any api/ backing helper, and every client
//     importer lives under the backing surfaces or their hooks.
// PR 3–5 extend these lists in their own commits; they never delete the rows.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BACKING_BETA_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/** Every non-test .js source under api/ and src/ (the PR 0 walker's shape). */
function listSources(dirRel) {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === '__fixtures__') continue;
      const next = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(next);
      // `.jsx` TOO, and that is the whole point of the rows below. `src/` holds
      // more .jsx than .js, PR 4's backing surfaces WILL be .jsx, and a walker
      // blind to them makes "no client importer" unfalsifiable at exactly the
      // moment it matters. This is the spelling the sibling walker this file
      // cites as its precedent already uses (attest.dark.test.js).
      else if (/\.(js|jsx|mjs)$/.test(ent.name) && !ent.name.includes('.test.')) {
        out.push(path.relative(REPO_ROOT, next).split(path.sep).join('/'));
      }
    }
  };
  walk(path.join(REPO_ROOT, dirRel));
  return out;
}
const SOURCES = [...listSources('api'), ...listSources('src')];

// Every non-test source importing `targetRel`, each specifier RESOLVED against
// the importing file's own directory, so a sibling `./x.js` counts exactly like
// a parent `../_utils/x.js` (the PR 0 attest.dark.test.js helper).
const IMPORT_FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const IMPORT_CALL_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
function importersOf(targetRel) {
  const target = path.join(REPO_ROOT, targetRel);
  return SOURCES.filter((rel) => {
    const src = read(rel);
    const dir = path.dirname(path.join(REPO_ROOT, rel));
    for (const re of [IMPORT_FROM_RE, IMPORT_CALL_RE]) {
      for (const m of src.matchAll(re)) {
        if (!m[1].startsWith('.')) continue;
        // Backing Beta PR 4: client modules import EXTENSIONLESS
        // (`'../constants/backing'`, the src/ convention), which the
        // extension-only resolution above could never see — so "no client
        // importer" was unfalsifiable at exactly the moment PR 4 added
        // client importers. Resolve the bare, `.js`, `.jsx` and index spellings.
        const abs = path.resolve(dir, m[1]);
        if ([abs, `${abs}.js`, `${abs}.jsx`, path.join(abs, 'index.js')].includes(target)) return true;
      }
    }
    return false;
  }).sort();
}

/** Route files anywhere under api/ whose path names `token`. */
function routesNamed(token) {
  return listSources('api')
    .filter((rel) => !rel.startsWith('api/_utils/') && rel.includes(token))
    .sort();
}

describe('Backing Beta PR 1 flag — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: BACKING_BETA_ENABLED is false at merge (spec V1.3 §12 — the flip PR flips it after every §11 gate)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(BACKING_BETA_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof BACKING_BETA_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const BACKING_BETA_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the flip map and the DARK_BY_DESIGN entry', () => {
    const idx = SRC.indexOf('export const BACKING_BETA_ENABLED');
    expect(idx).toBeGreaterThan(-1);
    // THIS flag's own docstring — bounded below by the previous `export const`
    // (the flag-pin guard's docstringWindow rule), so a neighbour's FLIP MAP
    // (ELIGIBILITY_ATTESTATION_ENABLED sits directly above) can never satisfy
    // these rows on this flag's behalf.
    const prevExport = SRC.lastIndexOf('\nexport const ', idx - 2);
    const window = SRC.slice(prevExport + 1, idx);
    expect(window).toContain('Pinned by: backingBetaFlags.test.js');
    expect(window).toContain('FLIP MAP');
    expect(window).toContain('DARK_BY_DESIGN');
    // …and the entry itself EXISTS. The guard's integrity test only validates
    // entries that ARE listed, so DELETING this one reddened nothing anywhere —
    // silently downgrading an accidental flip's message from the intent-aware
    // runway note to the generic one. The flip PR drops it deliberately, and
    // moves this row in the same commit.
    const guard = read('src/config/flagPinGuard.test.js');
    expect(guard).toMatch(/^\s*BACKING_BETA_ENABLED:$/m);
    // The routes' darkness is the flag's whole promise from PR 2 on; the
    // docstring says so even while PR 1 has no route to darken. Grepping the
    // 4-character token `404s` alone also matched a docstring rewritten to say
    // the routes 404 BEFORE auth and that PR 1 ships an ungated route — the
    // opposite of the contract — so the claim is pinned as a whole phrase.
    expect(window).toContain('404s while this is false, AFTER auth');
    expect(window).not.toMatch(/404s?[^.]*BEFORE auth/);
  });

  it('the docstring states that PR 1 adds no door — the honest FLIP MAP for a foundation PR', () => {
    const idx = SRC.indexOf('export const BACKING_BETA_ENABLED');
    const prevExport = SRC.lastIndexOf('\nexport const ', idx - 2);
    const window = SRC.slice(prevExport + 1, idx);
    // A FLIP MAP that listed doors this PR does not ship would be the copy
    // equivalent of a stale cron header (BUILD_RULES §6): a future reader must
    // not be able to infer a PR-1 surface from it.
    expect(window).toContain('PR 1 ADDS NO DOOR');
    // The WHOLE PR-1 line, not just its prefix: `toMatch(/PR 1 — NONE/)` also
    // matched "PR 1 — NONE (this PR). GET /api/... ships here.", so the row
    // could not fail under the very defect it names.
    const pr1Line = window.split('\n').find((l) => l.includes('PR 1 —'));
    expect(pr1Line.trim()).toBe('*   · PR 1 — NONE (this PR). Foundation only; no endpoint, no UI, no caller.');
    // And no route path may appear on ANY per-PR line attributed to PR 1.
    expect(pr1Line).not.toMatch(/\/api\//);
  });

  it('no backing HELPER reads the flag — the routes gate, the foundation does not', () => {
    // BUILD_RULES §2 mutation check: this row fails the moment a PR-1 module
    // imports the flag, which is exactly the event that should be deliberate.
    // Scoped to THIS PR's modules by name; PR 2–5 add their own readers and
    // their own dark suites, and will delete the module they light from this
    // list — never the row.
    const PR1_MODULES = [
      'api/_utils/backingWallet.js',
      'api/_utils/backingWeek.js',
      'src/constants/backing.js',
      // PR 2's helpers join the list rather than leaving it: the ROUTES gate,
      // the helpers do not, so a flag read appearing in one of these would be a
      // second gate that no dark suite covers.
      'api/_utils/backingPools.js',
      'api/_utils/backingEligibility.js',
      'api/_utils/backingFingerprint.js',
      // PR 3's settlement primitive: the Friday duty hook, the pod list and
      // the admin route each read the flag at THEIR call site; the primitive
      // reads only TOURNAMENT_ADVANCEMENT_FROZEN (A-C13), never this one.
      'api/_utils/backingSettlement.js',
    ];
    for (const rel of PR1_MODULES) {
      const text = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      expect(text, `${rel} reads BACKING_BETA_ENABLED — PR 1 gates nothing (spec V1.3 §12 PR 1)`)
        .not.toContain('BACKING_BETA_ENABLED');
    }
  });

  it('EVERY backing route under api/ reads the flag at CALL time and ships a dark suite', () => {
    // WAS "no backing endpoint exists yet - PR 1 ships no route to gate", and
    // PR 2 moved it in its own commit, exactly as that row's comment instructed.
    // The claim is STRONGER, not weaker: instead of counting zero routes it now
    // holds every route that exists to the gated-read discipline, so PR 3-5 must
    // move it again only to ADD their routes to the list.
    //
    // Scoped to ALL of api/, not just api/tournament/, so PR 5's `api/backing/`
    // directory cannot land a route this row is blind to.
    expect(routesNamed('backing'), 'a backing route appeared under api/ - add it here WITH its 404-while-dark suite')
      .toEqual([
        'api/tournament/backing-pools.js',
        // PR 3: the admin re-run. Admin-gated (requireAdminSecret) rather than
        // user-authed, and it 404s AFTER that gate like every other door.
        'api/tournament/backing-settle.js',
        'api/tournament/backing-stake.js',
      ]);

    for (const rel of routesNamed('backing')) {
      // CODE ONLY: comments are stripped before any index check, so a comment
      // that names `requireAdminSecret(req, res)` above a flag read that has
      // been moved AHEAD of auth cannot satisfy this row (PR 3 review lens C,
      // F3 — the row was comment-vacuous; the dark suites were its only
      // backstop). The block-comment strip runs first so a `//` inside a
      // block comment cannot leave a dangling fragment.
      const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      // The call-time read, inside the handler, in the SHOW_IT / research.js
      // shape - never a module-scope derivation and never an accessor.
      expect(src, `${rel} does not 404 on the flag`)
        .toContain('if (!BACKING_BETA_ENABLED) return res.status(404)');
      // ...and it is checked AFTER auth: the auth call must precede the flag
      // read in the source, or an anonymous caller is answered differently
      // while dark and while lit - a free oracle on the rollout state. A
      // user route authenticates with requireAuth, an admin route with
      // requireAdminSecret; every route must carry exactly one of them, and
      // an absent call (indexOf -1) must never pass this row vacuously.
      const authAt = Math.max(src.indexOf('await requireAuth('), src.indexOf('requireAdminSecret(req, res)'));
      expect(authAt, `${rel} carries no auth call before the flag`).toBeGreaterThan(-1);
      expect(authAt, `${rel} reads the flag before auth`)
        .toBeLessThan(src.indexOf('if (!BACKING_BETA_ENABLED)'));
    }

    // And the darkness is proved by a suite, not by a reviewer's reading. The
    // two PR 2 routes are covered by the shared PR 2 darkness file; the PR 3
    // admin route by its own.
    const dark = read('api/tournament/backing-stake.dark.test.js');
    expect(dark).toContain('./backing-stake.js');
    expect(dark).toContain('./backing-pools.js');
    const settleDark = read('api/tournament/backing-settle.dark.test.js');
    expect(settleDark).toContain('./backing-settle.js');
    expect(settleDark).toContain('BACKING_BETA_ENABLED: false');
  });

  it('EVERY importer of the backing modules is enumerated — the "no unreviewed caller" ratchet (the PR 0 importersOf precedent)', () => {
    // THE ROW THAT MAKES THE DARKNESS A RATCHET RATHER THAN A PROMISE.
    // api/_utils/backingWallet.js:57 and api/_utils/backingWeek.js:9 both state
    // that nothing in PR 1 calls them. Before this row that was prose: wiring
    // `touchWallet` — the one function here that opens a transaction and WRITES
    // backingWallets/{walletId} — into a production cron left the entire suite
    // green. PR 0 mechanized the same claim (api/eligibility/attest.dark.test.js
    // :140-151); this is that helper's shape, applied to PR 1's three modules.
    //
    // PR 2 added the first importers and moved this row in its own commit;
    // PR 3-5 do the same. The row never becomes a promise again.
    // PR 2 MOVED THESE LISTS, in its own commit, as the comment above instructs.
    // They are still a ratchet: every importer is named, so a SIXTH one (a cron,
    // a client bundle, an unreviewed endpoint) reds this row. PR 3-5 extend the
    // lists the same way - never delete the rows.
    expect(importersOf('api/_utils/backingWallet.js')).toEqual([
      'api/_utils/backingPools.js',
      // PR 3: settlement composes creditPayout + recordStakeLoss inside its
      // own transaction (the PR 1 threading contract's third caller).
      'api/_utils/backingSettlement.js',
      // PR 3: the admin route maps BackingLedgerError to a typed refusal.
      'api/tournament/backing-settle.js',
      'api/tournament/backing-stake.js',
    ]);
    expect(importersOf('api/_utils/backingWeek.js')).toEqual([
      'api/_utils/backingPools.js',
      'api/_utils/backingWallet.js',
      'api/tournament/backing-pools.js',
      'api/tournament/backing-stake.js',
    ]);
    expect(importersOf('src/constants/backing.js')).toEqual([
      'api/_utils/backingPools.js',
      'api/_utils/backingWallet.js',
      'api/_utils/backingWeek.js',
      'api/tournament/backing-pools.js',
      'api/tournament/backing-stake.js',
      // PR 4 — the team-card projection reads FORBIDDEN_TERMS: an archetype's
      // canonical approach line leaves the route only when it passes the
      // backing lexicon (DOM-2 in the PR 4 review record).
      'api/tournament/team-card.js',
      // PR 4 — THE SURFACE PR. The client reads the constants module for the
      // disclosures, the fine print, the §B6 strip lines, the economy's
      // bounds and the 24-hour rule; every one of these mounts only behind
      // BACKING_BETA_ENABLED (read at call time in the hosts).
      'src/components/League/backing/BackingParts.jsx',
      'src/components/League/backing/BackingScreen.jsx',
      'src/components/League/backing/PodList.jsx',
      'src/components/League/backing/StakeControl.jsx',
      'src/components/League/backing/backingCopy.js',
      'src/components/League/backing/backingStripState.js',
      'src/hooks/useBackingWallet.js',
    ]);
    // PR 2's own modules, listed for the same reason: the surface is enumerated,
    // so a new reachable caller is a deliberate edit here.
    expect(importersOf('api/_utils/backingPools.js')).toEqual([
      'api/_utils/backingEligibility.js',
      // PR 3: settlement reads the pool/totals refs and runs ensureClosed.
      'api/_utils/backingSettlement.js',
      'api/tournament/backing-pools.js',
      // PR 3: the admin route reads the group (the sim-requires-dev belt) and
      // maps BackingPoolError.
      'api/tournament/backing-settle.js',
      'api/tournament/backing-stake.js',
      // PR 4: the team-card projection reads the pod (readGroup) and derives
      // the seats through the ONE seat derivation (liveTeamsFor) — reads only.
      'api/tournament/team-card.js',
    ]);
    // PR 3's own module — THE THREE HOSTS, and nothing else: the Friday duty
    // hook (the one non-backing importer, and the whole reason H1 exists), the
    // pod list's settle-on-read, and the admin re-run. A fourth importer would
    // be a fourth settlement host, which is exactly the review this row is for.
    expect(importersOf('api/_utils/backingSettlement.js')).toEqual([
      'api/_utils/tournamentAdvancement.js',
      'api/tournament/backing-pools.js',
      'api/tournament/backing-settle.js',
    ]);
    expect(importersOf('api/_utils/backingEligibility.js')).toEqual([
      // attest.js reads the sign-in-provider helper for Amendment A §A3.
      'api/eligibility/attest.js',
      'api/tournament/backing-stake.js',
    ]);
    expect(importersOf('api/_utils/backingFingerprint.js')).toEqual(['api/tournament/backing-stake.js']);
    // NO CLIENT IMPORTER OF ANY api/ BACKING HELPER — still true after PR 4:
    // the surfaces reach the layer through endpoints and the rules-granted
    // Firestore reads, never by importing server modules into a bundle.
    for (const target of [
      'api/_utils/backingWallet.js', 'api/_utils/backingWeek.js',
      'api/_utils/backingPools.js', 'api/_utils/backingEligibility.js',
      'api/_utils/backingFingerprint.js', 'api/_utils/backingSettlement.js',
      'api/_utils/teamPitch.js',
    ]) {
      expect(importersOf(target).filter((rel) => rel.startsWith('src/')), `${target} is imported from src/`)
        .toEqual([]);
    }
    // And every CLIENT importer of the constants module is a backing surface
    // or one of its hooks — a stray importer elsewhere in src/ reds this row.
    for (const rel of importersOf('src/constants/backing.js').filter((r) => r.startsWith('src/'))) {
      expect(rel.startsWith('src/components/League/backing/') || rel.startsWith('src/hooks/use'), `${rel} imports the backing constants from outside the backing surfaces`).toBe(true);
    }
  });

  it('the importer walk sees EXTENSIONLESS client spellings — the row above is not vacuous for src/', () => {
    // useBackingWallet.js imports `'../constants/backing'` with no extension;
    // a walker blind to that spelling would report zero client importers and
    // pass the enumeration above for the wrong reason.
    expect(importersOf('src/constants/backing.js')).toContain('src/hooks/useBackingWallet.js');
  });

  it('every HOST that mounts a backing surface is enumerated — the client half of the ratchet (DARK-3 in the PR 4 review record)', () => {
    // The three gated mounts, by exact host…
    expect(importersOf('src/components/League/backing/BackingLandingStrip.jsx')).toEqual(['src/components/League/LeagueHome.jsx', 'src/components/League/LeagueLobbyDesktop.jsx']);
    expect(importersOf('src/components/League/backing/BackingScreen.jsx')).toEqual(['src/components/League/LeagueHome.jsx', 'src/components/League/LeagueLobbyDesktop.jsx']);
    expect(importersOf('src/components/League/backing/ScoutingLine.jsx')).toEqual(['src/components/Dashboard/EquipStation.jsx', 'src/components/Dashboard/desktop/IdentityPanel.jsx']);
    // …the service, by exact importer…
    expect(importersOf('src/services/backingService.js')).toEqual([
      'src/components/League/LeagueHome.jsx',
      'src/components/League/LeagueLobbyDesktop.jsx',
      'src/components/League/backing/AttestationStep.jsx',
      'src/components/League/backing/StakeControl.jsx',
      'src/hooks/useBackingPods.js',
      'src/hooks/useBackingWallet.js',
      'src/hooks/useEligibility.js',
      'src/hooks/useMyBacking.js',
      'src/hooks/useMyPitch.js',
      'src/hooks/useTeamCard.js',
    ]);
    // …and NOTHING outside the backing surfaces, their six hooks and these
    // hosts reaches any backing module. A new host is a deliberate edit here,
    // and it is held to the dark contract (backingDark.test.jsx) on arrival.
    const HOSTS = new Set([
      'src/components/Dashboard/EquipStation.jsx',
      'src/components/Dashboard/desktop/IdentityPanel.jsx',
      'src/components/League/LeagueHome.jsx',
      'src/components/League/LeagueLobbyDesktop.jsx',
      'src/components/League/LeaguePod.jsx',
    ]);
    const BACKING_HOOK = /^src\/hooks\/use(BackingPods|MyBacking|BackingWallet|Eligibility|MyPitch|TeamCard)\.js$/;
    const targets = [
      ...listSources('src/components/League/backing'),
      ...SOURCES.filter((rel) => BACKING_HOOK.test(rel)),
      'src/services/backingService.js',
    ];
    expect(targets.length).toBeGreaterThan(15);
    for (const target of targets) {
      for (const rel of importersOf(target)) {
        if (rel.startsWith('src/components/League/backing/') || BACKING_HOOK.test(rel)) continue;
        expect(HOSTS.has(rel), `${rel} reaches ${target} from outside the enumerated hosts`).toBe(true);
      }
    }
  });

  it('the two PR 4 routes read the flag at CALL time, after auth, and share a darkness suite', () => {
    // Their paths carry no `backing` token, so the routesNamed row above
    // cannot see them; they are held to the same discipline by name.
    const PR4_ROUTES = ['api/tournament/team-card.js', 'api/team/pitch.js'];
    for (const rel of PR4_ROUTES) {
      const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src, `${rel} does not 404 on the flag`).toContain('if (!BACKING_BETA_ENABLED) return res.status(404)');
      const authAt = src.indexOf('await requireAuth(');
      expect(authAt, `${rel} carries no auth call before the flag`).toBeGreaterThan(-1);
      expect(authAt, `${rel} reads the flag before auth`).toBeLessThan(src.indexOf('if (!BACKING_BETA_ENABLED)'));
    }
    const dark = read('api/tournament/team-card.dark.test.js');
    expect(dark).toContain('./team-card.js');
    expect(dark).toContain('../team/pitch.js');
    expect(dark).toContain('BACKING_BETA_ENABLED: false');
  });

  it('the importer walk is not vacuous — it resolves sibling and parent spellings alike', () => {
    // Without this, the rows above could pass by simply never matching anything
    // (BUILD_RULES §2). firebaseAdmin.js is imported as `./firebaseAdmin.js` by
    // one file and `../_utils/firebaseAdmin.js` by another; a walker blind to
    // either spelling fails here before it can pass vacuously above.
    const importers = importersOf('api/_utils/firebaseAdmin.js');
    expect(importers).toContain('api/_utils/authMiddleware.js');
    expect(importers.length).toBeGreaterThan(1);
  });

  it('no `@/` ALIAS import reaches the PR 1 modules either — the spelling importersOf cannot resolve', () => {
    // DOCUMENTED LIMIT, closed rather than left open: importersOf only resolves
    // specifiers starting with '.', but vite.config.js aliases `@` -> ./src and
    // the repo carries alias imports today. A basename sweep (the
    // archetypeImportBoundaryBaseline ratchet's spelling-agnostic idiom) covers
    // every other spelling of the same three targets.
    const ALIASED = /\bfrom\s+['"]@\/(?:constants\/backing|config\/backing)[^'"]*['"]/;
    for (const rel of SOURCES) {
      expect(ALIASED.test(read(rel)), `${rel} reaches a PR 1 module through a @/ alias`).toBe(false);
    }
  });
});
