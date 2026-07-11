/**
 * Correlation Intelligence Phase 2 — the CONFORMANCE VALIDATOR (Change 4).
 *
 * PURE. Proves a model rendering is EXACTLY the plan's approved frames with the
 * exact server spans and NOTHING else — the honesty gate that runs after the
 * model (the plan-level adverse-omission gate runs before it). The core is
 * RECONSTRUCT-AND-COMPARE: fill each approved variant's slots with the plan's
 * server spans, prepend each approved connective, and demand byte equality
 * (after normalization) with the model's sentence. One equality proves, at once:
 * approved variant · spans byte-intact · right metric/slot · zero intra-sentence
 * residual. A defense-in-depth lexicon scan runs last.
 *
 * Node-clean: imports only the phrasebook (the ACTIVE frames/connectives/lexicon
 * — one source, BUILD_RULES §4). validateNarration is the sole entry; it never
 * throws and always returns a code drawn from RETRY_REASONS.
 */
import { PHRASEBOOK, CONNECTIVES, BANNED_LEXICON, templateFor, fillSlots } from './narrationPhrasebook.js';

export const VALIDATOR_VERSION = '1';

// The CLOSED enum of failure codes. The narrate endpoint's retry hint is drawn
// ONLY from this set (+ a claimIndex integer) — never the free-text `detail`
// (Rider 2). Ordered by the check that emits them.
export const RETRY_REASONS = [
  'E_SHAPE', 'E_COUNT', 'E_POSITION', 'E_CLAIM_ORDER',
  'E_NO_VARIANT_MATCH', 'E_RESIDUAL', 'E_LENGTH', 'E_LEXICON',
];

// Length caps. MAX_SENTENCES = the plan's own claim ceiling (6): a valid plan is
// one sentence per claim, so the cap must not undercut a legal 6-claim plan
// (in_flux + proxy + headline + 2 supporting + closing).
const MAX_SENTENCES = 6;
const MAX_SENTENCE_CHARS = 240;
const MAX_TOTAL_CHARS = 1100;

// ── Normalization (identical on model text, variant templates, and spans) ────
// NFKC → strip format chars (zero-width, BOM, soft hyphen, word joiner) → fold
// quotes/dashes/ellipsis → collapse whitespace. NFKC already folds full-width
// forms and NBSP to their ASCII equivalents. Case is PRESERVED (tickers stay
// upper; span byte-intactness). `normLower` is used only by the lexicon scan.
export function normStrict(input) {
  let s = String(input).normalize('NFKC');
  s = s.replace(/\p{Cf}/gu, '');
  s = s.replace(/[‘’‚‛′`´]/g, "'");
  s = s.replace(/[“”„‟″]/g, '"');
  s = s.replace(/[‐‑‒–—―−]/g, '-');
  s = s.replace(/…/g, '...');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
export const normLower = (input) => normStrict(input).toLowerCase();

const fail = (code, extra = {}) => ({ valid: false, code, ...extra });

/**
 * @param {object} modelOutput - parsed model JSON: `{ sentences:[{claimId,variantId?,text}] }`
 *   (a parseVoiceLayerResponse `{parseError:true}` is treated as E_SHAPE).
 * @param {object} plan - the { planBuilderVersion, claims } from buildNarrationPlan.
 * @returns {{valid:true, variantsUsed:string[], narration:string}
 *          | {valid:false, code:string, claimIndex?:number, detail?:string}}
 */
export function validateNarration(modelOutput, plan) {
  // 1. Shape.
  if (!modelOutput || modelOutput.parseError === true || !Array.isArray(modelOutput.sentences)) {
    return fail('E_SHAPE', { detail: 'missing sentences[]' });
  }
  const sentences = modelOutput.sentences;
  if (!sentences.every((s) => s && typeof s.claimId === 'string' && typeof s.text === 'string')) {
    return fail('E_SHAPE', { detail: 'sentence must be {claimId, text}' });
  }
  const claims = plan?.claims ?? [];
  // A plan with no claims is not a narration — reject rather than vacuously pass
  // (hardens the cache-revalidation path against an empty/degenerate cached doc).
  if (!Array.isArray(claims) || claims.length === 0) return fail('E_SHAPE', { detail: 'empty plan' });

  // 2. Count — one sentence per claim, no more, no fewer.
  if (sentences.length !== claims.length) {
    return fail('E_COUNT', { detail: `${sentences.length} vs ${claims.length}` });
  }

  // 3. Required positions — a claim the plan pinned to a position must sit there
  //    (the buried-caveat gate).
  for (let j = 0; j < claims.length; j++) {
    const c = claims[j];
    if (c.requiredPosition != null && sentences[j]?.claimId !== c.claimId) {
      return fail('E_POSITION', { claimIndex: j, detail: `${c.claimId} must hold position ${c.requiredPosition}` });
    }
  }

  // 4. Order — sentence i renders claim i (the reading order IS the plan order).
  for (let i = 0; i < claims.length; i++) {
    if (sentences[i].claimId !== claims[i].claimId) {
      return fail('E_CLAIM_ORDER', { claimIndex: i, detail: `${sentences[i].claimId} ≠ ${claims[i].claimId}` });
    }
  }

  // 5. Reconstruct-and-compare per claim (the workhorse).
  const canonicals = [];
  const variantsUsed = [];
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const target = normStrict(sentences[i].text);
    let matched = null;
    for (const vid of claim.allowedVariants) {
      const tmpl = templateFor(claim.claimId, vid);
      if (!tmpl) continue;
      const filled = fillSlots(tmpl, claim.spans);
      for (const conn of CONNECTIVES) {
        if (target === normStrict(conn + filled)) { matched = { vid, canonical: target }; break; }
      }
      if (matched) break;
    }
    if (!matched) return fail('E_NO_VARIANT_MATCH', { claimIndex: i, detail: claim.claimId });
    canonicals.push(matched.canonical);
    variantsUsed.push(matched.vid);
  }

  // 6. Residual — the full narration is EXACTLY the matched canonicals joined,
  //    nothing between the sentences (defense on top of per-claim equality).
  const narration = sentences.map((s) => s.text).join(' ');
  if (normStrict(narration) !== normStrict(canonicals.join(' '))) {
    return fail('E_RESIDUAL', { detail: 'content outside the rendered claims' });
  }

  // 7. Length caps.
  if (sentences.length > MAX_SENTENCES) return fail('E_LENGTH', { detail: `${sentences.length} sentences` });
  for (let i = 0; i < sentences.length; i++) {
    if (normStrict(sentences[i].text).length > MAX_SENTENCE_CHARS) return fail('E_LENGTH', { claimIndex: i, detail: 'sentence too long' });
  }
  if (normStrict(narration).length > MAX_TOTAL_CHARS) return fail('E_LENGTH', { detail: 'narration too long' });

  // 8. Defense-in-depth lexicon scan (post-normalization, LAST). Catches a
  //    banned token that reached the text inside an authorized span/connective
  //    even though the frame itself is lint-clean.
  const lower = normLower(narration);
  for (const { family, re } of BANNED_LEXICON) {
    if (re.test(lower)) return fail('E_LEXICON', { detail: family });
  }

  return { valid: true, variantsUsed, narration: normStrict(narration) };
}

// Exposed for the endpoint's guardrails / tests (claim ids the phrasebook knows).
export const KNOWN_CLAIM_IDS = Object.keys(PHRASEBOOK);
