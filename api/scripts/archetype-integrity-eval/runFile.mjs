// api/scripts/archetype-integrity-eval/runFile.mjs
//
// Archetype-Integrity OBSERVE harness — the PER-RUN record file.
//
// WHY THIS EXISTS. The harness computes a verdict for all 140 corpus items,
// aggregates them, and then threw the per-item `records` away: it wrote only
// `{ meta, agg, hardZeroBreaches, ts }` into ONE file that every run overwrote.
// That is why the Sep 17 pre-flight numbers no longer exist on disk, and why
// which asks Gemma filed, mis-filed or refused was not recoverable
// (docs/audits/20260918_JEV_DIRECTION_JUDGE_EXPERIMENT.md §1 finding 2, §9).
// Each run now ALSO gets its own file under `runs/`, with the per-item records
// in it.
//
// ZERO IMPORTS — deliberately. These are the pure parts (naming, projection,
// collision resolution) so they are unit-testable without a live run, without
// `node:fs`, and without pulling the harness's mocked module graph into a test.
// The caller owns every side effect: it supplies the clock (`ts`), the
// filesystem probe (`exists`), and the write itself.
//
// GRADING IS NOT DONE HERE. This module tallies nothing, scores nothing and
// classifies nothing: `aggregate.js` remains the only place a rate is computed,
// and the `agg` handed in is passed through untouched. The two booleans stamped
// per record below are re-statements of the gate's own outcome fields, not
// judgements about whether an outcome was correct.

const JSON_EXT = '.json';

// A defensive ceiling on the collision walk so a pathological `exists` (one that
// answers true forever) fails loudly instead of hanging a two-hour eval run at
// the very last step, after ~140 real Gemma calls have already been spent.
const MAX_NAME_COLLISIONS = 1000;

// ISO-8601 UTC → a stamp that is legal in a Windows file name: no colons, no
// dashes, nothing from < > : " / \ | ? *. `2026-09-18T03:50:31.123Z` becomes
// `20260918T035031Z`. Seconds resolution — the collision suffix below, not the
// stamp, is what keeps two runs in the same second apart.
function toStamp(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`runFileName: ts is not a valid date: ${String(ts)}`);
  }
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

/**
 * The run file's name: `<stamp>_<fit-on|fit-off>.json`.
 *
 * The fit flag is read from the SAME value the report header already prints
 * (`meta.fitCheckEnabled`, stamped from `EVAL_FIT_CHECK=1`), so a pre-flight run
 * and a baseline run can never be confused for one another on disk — the
 * distinction the Sep 17 overwrite destroyed.
 *
 * @param {string|Date} ts ISO-8601 instant (the run's `ts`).
 * @param {{fitCheckEnabled?: boolean}} meta the harness's `meta` block.
 * @returns {string} a Windows-legal file name.
 */
export function runFileName(ts, meta) {
  const fit = meta && meta.fitCheckEnabled ? 'fit-on' : 'fit-off';
  return `${toStamp(ts)}_${fit}${JSON_EXT}`;
}

/**
 * NEVER OVERWRITE. Returns `name` when it is free, else the first free
 * `<stem>-1.json`, `<stem>-2.json`, … A run file is the only copy of its own
 * per-item records, so clobbering one loses data that costs ~140 Gemma calls to
 * reproduce — and would reproduce the exact failure this build exists to fix.
 *
 * Pure: the caller injects the probe, so the rule is testable without a disk.
 *
 * @param {string} name the preferred file name (from `runFileName`).
 * @param {(candidate: string) => boolean} exists true when that name is taken.
 * @returns {string} the first free name.
 */
export function resolveRunFileName(name, exists) {
  if (!exists(name)) return name;
  const stem = name.endsWith(JSON_EXT) ? name.slice(0, -JSON_EXT.length) : name;
  for (let n = 1; n <= MAX_NAME_COLLISIONS; n++) {
    const candidate = `${stem}-${n}${JSON_EXT}`;
    if (!exists(candidate)) return candidate;
  }
  throw new Error(`resolveRunFileName: ${MAX_NAME_COLLISIONS} collisions for ${name}`);
}

/**
 * One record's serialised form. Spreads the harness record (so nothing it
 * already carries is lost) and then stamps the fields the run file GUARANTEES,
 * normalising an absent one to null rather than letting it vanish.
 *
 * Returns a NEW object; the input record is never mutated. Nested values
 * (`archetypeGate`, `proposal`) are shared by reference and likewise untouched.
 */
function toRunRecord(r) {
  const gate = r.archetypeGate ?? null;
  const gateStatus = gate?.status ?? null;
  // No gate outcome exists for a call that never completed, so neither boolean
  // is a fact about the agent on that turn — null, not false.
  const callFailed = r.callFailed === true;
  return {
    ...r,
    corpusItemId: r.corpusItemId ?? r.itemId ?? null,
    archetype: r.archetype ?? null,
    category: r.category ?? null,                        // the item kind
    subtype: r.subtype ?? null,
    userMessage: r.userMessage ?? null,                  // the ask, verbatim
    expectedAdjustmentId: r.expectedAdjustmentId ?? null,
    expectedCommit: r.expectedCommit ?? null,
    expectedHardOutcome: r.expectedHardOutcome ?? null,
    // The gate's OWN outcome fields (directiveGate.js stamps both):
    gateClassification: gate?.classification ?? null,    // in_archetype | flex | core_conflict | user_lever | research_only
    gateStatus,                                          // committed | no_change | fit_mismatch
    selectedId: r.selectedId ?? null,                    // the id filed, or null
    // The turn filed nothing AND it was not the fit check refusing the quote.
    // This is the OUTCOME, category-blind — it does NOT say the refusal was
    // wrong. Whether a refusal was a FALSE refusal is graded against
    // `expectedCommit` by aggregate.js, which this module does not touch.
    refused: callFailed ? null : (r.committed !== true && gateStatus !== 'fit_mismatch'),
    // The gate named a valid id, membership passed, and the reply never said the
    // canonical sentence — `directiveGate.js` status `fit_mismatch`, the same
    // field `aggregate.js`'s own fit-mismatch predicate reads.
    fitMismatch: callFailed ? null : gateStatus === 'fit_mismatch',
    replyText: r.replyText ?? null,                      // the agent's reply, verbatim
  };
}

/**
 * The run file's contents: the aggregate the harness already reports, PLUS the
 * per-item records it used to discard.
 *
 * `meta`, `agg`, `hardZeroBreaches` and `ts` are passed through by reference,
 * unread and unmodified — the run file reports exactly the numbers
 * `last-run-report.json` reports, by construction rather than by recomputation.
 *
 * @param {{meta: object, agg: object, hardZeroBreaches: object, ts: string, records: Array<object>}} input
 * @returns {{meta: object, agg: object, hardZeroBreaches: object, ts: string, records: Array<object>}}
 */
export function buildRunFile({ meta, agg, hardZeroBreaches, ts, records }) {
  return {
    meta,
    agg,
    hardZeroBreaches,
    ts,
    records: (records ?? []).map(toRunRecord),
  };
}
