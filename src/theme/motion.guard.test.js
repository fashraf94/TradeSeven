// Motion guard — spec V1 §7 row A5. Delight Layer arc, Task 3 Phase 3.
//
// Modeled on the shipped color-token guard (src/theme/tokens.guard.test.js): scan a
// curated list of migrated files, diff a per-file count against a committed baseline,
// put the remedy in expect()'s second argument, and offer an env-gated regen. Chosen
// (over a shell script) for the same reason the token guard was: a vitest file is picked
// up by the default include glob and runs inside the existing CI step at
// .github/workflows/tests.yml:55 with ZERO workflow change.
//
// This file runs in the default 'node' environment — it reads files, no DOM.
//
// WHAT THIS GUARD ENFORCES (locked A5 wording — COUNT-based, not site-based):
//   For each file in GUARDED_FILES, the number of raw `transition={{ ... }}` opener
//   literals must not exceed the committed baseline. New motion in a migrated file must
//   consume src/theme/motion.js (`transition={snappy}`, `transition={motionToken(...)}`)
//   rather than inline a fresh `transition={{ ... }}`.
//
// ───────────────────────────────────────────────────────────────────────────
// KNOWN BLIND SPOT — STATED PLAINLY, NOT PAPERED OVER (Phase 0 §2.8, founder ruling)
// ───────────────────────────────────────────────────────────────────────────
// This guard matches the JSX OPENER `transition={{`. That anchor is what makes it
// reliable (multi-line and nested-brace literals can't defeat an opener match) and
// false-positive-free (it excludes the 494 CSS `transition:'…'` property strings and the
// framer `transition:` variant KEYS, all of which use `:` not `={{`). The unavoidable
// cost is COVERAGE: three forms are structurally invisible to it —
//   1. identifier refs  `transition={snappy}`        — invisible, and BENIGN: this IS the
//                                                       desired tokenized end-state.
//   2. conditional exprs `transition={cond ? a : b}` — invisible; branch literals slip past.
//   3. variants-embedded `transition:` keys          — invisible, and the ONE REAL LEAK:
//        a developer can move a raw spring config into a variants object's `transition:`
//        key and stay both raw AND unguarded. Phase 0 counted 51 such keys in src today.
// So this guard proves "no NEW inline `transition={{` literal in guarded files." It does
// NOT prove "motion is tokenized." Catching form (3) needs an AST/lint rule — a separate
// task. The `docLimits` describe block below asserts each of these behaviors so the gap
// is executable documentation, not a footnote someone can forget.
//
// REGEN (after a deliberate migration that changes a count, e.g. a new guarded file):
//     GENERATE_MOTION_GUARD_BASELINE=1 npx vitest run src/theme/motion.guard.test.js
// then commit the updated motionGuardBaseline.json in the SAME commit.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BASELINE_PATH = path.join(HERE, 'motionGuardBaseline.json');

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/**
 * Files whose motion Phase 2+ migrated onto the vocabulary. The list EXPANDS as more
 * surfaces migrate — that is the ratchet. The motion-DEFINITION module (theme/motion.js)
 * is deliberately absent: it legitimately contains transition shapes.
 */
const GUARDED_FILES = [
  'src/components/Forge/ParamControls/ParamToggle.jsx',
  // Battle View controller, Phase A (A4 review L5-N6): NEW surfaces that consume the
  // vocabulary from birth (motionToken / the named tokens) — a zero-literal ratchet on
  // the whole directory, not a D3 retrofit of an existing surface.
  'src/screens/battleView/ChatSheet.jsx',
  'src/screens/battleView/TapeCards.jsx',
  'src/screens/battleView/LandingWash.jsx',
  'src/screens/battleView/ThisTurnStrip.jsx',
  'src/screens/battleView/TurnLine.jsx',
  'src/screens/battleView/WhyPanel.jsx',
  'src/screens/battleView/battleViewCopy.js',
  'src/screens/battleView/buildTape.js',
  'src/screens/battleView/deriveReceipts.js',
  'src/screens/battleView/deriveTurnLine.js',
  'src/screens/battleView/selectDeployPlan.js',
  'src/screens/battleView/selectSymbolRoster.js',
  'src/screens/battleView/scopeTape.js',
  'src/screens/battleView/PeekStrip.jsx',
  'src/screens/battleView/derivePeekLine.js',
  'src/screens/battleView/landing.js',
  'src/screens/battleView/selectWhyState.js',
  'src/screens/battleView/useChatSheet.js',
  'src/screens/battleView/useCoarseNow.js',
  'src/screens/battleView/useContentStable.js',
];

/**
 * Strip block comments and full-line `//` comments so a `transition={{` written inside
 * documentation is not counted as usage. Trailing `//` is left intact (stripping it would
 * risk eating the tail of a string literal), matching the token guard's stated tradeoff.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** The one detection target: the JSX transition-literal OPENER. Count, don't parse. */
