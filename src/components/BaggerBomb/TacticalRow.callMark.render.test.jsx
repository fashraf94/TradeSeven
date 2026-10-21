// src/components/BaggerBomb/TacticalRow.callMark.render.test.jsx
//
// Cockpit Build 2b (spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5.8): the board-row
// dot. `callMark: 'command' | 'open'` puts one 6 px dot beside the PLAYER's
// symbol — teal "your live command", neutral "an open call" — on both of the
// side's paths (a live quote and an unavailable one). The CPU side never
// carries it. Without the prop the row's markup is the shipped one — asserted
// as a string comparison, not as an absence.
//
// renderToString: the markup is the whole claim.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TacticalRow from './TacticalRow';

const strip = (h) => h.replace(/<!-- -->/g, '');
const PLAYER = { symbol: 'VLO', priceChange: -1.2, thresholdPriceChange: -1.2, baseATR: 2.5, points: 4, badges: [], history: { maxMultiplier: 0.2, minMultiplier: -0.4 } };
const CPU = { symbol: 'ZS', priceChange: 0.8, thresholdPriceChange: 0.8, baseATR: 2.1, points: 3, badges: [], history: { maxMultiplier: 0.3, minMultiplier: 0 } };
const row = (props) => strip(renderToString(<TacticalRow leftAsset={PLAYER} rightAsset={CPU} tier="core" {...props} />));
const marks = (html) => [...html.matchAll(/<span[^>]*data-row-call-mark="([a-z]+)"[^>]*>/g)];

describe('TacticalRow callMark', () => {
  it('absent → byte-identical to the shipped row (null too)', () => {
    expect(row({ callMark: null })).toBe(row({}));
    expect(row({})).not.toContain('data-row-call-mark');
  });

  it("'command': one teal dot on the player's side, labelled \"your live command\"", () => {
    const html = row({ callMark: 'command' });
    const found = marks(html);
    expect(found).toHaveLength(1);
    expect(found[0][1]).toBe('command');
    expect(found[0][0]).toContain('aria-label="your live command"');
    expect(found[0][0]).toContain('role="img"');
    expect(found[0][0]).toContain('var(--ft-teal)');
    // On the player's side: the dot comes after the player's symbol and before the CPU's.
    expect(html.indexOf('data-row-call-mark')).toBeGreaterThan(html.indexOf('>VLO<'));
    expect(html.indexOf('data-row-call-mark')).toBeLessThan(html.indexOf('>ZS<'));
  });

  it("'open': the neutral dot, labelled \"an open call\"", () => {
    const [m] = marks(row({ callMark: 'open' }));
    expect(m[1]).toBe('open');
    expect(m[0]).toContain('aria-label="an open call"');
    expect(m[0]).toContain('var(--ft-text-muted)');
  });

  it('an unavailable quote keeps the mark beside the symbol', () => {
    const unavailable = { symbol: 'VLO', quoteAvailability: { status: 'unavailable', label: 'Quote unavailable' } };
    const html = strip(renderToString(<TacticalRow leftAsset={unavailable} rightAsset={CPU} tier="core" callMark="command" />));
    expect(html).toContain('data-quote-unavailable="VLO"');
    expect(marks(html)).toHaveLength(1);
  });
});
