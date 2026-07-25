// api/_utils/wireSchemaExtension.test.js
// Clone-never-mutate (warm-container M8) + extension shape. The base tool
// constants must remain byte-identical after any number of extensions —
// flag-off requests pass the pristine singleton by identity.

import { describe, it, expect } from 'vitest';
import {
  PUBLISH_MARKET_PULSE_TOOL,
  PUBLISH_STORY_TOOL,
  PUBLISH_ECON_RECAP_TOOL,
  PUBLISH_ECON_PREVIEW_TOOL,
  PUBLISH_EARNINGS_PREVIEW_TOOL,
  PUBLISH_EARNINGS_RECAP_TOOL,
  PUBLISH_SECTOR_COLUMN_TOOL,
} from './fantasyTimesPrompts.js';
import { extendToolWithAgentFacts, buildAgentFactsInstruction } from './wireSchemaExtension.js';
import {
  REPORTER_EVENT_ALLOWLIST,
  EVENT_CONTRACTS,
  SHARED_FIGURE_BASES,
  INDEX_SUBJECTS,
  WIRE_OUTCOMES,
} from './wireContracts.js';
import { validateAgentFacts } from './wireValidator.js';

const PAIRS = [
  ['kai', PUBLISH_MARKET_PULSE_TOOL],
  ['alex', PUBLISH_STORY_TOOL],
  ['neta', PUBLISH_ECON_RECAP_TOOL],
  ['neta', PUBLISH_ECON_PREVIEW_TOOL],
  ['doug', PUBLISH_EARNINGS_PREVIEW_TOOL],
  ['doug', PUBLISH_EARNINGS_RECAP_TOOL],
  ['kim', PUBLISH_SECTOR_COLUMN_TOOL],
];

describe('warm-container M8: the base constants are never mutated', () => {
  for (const [reporter, tool] of PAIRS) {
    it(`${tool.name} unchanged after extension for ${reporter}`, () => {
      const pristine = JSON.parse(JSON.stringify(tool)); // snapshot before
      const extended = extendToolWithAgentFacts(tool, reporter);

      // the ORIGINAL is byte-identical to its pre-extension snapshot
      expect(JSON.parse(JSON.stringify(tool))).toEqual(pristine);
      expect(tool.input_schema.properties.agentFacts).toBeUndefined();

      // the CLONE carries the extension and is a distinct object graph
      expect(extended).not.toBe(tool);
      expect(extended.input_schema).not.toBe(tool.input_schema);
      expect(extended.input_schema.properties.agentFacts).toBeDefined();
      // required untouched — agentFacts is optional at the schema layer
      expect(extended.input_schema.required).toEqual(tool.input_schema.required);
    });
  }

  it('repeated extensions in one warm container never accumulate on the base', () => {
    for (let i = 0; i < 3; i++) extendToolWithAgentFacts(PUBLISH_MARKET_PULSE_TOOL, 'kai');
    expect(PUBLISH_MARKET_PULSE_TOOL.input_schema.properties.agentFacts).toBeUndefined();
  });
});

describe('extension shape derives from the contracts', () => {
  it('eventType enum equals the reporter allowlist; qualifiers are the union', () => {
    for (const [reporter, tool] of PAIRS) {
      const af = extendToolWithAgentFacts(tool, reporter).input_schema.properties.agentFacts;
      expect(af.properties.eventType.enum).toEqual([...REPORTER_EVENT_ALLOWLIST[reporter]]);
      expect(af.required).toEqual(['eventType', 'tickers']);
      const expectedQualifiers = [...new Set(
        REPORTER_EVENT_ALLOWLIST[reporter].flatMap((t) => EVENT_CONTRACTS[t].qualifiers)
      )];
      if (expectedQualifiers.length > 0) {
        expect(af.properties.qualifiers.items.enum).toEqual(expectedQualifiers);
      } else {
        expect(af.properties.qualifiers.items.enum).toBeUndefined();
      }
    }
  });

  it('throws for a reporter with no Wire allowlist (vera excluded v1)', () => {
    expect(() => extendToolWithAgentFacts(PUBLISH_STORY_TOOL, 'vera')).toThrow(/no Wire allowlist/);
  });
});

