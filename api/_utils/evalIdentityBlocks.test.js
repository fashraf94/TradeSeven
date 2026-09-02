// api/_utils/evalIdentityBlocks.test.js
//
// DR-13 Commit 1 — the mechanical locks that make frozen constants
// acceptable under the "mechanically rendered, never hand-authored" ruling:
//
//   1. DOC-PARITY: each constitution's golden-render blockquote, parsed out
//      of the markdown, is byte-equal to the shipped constant. An edit to
//      either side without the other fails CI.
//   2. COMPLETENESS: exactly the six canonical archetype code-ids, in both
//      the block map and the path map.
//   3. SIZE CAP: ≤ 1050 chars per render (founder-ruled 2026-07-24; ≈ 240
//      tokens on claude-haiku-4-5-20251001 — equivalence recorded in the
//      module header). Deterministic and offline by design: no tokenizer
//      dependency, no network in CI.
//   4. SUBORDINATION CLAUSE: byte-locked against the founder-ruled DR-13
//      wording (Master Spec V1.1 §2.3, R1 finding 27).
//   5. Version stamps and the flag-on render contract (valid key → the fenced
//      block; unknown/undefined → '', the flag-independent omit rule).
//
// Parse rule (founder-ruled, Flag H): the key is the FIRST backticked token
// on a line starting '**Golden render' — never the exact marker shape
// (CONSTITUTION_TREND_FOLLOWER_V1.md's marker line differs from the other
// five); the render is the first '> ' blockquote line after that marker.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of
// evalIdentityBlocks.js below IS the runtime guard for its api → src
// featureFlags import — it explodes in the Node test env if a browser-only
// dep ever enters that graph. NEVER mock it (the flag-on sibling test file
// mocks the flags module instead, deliberately keeping this one real).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVAL_IDENTITY_BLOCKS,
  EVAL_IDENTITY_CONSTITUTION_PATHS,
  EVAL_IDENTITY_SUBORDINATION_CLAUSE,
  EVAL_IDENTITY_YIELD_CLAUSE,
  EVAL_IDENTITY_PROMPT_SPEC_VERSION,
  EVAL_IDENTITY_KERNEL_VERSION,
  EVAL_IDENTITY_RENDER_CHAR_CAP,
  renderEvalIdentityBlock,
} from './evalIdentityBlocks.js';
// Exit-Behavior Ask 2 (rescoped): the clause this REAL-flag file expects in a
// render is a behavior branch on the live flag (never a pin — this file keeps
// the flags module real as the §4 dependency-surface guard).
import { EQUIPPED_RULE_PRECEDENCE_ENABLED } from '../../src/config/featureFlags.js';

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

// The canonical six code-ids (archetypeScoring.js / agentArchetypeConfig.js
// key set). Deliberately hardcoded rather than imported: importing a legacy
// archetype table from a test would still be a new direct importer under the
// Spec §2.3 ratchet reading, and a seventh archetype is a program-level
// event that SHOULD arrive here as a deliberate edit.
const CANONICAL_KEYS = [
  'momentum_chaser',
  'contrarian',
  'diversifier',
  'degen',
  'analyst',
  'guardian',
];

/**
 * Extract { key, render } from one constitution doc per the Flag H rule.
 * Throws (failing the test loudly) on zero or multiple marker lines, a
 * missing backticked key, or a missing blockquote after the marker.
 */
function extractGoldenRender(relPath) {
  const lines = readFileSync(resolve(REPO_ROOT, relPath), 'utf8').split('\n');
  const markerIndexes = lines
    .map((line, i) => (line.startsWith('**Golden render') ? i : -1))
    .filter((i) => i >= 0);
  expect(markerIndexes, `${relPath}: expected exactly one '**Golden render' marker`).toHaveLength(1);

  const markerLine = lines[markerIndexes[0]];
  const keyMatch = markerLine.match(/`([a-z_]+)`/);
  expect(keyMatch, `${relPath}: no backticked archetype key on the marker line`).not.toBeNull();

  let i = markerIndexes[0] + 1;
  while (i < lines.length && !lines[i].startsWith('> ')) i++;
  expect(i, `${relPath}: no blockquote after the golden-render marker`).toBeLessThan(lines.length);

  return { key: keyMatch[1], render: lines[i].slice(2) };
}

