// src/components/Research/TechnicalTabV2.levelsNote.test.jsx
//
// The Chart view's read (spec docs/specs/CHART_READ_SPEC_V1.md; round 6): TechnicalTabV2's one new line, `levelsNote`
// — its levels are their own calculation, not the rule's 20-session high and low. Absent (every caller but the read's),
// the output is the output without the prop, with no note element (review L3-5: rendering the note always survived
// every row before this file).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TechnicalTabV2 from './TechnicalTabV2.jsx';

const LEVELS = { support: [{ price: 139.2, strength: 'strong', touches: 3 }], resistance: [{ price: 148.9, strength: 'moderate', touches: 2 }], currentPrice: 143.35 };
const props = { asset: { symbol: 'ABC', price: 143.35 }, dailyData: null, indicators: null, levels: LEVELS, sessionDate: '2026-11-18', onLevelHighlight: () => {} };
const NOTE = 'Support and resistance · its own calculation · not the rule’s 20-session high and low';

describe('TechnicalTabV2 levelsNote', () => {
  it('absent: no note element, and the same markup as an explicit null', () => {
    const html = renderToStaticMarkup(<TechnicalTabV2 {...props} />);
    expect(html).not.toContain('data-levels-note');
    expect(html).not.toContain('its own calculation');
    expect(renderToStaticMarkup(<TechnicalTabV2 {...props} levelsNote={null} />)).toBe(html);
  });
  it('present: the one line, once, inside Price Levels before its first level', () => {
    const html = renderToStaticMarkup(<TechnicalTabV2 {...props} levelsNote={NOTE} />);
    expect(html.split('data-levels-note').length - 1).toBe(1);
    expect(html.indexOf('Price Levels')).toBeLessThan(html.indexOf(NOTE));
    expect(html.indexOf(NOTE)).toBeLessThan(html.indexOf('139.2'));
  });
});
