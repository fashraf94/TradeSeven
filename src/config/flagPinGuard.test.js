// src/config/flagPinGuard.test.js
// FLAG-PIN GUARD — the standing enforcement for the BUILD_RULES §2 flag-flip rule.
//
// The recurring incident (3× and counting): a one-line flag flip in a *_ENABLED
// module reds `main` because a test still pins the flag's OLD literal
// (`expect(FLAG).toBe(<stale>)`). This guard walks the flag-source modules and
// every test file and fails with ONE actionable, INTENT-AWARE message that names
// the exact file:line to fix — so a flip is a one-line change, never a mystery red.
//
// House pattern (src/theme/tokens.guard.test.js / motion.guard.test.js): a
// node-env vitest file, read-only over the tree, remedy in expect()'s 2nd arg.
// It is picked up by the default include glob and runs inside the existing CI
// step (.github/workflows/tests.yml — `npm run test:run`) with ZERO workflow change.
//
// It does NOT delete pins. Founder ruling (2026-08-10): the deliberately-dark
// flags KEEP their loud tripwire pins (see DARK_BY_DESIGN); the guard's job is to
// make any contradiction self-explaining and tell you WHETHER you meant to flip.
//
// KNOWN LIMITATION, stated on purpose (the tokens.guard "documented limits"
// precedent): the guard matches direct `expect(<flag>).toBe(<bool>)` pins only.
// Aggregate/wrapper-output pins — e.g. wireFlags.test.js asserting
// `getWireFlags()` toEqual an all-false object — are NOT detected here; they are
// covered by that suite's own five direct WIRE_* pins, which ARE detected.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const base = (rel) => rel.split('/').pop();

// ── The flag-source modules the guard knows about ───────────────────────────
// EXPLICIT and auditable (the tokens.guard GUARDED_FILES precedent). ADD A MODULE
// HERE when a new *_ENABLED flag source appears, or the guard is blind to its
// pins. Every boolean `export const <NAME>_ENABLED = true|false` in these files
// becomes a checked flag.
const FLAG_SOURCE_MODULES = [
  'src/config/featureFlags.js',
  'api/_utils/compositionConfig.js',
  'api/_utils/tournamentOrchestrator.js',
];

// ── Deliberately-dark flags (founder ruling 2026-08-10: keep the loud tripwire) ─
// These ship FALSE on purpose along a founder-sequenced runway. Their pins are a
// FEATURE — an accidental flip must fail loudly. The note is folded into the
// guard message so a contradiction tells you whether you meant to flip, not just
// which line moved. Notes are sourced from each flag's own docstring.
// When a dark flag is DELIBERATELY flipped: update its pin AND remove its entry
// here, in the same commit (the integrity test below enforces the coupling).
const DARK_BY_DESIGN = {
  COMPILER_ENABLED:
    'double-gated behind the activationGate; flips ONLY via a deliberate founder PR with a green gate, never a build PR',
  WIRE_METRICS_ENABLED:
    'Wire runway step 1 — flips FIRST for a ≥3-trading-day p95 baseline before writes',
  WIRE_WRITES_ENABLED:
    'Wire runway — dark until the metrics baseline lands, ≥2 trading days solo before continuity (runway: metrics → 3-day baseline → writes)',
  CONTINUITY_MEMORY_ENABLED:
    'Wire runway — requires WIRE_WRITES_ENABLED live first',
  WIRE_NEWSLINE_ENABLED:
    'Wire runway step 7 (LAST) — requires WIRE_WRITES_ENABLED; flips last at founder discretion',
  EDITORIAL_REVIEW_ENABLED:
    'Wire runway step 5 — flips after WIRE_WRITES_ENABLED (first Sunday after writes)',
  COMPOSITION_EPOCH_FENCE_ENABLED:
    'ships dark until the §8 activation runbook runs; LOAD-BEARING once activated — never lowered after (A48)',
  COMPOSITION_MIGRATION_FEED_ENABLED:
    'identityMigration feed gate — dark until composition activation',
  COMPOSITION_DISPLAY_ENABLED:
    'the one client-consumed composition flag — dark until activation (legacy copy is byte-identical when off)',
  MANAGED_MANDATE_ENABLED:
    'Spec 1 (The Mandate) MASTER gate — dark across Phases 1–6; the whole substrate stays inert until a deliberate founder PR after preview smoke',
  MANDATE_EVAL_ENABLED:
    'Spec 1 eval loop (§3.1) — built P2, registered P6; flips only after a founder preview smoke, never in a build PR',
  MANDATE_CLOSE_ENABLED:
    'Spec 1 daily close pass (§3.6) — built P3; flips only after a founder preview smoke',
  MANDATE_ROLLOVER_ENABLED:
    'Spec 1 rollover sweep (§5.3) — built P4; flips only after a founder preview smoke',
  MANDATE_DORMANCY_DOWNSHIFT_ENABLED:
    'Spec 1 dormancy downshift (§6.5) — trading/close never downshift; flips only after a founder preview smoke',
  MANDATE_FOUNDER_CREATE_ENABLED:
    'Spec 1 founder create endpoint (§7) — dark-testing switch; creation also requires an allowlisted uid, so the flag alone is inert',
};

