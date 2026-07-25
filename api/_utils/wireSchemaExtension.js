// api/_utils/wireSchemaExtension.js
// FantasyTimes Wire — flag-gated Tool Use schema extension + prompt
// instruction (Spec V1.5 §4.5 step 1, §4.8, M8; V1.6 A2/A4).
//
// CLONE, NEVER MUTATE: the publish tools are shared module-level singletons
// reused across warm-container invocations. This module deep-clones the base
// tool and grafts the agentFacts property onto the CLONE; the original
// constant is never touched, so a flag-off request passes the pristine
// singleton by identity and the outbound payload stays byte-identical to the
// pre-Wire build (§9 warm-container M8 test).
//
// V1.6 A4 — per-seam eventType PINNING: the four single-eventType seams
// (doug_earnings_recap, doug_earnings_preview, neta_econ_recap→econ_print,
// neta_econ_preview→econ_preview) pin eventType to that row and offer that
// row's EXACT vocabularies (qualifiers, magnitude/figure bases). Pinned
// preview rows additionally EXCLUDE the direction property — direction is
// forbidden there, so offering it would invite R4 rejects from
// schema-conformant payloads. Multi-eventType seams keep the per-reporter
// union; the residual salvage noise is a documented §6.1 gate note.
//
// V1.6 A2 — subjectRef: the property appears ONLY when the schema's
// eventType set includes index_move (Kai's multi-schema). Neta's pinned
// schemas exclude it entirely — subjectRef is server-owned on her rows and
// the model never sees the field.

import {
  DIRECTIONS,
  UNITS,
  KEY_LEVEL_TYPES,
  FIGURES_CAP,
  QUALIFIERS_CAP,
  REPORTER_EVENT_ALLOWLIST,
  EVENT_CONTRACTS,
  SHARED_FIGURE_BASES,
  INDEX_SUBJECTS,
} from './wireContracts.js';

/**
 * Return a deep-cloned copy of `baseTool` with the optional `agentFacts`
 * property added to input_schema.properties. `required` is untouched —
 * agentFacts is optional at the schema layer; the validator enforces
 * presence server-side (absent → REJECT R4_MISSING, counted by the gate).
 *
 * @param {object} baseTool — the pristine publish tool singleton
 * @param {string} reporter — 'kai'|'alex'|'neta'|'doug'|'kim'
 * @param {object} [opts]
 * @param {string} [opts.pinEventType] — single-eventType seams (V1.6 A4):
 *        pin eventType to this row and offer the row's exact vocabularies.
 *        Must be in the reporter's allowlist.
 */
