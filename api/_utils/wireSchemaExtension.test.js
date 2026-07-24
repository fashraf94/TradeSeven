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
import { REPORTER_EVENT_ALLOWLIST, EVENT_CONTRACTS } from './wireContracts.js';

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

describe('prompt instruction', () => {
  it('names the reporter allowlist and carries no directive vocabulary', () => {
    const text = buildAgentFactsInstruction('doug');
    expect(text).toContain('earnings_recap | earnings_preview');
    expect(text).not.toMatch(/recommended_action:|sentiment:/);
    expect(text.startsWith('\n')).toBe(true); // appended, never replaces
  });
});