// ── Build the live flag → value map from the source modules ──────────────────
// { FLAG: { value, module, line } }. Duplicate names across modules are an
// ambiguity the guard refuses to resolve silently.
function buildFlagMap() {
  const map = {};
  const dupes = [];
  for (const rel of FLAG_SOURCE_MODULES) {
    read(rel).split('\n').forEach((text, i) => {
      const m = /^export const ([A-Z][A-Z0-9_]*_ENABLED)\s*=\s*(true|false)\s*;/.exec(text);
      if (!m) return;
      const [, name, lit] = m;
      if (map[name]) dupes.push(`${name} (${map[name].module}:${map[name].line} and ${rel}:${i + 1})`);
      map[name] = { value: lit === 'true', module: rel, line: i + 1 };
    });
  }
  return { map, dupes };
}

// ── Walk every test file under src/ and api/ ─────────────────────────────────
function listTestFiles(dirRel) {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const childAbs = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(childAbs);
      else if (/\.test\.(js|jsx)$/.test(ent.name)) out.push(path.relative(REPO_ROOT, childAbs).split(path.sep).join('/'));
    }
  };
  walk(path.join(REPO_ROOT, dirRel));
  return out;
}
const TEST_FILES = [...listTestFiles('src'), ...listTestFiles('api')];

// A literal pin: expect( [ns.]FLAG ).toBe( true|false ). Captures the flag name
// (a `flags.`/`cfg.`/`ff.` namespace is stripped) and the literal. Restricted to
// *_ENABLED subjects — the convention every flag follows — so a local
// `const READY = true` in a test is never a false match.
const PIN_RE = /expect\(\s*(?:[A-Za-z_$][\w$]*\.)?([A-Z][A-Z0-9_]*_ENABLED)\s*\)\s*\.toBe\(\s*(true|false)\s*\)/;

function findPins(knownFlags) {
  const pins = [];
  for (const rel of TEST_FILES) {
    if (base(rel) === 'flagPinGuard.test.js') continue; // never scan the guard's own examples/comments
    read(rel).split('\n').forEach((text, i) => {
      const m = PIN_RE.exec(text);
      if (!m) return;
      const [, flag, lit] = m;
      if (!knownFlags.has(flag)) return; // not a flag from a registered module
      pins.push({ flag, file: rel, line: i + 1, literal: lit === 'true' });
    });
  }
  return pins;
}

// The comment block immediately preceding a flag's export (bounded below by the
// previous `export const`, so it never bleeds into a neighbor's docstring).
function docstringWindow(rel, exportLine) {
  const lines = read(rel).split('\n');
  let start = 0;
  for (let i = exportLine - 2; i >= 0; i--) {
    if (/^export const /.test(lines[i])) { start = i + 1; break; }
  }
  return lines.slice(start, exportLine - 1).join('\n');
}

const { map: FLAG_MAP, dupes: FLAG_DUPES } = buildFlagMap();
const KNOWN = new Set(Object.keys(FLAG_MAP));
const PINS = findPins(KNOWN);

// flag -> sorted unique basenames of the test files that pin it
const PIN_FILES_BY_FLAG = {};
for (const p of PINS) {
  (PIN_FILES_BY_FLAG[p.flag] ||= new Set()).add(base(p.file));
}

