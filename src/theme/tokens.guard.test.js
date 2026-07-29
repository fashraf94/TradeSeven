// Token guard — spec V2 §7 rows A4a, A4b, A4c. Delight Layer arc, Task 1 Phase 3.
//
// Modeled on the house frozen-baseline pattern (api/_utils/archetypeRegistry.test.js
// + archetypeImportBoundaryBaseline.json): scan the tree, diff against a committed
// baseline, put the remedy in expect()'s second argument, and offer an env-gated
// regen. Chosen over the spec V1 idea of a scripts/audit-tokens.sh because the
// repo's one existing .sh ends every grep with `|| true` (it cannot fail) and no
// workflow or npm script invokes it — whereas a vitest file is picked up by the
// default include glob and runs inside the existing CI step at
// .github/workflows/tests.yml:55 with ZERO workflow change.
//
// REGEN (after a deliberate migration that changes the counts):
//     GENERATE_TOKEN_GUARD_BASELINE=1 npx vitest run src/theme/tokens.guard.test.js
// then commit the updated tokenGuardBaseline.json in the SAME commit.
//
// This file runs in the default 'node' environment — it reads files, no DOM.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BASELINE_PATH = path.join(HERE, 'tokenGuardBaseline.json');

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/**
 * The core palette = the hex values of the locked token list. Anything else is
 * not "core" and this guard says nothing about it (ruling R-S7 deliberately left
 * the Tailwind gray ramp and the orphans untokenized).
 */
