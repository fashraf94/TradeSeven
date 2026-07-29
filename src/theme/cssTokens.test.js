// @vitest-environment jsdom
//
// Acceptance suite for the --ft-* token substrate — spec V2 §7 rows A1, A2, A2b,
// A3, A5. Delight Layer arc, Task 1 Phase 3.
//
// FIXTURE (ruling R-S3). We fs-read tokens.css and inject it as a <style> rather
// than importing it. Two reasons, both measured during Phase 0 discovery:
//   1. vitest's `test.css` option is never set (vitest.config.js:35-42) and its
//      default is {include: []}, so `import './tokens.css'` resolves to an empty
//      string module — 0 style tags, 0 stylesheets, every token reads as "".
//   2. jsdom parses `@layer` into a CSSLayerBlockRule it never cascades, so any
//      token declared inside a cascade layer also reads as "". That is exactly
//      why the legacy :root block in index.css was untestable, and why R-S6 puts
//      the new tokens in a bare, unlayered :root.
// This strategy needs no vitest config change. Do not "simplify" it into an
// import — that silently empties every assertion below.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { cssVar, readToken, readTokenRgb } from './cssTokens.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = JSON.parse(readFileSync(path.join(HERE, 'tokenBaseline.json'), 'utf8'));

const stripCssComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** Whitespace-insensitive compare, for RGB triplet rows only (ruling R-A2w). */
const canonTriplet = (v) => v.replace(/\s*,\s*/g, ',').trim();

const isAlias = (v) => v.startsWith('var(');
const isTriplet = (name) => name.endsWith('-rgb');

/**
 * The locked semantic tier (spec V2 §3). Duplicated here deliberately: if the
 * shipped tokens.css is edited to retarget an alias, this table does NOT move
 * with it, so A2b fails. A test that derived the map from the file under test
 * could not detect a retarget.
 */
const SEMANTIC = {
  '--ft-accent': { alias: 'var(--ft-cyan)', resolvesTo: '#00d9ff' },
  '--ft-warp-tint': { alias: 'var(--ft-accent)', resolvesTo: '#00d9ff' },
  '--ft-success': { alias: 'var(--ft-emerald)', resolvesTo: '#10b981' },
  '--ft-danger': { alias: 'var(--ft-red)', resolvesTo: '#ef4444' },
  '--ft-warning': { alias: 'var(--ft-amber)', resolvesTo: '#f59e0b' },
  '--ft-game-baggerbomb': { alias: 'var(--ft-amber)', resolvesTo: '#f59e0b' },
  '--ft-game-draft': { alias: 'var(--ft-emerald)', resolvesTo: '#10b981' },
};

const rawProp = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = stripCssComments(readFileSync(path.join(HERE, 'tokens.css'), 'utf8'));
  document.head.appendChild(style);
});

describe('defines-all-tokens (A1)', () => {
  it('resolves every tokenBaseline.json name to a non-empty value on :root', () => {
    const missing = Object.keys(BASELINE).filter((name) => rawProp(name) === '');
    expect(
      missing,
      `these tokens are in tokenBaseline.json but do not resolve from tokens.css: ${missing.join(', ')}. `
        + 'REMEDY: add them to the :root block in src/theme/tokens.css, or remove them from the baseline if the spec dropped them.'
    ).toEqual([]);
  });

  it('has a baseline that covers the whole locked list — 37 tokens', () => {
    expect(Object.keys(BASELINE)).toHaveLength(37);
  });
});

describe('parity-with-baseline (A2)', () => {
  // Ruling R-A2w: hex rows are STRICT string equality; the 8 RGB triplet rows are
  // whitespace-insensitive, because jsdom collapses the space after each comma
  // while browsers preserve it.
  const hexRows = Object.entries(BASELINE).filter(([n, v]) => !isAlias(v) && !isTriplet(n));
  const tripletRows = Object.entries(BASELINE).filter(([n, v]) => !isAlias(v) && isTriplet(n));

  it.each(hexRows)('%s matches the baseline exactly', (name, expected) => {
    expect(
      rawProp(name),
      `${name} drifted from tokenBaseline.json. The baseline is the published, auditable list (ruling R-S7) `
        + 'and every value seeds from a real consumption site (R-S4) — a change here is a VISUAL change. '
        + 'REMEDY: revert tokens.css, or get the new value ruled and update the baseline in the same commit.'
    ).toBe(expected);
  });

  it.each(tripletRows)('%s matches the baseline (whitespace-insensitive, R-A2w)', (name, expected) => {
    expect(canonTriplet(rawProp(name))).toBe(canonTriplet(expected));
  });

  it('guards the comparator split itself — 22 strict rows, 8 triplet rows', () => {
    // If this drifts, someone added a token without deciding which comparator it
    // belongs under, and one of the two it.each blocks above silently skipped it.
    expect({ strict: hexRows.length, triplets: tripletRows.length })
      .toEqual({ strict: 22, triplets: 8 });
  });
});

describe('semantic-bindings (A2b)', () => {
  it.each(Object.entries(SEMANTIC))(
    '%s is a var() alias in the CSS text and resolves to its locked literal',
    (name, { alias, resolvesTo }) => {
      // Text level: the alias must not be flattened to a literal, or the whole
      // point of the semantic tier (rebind one variable, restyle wholesale) is lost.
      expect(
        rawProp(name),
        `${name} should be the alias ${alias}. If it was flattened to a literal, future themes and the `
          + 'accent picker can no longer rebind it. REMEDY: restore the alias in src/theme/tokens.css.'
      ).toBe(alias);

      // Resolution level: readToken walks the chain, so it must land on the literal.
      expect(readToken(name.replace('--ft-', ''))).toBe(resolvesTo);
    }
  );

  it('covers exactly the 7 locked semantic tokens', () => {
    const aliasesInBaseline = Object.entries(BASELINE).filter(([, v]) => isAlias(v)).map(([n]) => n);
    expect(aliasesInBaseline.sort()).toEqual(Object.keys(SEMANTIC).sort());
  });

  it('resolves the two-hop chain --ft-warp-tint -> --ft-accent -> --ft-cyan', () => {
    // Task 2's starfield reads warp-tint. If the chain stops resolving, it gets a
    // raw "var(...)" string and the canvas paints nothing.
    expect(readToken('warp-tint')).toBe(readToken('cyan'));
  });
});

