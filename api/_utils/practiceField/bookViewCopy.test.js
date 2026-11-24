// api/_utils/practiceField/bookViewCopy.test.js
//
// Practice Field build B3 — THE SCREEN'S FIXED WORDS (ruling B3-5). The refusal map must cover every refusal code the
// drafting path can record: the list is DERIVED from the source of the modules that write them (a draft's contract check,
// admission, admission's marks and drafting), so a code added there and not here fails this row instead of silently
// reading "Refused: not admitted". And no fixed word says validated, proven or supported (contract §4.4).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as COPY from './bookViewCopy.js';
import { REFUSAL_REASONS, REFUSAL_UNMAPPED, FAILED_CHECK } from './bookViewCopy.js';
import { CODE_FALLBACK_NOTE } from './agentConfig.js';
import { BANNED_RESULT_WORDS } from './__testsupport__/fixtures.js';

const SOURCES = ['contract.js', 'admission.js', 'admissionMarks.js', 'agentDrafting.js'];
/** Codes the drafting path records that deliberately read the fallback: a refusal that named no reason. */
const DELIBERATELY_UNMAPPED = new Set(['refused']);

function codesIn(file) {
  const src = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/refuse\('([a-z_]+)'/g)) out.add(m[1]);
  for (const m of src.matchAll(/\bcode: '([a-z_]+)'/g)) out.add(m[1]);
  return out;
}

describe('B3-5: the refusal map', () => {
  it('covers every refusal code the drafting path writes (derived from the source, so a new code fails here)', () => {
    const codes = new Set(SOURCES.flatMap((f) => [...codesIn(f)]));
    expect(codes.size, 'the source walk found the codes it should').toBeGreaterThan(40);
    const missing = [...codes].filter((c) => !Object.hasOwn(REFUSAL_REASONS, c) && !DELIBERATELY_UNMAPPED.has(c)).sort();
    expect(missing).toEqual([]);
  });
  it('maps no code the source does not write (a stale entry is pruned with its code)', () => {
    const codes = new Set(SOURCES.flatMap((f) => [...codesIn(f)]));
    const stale = Object.keys(REFUSAL_REASONS).filter((c) => !codes.has(c)).sort();
    // The engine's own internal answers, mapped on purpose: none is stale today.
    expect(stale).toEqual([]);
  });
  it('every sentence is plain: lower-case first word, no trailing stop, no code in it', () => {
    for (const [code, s] of Object.entries(REFUSAL_REASONS)) {
      expect(s, code).toMatch(/^[a-z]/);
      expect(s, code).not.toMatch(/\.$/);
      expect(s, code).not.toMatch(/_/);
    }
    expect(REFUSAL_UNMAPPED).toBe('not admitted');
  });
});

describe('the fixed words', () => {
  it('the failed-check sentence is the agent\'s own code-built note, word for word', () => {
    expect(FAILED_CHECK).toBe(CODE_FALLBACK_NOTE);
  });
  it('no fixed word says validated, proven or supported (contract §4.4)', () => {
    const texts = [];
    const add = (v) => {
      if (typeof v === 'string') texts.push(v);
      else if (typeof v === 'function') { try { texts.push(String(v('X', 'Y', true))); } catch { texts.push(String(v)); } }
      else if (v && typeof v === 'object') Object.values(v).forEach(add);
    };
    Object.values(COPY).forEach(add);
    for (const t of texts) expect(t).not.toMatch(BANNED_RESULT_WORDS);
  });
});
