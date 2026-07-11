/**
 * Correlation Intelligence Phase 2 — the NARRATION PHRASEBOOK (Change 2).
 *
 * The product's voice, versioned. Per claimId, 2–4 approved clause variants:
 * past-tense, sample-bounded sentence frames with NAMED span slots only, plus
 * the approved connective list. No frame contains causal, forward-looking,
 * advisory/imperative, or interior/certainty language — the stance's
 * blocker-11 families are ABSENT here, not banned downstream.
 *
 * The model's ONLY freedom is (a) picking one approved variant per claim and
 * (b) picking an approved connective. It fills no slots itself — the plan hands
 * it the exact server-rendered span strings, and the conformance validator
 * reconstructs `template-with-spans-filled` and demands byte equality. This is
 * literally "the model renders; it does not author."
 *
 * Pure — no imports, no project state. Unit-tested by narrationPhrasebook.test.js,
 * which lints every frame against BANNED_LEXICON + a no-future-tense +
 * past-tense-presence + structural (declared-slot) check BEFORE any narration
 * exists (the voice is tested first). BANNED_LEXICON / APPROVED_PAST_VERBS are
 * exported as the ONE source shared by the meta-test and the conformance
 * validator's defense-in-depth lexicon scan (BUILD_RULES §4 — one implementation).
 */

// ── Versions ─────────────────────────────────────────────────────────────────
// phrasebookVersion: bumped when any frame/connective/slot changes (orphans the
// narration cache by construction — it is a docId component). promptVersion:
// the render-instruction contract. modelVersion: pinned to gemmaClient's model
// (asserted equal in the meta-test) so a model swap invalidates cached voice.
export const PHRASEBOOK_VERSION = '1';
export const PROMPT_VERSION = '1';
export const MODEL_VERSION = 'google/gemma-4-26b-a4b-it';

// Approved connectives — sentence-initial, non-causal glue only. '' is the
// no-connective case (position 1 uses it). The validator accepts any ONE of
// these as an optional prefix on a rendered sentence.
export const CONNECTIVES = ['', 'And ', 'But ', 'Still, ', 'Meanwhile, ', 'That said, '];

