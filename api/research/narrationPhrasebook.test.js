/**
 * Meta-test for the narration phrasebook (Change 2). The voice is tested BEFORE
 * any narration exists: every approved frame + connective is linted against the
 * banned lexicon, a no-future-tense check, a past-tense-presence check, and a
 * structural (declared-slot) check. If any frame could read as causal, forward,
 * advisory, or certain — or drifts from its declared slots — CI fails here,
 * before the plan builder or the model ever run.
 */
import { describe, it, expect } from 'vitest';
import {
  PHRASEBOOK,
  CONNECTIVES,
  BANNED_LEXICON,
  APPROVED_PAST_VERBS,
  PHRASEBOOK_VERSION,
  PROMPT_VERSION,
  MODEL_VERSION,
  fillSlots,
  variantsFor,
  templateFor,
} from './narrationPhrasebook.js';

// The frame's LITERAL words: slots removed, NFKC-folded, lower-cased. This is
// what the reader sees minus the data — exactly what must never carry a banned
// token.
const frameWords = (template) => template.replace(/\{[A-Za-z0-9]+\}/g, ' ').normalize('NFKC').toLowerCase();

const allVariants = Object.entries(PHRASEBOOK).flatMap(([claimId, def]) =>
  def.variants.map((v) => ({ claimId, ...v }))
);

describe('narration phrasebook — banned lexicon', () => {
  it('no frame contains a causal / forward / advisory / certainty token', () => {
    for (const v of allVariants) {
      const words = frameWords(v.template);
      for (const { family, re } of BANNED_LEXICON) {
        expect(re.test(words), `${v.claimId}/${v.id} tripped ${family}: "${v.template}"`).toBe(false);
      }
    }
  });

  it('no connective contains a banned token', () => {
    for (const conn of CONNECTIVES) {
      const words = conn.normalize('NFKC').toLowerCase();
      for (const { family, re } of BANNED_LEXICON) {
        expect(re.test(words), `connective "${conn}" tripped ${family}`).toBe(false);
      }
    }
  });
});

describe('narration phrasebook — no future tense', () => {
  const FUTURE = BANNED_LEXICON.find((b) => b.family === 'forward').re;
  it('no frame reads as forward-looking', () => {
    for (const v of allVariants) {
      expect(FUTURE.test(frameWords(v.template)), `${v.claimId}/${v.id}: "${v.template}"`).toBe(false);
    }
  });
});

describe('narration phrasebook — past-tense presence', () => {
  it('every frame contains at least one approved past-tense verb', () => {
    for (const v of allVariants) {
      const words = frameWords(v.template);
      const hit = APPROVED_PAST_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`).test(words));
      expect(hit, `${v.claimId}/${v.id} has no past-tense verb: "${v.template}"`).toBe(true);
    }
  });
});

describe('narration phrasebook — structural lint', () => {
  it('every {slot} in a template is declared in the claim slots AND the variant requires', () => {
    for (const [claimId, def] of Object.entries(PHRASEBOOK)) {
      for (const v of def.variants) {
        const used = [...v.template.matchAll(/\{([A-Za-z0-9]+)\}/g)].map((m) => m[1]);
        for (const slot of used) {
          expect(def.slots, `${claimId}/${v.id} uses undeclared slot {${slot}}`).toContain(slot);
          expect(v.requires, `${claimId}/${v.id} uses {${slot}} not in requires`).toContain(slot);
        }
      }
    }
  });

  it('every requires slot appears in the template (no orphan requirement)', () => {
    for (const [claimId, def] of Object.entries(PHRASEBOOK)) {
      for (const v of def.variants) {
        const used = new Set([...v.template.matchAll(/\{([A-Za-z0-9]+)\}/g)].map((m) => m[1]));
        for (const slot of v.requires) {
          expect(used.has(slot), `${claimId}/${v.id} requires {${slot}} but never uses it`).toBe(true);
        }
      }
    }
  });

  it('every claim carries 2–4 variants with unique ids', () => {
    for (const [claimId, def] of Object.entries(PHRASEBOOK)) {
      expect(def.variants.length, `${claimId} variant count`).toBeGreaterThanOrEqual(2);
      expect(def.variants.length, `${claimId} variant count`).toBeLessThanOrEqual(4);
      const ids = def.variants.map((v) => v.id);
      expect(new Set(ids).size, `${claimId} duplicate variant id`).toBe(ids.length);
    }
  });
});

describe('narration phrasebook — versions + accessors', () => {
  it('exports non-empty versions and the pinned model id (must track gemmaClient)', () => {
    expect(PHRASEBOOK_VERSION).toBeTruthy();
    expect(PROMPT_VERSION).toBeTruthy();
    // gemmaClient.js pins google/gemma-4-26b-a4b-it (GEMMA_MODEL, private). Keep
    // this literal in sync — a model swap must bump MODEL_VERSION and orphan cache.
    expect(MODEL_VERSION).toBe('google/gemma-4-26b-a4b-it');
  });

  it('fillSlots substitutes declared slots and leaves unknown slots literal', () => {
    expect(fillSlots('a {x} b {y}', { x: '1', y: '2' })).toBe('a 1 b 2');
    expect(fillSlots('a {x} b {y}', { x: '1' })).toBe('a 1 b {y}');
  });

  it('templateFor / variantsFor resolve real entries', () => {
    expect(variantsFor('headline_link').length).toBeGreaterThan(0);
    expect(templateFor('headline_link', 'hl_raw')).toContain('{name}');
    expect(templateFor('headline_link', 'nope')).toBeNull();
  });
});