const OPENER = /transition\s*=\s*\{\{/g;

/** Count raw `transition={{` openers in already-comment-stripped code. */
const countOpeners = (code) => (code.match(OPENER) || []).length;

/** Raw `transition={{` opener count for a repo-relative file. */
const scanFile = (rel) => countOpeners(stripComments(read(rel)));

const baselineCount = (entry) => (typeof entry === 'number' ? entry : entry?.count ?? 0);

// Regen mode — runs before the lock tests so a regen run passes (house pattern). MERGES:
// keeps the authority already recorded for each file, updates the count from the live scan.
if (process.env.GENERATE_MOTION_GUARD_BASELINE === '1') {
  const parsed = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
  const prev = parsed.guarded || {};
  const merged = {};
  for (const rel of GUARDED_FILES) {
    merged[rel] = { count: scanFile(rel), authority: prev[rel]?.authority || 'UNTAGGED' };
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ _schema: parsed._schema, guarded: merged }, null, 2)}\n`);
}

const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).guarded;

describe('motion guard — no new raw transition literal in migrated files (A5)', () => {
  it('the baseline covers exactly the migrated (guarded) files', () => {
    expect(Object.keys(BASELINE).sort()).toEqual([...GUARDED_FILES].sort());
  });

  it('every file in src/screens/battleView/ is on this list (hazard 34)', () => {
    // The list is explicit, so a new surface added without a line here is
    // simply unguarded and nothing goes red — the exact silence hazard 34
    // exists to prevent. deskHonesty.test.js already scans the directory; this
    // makes the theme guards agree with it by construction.
    const dir = path.join(REPO_ROOT, 'src', 'screens', 'battleView');
    const onDisk = readdirSync(dir)
      .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f))
      .map((f) => `src/screens/battleView/${f}`);
    const listed = new Set(GUARDED_FILES);
    const missing = onDisk.filter((f) => !listed.has(f));
    expect(
      missing,
      `these src/screens/battleView/ files are not on the guarded list: ${missing.join(', ')}.\n`
        + 'REMEDY: add each to GUARDED_FILES and regenerate the baseline IN THE SAME COMMIT (hazard 34).',
    ).toEqual([]);
  });

  it.each(GUARDED_FILES)('%s has not gained a raw `transition={{ ... }}` literal', (rel) => {
    const actual = scanFile(rel);
    const allowed = baselineCount(BASELINE[rel]);
    expect(
      actual,
      `${rel} added a raw transition literal (${allowed} allowed, ${actual} found).\n`
        + 'REMEDY: consume the vocabulary instead — `transition={snappy}` (or fade/smooth/bouncy/gesture), '
        + 'or `transition={motionToken(name, { reducedMotion })}` from src/theme/motion.js. '
        + 'If a raw literal MUST stay, regenerate with GENERATE_MOTION_GUARD_BASELINE=1 and say why in the commit.',
    ).toBeLessThanOrEqual(allowed);
  });

  it.each(GUARDED_FILES)('%s baseline is not stale (fewer literals than recorded)', (rel) => {
    const actual = scanFile(rel);
    const allowed = baselineCount(BASELINE[rel]);
    expect(
      actual,
      `${rel} now has FEWER raw transition literals than the baseline records (${allowed} allowed, ${actual} found). `
        + 'That is progress, not a defect — but the baseline is the published list and must stay accurate. '
        + 'REMEDY: GENERATE_MOTION_GUARD_BASELINE=1 npx vitest run src/theme/motion.guard.test.js, then commit it.',
    ).toBeGreaterThanOrEqual(allowed);
  });

  it('every baseline entry cites why its count is allowed (born green, no silent absorption)', () => {
    const bad = [];
    for (const [rel, entry] of Object.entries(BASELINE)) {
      const authority = entry && typeof entry === 'object' ? entry.authority : undefined;
      if (typeof authority !== 'string' || authority.trim() === '' || authority === 'UNTAGGED') {
        bad.push(`${rel} → ${JSON.stringify(authority)}`);
      }
    }
    expect(
      bad,
      `these baseline entries carry no authority note: ${bad.join(', ')}. `
        + 'Every entry must say why its count is what it is (e.g. "migrated to the snappy token"). '
        + 'REMEDY: edit the "authority" field in src/theme/motionGuardBaseline.json.',
    ).toEqual([]);
  });
});

// Executable documentation of the guard's reach — so the known blind spot cannot be
// silently forgotten. These assert the guard's BEHAVIOR on synthetic inputs.
describe('motion guard — what the opener anchor does and does NOT catch (documented limits)', () => {
  it('DETECTS inline `transition={{ ... }}` literals — single-line, multi-line, and nested-brace', () => {
    expect(countOpeners('transition={{ duration: 0.3 }}')).toBe(1);
    expect(countOpeners('transition = {{ duration: 0.3 }}')).toBe(1); // whitespace-tolerant
    expect(countOpeners('transition={{\n  duration: 0.3,\n  ease: "easeOut",\n}}')).toBe(1); // opener only
    expect(countOpeners('transition={{ layout: { duration: 0.3 } }}')).toBe(1); // nested inner brace
  });

  it('EXCLUDES CSS `transition:` property strings and identifier refs — no false positives', () => {
    expect(countOpeners("transition: 'background 0.2s ease'")).toBe(0); // CSS prop string (colon, not `={{`)
    expect(countOpeners('transition={snappy}')).toBe(0); // identifier ref — the DESIRED tokenized end-state
    expect(countOpeners('transition={motionToken("smooth", { reducedMotion })}')).toBe(0); // accessor call
  });

  it('is BLIND to a raw config embedded as a `transition:` KEY inside a variants object (the known leak)', () => {
    // This is form (3) in the header: a raw spring living as a `transition:` key stays both
    // raw AND invisible to an opener guard. 51 such keys exist in src today (Phase 0 §2.8).
    // Catching them is an AST/lint rule — a separate task, not this guard's job.
    const variantsWithRawSpring =
      'const v = { visible: { opacity: 1, transition: { type: "spring", stiffness: 300, damping: 25 } } };';
    expect(countOpeners(variantsWithRawSpring)).toBe(0);
  });

  it('the real pilot file scans to its baseline count (guard is born green on ParamToggle)', () => {
    expect(scanFile('src/components/Forge/ParamControls/ParamToggle.jsx')).toBe(0);
  });
});