// ── The banned lexicon (defense-in-depth; ONE source) ────────────────────────
// Word-boundary regexes, matched over NFKC-normalized, lower-cased text. Ordered
// families so a failure carries which family tripped. `driver`/`driven`/`adjust`
// are intentionally NOT matched: \bdrive\b has no boundary inside "driver", and
// \badd\b has none inside "adjust".
export const BANNED_LEXICON = [
  { family: 'causal', re: /\b(because|caused?|causes|led to|leads? to|due to|thanks to|owing to|results? in|resulting in|drives|driven by)\b/ },
  { family: 'forward', re: /\b(will|'ll|gonna|going to|expects?|forecasts?|predicts?|projects?|projected|tomorrow|upcoming|imminent|soon|next\s+(?:week|month|session|day|quarter|year))\b/ },
  { family: 'advisory', re: /\b(buy|sell|trim|hedge|consider|overweight|underweight|recommend|recommends|allocate|position)\b/ },
  { family: 'certainty', re: /\b(significantly|significant|proven|guarantees?|guaranteed|always|never|definitely|certainly|inevitable|inevitably)\b/ },
];

// Every non-connective frame must contain at least one of these (the
// no-present-tense-universal guard). Kept in sync with the frames below by the
// structural meta-test.
export const APPROVED_PAST_VERBS = [
  'moved', 'held', 'tracked', 'was', 'were', 'ranked', 'sat', 'split',
  'described', 'stayed', 'measured', 'co-moved',
];

// ── The phrasebook ───────────────────────────────────────────────────────────
// Per claimId: `slots` (every slot any variant may reference) and `variants`
// (each { id, requires, template }). `requires` is the slot set the plan MUST
// supply for that variant to be selectable (the plan prunes allowedVariants to
// span-satisfiable ones). A template references ONLY its `requires` slots.
export const PHRASEBOOK = {
  // ── Opening caveats (mutually exclusive; at most one, position 1) ──
  caveat_limited: {
    slots: ['criterion', 'sampleSpan'],
    variants: [
      { id: 'lim_a', requires: ['criterion', 'sampleSpan'], template: 'This was a limited read {sampleSpan}: {criterion}.' },
      { id: 'lim_b', requires: ['criterion', 'sampleSpan'], template: 'The read was limited {sampleSpan} — {criterion}.' },
    ],
  },
  caveat_fragile: {
    slots: ['criterion', 'sampleSpan'],
    variants: [
      { id: 'frag_a', requires: ['criterion', 'sampleSpan'], template: 'This was a fragile read {sampleSpan}: {criterion}.' },
      { id: 'frag_b', requires: ['criterion', 'sampleSpan'], template: 'The read held {sampleSpan} but stayed fragile — {criterion}.' },
    ],
  },
  caveat_in_flux: {
    slots: ['strain', 'sampleSpan'],
    variants: [
      { id: 'flux_a', requires: ['strain', 'sampleSpan'], template: 'The link was in flux {sampleSpan} — {strain}.' },
      { id: 'flux_b', requires: ['strain', 'sampleSpan'], template: 'This read sat in flux {sampleSpan}: {strain}.' },
    ],
  },

  // ── Proxy disclosure (position 1, or 2 behind an in_flux caveat) ──
  proxy_disclosure: {
    slots: ['name', 'sampleSpan'],
    variants: [
      { id: 'proxy_a', requires: ['name', 'sampleSpan'], template: '{name} was effectively the market itself {sampleSpan}, and no market-adjusted link applied.' },
      { id: 'proxy_b', requires: ['name', 'sampleSpan'], template: '{name} moved as the market itself {sampleSpan}; the market-adjusted view did not apply.' },
    ],
  },

  // ── Headline link (always) ──
  headline_link: {
    slots: ['name', 'direction', 'band', 'value', 'sampleSpan', 'adjBand', 'adjValue'],
    variants: [
      { id: 'hl_raw', requires: ['name', 'direction', 'band', 'value', 'sampleSpan'], template: 'The group moved {direction} {name} {sampleSpan}, a {band} link at {value}.' },
      { id: 'hl_raw_alt', requires: ['name', 'direction', 'band', 'value', 'sampleSpan'], template: '{name} and the group moved {direction} each other {sampleSpan}, a {band} link at {value}.' },
      { id: 'hl_raw_adj', requires: ['name', 'direction', 'band', 'value', 'sampleSpan', 'adjBand', 'adjValue'], template: 'The group moved {direction} {name} {sampleSpan}, a {band} link at {value}, and it held {adjBand} at {adjValue} after adjusting for the market.' },
    ],
  },

  // ── Supporting claims (≤2) ──
  tension_elevated: {
    slots: ['sds', 'sampleSpan'],
    variants: [
      { id: 'tens_a', requires: ['sds', 'sampleSpan'], template: 'Tension held elevated at {sds} {sampleSpan}.' },
      { id: 'tens_b', requires: ['sds', 'sampleSpan'], template: 'The link sat {sds} above its usual spread {sampleSpan}.' },
    ],
  },
  percentile_extreme: {
    slots: ['pct', 'sampleSpan'],
    variants: [
      { id: 'pct_a', requires: ['pct', 'sampleSpan'], template: 'The link ranked {pct} against its own history {sampleSpan}.' },
      { id: 'pct_b', requires: ['pct', 'sampleSpan'], template: 'Measured {sampleSpan}, the link ranked {pct} of its own range.' },
    ],
  },
  capture_asymmetry: {
    slots: ['direction', 'value', 'n', 'sampleSpan'],
    variants: [
      { id: 'cap_a', requires: ['direction', 'value', 'n', 'sampleSpan'], template: 'The group tracked harder on {direction} days, {value} beta across {n} sessions {sampleSpan}.' },
      { id: 'cap_b', requires: ['direction', 'value', 'n', 'sampleSpan'], template: 'On {direction} days the group moved more, {value} beta over {n} sessions {sampleSpan}.' },
    ],
  },
  tail_comovement: {
    slots: ['n', 'coMoveCount', 'sampleSpan'],
    variants: [
      { id: 'tail_a', requires: ['n', 'coMoveCount', 'sampleSpan'], template: 'On its {n} sharpest down days, the group co-moved {coMoveCount} times {sampleSpan}.' },
      { id: 'tail_b', requires: ['n', 'coMoveCount', 'sampleSpan'], template: 'Across its {n} worst sessions, the group moved together {coMoveCount} times {sampleSpan}.' },
    ],
  },
  low_cohesion: {
    slots: ['value', 'sampleSpan'],
    variants: [
      { id: 'coh_a', requires: ['value', 'sampleSpan'], template: 'The group split into several stories at once, {value} internal cohesion {sampleSpan}.' },
      { id: 'coh_b', requires: ['value', 'sampleSpan'], template: 'Its members split several ways {sampleSpan}, {value} internal cohesion.' },
    ],
  },
  driver_context: {
    slots: ['name', 'volpct', 'ret', 'sampleSpan'],
    variants: [
      { id: 'dc_vol', requires: ['name', 'volpct', 'sampleSpan'], template: "{name}'s own swings sat in the {volpct} of its range {sampleSpan}." },
      { id: 'dc_ret', requires: ['name', 'ret', 'sampleSpan'], template: '{name} itself moved {ret} {sampleSpan}.' },
    ],
  },

  // ── Closing caveat (present iff readState ≠ solid) ──
  closing_caveat: {
    slots: ['sampleSpan'],
    variants: [
      { id: 'cc_a', requires: ['sampleSpan'], template: 'All of this described the measured window {sampleSpan}.' },
      { id: 'cc_b', requires: ['sampleSpan'], template: 'Each line above described the sample {sampleSpan}.' },
    ],
  },
};

// ── Accessors ────────────────────────────────────────────────────────────────
export function variantsFor(claimId) {
  return PHRASEBOOK[claimId]?.variants ?? [];
}

export function templateFor(claimId, variantId) {
  return variantsFor(claimId).find((v) => v.id === variantId)?.template ?? null;
}

/**
 * Substitute every `{slot}` in a template with its span string. A slot absent
 * from `spans` is left as the literal `{slot}` — which guarantees a
 * reconstruct-and-compare MISS (the plan must supply every required span). Slot
 * names are `[A-Za-z0-9]+`; values are inserted verbatim (no re-escaping — the
 * spans are server-rendered display strings).
 */
export function fillSlots(template, spans) {
  return template.replace(/\{([A-Za-z0-9]+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(spans, key) && spans[key] != null ? String(spans[key]) : whole
  );
}