describe('completeness — exactly the six canonical code-ids', () => {
  it('EVAL_IDENTITY_BLOCKS carries all six keys and no others', () => {
    expect(Object.keys(EVAL_IDENTITY_BLOCKS).sort()).toEqual([...CANONICAL_KEYS].sort());
  });

  it('EVAL_IDENTITY_CONSTITUTION_PATHS mirrors the same key set', () => {
    expect(Object.keys(EVAL_IDENTITY_CONSTITUTION_PATHS).sort()).toEqual(
      Object.keys(EVAL_IDENTITY_BLOCKS).sort()
    );
  });
});

describe('doc-parity — constants are byte-equal to the constitution golden renders', () => {
  it.each(CANONICAL_KEYS)('%s: doc blockquote === shipped constant', (key) => {
    const relPath = EVAL_IDENTITY_CONSTITUTION_PATHS[key];
    const { key: docKey, render: docRender } = extractGoldenRender(relPath);

    // The doc's own backticked key must agree with the path map's key —
    // three sources (doc, path map, block map) locked to one another.
    expect(docKey).toBe(key);
    expect(EVAL_IDENTITY_BLOCKS[key].render).toBe(docRender);
  });

  it.each(CANONICAL_KEYS)('%s: render is a single-line IDENTITY sentence block', (key) => {
    const { render } = EVAL_IDENTITY_BLOCKS[key];
    expect(render.startsWith('IDENTITY — ')).toBe(true);
    expect(render.includes('\n')).toBe(false);
    expect(render.endsWith('.')).toBe(true);
  });
});

describe('size cap — ≤ 1050 chars per render (≈ 240 tokens, founder-ruled 2026-07-24)', () => {
  it.each(CANONICAL_KEYS)('%s: render length within the cap', (key) => {
    expect(EVAL_IDENTITY_BLOCKS[key].render.length).toBeLessThanOrEqual(
      EVAL_IDENTITY_RENDER_CHAR_CAP
    );
  });

  it('the cap constant itself is the ruled 1050', () => {
    expect(EVAL_IDENTITY_RENDER_CHAR_CAP).toBe(1050);
  });
});

describe('subordination clause — DR-13-as-amended, byte-locked', () => {
  it('matches the founder-ruled wording verbatim', () => {
    expect(EVAL_IDENTITY_SUBORDINATION_CLAUSE).toBe(
      'Platform limits and enforced values override this identity. Your equipped rules refine how you apply these principles but never reverse them.'
    );
  });
});

describe('version stamps (Flag G ruling)', () => {
  it('module-level versions carry the ruled values', () => {
    expect(EVAL_IDENTITY_PROMPT_SPEC_VERSION).toBe('dr13-1.0.0');
    expect(EVAL_IDENTITY_KERNEL_VERSION).toBe('1.0.0-pre-registry');
  });

  it.each(CANONICAL_KEYS)('%s: entry is stamped with both versions', (key) => {
    expect(EVAL_IDENTITY_BLOCKS[key].promptSpecVersion).toBe(EVAL_IDENTITY_PROMPT_SPEC_VERSION);
    expect(EVAL_IDENTITY_BLOCKS[key].kernelIdentityVersion).toBe(EVAL_IDENTITY_KERNEL_VERSION);
  });
});

describe('flag-on render contract — EVAL_IDENTITY_BLOCK_ENABLED=true (live)', () => {
  // This file keeps the flags module REAL (the BUILD_RULES §4 dependency-surface
  // guard), so it reads the production flag. After the DR-13 endgame flip that
  // flag is true, so a valid key renders the fenced block here.
  it('renderEvalIdentityBlock returns the fenced identity block for every canonical key', () => {
    for (const key of CANONICAL_KEYS) {
      const block = renderEvalIdentityBlock(key);
      expect(block).toContain('━━━ ARCHETYPE IDENTITY ━━━');
      expect(block).toContain(EVAL_IDENTITY_BLOCKS[key].render);
      expect(block).toContain(EQUIPPED_RULE_PRECEDENCE_ENABLED ? EVAL_IDENTITY_YIELD_CLAUSE : EVAL_IDENTITY_SUBORDINATION_CLAUSE);
    }
  });

  it('unknown / undefined keys still omit the block — the omit rule is flag-independent', () => {
    // A wrong identity is worse than none: membership (never falsiness) gates
    // the render, so these hold identically flag-off and flag-on.
    expect(renderEvalIdentityBlock('unknown')).toBe('');
    expect(renderEvalIdentityBlock(undefined)).toBe('');
  });
});