const TOKEN_BASELINE = JSON.parse(read('src/theme/tokenBaseline.json'));
const CORE_PALETTE = new Set(
  Object.values(TOKEN_BASELINE).filter((v) => /^#[0-9a-f]{6}$/i.test(v)).map((v) => v.toLowerCase())
);

/**
 * Files whose color surface Phase 2 migrated. The list EXPANDS as more files
 * migrate — that is the ratchet. Token-definition files are deliberately absent:
 * per the §6 counting rule they legitimately contain every core hex.
 */
const GUARDED_FILES = [
  'src/index.css',
  'src/components/Dashboard/CommandDashboard.jsx',
  'src/components/Dashboard/CommandDashboardDesktop.jsx',
  'src/components/DesktopBackground.jsx',
];

/**
 * Strip comments so a hex mentioned in documentation is not counted as usage.
 * Block comments go in both CSS and JS. For `//` we strip FULL-LINE comments
 * only — stripping trailing `//` would risk eating the tail of a string literal
 * containing a protocol (`https://`). Consequence: a hex in a TRAILING `//`
 * comment inside a guarded file counts as usage. Put such notes on their own
 * line, or in a block comment.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Lowercase and expand #abc -> #aabbcc so shorthand cannot smuggle a core value past the guard. */
function normalizeHex(hex) {
  const body = hex.slice(1).toLowerCase();
  const full = body.length === 3 ? body.split('').map((c) => c + c).join('') : body;
  return `#${full}`;
}

/** Per-file map of normalized core-palette hex -> occurrence count. */
function scanFile(rel) {
  const matches = stripComments(read(rel)).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  const counts = {};
  for (const raw of matches) {
    const hex = normalizeHex(raw);
    if (!CORE_PALETTE.has(hex)) continue; // not core — out of this guard's scope
    counts[hex] = (counts[hex] || 0) + 1;
  }
  return counts;
}

function scanAll() {
  return Object.fromEntries(GUARDED_FILES.map((rel) => [rel, scanFile(rel)]));
}

// Regen mode — runs before the lock test so a regen run passes (house pattern).
if (process.env.GENERATE_TOKEN_GUARD_BASELINE === '1') {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ guarded: scanAll() }, null, 2)}\n`);
}

const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).guarded;

describe('token guard — no core-palette hex reintroduced in migrated files (A4a)', () => {
  it('guards every file Phase 2 migrated', () => {
    expect(Object.keys(BASELINE).sort()).toEqual([...GUARDED_FILES].sort());
  });

  it.each(GUARDED_FILES)('%s has not gained a core-palette hex literal', (rel) => {
    const actual = scanFile(rel);
    const allowed = BASELINE[rel] || {};

    const added = Object.entries(actual)
      .filter(([hex, n]) => n > (allowed[hex] || 0))
      .map(([hex, n]) => `${hex} (${allowed[hex] || 0} allowed, ${n} found)`);

    expect(
      added,
      `${rel} introduced core-palette hex literals: ${added.join(', ')}.\n`
        + 'REMEDY: consume the token instead — cssVar(name) for inline styles, readToken(name) for canvas / '
        + 'WebGL / Framer Motion (hazard H2), rgba(var(--ft-<name>-rgb), a) at literal CSS sites. If the literal '
        + 'MUST stay — an SVG stroke=""/fill="" presentation attribute (hazard H8, ruling R-H8), an alpha() or '
        + 'hexToRgba() or readableOn() call site (ruling R-S9), or a Framer-Motion-interpolated value — then it is '
        + 'a deliberate exemption: regenerate with GENERATE_TOKEN_GUARD_BASELINE=1 and say why in the commit.'
    ).toEqual([]);
  });

  it.each(GUARDED_FILES)('%s baseline is not stale (fewer literals than recorded)', (rel) => {
    const actual = scanFile(rel);
    const allowed = BASELINE[rel] || {};

    const removed = Object.entries(allowed)
      .filter(([hex, n]) => (actual[hex] || 0) < n)
      .map(([hex, n]) => `${hex} (${n} allowed, ${actual[hex] || 0} found)`);

    expect(
      removed,
      `${rel} now has FEWER core-palette literals than the baseline records: ${removed.join(', ')}. `
        + 'That is progress, not a defect — but the baseline is the published list and must stay accurate. '
        + 'REMEDY: GENERATE_TOKEN_GUARD_BASELINE=1 npx vitest run src/theme/tokens.guard.test.js, then commit it.'
    ).toEqual([]);
  });

  it('records the four deliberately-left literals so the guard is born green', () => {
    // Ratified exemptions. 3 x H8 (ruling R-H8): SVG presentation attributes in
    // DesktopBackground, where var() is not reliably substituted. 1 x #fff
    // (ruling R-#fff): 3-digit shorthand is not an exact match for --ft-white,
    // and shorthand-equivalence is a consolidation-arc concern.
    const bg = BASELINE['src/components/DesktopBackground.jsx'];
    expect(bg['#00d9ff'], 'H8: stroke="#00d9ff" at DesktopBackground.jsx:98 and :138').toBe(2);
    expect(bg['#8b5cf6'], 'H8: stroke="#8b5cf6" at DesktopBackground.jsx:146').toBe(1);

    const dash = BASELINE['src/components/Dashboard/CommandDashboard.jsx'];
    // #fff normalizes to #ffffff and joins the two alpha('#FFFFFF', a) call sites
    // that R-S9 keeps on hex — 3 exempt occurrences of --ft-white in this file.
    expect(dash['#ffffff'], 'R-#fff shorthand + 2 alpha() call sites (R-S9)').toBe(3);
  });

  it('the migrated dashboard stays free of core-palette literals', () => {
    expect(scanFile('src/components/Dashboard/CommandDashboardDesktop.jsx')).toEqual({});
  });
});

describe('tokens.css stays unlayered (A4b)', () => {
  it('has no cascade-layer wrapper', () => {
    // Comment-stripped: the word appears in this file's own documentation and in
    // tokens.css's header prose, and a raw text grep would false-positive on it.
    // Load-bearing twice over: a layered token block cannot override the unlayered
    // :root in holographic.css, AND jsdom never cascades a layer, so every
    // acceptance assertion in cssTokens.test.js would silently read "".
    const css = stripComments(read('src/theme/tokens.css'));
    expect(
      css.includes('@layer'),
      'src/theme/tokens.css acquired a cascade-layer wrapper. REMEDY: move the :root block back out of it '
        + '(ruling R-S6). Inside a layer, jsdom resolves every custom property to "" and the A1/A2/A2b/A3 '
        + 'assertions all pass vacuously while the real cascade also breaks against holographic.css.'
    ).toBe(false);
  });

  it('declares the tokens on a bare :root', () => {
    expect(stripComments(read('src/theme/tokens.css'))).toMatch(/^\s*:root\s*\{/m);
  });

  it('is imported by the app entrypoint', () => {
    expect(read('src/main.jsx')).toContain("import './theme/tokens.css'");
  });
});

describe('tailwind colors key stays empty (A4c)', () => {
  it('has not armed the 45-utility landmine', () => {
    // Ruling R-S10. tailwind.config.js ships `colors: {}` while 45 shadcn-style
    // color utilities (border-border x22, bg-card x19, bg-background x4) sit in
    // live JSX emitting no CSS. Populating the scale activates all 45 at once and
    // visibly changes the BaggerBomb surfaces.
    expect(
      /colors:\s*\{\s*\}/.test(read('tailwind.config.js')),
      'tailwind.config.js colors key is no longer empty. REMEDY: revert it (ruling R-S10). Wiring --ft-* into '
        + "Tailwind's color scale activates 45 dormant utilities in one commit — that is its own task, with its "
        + 'own visual-change budget and sign-off.'
    ).toBe(true);
  });
});

describe('legacy color vars stay retired (R-S6)', () => {
  it('index.css declares no unprefixed color custom properties', () => {
    const css = stripComments(read('src/index.css'));
    const declared = [...css.matchAll(/^\s*(--[a-z][\w-]*)\s*:/gm)].map((m) => m[1]);
    expect(
      declared,
      'index.css declared a custom property again. Only --radius may live there (it is not a color, and '
        + 'tailwind.config.js:11-13 consumes it); colors belong in src/theme/tokens.css per ruling R-S6.'
    ).toEqual(['--radius']);
  });

  it('index.css consumes the --ft-* substrate for the three re-pointed sites', () => {
    const css = read('src/index.css');
    expect(css).toContain('var(--ft-bg-app)');
    expect(css).toContain('var(--ft-text-primary-holo)');
    expect(css).toContain('rgba(var(--ft-scrim-rgb), 0.1)');
  });
});
