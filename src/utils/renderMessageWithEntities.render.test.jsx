// src/utils/renderMessageWithEntities.render.test.jsx
//
// THE SHIPPED UNDERLINE — the guard A2.3's detector extraction was cited
// against, and did not have (A2.3 review L3-F2).
//
// Ruling 8 says the extraction's "flag-off byte-identity [is] proven by the
// chat golden", and `renderMessageWithEntities.jsx` repeated the claim. It was
// void: `agentBattleScreenGoldenFixture.js` passes NO `onSymbolClick`, so the
// function returns at its second line and neither golden contains a single
// entity span. `TICKER_ACCENT` could be changed to `#ff0000` with the whole
// suite green, and there was no test file for this module at all — while three
// Film Room surfaces render through it.
//
// So this file is the proof the claim needed. It pins the SHIPPED rendering,
// not the extraction: the spans, their roles and labels, their accents, their
// keys (which are the match indices — a change there reorders React's
// reconciliation of a message), the interleaved plain text, the two click
// payload shapes, and the four early returns.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  renderMessageWithEntities,
  TICKER_ACCENT,
  TERM_ACCENT,
} from './renderMessageWithEntities';
import { TERM_TOKENS_SET } from '../data/termUniverse';

const ROSTER = new Set(['NVDA', 'SLB', 'MU', 'ALL']);
const noop = () => {};
const html = (text, roster = ROSTER) => renderToStaticMarkup(
  <div>{renderMessageWithEntities(text, noop, roster)}</div>,
);
/** A glossary token that is not in the roster — a real one, read from the set. */
const TERM = [...TERM_TOKENS_SET].find((t) => /^[A-Z]{2,5}$/.test(t) && !ROSTER.has(t));

describe('the shipped ticker underline', () => {
  it('wraps a roster symbol in a tappable span with the ticker accent', () => {
    const out = html('MU rolled over; NVDA leads.');
    expect(out).toContain('Open research for MU');
    expect(out).toContain('Open research for NVDA');
    // The LITERAL, not the imported constant: asserting `color:${TICKER_ACCENT}`
    // mutates with the source and can never fail (the same self-reference the
    // review found elsewhere). The constant is pinned to it on the next line.
    expect(out).toContain('color:#5EEAD4');
    expect(TICKER_ACCENT).toBe('#5EEAD4');
    expect(out).toContain('1px dotted rgba(94, 234, 212, 0.4)');
    expect(out).toContain('role="button"');
    expect(out).toContain('tabindex="0"');
  });

  it('leaves the surrounding prose exactly where it was', () => {
    const text = 'MU rolled over; NVDA leads and nothing else changed.';
    const out = html(text);
    // Every character of the input survives, in order, once the tags go.
    expect(out.replace(/<[^>]+>/g, '')).toBe(text);
  });

  it('the span KEY is the match index — React reconciles a message on it', () => {
    const parts = renderMessageWithEntities('MU rolled over; NVDA leads.', noop, ROSTER);
    const keys = parts.filter((p) => typeof p === 'object').map((p) => p.key);
    expect(keys).toEqual(['0', '16']);
  });

  it('a glossary term gets the term accent and the glossary label, not the research one', () => {
    expect(TERM).toBeTruthy();
    const out = html(TERM);
    expect(out).toContain(`Open glossary for ${TERM}`);
    expect(out).toContain('color:#f59e0b');
    expect(TERM_ACCENT).toBe('#f59e0b');
    expect(out).not.toContain(`Open research for ${TERM}`);
  });

  it('TICKER BEATS TERM — a roster symbol that is also a glossary token is a ticker', () => {
    expect(TERM).toBeTruthy();
    const out = html(TERM, new Set([TERM]));
    expect(out).toContain(`Open research for ${TERM}`);
    expect(out).not.toContain('Open glossary for');
  });

  it('the fallthrough keeps an unknown acronym as plain text — a broken modal never opens', () => {
    const made = 'ZZZZZ';
    expect(TERM_TOKENS_SET.has(made)).toBe(false);
    const out = html(`${made} is not a thing`);
    expect(out).toBe(`<div>${made} is not a thing</div>`);
    expect(out).not.toContain('role="button"');
  });

  it('the two click payloads are the shipped ones', () => {
    const onClick = vi.fn();
    const parts = renderMessageWithEntities(`NVDA and ${TERM}`, onClick, ROSTER);
    const spans = parts.filter((p) => typeof p === 'object');
    spans[0].props.onClick();
    spans[1].props.onClick();
    expect(onClick).toHaveBeenNthCalledWith(1, { symbol: 'NVDA' });
    expect(onClick).toHaveBeenNthCalledWith(2, { type: 'term', token: TERM });
  });

  it('Enter and Space activate a span; nothing else does', () => {
    const onClick = vi.fn();
    const [span] = renderMessageWithEntities('NVDA', onClick, ROSTER).filter((p) => typeof p === 'object');
    for (const key of ['Enter', ' ']) {
      span.props.onKeyDown({ key, preventDefault: () => {} });
    }
    span.props.onKeyDown({ key: 'a', preventDefault: () => {} });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('the four early returns are the shipped ones', () => {
    // A non-string (a server contract violation) must not reach React.
    expect(renderMessageWithEntities({ text: 'x' }, noop, ROSTER)).toBe('');
    expect(renderMessageWithEntities(null, noop, ROSTER)).toBe('');
    // No handler, or no text: the string itself, by identity.
    const text = 'NVDA leads.';
    expect(renderMessageWithEntities(text, null, ROSTER)).toBe(text);
    expect(renderMessageWithEntities('', noop, ROSTER)).toBe('');
    // No match at all: the SAME string instance, not a rebuilt array.
    const plain = 'nothing here names a piece';
    expect(renderMessageWithEntities(plain, noop, ROSTER)).toBe(plain);
  });

  it('the SHIPPED caveats, on the rendered output', () => {
    // case-sensitive
    expect(html('slb looks weak')).not.toContain('role="button"');
    // `$NVDA` matches — `$` is a non-word character
    expect(html('taking $NVDA up a slot')).toContain('Open research for NVDA');
    // an English word in capitals that is also a symbol matches
    expect(html('ALL of it')).toContain('Open research for ALL');
    expect(html('all of it')).not.toContain('role="button"');
    // …and a symbol inside a longer word does not
    expect(html('NVDAX and NVDA1')).not.toContain('role="button"');
  });

  it('no roster and no terms: the text, untouched', () => {
    expect(renderMessageWithEntities('NVDA leads.', noop, null)).toBe('NVDA leads.');
    expect(renderMessageWithEntities('NVDA leads.', noop, new Set())).toBe('NVDA leads.');
  });
});
