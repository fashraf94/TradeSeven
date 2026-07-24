// api/_utils/wireSchemaExtension.js
// FantasyTimes Wire — flag-gated Tool Use schema extension + prompt
// instruction (Spec V1.5 §4.5 step 1, §4.8, M8).
//
// CLONE, NEVER MUTATE: the publish tools are shared module-level singletons
// reused across warm-container invocations. This module deep-clones the base
// tool and grafts the agentFacts property onto the CLONE; the original
// constant is never touched, so a flag-off request passes the pristine
// singleton by identity and the outbound payload stays byte-identical to the
// pre-Wire build (§9 warm-container M8 test).

import {
  DIRECTIONS,
  UNITS,
  KEY_LEVEL_TYPES,
  FIGURES_CAP,
  QUALIFIERS_CAP,
  REPORTER_EVENT_ALLOWLIST,
  EVENT_CONTRACTS,
  magnitudeBasesForReporter,
  qualifiersForReporter,
  SHARED_FIGURE_BASES,
} from './wireContracts.js';

/**
 * Return a deep-cloned copy of `baseTool` with the optional `agentFacts`
 * property added to input_schema.properties. `required` is untouched —
 * agentFacts is optional at the schema layer; the validator enforces
 * presence server-side (absent → REJECT R4_MISSING, counted by the gate).
 */
export function extendToolWithAgentFacts(baseTool, reporter) {
  const eventTypes = REPORTER_EVENT_ALLOWLIST[reporter];
  if (!eventTypes || eventTypes.length === 0) {
    throw new Error(`extendToolWithAgentFacts: no Wire allowlist for reporter '${reporter}'`);
  }
  const clone = structuredClone(baseTool);
  const magBases = magnitudeBasesForReporter(reporter);
  const figBases = [...new Set([...magBases, ...SHARED_FIGURE_BASES])];
  const reporterQualifiers = qualifiersForReporter(reporter);

  const valueUnitBasis = (basisEnum) => ({
    type: 'object',
    properties: {
      value: { type: 'number', description: 'Signed: carries the direction of change. Must match your source data exactly.' },
      unit: { type: 'string', enum: [...UNITS] },
      basis: { type: 'string', enum: basisEnum },
    },
    required: ['value', 'unit', 'basis'],
  });

  clone.input_schema.properties.agentFacts = {
    type: 'object',
    description:
      'Typed machine facts about the PRIMARY event in this story, for the FantasyTimes Wire. ' +
      'Report ONLY values present in your source data — omit any field you cannot ground. ' +
      'No recommendations, no sentiment, no free text.',
    properties: {
      eventType: {
        type: 'string',
        enum: [...eventTypes],
        description: 'The event class this story reports.',
      },
      tickers: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Tickers this event is about, primary first. Cardinality per eventType: ' +
          eventTypes.map((t) => `${t}=${EVENT_CONTRACTS[t].tickers[0]}-${EVENT_CONTRACTS[t].tickers[1]}`).join(', ') +
          '. Empty array for zero-ticker (macro/econ) eventTypes.',
      },
      direction: {
        type: 'string',
        enum: [...DIRECTIONS],
        description:
          'Direction of the change. OMIT ENTIRELY for preview eventTypes (previews carry no direction). ' +
          'Must agree with the sign of magnitude.value.',
      },
      magnitude: valueUnitBasis(magBases),
      keyLevel: {
        type: 'object',
        properties: {
          price: { type: 'number' },
          type: { type: 'string', enum: [...KEY_LEVEL_TYPES] },
        },
        required: ['price', 'type'],
        description: 'A price level the move relates to, if one is in your source data.',
      },
      figures: {
        type: 'array',
        maxItems: FIGURES_CAP,
        items: valueUnitBasis(figBases),
        description: `Up to ${FIGURES_CAP} additional typed figures from your source data.`,
      },
      qualifiers: {
        type: 'array',
        maxItems: QUALIFIERS_CAP,
        items: reporterQualifiers.length > 0
          ? { type: 'string', enum: reporterQualifiers }
          : { type: 'string' },
        description: reporterQualifiers.length > 0
          ? `Non-numeric facts, from the closed set only: ${reporterQualifiers.join(', ')}.`
          : 'Omit — no qualifier vocabulary is defined for your eventTypes.',
      },
    },
    required: ['eventType', 'tickers'],
  };
  return clone;
}

/**
 * The flag-gated system-prompt addendum instructing the reporter to populate
 * agentFacts. Appended to the system string ONLY when WIRE_WRITES_ENABLED —
 * flag-off appends nothing, keeping the prompt byte-identical.
 */
export function buildAgentFactsInstruction(reporter) {
  const eventTypes = REPORTER_EVENT_ALLOWLIST[reporter] || [];
  return [
    '',
    'AGENT FACTS (machine wire — required):',
    'Alongside the story fields, populate the agentFacts object with typed facts about the PRIMARY event you are reporting.',
    `- eventType: exactly one of ${eventTypes.join(' | ')}.`,
    '- tickers: the tickers the EVENT is about (primary first); empty for market-wide/econ events.',
    '- Every number must appear in the data you were given — never estimate, never round differently.',
    '- Omit direction for preview eventTypes. Omit any field your source data does not support.',
    '- agentFacts is for machines: no prose, no recommendations, no sentiment.',
  ].join('\n');
}
