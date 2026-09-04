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

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BASELINE_PATH = path.join(HERE, 'tokenGuardBaseline.json');

// Sentinel written for a NEW exemption during regen. The authority-integrity test
// (R-BL21) rejects it, so a freshly-regenerated exemption fails CI until a human
// cites the ruling that exempts it — the guard can never silently absorb a literal.
const UNTAGGED = 'UNTAGGED';

/** Count for a baseline entry, tolerant of the legacy bare-number shape. */
const baselineCount = (entry) => (typeof entry === 'number' ? entry : entry?.count ?? 0);

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
  // Battle View controller, Phase A (A4 review L5-N6): new surfaces built on cssVar()
  // from birth — a zero-literal ratchet on the whole directory (BUILD_RULES §10: the
  // guarded-file list expands as files migrate).
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
  // Battle View character pane, Phase A3 — token-only from birth (D-96).
  'src/screens/battleView/ArenaHeader.jsx',
  'src/screens/battleView/computeTugOfWarWidth.js',
  'src/screens/battleView/CharacterAvatar.jsx',
  'src/screens/battleView/deriveBubble.js',
  'src/screens/battleView/CharacterPane.jsx',
  'src/screens/battleView/useCharacterPane.js',
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

/**
 * Normalize a matched hex to its lowercase 6-digit RGB form so no notation can
 * smuggle a core value past the guard:
 *   #abc      -> #aabbcc   (3-digit shorthand expanded)
 *   #rrggbbaa -> #rrggbb   (8-digit alpha form, alpha dropped — spec §6)
 * The 8-digit case is the one the first code review caught: without it,
 * `#ef444480` (core red with alpha) matched nothing and re-entered a guarded
 * file with the guard staying green.
 */
function normalizeHex(hex) {
  let body = hex.slice(1).toLowerCase();
  if (body.length === 3) body = body.split('').map((c) => c + c).join('');
  if (body.length === 8) body = body.slice(0, 6); // drop the alpha pair
  return `#${body}`;
}

/**
 * Per-file map of normalized core-palette hex -> occurrence count.
 *
 * Matches the locked §6 counting rule: word-boundary-anchored 3/6/8-digit hex,
 * case-insensitive. The 8-digit alternative is listed FIRST so `#ef444480`
 * matches as one 8-digit token rather than failing the 6-digit `\b`.
 *
 * KNOWN LIMITATIONS, inherent to a raw-text diff guard and deliberately NOT
 * papered over — the §7 parity acceptance tests and the founder screenshot gate
 * cover what a text scan structurally cannot:
 *   1. 4-digit `#rgba` shorthand-with-alpha is outside the locked §6 rule
 *      (3/6/8 only) and is deliberately not counted here.
 *   2. A core hex split across concatenation or interpolation (`'#ef' + '4444'`,
 *      `` `#${r}4444` ``) is not reconstructed, so it is not caught.
 *   3. The guard is COUNT-based, not site-based: swapping one exempt occurrence
 *      of a hex for a non-exempt occurrence of the SAME hex keeps the count and
 *      the recorded authority unchanged, so it stays green. Line-level tracking
 *      is a larger design; today the exempt sites are few and named in the
 *      baseline authority strings, and parity review catches a moved literal.
 */
