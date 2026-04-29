// Post-parse sanitizer for submit_parsed_signal tool output.
//
// Defends against two Haiku-side decoder regression failure modes observed in
// Phase 1 Run 3:
//   1. Tag-shaped content leaking into string field values
//      (e.g., keyClaim contained "</anyClaim>\n<parameter name=\"tickers\">[]").
//   2. Required fields silently dropped from the parsed object when the leakage
//      displaces the field-key boundary in tool-XML serialization.
//
// Both are vendor-side artifacts, not prompt issues. This sanitizer is a
// permanent guardrail — it has zero cost on clean outputs (regex matches
// nothing, returns input unchanged) and prevents corrupted state from reaching
// Firestore, the API response, or the shadow log.
//
// Stripping is intentionally aggressive: under-stripping leaves structural
// corruption that breaks downstream consumers; over-stripping merely degrades
// content slightly. Asymmetric risk → aggressive default. Every modification
// logs originalSample + cleanedSample (first 200 chars each) so future audits
// can quantify over-strip frequency.
//
// Fire-and-forget logging: every non-trivial modification is logged via the
// shadow logger so we can track frequency and correlation over time.

import { logSignalDrops } from './shadowLogger.js';

// Patterns that should never appear inside a tool-output string field.
// Order matters: longer/more-specific patterns first.
const LEAKED_TAG_PATTERNS = [
  /<\/?parameter\s+name=["'][^"']*["'][^>]*>/gi,
  /<\/?[a-zA-Z][a-zA-Z0-9_]*\s*\/?>/g,
];

// Schema-required fields and their default values when missing/dropped.
// Mirrors submit_parsed_signal's required list (sans keyClaim, removed in
// this commit). Update if the schema's required list ever changes.
const REQUIRED_FIELD_DEFAULTS = {
  extractedText: '',
  topic: '',
  tickers: [],
  impliedTickers: [],
  confidence: null,           // null distinguishes "missing" from a real 0
  contentType: 'unknown',
  signalDirection: 'uncertain',
  timeHorizon: 'unspecified',
  referencedDate: '',
  dataPoints: [],
};

function stripLeakedTags(value) {
  if (typeof value !== 'string') return { cleaned: value, modified: false };
  let cleaned = value;
  for (const pattern of LEAKED_TAG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Collapse any double-whitespace introduced by stripping
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return { cleaned, modified: cleaned !== value };
}

function stripStringField(obj, fieldName, modifications) {
  const original = obj[fieldName];
  if (typeof original !== 'string') return;
  const { cleaned, modified } = stripLeakedTags(original);
  if (modified) {
    obj[fieldName] = cleaned;
    modifications.push({
      type: 'stripped_tags',
      field: fieldName,
      originalLength: original.length,
      cleanedLength: cleaned.length,
      originalSample: original.slice(0, 200),
      cleanedSample: cleaned.slice(0, 200),
    });
  }
}

function stripStringArrayField(obj, fieldName, modifications) {
  const original = obj[fieldName];
  if (!Array.isArray(original)) return;
  const cleaned = [];
  let arrayModified = false;
  const itemSamples = [];
  for (const item of original) {
    if (typeof item === 'string') {
      const { cleaned: itemCleaned, modified } = stripLeakedTags(item);
      if (modified) {
        arrayModified = true;
        itemSamples.push({
          originalSample: item.slice(0, 200),
          cleanedSample: itemCleaned.slice(0, 200),
        });
      }
      if (itemCleaned) cleaned.push(itemCleaned);
    } else {
      cleaned.push(item);
    }
  }
  if (arrayModified) {
    obj[fieldName] = cleaned;
    modifications.push({
      type: 'stripped_tags_in_array',
      field: fieldName,
      itemCount: original.length,
      modifiedItems: itemSamples,
    });
  }
}

function coerceMissingRequiredFields(obj, modifications) {
  for (const [field, defaultValue] of Object.entries(REQUIRED_FIELD_DEFAULTS)) {
    if (!(field in obj) || obj[field] === undefined) {
      obj[field] = Array.isArray(defaultValue) ? [...defaultValue] : defaultValue;
      modifications.push({
        type: 'coerced_missing_field',
        field,
        defaultUsed: defaultValue,
      });
    }
  }
}

/**
 * Sanitize the parsed object returned by Haiku's submit_parsed_signal tool.
 * Mutates the input object in place and returns the same reference for chaining.
 * Fires a shadow log event (fire-and-forget) when any modification is made.
 *
 * @param {object} parsed - The raw tool input from Haiku
 * @param {object} context - { dropId, userId, contentHash } for logging
 * @returns {object} The mutated parsed object (same reference as input)
 */
export function sanitizeParsedOutput(parsed, context = {}) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const modifications = [];

  // String fields: strip tag-shaped leaks
  stripStringField(parsed, 'extractedText', modifications);
  stripStringField(parsed, 'topic', modifications);
  stripStringField(parsed, 'referencedDate', modifications);

  // String-array fields: strip per-item
  stripStringArrayField(parsed, 'dataPoints', modifications);

  // Coerce any missing required fields to safe defaults
  coerceMissingRequiredFields(parsed, modifications);

  // Fire-and-forget logging if anything changed
  if (modifications.length > 0) {
    logSignalDrops({
      event: 'parsed_output_sanitized',
      dropId: context.dropId || null,
      userId: context.userId || null,
      contentHash: context.contentHash || null,
      modifications,
      sanitizedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return parsed;
}