describe('per-seam eventType pinning (V1.6 A4)', () => {
  const PINNED = [
    ['doug', PUBLISH_EARNINGS_RECAP_TOOL, 'earnings_recap'],
    ['doug', PUBLISH_EARNINGS_PREVIEW_TOOL, 'earnings_preview'],
    ['neta', PUBLISH_ECON_RECAP_TOOL, 'econ_print'],
    ['neta', PUBLISH_ECON_PREVIEW_TOOL, 'econ_preview'],
  ];

  for (const [reporter, tool, pin] of PINNED) {
    it(`${pin}: eventType enum collapses to the pin; vocabularies are the row's EXACT sets`, () => {
      const af = extendToolWithAgentFacts(tool, reporter, { pinEventType: pin })
        .input_schema.properties.agentFacts;
      const row = EVENT_CONTRACTS[pin];

      expect(af.properties.eventType.enum).toEqual([pin]);
      expect(af.properties.magnitude.properties.basis.enum).toEqual([...row.magnitudeBases]);
      expect(af.properties.figures.items.properties.basis.enum).toEqual(
        [...new Set([...row.magnitudeBases, ...SHARED_FIGURE_BASES])]
      );
      if (row.qualifiers.length > 0) {
        expect(af.properties.qualifiers.items.enum).toEqual([...row.qualifiers]);
      } else {
        expect(af.properties.qualifiers.items.enum).toBeUndefined();
      }
      // subjectRef never appears on a pinned seam: Doug's rows have none and
      // Neta's are server-owned — the model must not see the field (A2).
      expect(af.properties.subjectRef).toBeUndefined();
    });
  }

  it('pinned PREVIEW schemas exclude the direction property entirely; pinned recaps keep it', () => {
    const prev = extendToolWithAgentFacts(PUBLISH_EARNINGS_PREVIEW_TOOL, 'doug', { pinEventType: 'earnings_preview' })
      .input_schema.properties.agentFacts;
    const econPrev = extendToolWithAgentFacts(PUBLISH_ECON_PREVIEW_TOOL, 'neta', { pinEventType: 'econ_preview' })
      .input_schema.properties.agentFacts;
    const recap = extendToolWithAgentFacts(PUBLISH_EARNINGS_RECAP_TOOL, 'doug', { pinEventType: 'earnings_recap' })
      .input_schema.properties.agentFacts;
    const econRecap = extendToolWithAgentFacts(PUBLISH_ECON_RECAP_TOOL, 'neta', { pinEventType: 'econ_print' })
      .input_schema.properties.agentFacts;

    expect(prev.properties.direction).toBeUndefined();
    expect(econPrev.properties.direction).toBeUndefined();
    expect(recap.properties.direction).toBeDefined();
    expect(econRecap.properties.direction).toBeDefined();
  });

  it('the pin removes cross-row vocabulary the union schema invited (the salvage-noise defect)', () => {
    // Unpinned, Doug's PREVIEW schema offered the RECAP's bases — a
    // schema-conformant preview could cite eps_vs_consensus and get
    // salvage-dropped or rejected. Pinned, that basis is unrepresentable.
    const union = extendToolWithAgentFacts(PUBLISH_EARNINGS_PREVIEW_TOOL, 'doug')
      .input_schema.properties.agentFacts;
    const pinned = extendToolWithAgentFacts(PUBLISH_EARNINGS_PREVIEW_TOOL, 'doug', { pinEventType: 'earnings_preview' })
      .input_schema.properties.agentFacts;

    expect(union.properties.magnitude.properties.basis.enum).toContain('eps_vs_consensus');
    expect(pinned.properties.magnitude.properties.basis.enum).not.toContain('eps_vs_consensus');
    expect(union.properties.direction).toBeDefined();
  });

  it('a payload inside the pinned preview vocabulary round-trips CLEAN through the validator', () => {
    // The A4 acceptance: pinning makes schema-conformant ⇒ validator-clean
    // on single-eventType seams. This exact payload was representable-and-
    // rejectable under the union schema (direction offered there).
    const result = validateAgentFacts({
      rawAgentFacts: {
        eventType: 'earnings_preview',
        tickers: ['COST'],
        magnitude: { value: 3.71, unit: 'usd', basis: 'consensus_estimate' },
      },
      reporter: 'doug',
      stopReason: 'tool_use',
      primaryTickerRaw: 'COST',
    });
    expect(result.outcome).toBe(WIRE_OUTCOMES.PASSED);
    expect(result.codes).toEqual([]);

    // The reject class the exclusion protects against is still enforced.
    const withDirection = validateAgentFacts({
      rawAgentFacts: {
        eventType: 'earnings_preview',
        tickers: ['COST'],
        direction: 'up',
        magnitude: { value: 3.71, unit: 'usd', basis: 'consensus_estimate' },
      },
      reporter: 'doug',
      stopReason: 'tool_use',
      primaryTickerRaw: 'COST',
    });
    expect(withDirection.outcome).toBe(WIRE_OUTCOMES.REJECTED);
  });

  it('subjectRef appears ONLY when the schema offers index_move (Kai), with the closed index enum', () => {
    const kai = extendToolWithAgentFacts(PUBLISH_MARKET_PULSE_TOOL, 'kai')
      .input_schema.properties.agentFacts;
    expect(kai.properties.subjectRef).toBeDefined();
    expect(kai.properties.subjectRef.enum).toEqual([...INDEX_SUBJECTS]);
    for (const [reporter, tool] of PAIRS) {
      if (reporter === 'kai') continue;
      const af = extendToolWithAgentFacts(tool, reporter).input_schema.properties.agentFacts;
      expect(af.properties.subjectRef, reporter).toBeUndefined();
    }
  });

  it('a pin outside the reporter allowlist throws', () => {
    expect(() => extendToolWithAgentFacts(PUBLISH_ECON_RECAP_TOOL, 'neta', { pinEventType: 'earnings_recap' }))
      .toThrow(/outside/);
  });
});

describe('prompt instruction', () => {
  it('names the reporter allowlist and carries no directive vocabulary', () => {
    const text = buildAgentFactsInstruction('doug');
    expect(text).toContain('earnings_recap | earnings_preview');
    expect(text).not.toMatch(/recommended_action:|sentiment:/);
    expect(text.startsWith('\n')).toBe(true); // appended, never replaces
  });

  it('mirrors the pin (V1.6 A4) and scopes the subjectRef line to index_move schemas (A2)', () => {
    const pinned = buildAgentFactsInstruction('doug', { pinEventType: 'earnings_preview' });
    expect(pinned).toContain("always 'earnings_preview'");
    expect(pinned).not.toContain('earnings_recap |');
    expect(pinned).not.toContain('subjectRef');

    const kai = buildAgentFactsInstruction('kai');
    expect(kai).toContain('subjectRef: REQUIRED on index_move');
    const netaPinned = buildAgentFactsInstruction('neta', { pinEventType: 'econ_print' });
    expect(netaPinned).not.toContain('subjectRef');
  });
});