export function extendToolWithAgentFacts(baseTool, reporter, { pinEventType } = {}) {
  const allowlist = REPORTER_EVENT_ALLOWLIST[reporter];
  if (!allowlist || allowlist.length === 0) {
    throw new Error(`extendToolWithAgentFacts: no Wire allowlist for reporter '${reporter}'`);
  }
  if (pinEventType && !allowlist.includes(pinEventType)) {
    throw new Error(`extendToolWithAgentFacts: pin '${pinEventType}' outside ${reporter}'s allowlist`);
  }
  const eventTypes = pinEventType ? [pinEventType] : [...allowlist];
  const rows = eventTypes.map((t) => EVENT_CONTRACTS[t]);

  const magBases = [...new Set(rows.flatMap((r) => r.magnitudeBases))];
  const figBases = [...new Set([...magBases, ...SHARED_FIGURE_BASES])];
  const reporterQualifiers = [...new Set(rows.flatMap((r) => r.qualifiers))];
  const anyDirectionAllowed = rows.some((r) => r.direction !== 'forbidden');
  const includeSubjectRef = eventTypes.includes('index_move');

  const clone = structuredClone(baseTool);

  const valueUnitBasis = (basisEnum) => ({
    type: 'object',
    properties: {
      value: { type: 'number', description: 'Signed: carries the direction of change. Must match your source data exactly.' },
      unit: { type: 'string', enum: [...UNITS] },
      basis: { type: 'string', enum: basisEnum },
    },
    required: ['value', 'unit', 'basis'],
  });

  const properties = {
    eventType: {
      type: 'string',
      enum: eventTypes,
      description: pinEventType
        ? `Always '${pinEventType}' for this story type.`
        : 'The event class this story reports.',
    },
    tickers: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Tickers this event is about, primary first. Cardinality per eventType: ' +
        eventTypes.map((t) => `${t}=${EVENT_CONTRACTS[t].tickers[0]}-${EVENT_CONTRACTS[t].tickers[1]}`).join(', ') +
        '. Empty array for zero-ticker (macro/econ) eventTypes.',
    },
  };

  if (anyDirectionAllowed) {
    properties.direction = {
      type: 'string',
      enum: [...DIRECTIONS],
      description:
        'Direction of the change. OMIT ENTIRELY for preview eventTypes (previews carry no direction). ' +
        'Must agree with the sign of magnitude.value.',
    };
  }

  if (includeSubjectRef) {
    properties.subjectRef = {
      type: 'string',
      enum: [...INDEX_SUBJECTS],
      description: 'REQUIRED for index_move: which index this event is about. Omit for every other eventType.',
    };
  }

  properties.magnitude = valueUnitBasis(magBases);
  properties.keyLevel = {
    type: 'object',
    properties: {
      price: { type: 'number' },
      type: { type: 'string', enum: [...KEY_LEVEL_TYPES] },
    },
    required: ['price', 'type'],
    description: 'A price level the move relates to, if one is in your source data.',
  };
  properties.figures = {
    type: 'array',
    maxItems: FIGURES_CAP,
    items: valueUnitBasis(figBases),
    description: `Up to ${FIGURES_CAP} additional typed figures from your source data.`,
  };
  properties.qualifiers = {
    type: 'array',
    maxItems: QUALIFIERS_CAP,
    items: reporterQualifiers.length > 0
      ? { type: 'string', enum: reporterQualifiers }
      : { type: 'string' },
    description: reporterQualifiers.length > 0
      ? `Non-numeric facts, from the closed set only: ${reporterQualifiers.join(', ')}.`
      : 'Omit — no qualifier vocabulary is defined for your eventTypes.',
  };

  clone.input_schema.properties.agentFacts = {
    type: 'object',
    description:
      'Typed machine facts about the PRIMARY event in this story, for the FantasyTimes Wire. ' +
      'Report ONLY values present in your source data — omit any field you cannot ground. ' +
      'No recommendations, no sentiment, no free text.',
    properties,
    required: ['eventType', 'tickers'],
  };
  return clone;
}

/**
 * The flag-gated system-prompt addendum instructing the reporter to populate
 * agentFacts. Appended to the system string ONLY when WIRE_WRITES_ENABLED —
 * flag-off appends nothing, keeping the prompt byte-identical.
 *
 * @param {string} reporter
 * @param {object} [opts]
 * @param {string} [opts.pinEventType] — mirrors the schema pin (V1.6 A4)
 */
export function buildAgentFactsInstruction(reporter, { pinEventType } = {}) {
  const eventTypes = pinEventType ? [pinEventType] : (REPORTER_EVENT_ALLOWLIST[reporter] || []);
  const lines = [
    '',
    'AGENT FACTS (machine wire — required):',
    'Alongside the story fields, populate the agentFacts object with typed facts about the PRIMARY event you are reporting.',
    pinEventType
      ? `- eventType: always '${pinEventType}' for this story.`
      : `- eventType: exactly one of ${eventTypes.join(' | ')}.`,
    '- tickers: the tickers the EVENT is about (primary first); empty for market-wide/econ events.',
    '- Every number must appear in the data you were given — never estimate, never round differently.',
    '- Omit direction for preview eventTypes. Omit any field your source data does not support.',
  ];
  if (eventTypes.includes('index_move')) {
    lines.push('- subjectRef: REQUIRED on index_move — which index (SPX|NDX|DJI|RUT|VIX) the event is about. Omit on every other eventType.');
  }
  lines.push('- agentFacts is for machines: no prose, no recommendations, no sentiment.');
  return lines.join('\n');
}