describe('flag-pin guard — no test pins a flag against its live value (BUILD_RULES §2)', () => {
  it('resolves flag values cleanly (modules read, no duplicate names)', () => {
    expect(FLAG_DUPES, `duplicate *_ENABLED names across flag modules: ${FLAG_DUPES.join(', ')}`).toEqual([]);
    expect(Object.keys(FLAG_MAP).length, 'flag modules were not read').toBeGreaterThan(20);
  });

  it('is not vacuous — it detects real pins in both bare and namespaced forms', () => {
    // Anti-vacuous mutation check (BUILD_RULES §2: a row that cannot fail is not a
    // guard). A regex/walk regression that stops matching pins would make every
    // check below pass green; anchor on two PERMANENT dark-by-design tripwires
    // (kept by founder ruling, so these survive the later behavior-refactor):
    //   COMPILER_ENABLED — bare form; WIRE_WRITES_ENABLED — `flags.` namespaced.
    const found = (flag, fileFragment) => PINS.some((p) => p.flag === flag && p.file.includes(fileFragment));
    expect(found('COMPILER_ENABLED', 'compileOnSettingsChange.test.js'), 'bare-form pin not detected').toBe(true);
    expect(found('WIRE_WRITES_ENABLED', 'wireFlags.test.js'), 'namespaced (flags.) pin not detected').toBe(true);
    expect(PINS.length, 'no flag pins found at all — the walker or regex is broken').toBeGreaterThan(0);
  });

  it('every pinned flag matches its live value; a contradiction names the fix and the intent', () => {
    const bad = PINS
      .filter((p) => p.literal !== FLAG_MAP[p.flag].value)
      .map((p) => {
        const def = FLAG_MAP[p.flag];
        const dark = DARK_BY_DESIGN[p.flag];
        if (dark) {
          return `${p.file}:${p.line} — ${p.flag} ships dark by design (${dark}). `
            + `It is now ${def.value} at ${def.module}:${def.line} but this assertion pins ${p.literal}. `
            + `If this flip is DELIBERATE: update the assertion here and drop ${p.flag} from DARK_BY_DESIGN `
            + `(src/config/flagPinGuard.test.js) in the same commit. If NOT: revert the flag at ${def.module}:${def.line}.`;
        }
        return `${p.file}:${p.line} — ${p.flag} is live ${def.value} (${def.module}:${def.line}) but this assertion pins ${p.literal}. `
          + `Update THIS assertion in the same commit as the flip (BUILD_RULES §2), or refactor it to a behavior branch.`;
      });
    expect(bad, `flag pins contradict live values:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('DARK_BY_DESIGN lists only real, currently-dark flags, each with a note', () => {
    // Registry integrity: an entry that is missing, actually true, or noteless
    // would emit a wrong or empty message on the day it matters. This also
    // enforces the "remove on deliberate flip" coupling — a flag flipped true
    // but left in DARK_BY_DESIGN fails here.
    const bad = [];
    for (const [flag, note] of Object.entries(DARK_BY_DESIGN)) {
      if (!FLAG_MAP[flag]) bad.push(`${flag}: not found in any registered flag module`);
      else if (FLAG_MAP[flag].value !== false) bad.push(`${flag}: listed dark but ships ${FLAG_MAP[flag].value} — remove it here in the flip commit`);
      if (!note || !note.trim()) bad.push(`${flag}: empty runway note`);
    }
    expect(bad, `DARK_BY_DESIGN integrity: ${bad.join('; ')}`).toEqual([]);
  });

  it("each pinned flag's docstring names its pinning suite(s) (item 4 — kept honest)", () => {
    // Every flag that a suite pins must say so at its definition, naming each
    // pinning file. Keeps the flag→test link discoverable AND drift-proof: a new
    // suite that pins a flag without updating its docstring fails here.
    const bad = [];
    for (const [flag, filesSet] of Object.entries(PIN_FILES_BY_FLAG)) {
      const def = FLAG_MAP[flag];
      const window = docstringWindow(def.module, def.line);
      const missing = [...filesSet].filter((f) => !window.includes(f));
      if (!window.includes('Pinned by:') || missing.length) {
        bad.push(`${def.module}:${def.line} ${flag} — docstring must contain "Pinned by:" naming ${[...filesSet].join(', ')}`
          + (missing.length ? ` (missing: ${missing.join(', ')})` : ''));
      }
    }
    expect(bad, `flag docstrings missing/stale "Pinned by:" pointers:\n  ${bad.join('\n  ')}`).toEqual([]);
  });
});