function scanFile(rel) {
  const matches = stripComments(read(rel)).match(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
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
// MERGES rather than overwrites: it keeps the authority tag already recorded for
// each (file, hex), updates the count from the live scan, and stamps any NEW
// exemption UNTAGGED so the authority test forces a human to cite its ruling.
if (process.env.GENERATE_TOKEN_GUARD_BASELINE === '1') {
  const parsed = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
  const prev = parsed.guarded || {};
  const merged = {};
  for (const [rel, counts] of Object.entries(scanAll())) {
    merged[rel] = {};
    for (const [hex, count] of Object.entries(counts)) {
      merged[rel][hex] = { count, authority: prev[rel]?.[hex]?.authority || UNTAGGED };
    }
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ _schema: parsed._schema, guarded: merged }, null, 2)}\n`);
}

const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).guarded;

describe('token guard — no core-palette hex reintroduced in migrated files (A4a)', () => {
  it('guards every file Phase 2 migrated', () => {
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

  it.each(GUARDED_FILES)('%s has not gained a core-palette hex literal', (rel) => {
    const actual = scanFile(rel);
    const allowed = BASELINE[rel] || {};

    const added = Object.entries(actual)
      .filter(([hex, n]) => n > baselineCount(allowed[hex]))
      .map(([hex, n]) => `${hex} (${baselineCount(allowed[hex])} allowed, ${n} found)`);

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
      .filter(([hex, entry]) => (actual[hex] || 0) < baselineCount(entry))
      .map(([hex, entry]) => `${hex} (${baselineCount(entry)} allowed, ${actual[hex] || 0} found)`);

    expect(
      removed,
      `${rel} now has FEWER core-palette literals than the baseline records: ${removed.join(', ')}. `
        + 'That is progress, not a defect — but the baseline is the published list and must stay accurate. '
        + 'REMEDY: GENERATE_TOKEN_GUARD_BASELINE=1 npx vitest run src/theme/tokens.guard.test.js, then commit it.'
    ).toEqual([]);
  });

  it('records the 21 exempt occurrences with their rulings so the guard is born green (R-BL21)', () => {
    // R-BL21 corrected the arithmetic: the founder ratified 4 dispositions, but the
    // guard counts OCCURRENCES in guarded files, and the exempt set is 21:
    //   3 x R-H8 (SVG stroke presentation attributes, DesktopBackground)
    // + 1 x R-#fff (color:'#fff' shorthand, CommandDashboard)
    // + 2 x R-S9  (alpha('#FFFFFF') call sites, CommandDashboard)
    // + 15 x UNSCOPED-P2 (index.css @layer utilities block, never scoped by Phase 2)
    const bg = BASELINE['src/components/DesktopBackground.jsx'];
    expect(baselineCount(bg['#00d9ff'])).toBe(2);
    expect(bg['#00d9ff'].authority, 'stroke="#00d9ff" at :98, :138').toContain('R-H8');
    expect(baselineCount(bg['#8b5cf6'])).toBe(1);
    expect(bg['#8b5cf6'].authority, 'stroke="#8b5cf6" at :146').toContain('R-H8');

    const dash = BASELINE['src/components/Dashboard/CommandDashboard.jsx'];
    expect(baselineCount(dash['#ffffff'])).toBe(3);
    // The single #ffffff entry carries MIXED authority — one shorthand + two helper
    // call sites — because #fff normalizes to #ffffff and joins them. Both cited.
    expect(dash['#ffffff'].authority).toContain('R-#fff');
    expect(dash['#ffffff'].authority).toContain('R-S9');

    const index = BASELINE['src/index.css'];
    const unscopedTotal = Object.values(index).reduce((n, e) => n + baselineCount(e), 0);
    expect(unscopedTotal, '15 core-palette hexes in the untouched @layer utilities block').toBe(15);
    for (const entry of Object.values(index)) {
      expect(entry.authority).toContain('UNSCOPED-P2');
    }

    const grandTotal = GUARDED_FILES.reduce(
      (sum, rel) => sum + Object.values(BASELINE[rel]).reduce((n, e) => n + baselineCount(e), 0),
      0
    );
    expect(grandTotal, 'the ratified R-BL21 total').toBe(21);
  });

  it('every exemption carries a REAL ruling tag — no silent, garbage, or malformed absorption (R-BL21)', () => {
    // A ruling-shaped token: an R-<id> (R-H8, R-#fff, R-A2w, R-S9, R-BL21, and any
    // future R-*) or UNSCOPED-<phase>. This rejects three failure modes the guard
    // review surfaced: a missing/UNTAGGED tag, a non-string authority (which used
    // to THROW on .startsWith rather than assert), and a plausible-looking but
    // meaningless free-text string that cites no ruling.
    const RULING_PATTERN = /R-[A-Za-z0-9#]|UNSCOPED-/;
    const bad = [];
    for (const [rel, entries] of Object.entries(BASELINE)) {
      for (const [hex, entry] of Object.entries(entries)) {
        const authority = entry && typeof entry === 'object' ? entry.authority : undefined;
        const ok = typeof authority === 'string'
          && !authority.startsWith(UNTAGGED)
          && RULING_PATTERN.test(authority);
        if (!ok) bad.push(`${rel} ${hex} → ${JSON.stringify(authority)}`);
      }
    }
    expect(
      bad,
      `these baseline exemptions carry no real ruling tag: ${bad.join(', ')}.\n`
        + 'Every exemption must cite the ruling that exempts it (R-BL21) as a string containing an R-<id> or '
        + 'UNSCOPED-<phase> token — R-H8 (SVG presentation attribute), R-#fff (3-digit shorthand), R-S9 '
        + '(alpha/hexToRgba/readableOn call site), UNSCOPED-P2 (pre-existing, outside the Phase 2 scope), or a '
        + 'new ruling id. REMEDY: edit the "authority" field in src/theme/tokenGuardBaseline.json.'
    ).toEqual([]);
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
