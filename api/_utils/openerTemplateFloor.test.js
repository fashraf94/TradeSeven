import { describe, it, expect } from 'vitest';
// The real import of the module under test IS the dependency-surface guard
// (BUILD_RULES §4): it loads the fenced agentArchetypeConfig.js graph in the Node
// test env and explodes if a browser-only dep ever enters it. NEVER mock this.
import { buildTemplateOpener } from './openerTemplateFloor.js';

const noSentinels = (s) => {
  expect(s).not.toContain('undefined');
  expect(s).not.toContain('null');
  expect(s).not.toContain('[object Object]');
};

describe('buildTemplateOpener', () => {
  it('composes a non-empty opener with the archetype label and tier tickers', () => {
    const out = buildTemplateOpener({
      battle: {
        agentContext: { archetype: 'analyst' },
        portfolio: {
          star: [{ symbol: 'NVDA' }, { symbol: 'AAPL' }],
          core: [{ symbol: 'MSFT' }],
          support: [{ symbol: 'JNJ' }],
        },
      },
    });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain('Fundamental Investor'); // analyst → label
    expect(out).toContain('NVDA');
    expect(out).toContain('MSFT');
    expect(out).toContain('JNJ');
    expect(out.trim().endsWith('?')).toBe(true); // low-pressure closing question
    noSentinels(out);
  });

  it('degrades gracefully with an absent portfolio', () => {
    const out = buildTemplateOpener({ battle: { agentContext: { archetype: 'guardian' } } });
    expect(out).toContain('Capital Preserver');
    expect(out.length).toBeGreaterThan(0);
    noSentinels(out);
  });

  it('falls back to the strategist label + neutral posture for a missing archetype', () => {
    const out = buildTemplateOpener({ battle: { portfolio: { star: [{ symbol: 'SPY' }] } } });
    expect(out).toContain('SPY');
    expect(out).toContain('strategist'); // getArchetypeLabel(null) → 'strategist'
    noSentinels(out);
  });

  it('prefers the agent archetype when the battle carries none', () => {
    const out = buildTemplateOpener({ agent: { archetype: 'contrarian' }, battle: { portfolio: {} } });
    expect(out).toContain('Contrarian');
    noSentinels(out);
  });

  it('caps tickers at 3 per tier and ignores malformed entries', () => {
    const out = buildTemplateOpener({
      battle: {
        agentContext: { archetype: 'analyst' },
        portfolio: {
          star: [
            { symbol: 'AAAA' }, { symbol: 'BBBB' }, { symbol: 'CCCC' }, { symbol: 'DDDD' },
            { notSymbol: 'x' }, null,
          ],
        },
      },
    });
    expect(out).toContain('AAAA');
    expect(out).toContain('CCCC');
    expect(out).not.toContain('DDDD'); // 4th symbol dropped by the cap
    noSentinels(out);
  });

  it('never throws on an empty/undefined argument', () => {
    expect(() => buildTemplateOpener()).not.toThrow();
    expect(() => buildTemplateOpener({})).not.toThrow();
    expect(buildTemplateOpener().length).toBeGreaterThan(0);
  });
});
