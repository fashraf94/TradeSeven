// api/_utils/unitsLint.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F3 deterministic units belt.
//
// TWO HELD PATTERNS at publish. A match HOLDS the story (it does not publish)
// and logs `units_collision`, the same posture as operand_implausible.
//
// DESIGN NOTE (build review, Aug 6 — deviation from the spec's loose pattern):
// the spec sketched a wide "$…points within 40 chars" pattern guarded by
// percentage/basis lookbehinds + an index-family exclusion. Adversarial review
// proved that shape FALSE-POSITIVES on ordinary financial prose — "$50 price
// point", "shares hit $12 at one point", "$2B chased the 25 basis-points move"
// (a hyphen defeats a whitespace lookbehind) — and a hold is expensive (the
// story silently doesn't publish). So the collision is detected by ADJACENCY
// instead: a currency figure directly LABELED as points. Adjacency is airtight
// here — dollars are never points — and needs no idiom denylist (every "point"
// idiom carries other words between the "$" and "point"). Filed as a register
// note; R5's boundary rows defend the adjacency.

// Pattern 1 — a currency figure DIRECTLY labeled as points ("$20 points",
// "$20 BaggerBomb Points"). Case-insensitive. An optional single "BaggerBomb"
// qualifier is the only thing allowed between the amount and "points".
const CURRENCY_ATTACHED_POINTS = /\$\s?\d[\d.,]*\s+(?:BaggerBomb\s+)?points?\b/i;

// Pattern 2 — any NUMERAL bound to "BaggerBomb points" ("Wiping 20 BaggerBomb
// Points", incl. the no-"$" half of the original defect). Case-insensitive so
// "20 BAGGERBOMB POINTS" / "20 baggerbomb points" cannot slip. Airtight: no
// numeric point value is ever a legitimate operand.
const NUMERAL_BAGGERBOMB_POINTS = /\b\d[\d,.]*\s+BaggerBomb\s+points?\b/i;

/**
 * Run the units belt over a block of prose.
 * @param {string} text
 * @returns {{ held: boolean, code: 'units_collision', violations: Array<{pattern:string,match:string}> }}
 */
export function lintUnits(text) {
  const src = String(text || '');
  const violations = [];

  const p1 = src.match(CURRENCY_ATTACHED_POINTS);
  if (p1) violations.push({ pattern: 'currency_attached_points', match: p1[0].trim() });

  const p2 = src.match(NUMERAL_BAGGERBOMB_POINTS);
  if (p2) violations.push({ pattern: 'numeral_baggerbomb_points', match: p2[0].trim() });

  return { held: violations.length > 0, code: 'units_collision', violations };
}

/**
 * Convenience over EVERY model-authored prose field a mover story publishes —
 * headline, subheadline, body, AND pullquote (a free-text field the prompt
 * asks the model to make dramatic, exactly where an invented "$20 BaggerBomb
 * Points" would land; review finding).
 */
export function lintStoryUnits({ headline, subheadline, body, pullquote } = {}) {
  const combined = [headline, subheadline, body, pullquote].filter(Boolean).join('\n');
  return lintUnits(combined);
}
