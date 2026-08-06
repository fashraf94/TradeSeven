// api/_utils/unitsLint.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F3 deterministic units belt.
//
// TWO HELD PATTERNS at publish. A match HOLDS the story (it does not publish)
// and logs `units_collision`, the same posture as operand_implausible. The
// narrowness is EARNED by R5's negative rows, not asserted — currency and
// points legitimately co-occur in mover prose ("shares fell $4 after gross
// margin dropped 2 percentage points"; "GOOGL shed $18 while the Dow lost 300
// points"), and a hold is expensive (the story silently doesn't publish), so a
// false positive must be designed out.

// Index-move prose legitimately says "the Dow lost 300 points". A sentence
// carrying an index-family reference is exempt from pattern 1.
const INDEX_FAMILY = /\b(?:dow|s ?& ?p|nasdaq|russell|vix|nyse|ftse|nikkei|dax|hang seng|index|indices)\b/i;

// Pattern 1 — a CURRENCY amount fused with a POINTS figure in the same clause
// (dollars ≠ points). The fixed-width lookbehind spares "percentage points" /
// "basis points"; the sentence-level index-family guard spares index moves.
// BOTH exclusions are load-bearing (R5 negatives go red without them).
const CURRENCY_ATTACHED_POINTS = /\$\s?\d[\d.,]*[^.!?\n]{0,40}?(?<!percentage\s)(?<!basis\s)\bpoints?\b/i;

// Pattern 2 — any NUMERAL bound to "BaggerBomb points". Airtight by
// construction: no numeric point value is ever a legitimate operand, so a
// number on "BaggerBomb points" is invented. Closes the no-dollar-sign half of
// the original defect ("Wiping 20 BaggerBomb Points") that sails past pattern 1.
// Name-anchored on purpose — a generic `\d+ points` would re-flag the Dow case.
const NUMERAL_BAGGERBOMB_POINTS = /\b\d[\d,.]*\s+BaggerBomb\s+[Pp]oints?\b/;

function splitSentences(text) {
  return String(text || '').split(/(?<=[.!?\n])\s+/);
}

/**
 * Run the units belt over a block of prose.
 * @param {string} text
 * @returns {{ held: boolean, code: 'units_collision', violations: Array<{pattern:string,match:string}> }}
 */
export function lintUnits(text) {
  const src = String(text || '');
  const violations = [];

  const p2 = src.match(NUMERAL_BAGGERBOMB_POINTS);
  if (p2) violations.push({ pattern: 'numeral_baggerbomb_points', match: p2[0].trim() });

  for (const sentence of splitSentences(src)) {
    if (INDEX_FAMILY.test(sentence)) continue;
    const m = sentence.match(CURRENCY_ATTACHED_POINTS);
    if (m) violations.push({ pattern: 'currency_attached_points', match: m[0].trim() });
  }

  return { held: violations.length > 0, code: 'units_collision', violations };
}

/** Convenience over the prose fields a mover story publishes. */
export function lintStoryUnits({ headline, subheadline, body } = {}) {
  const combined = [headline, subheadline, body].filter(Boolean).join('\n');
  return lintUnits(combined);
}
