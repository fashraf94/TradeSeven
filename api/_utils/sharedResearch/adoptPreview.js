// api/_utils/sharedResearch/adoptPreview.js
//
// Shared Research — THE ADOPTION PREVIEW AND ITS ASSERTION CHECK, pure (spec
// §4.6, §6.6, §9 Correction C).
//
// The carried set is built from the EXACT selected names' CURRENT findings:
// the company's proposed claim, every current verified finding with its symbol,
// its open `unavailable` finding, then the latest step's complication and
// missing-link findings — each resolved through `supersedes` to the finding
// that stands now (a corrected fact travels as its correction). Never a static
// list, never the client's. At most KEPT_FINDINGS_MAX (the builder's 30 refs
// less the record and the confirming exchange): a company whose own set is
// larger is shown as not adoptable, with the reason (review A4).
//
// assertAssertionsSupported(statement, …): every number in the statement is in
// a carried fact (spec §6.6's letter: any status; a proposed claim cannot back
// itself; a mention of a carried fact's own date is excused; verified-only is
// founder question FQ-5) — else
// `unsupported_assertion` with the token; every selected company is named, and
// no deselected supported company is — else `names_not_supported`.

import { currentFindingsOf } from '../researchRecords/model.js';
import { SERVER_EVIDENCE_REFS_MAX } from '../hypothesisRecords/model.js';
import { strayNumberOf } from './stepSchema.js';
import { coreNameOf, namesCompany } from './companies.js';

export { coreNameOf, namesCompany };
/** The most findings one idea carries: the builder's 30 server refs less the record ref and the confirming exchange. */
export const KEPT_FINDINGS_MAX = SERVER_EVIDENCE_REFS_MAX - 2;

/** The preview's revision: what Save re-checks (spec §6.6). */
export const previewRevOf = (record) => ({
  summaryRev: Number.isSafeInteger(record?.summary?.rev) ? record.summary.rev : 0,
  findingsCount: Array.isArray(record?.findings) ? record.findings.length : 0,
});
export const sameRev = (a, b) => Boolean(a && b) && a.summaryRev === b.summaryRev && a.findingsCount === b.findingsCount;

/** The finding that stands now for `id`: follow the correction chain forward. */
export function currentIdOf(record, id) {
  const all = Array.isArray(record?.findings) ? record.findings : [];
  const next = new Map(all.filter((f) => f?.supersedes).map((f) => [f.supersedes, f.findingId]));
  let cur = id;
  const seen = new Set();
  while (next.has(cur) && !seen.has(cur)) { seen.add(cur); cur = next.get(cur); }
  return cur;
}

/** The ids a selection carries, in order, each once (Correction C). */
export function carriedFor(record, { supported, lines, symbols }) {
  const current = currentFindingsOf(record);
  const currentIds = new Set(current.map((f) => f.findingId));
  const out = [];
  const add = (id) => { if (id && currentIds.has(id) && !out.includes(id)) out.push(id); };
  for (const symbol of symbols) {
    const c = supported.find((x) => x.symbol === symbol);
    if (!c) continue;
    add(c.claim?.findingId);
    for (const f of current) if (f.symbol === symbol && f.status === 'verified' && f.kind !== 'idea') add(f.findingId);
    add(c.openQuestion?.findingId);
  }
  for (const ref of [lines?.complication, lines?.missing]) if (ref) add(currentIdOf(record, ref));
  return out;
}

/** One company's draft sentence: its proposed claim, else its relationship — always naming it. */
export function fragmentOf(c) {
  const body = c.claim?.fact || `${c.role}: ${c.relationship}`;
  return namesCompany(body, c) ? body : `${c.name}: ${body}`;
}

/**
 * The preview the sheet opens with (spec §4.6): per supported company, its
 * fragment, its carried ids and whether it can be saved (`adoptable`, with the
 * `reason` when not); the draft for all of them; the revision. Null when no
 * company is supported (no "Turn this into an idea").
 */
export function adoptPreviewOf(record, { companies, lines }) {
  const supported = companies?.supported ?? [];
  if (record?.state !== 'open' || supported.length === 0) return null;
  const list = supported.map((c) => {
    const carried = carriedFor(record, { supported, lines, symbols: [c.symbol] });
    const adoptable = carried.length <= KEPT_FINDINGS_MAX;
    return {
      symbol: c.symbol, name: c.name, role: c.role, relationship: c.relationship, eligibility: c.eligibility,
      fragment: fragmentOf(c), carried, adoptable, reason: adoptable ? null : 'too_many_evidence_refs',
    };
  });
  return {
    previewRev: previewRevOf(record),
    companies: list,
    draft: list.map((c) => c.fragment).join(' '),
    carried: carriedFor(record, { supported, lines, symbols: supported.map((c) => c.symbol) }),
    keptMax: KEPT_FINDINGS_MAX,
  };
}

/** A typed refusal of an adoption's statement. */
export class AssertionError extends Error {
  constructor(code, detail) { super(code); this.code = code; this.detail = detail; }
}

/**
 * The statement may assert only what the carried findings hold (spec §6.6).
 * @param {string} statement
 * @param {{ record: object, carried: string[], selected: object[], deselected: object[] }} p
 *   selected / deselected: supported companies ({ symbol, name })
 */
export function assertAssertionsSupported(statement, { record, carried, selected, deselected }) {
  const byId = new Map((Array.isArray(record?.findings) ? record.findings : []).map((f) => [f.findingId, f]));
  const held = carried.map((id) => byId.get(id)).filter((f) => f && f.kind !== 'idea');
  const stray = strayNumberOf(statement, held);
  if (stray !== undefined) throw new AssertionError('unsupported_assertion', stray);
  const unnamed = selected.find((c) => !namesCompany(statement, c));
  if (unnamed) throw new AssertionError('names_not_supported', { missing: unnamed.symbol });
  const extra = deselected.find((c) => namesCompany(statement, c));
  if (extra) throw new AssertionError('names_not_supported', { deselected: extra.symbol });
}
