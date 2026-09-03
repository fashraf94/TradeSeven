// src/utils/findKnownTickers.test.js
//
// A2.3, ruling 8 — the detector, lifted out of the renderer unchanged.
//
// The rows below hold the SHIPPED rule, caveats included. Every one of the
// caveats is a behaviour a well-meaning "fix" would remove, and removing it
// would change what the chat underlines for a real user on the shipped path.
// They are pinned here so the extraction cannot quietly become a rewrite.

import { describe, it, expect } from 'vitest';
import { findKnownTickers, scanEntities, textNamesTicker, ENTITY_KIND } from './findKnownTickers';
import { TERM_TOKENS_SET } from '../data/termUniverse';

const ROSTER = new Set(['NVDA', 'SLB', 'MU', 'CF', 'ALL']);

describe('findKnownTickers — the roster question', () => {
  it('finds the roster symbols a message names, in first-occurrence order', () => {
    expect(findKnownTickers('MU rolled over; NVDA leads and SLB is flat.', ROSTER))
      .toEqual(['MU', 'NVDA', 'SLB']);
  });

  it('is DISTINCT — a message that says NVDA three times is one message about NVDA', () => {
    expect(findKnownTickers('NVDA, NVDA and NVDA again.', ROSTER)).toEqual(['NVDA']);
  });

  it('names nothing outside the roster', () => {
    expect(findKnownTickers('AAPL and TSLA are not in this battle.', ROSTER)).toEqual([]);
    expect(findKnownTickers('NVDA is.', new Set())).toEqual([]);
    expect(findKnownTickers('NVDA is.', null)).toEqual([]);
  });

  it('CAVEAT — case-sensitive: `slb` is not SLB', () => {
    expect(findKnownTickers('slb looks weak', ROSTER)).toEqual([]);
    expect(findKnownTickers('Slb looks weak', ROSTER)).toEqual([]);
    expect(findKnownTickers('SLB looks weak', ROSTER)).toEqual(['SLB']);
  });

  it('CAVEAT — `$NVDA` matches: `$` is a non-word character, so the boundary holds', () => {
    expect(findKnownTickers('taking $NVDA up a slot', ROSTER)).toEqual(['NVDA']);
  });

  it('CAVEAT — a symbol that is also an English word matches the word in capitals', () => {
    expect(findKnownTickers('ALL of it', ROSTER)).toEqual(['ALL']);
    expect(findKnownTickers('all of it', ROSTER)).toEqual([]);
  });

  it('a symbol inside a longer word does not match', () => {
    expect(findKnownTickers('NVDAX and XNVDA and NVDA1', ROSTER)).toEqual([]);
  });

  it('non-text in, empty out — never a throw', () => {
    for (const bad of [null, undefined, 42, {}, [], '']) {
      expect(findKnownTickers(bad, ROSTER)).toEqual([]);
    }
  });

  it('textNamesTicker is the same rule, asked about one piece', () => {
    expect(textNamesTicker('MU rolled over; NVDA leads.', 'NVDA', ROSTER)).toBe(true);
    expect(textNamesTicker('MU rolled over; NVDA leads.', 'SLB', ROSTER)).toBe(false);
    expect(textNamesTicker('MU rolled over.', null, ROSTER)).toBe(false);
  });
});

describe('scanEntities — the ONE scan the renderer and the count share', () => {
  it('carries the index the renderer slices on, in order', () => {
    const text = 'MU rolled over; NVDA leads.';
    expect(scanEntities(text, ROSTER)).toEqual([
      { word: 'MU', index: 0, kind: ENTITY_KIND.TICKER },
      { word: 'NVDA', index: 16, kind: ENTITY_KIND.TICKER },
    ]);
    expect(text.slice(16, 20)).toBe('NVDA');
  });

  it('CAVEAT — a roster symbol beats a glossary term', () => {
    const term = [...TERM_TOKENS_SET].find((t) => /^[A-Z]{1,5}$/.test(t));
    expect(term).toBeTruthy();
    expect(scanEntities(term, new Set([term]))[0].kind).toBe(ENTITY_KIND.TICKER);
    expect(scanEntities(term, new Set())[0].kind).toBe(ENTITY_KIND.TERM);
  });

  it('a word that is neither is plain text — the fallthrough that keeps a broken modal shut', () => {
    // The reason the shipped rule has a fallthrough at all: an uppercase
    // acronym that is not a ticker must not route to AssetResearchModal.
    const madeUp = 'ZZZZZ';
    expect(TERM_TOKENS_SET.has(madeUp)).toBe(false);
    expect(scanEntities(`${madeUp} is not a thing`, ROSTER)).toEqual([]);
  });

  it('repeat calls are stable — and the safety is the LOOP, not the fresh instance', () => {
    // Recorded honestly (review L4-F6): the old title claimed a fresh matcher
    // per scan guards against a leaked `lastIndex`, and sharing one module-level
    // regex passes every row here. It has to: the loop always runs to
    // `exec() === null`, which resets `lastIndex` to 0. The rows below prove
    // what is actually true — repeat calls agree — and the comment no longer
    // claims a guard the code does not need.
    const text = 'NVDA and SLB';
    expect(scanEntities(text, ROSTER)).toEqual(scanEntities(text, ROSTER));
    expect(findKnownTickers(text, ROSTER)).toEqual(['NVDA', 'SLB']);
    expect(findKnownTickers(text, ROSTER)).toEqual(['NVDA', 'SLB']);
    // …including interleaved with a scan that finds nothing, which is where a
    // shared, half-consumed regex would actually show.
    expect(scanEntities('nothing here', ROSTER)).toEqual([]);
    expect(findKnownTickers(text, ROSTER)).toEqual(['NVDA', 'SLB']);
  });
});