describe('rebind (A3)', () => {
  const SENTINEL = '#ff00aa';

  afterEach(() => {
    document.documentElement.style.removeProperty('--ft-accent');
  });

  it('reflects a runtime setProperty on --ft-accent (decision D4 mechanism)', () => {
    expect(readToken('accent')).toBe('#00d9ff');
    document.documentElement.style.setProperty('--ft-accent', SENTINEL);
    expect(
      readToken('accent'),
      'readToken returned a stale value after setProperty — it is caching. Values MUST be read lazily on '
        + 'every call or the accent picker and unlockable themes cannot work. REMEDY: remove the memoization '
        + 'from readToken in src/theme/cssTokens.js.'
    ).toBe(SENTINEL);
  });

  it('propagates a rebind through the semantic chain to --ft-warp-tint', () => {
    document.documentElement.style.setProperty('--ft-accent', SENTINEL);
    expect(readToken('warp-tint')).toBe(SENTINEL);
  });

  it('reverts cleanly on removeProperty', () => {
    document.documentElement.style.setProperty('--ft-accent', SENTINEL);
    document.documentElement.style.removeProperty('--ft-accent');
    expect(readToken('accent')).toBe('#00d9ff');
  });
});

describe('cssvar-format (A5)', () => {
  it.each(['accent', 'bg-app', 'warp-tint', 'text-primary-holo', 'game-baggerbomb'])(
    'cssVar(%s) emits a well-formed var() reference',
    (name) => {
      expect(cssVar(name)).toMatch(/^var\(--ft-[a-z0-9-]+\)$/);
    }
  );

  it('emits a reference that actually resolves for every base token', () => {
    // Catches a prefix typo: a malformed name still matches the regex above but
    // resolves to nothing.
    for (const name of Object.keys(BASELINE)) {
      const short = name.replace('--ft-', '');
      expect(cssVar(short)).toBe(`var(${name})`);
    }
  });
});

describe('readTokenRgb canonicalization (R-A2w)', () => {
  it.each([
    ['scrim', '255,255,255'],
    ['shadow', '0,0,0'],
    ['cyan', '0,217,255'],
    ['red', '239,68,68'],
    ['amber', '245,158,11'],
    ['emerald', '16,185,129'],
    ['teal', '94,234,212'],
    ['purple', '139,92,246'],
  ])('readTokenRgb(%s) returns the canonical no-space form', (name, expected) => {
    expect(
      readTokenRgb(name),
      'readTokenRgb must canonicalize to the no-space form in EVERY environment (ruling R-A2w) so consumers '
        + 'get one stable string. jsdom and browsers disagree on the raw property value.'
    ).toBe(expected);
  });

  it('canonicalizes a SPACED source value — the browser case (R-A2w)', () => {
    // This is the assertion that actually exercises the canonicalizer. Reading
    // tokens.css through jsdom cannot: jsdom already collapses the space after
    // each comma when parsing a <style>, so the canonicalizer is a no-op there
    // and removing it would not fail any other test in this file.
    //
    // A real browser DOES return the authored spacing ('0, 217, 255'). jsdom
    // reproduces that faithfully via setProperty / the style attribute (measured:
    // setProperty('x', '7, 8, 9') reads back as "7, 8, 9"), so we inject the
    // spaced form the same way the browser would present it.
    document.documentElement.style.setProperty('--ft-teal-rgb', '94, 234, 212');
    try {
      expect(
        getComputedStyle(document.documentElement).getPropertyValue('--ft-teal-rgb').trim(),
        'precondition: the spaced form must survive injection, or this test proves nothing'
      ).toBe('94, 234, 212');

      expect(
        readTokenRgb('teal'),
        'readTokenRgb did not canonicalize a spaced source value. Ruling R-A2w requires the no-space form in '
          + 'EVERY environment so consumers get one stable string across browser and jsdom. '
          + 'REMEDY: restore the canonicalizeTriplet() call in readTokenRgb (src/theme/cssTokens.js).'
      ).toBe('94,234,212');
    } finally {
      document.documentElement.style.removeProperty('--ft-teal-rgb');
    }
  });

  it('returns "" for a token with no -rgb companion', () => {
    expect(readTokenRgb('bg-app')).toBe('');
  });

  it('tracks --ft-purple (#8b5cf6), not --ft-purple-deep (R-S9 exception)', () => {
    expect(readTokenRgb('purple')).toBe('139,92,246');
    expect(readToken('purple')).toBe('#8b5cf6');
    expect(readToken('purple-deep')).toBe('#9333ea');
  });
});

describe('no-DOM degradation', () => {
  it('returns "" rather than throwing when there is no document', () => {
    // The repo's vitest default environment is 'node' (vitest.config.js sets no
    // `environment`), so any test file without the jsdom pragma imports this
    // module DOM-less. It must not explode on import or call.
    const saved = globalThis.document;
    try {
      delete globalThis.document;
      expect(readToken('accent')).toBe('');
      expect(readTokenRgb('cyan')).toBe('');
      expect(cssVar('accent')).toBe('var(--ft-accent)');
    } finally {
      globalThis.document = saved;
    }
  });
});
