// api/_utils/explore/matchStory.js
//
// Explore publish step — THE MATCH, AND WHAT IS RECORDED (build prompt K-6, K-8, K-12; the Work an idea chat's
// conditions and additions of Nov 25). Server code, run only by the founder's command.
//
// The conditions, as agreed: "The match is made and recorded by server code. The publish step fetches the link itself
// and records the result on the source. A model's or a page reader's say-so is not a match." and "The figure sits
// inside its own matched excerpt, written as the table will show it." (K-7 checks the second on the author's text,
// storyCheck.js.)
//
// One run: every distinct link of every story is fetched ONCE, by this code (fetchSource.js), its text extracted
// (extractText.js) and put under the word-for-word rule (matchRule.js). Then, from that run alone:
//
//   on each source   match: { by, readAt, documentDate, textHash, rule }
//                      by            'machine' ONLY when this run fetched the link, extracted text from it and found
//                                    the source's own `excerpt` in it; otherwise 'read' (the reason is in the report)
//                      readAt        when this run received the document, or null when nothing was received
//                      documentDate  a date found in the document's own metadata, or null — never the author's `dated`
//                      textHash      SHA-256 of the extracted text under the rule, or null when there is no text
//                      rule          RULE_VERSION, the version of the word-for-word rule applied
//   on each stated cell and each input of a computed cell
//                    matched: true ONLY when its own `excerpt` was found in its source's text fetched in this run, so
//                    only on a source whose readAt and textHash are both set; otherwise false. A computed cell has no
//                    excerpt of its own (its inputs do) and a `notReported` cell is the story's own claim: neither
//                    gets `matched`.
//
// Nothing here reads a `match` or `matched` that arrived with the record: the records handed in are the check's,
// which removed them first (storyRecord.js authorRecordOf), and every value below is written fresh.

import { underRule, quoteIn, textHashOf, RULE_VERSION } from './matchRule.js';
import { extractText as defaultExtract } from './extractText.js';
import { fetchDocument as defaultFetch } from './fetchSource.js';
import { measureCellsOf, cellKindOf } from './storyRecord.js';
import { LEVELS } from './storyCheck.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Fetch and read one link: `{ url, fetch, type, ruled, textHash, documentDate, readAt, reason }`. `ruled` is the text
 * under the rule, or null.
 */
async function readLink(url, { fetchDocument, extract, contact }) {
  const fetched = await fetchDocument(url, { contact });
  if (!fetched.ok) {
    return { url, fetch: fetched, type: null, ruled: null, textHash: null, documentDate: null, readAt: null, reason: fetched.reason };
  }
  const ex = await extract({ bytes: fetched.bytes, contentType: fetched.contentType });
  const ruled = typeof ex.text === 'string' ? underRule(ex.text) : '';
  const hasText = ruled.length > 0;
  return {
    url,
    fetch: fetched,
    type: ex.type,
    ruled: hasText ? ruled : null,
    textHash: hasText ? textHashOf(ruled) : null,
    documentDate: ex.documentDate ?? null,
    readAt: fetched.fetchedAt,
    reason: hasText ? null : (ex.reason ?? 'no text could be read from the document'),
  };
}

/** The match block for one source, from this run's reading of its link (see the header). */
export function matchBlockOf(source, link) {
  const found = Boolean(link?.ruled) && Boolean(link.readAt) && Boolean(link.textHash) && quoteIn(link.ruled, source?.excerpt);
  return {
    by: found ? 'machine' : 'read',
    readAt: link?.readAt ?? null,
    documentDate: link?.documentDate ?? null,
    textHash: link?.textHash ?? null,
    rule: RULE_VERSION,
  };
}

/** Whether one excerpt was found in its source's text fetched in this run (only a source with readAt and textHash). */
export const excerptMatched = (excerpt, link) => Boolean(link?.ruled) && Boolean(link.readAt) && Boolean(link.textHash) && quoteIn(link.ruled, excerpt);

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
/**
 * The date check (standard §4), in words, or null when it passes: the source's `dated` should name the month and the
 * year of the document's own date. No document date found: the check is left to a person, and said so.
 */
export function dateCheckOf(dated, documentDate) {
  if (typeof documentDate !== 'string' || !documentDate) return 'no date was found in the document itself: check `dated` by hand';
  const d = new Date(documentDate.length === 10 ? `${documentDate}T00:00:00Z` : documentDate);
  if (!Number.isFinite(d.getTime())) return null;
  const year = String(d.getUTCFullYear());
  const month = MONTH.format(d);
  const text = typeof dated === 'string' ? dated.toLowerCase() : '';
  return text.includes(year) && text.includes(month.toLowerCase()) ? null : `the document's own date is ${documentDate.slice(0, 10)}; \`dated\` says ${JSON.stringify(dated ?? null)}`;
}

/** Why a source is `by: 'read'`, in plain words. */
function readReasonOf(source, link) {
  if (!link) return 'the source has no link to fetch';
  if (!link.ruled) return link.reason;
  if (typeof source?.excerpt !== 'string' || !source.excerpt.trim()) return 'the source has no excerpt to look for';
  return 'the excerpt was not found word for word in the document\'s text';
}

/**
 * Match every story of one run (see the header). `stories`: the check's `{ id, record }` (records already without
 * any author's match). Returns `{ stories: [{ id, record, sources, figures, findings, summary }], links }` — `record`
 * a NEW record carrying this run's `match` and `matched` values.
 */
export async function matchStories(stories, { contact, fetchDocument = defaultFetch, extract = defaultExtract } = {}) {
  const links = new Map(); // url → Promise of readLink: each distinct link fetched once per run
  const linkOf = (url) => {
    if (typeof url !== 'string' || !url) return Promise.resolve(null);
    if (!links.has(url)) links.set(url, readLink(url, { fetchDocument, extract, contact }));
    return links.get(url);
  };

  const out = [];
  for (const story of stories) {
    const record = isPlain(story.record) ? clone(story.record) : story.record;
    const findings = [];
    const sourceRows = [];
    const figures = [];
    if (!isPlain(record)) { out.push({ id: story.id, record, sources: sourceRows, figures, findings, summary: summaryOf(figures) }); continue; }
    const sources = Array.isArray(record.sources) ? record.sources : [];
    const byId = new Map();
    for (let i = 0; i < sources.length; i += 1) {
      const s = sources[i];
      if (!isPlain(s)) continue;
      const link = await linkOf(s.url);
      s.match = matchBlockOf(s, link);
      if (typeof s.id === 'string' && !byId.has(s.id)) byId.set(s.id, { source: s, link });
      const reason = s.match.by === 'machine' ? null : readReasonOf(s, link);
      sourceRows.push({
        index: i, id: s.id ?? null, url: s.url ?? null, finalUrl: link?.fetch?.finalUrl ?? null, redirects: link?.fetch?.redirects ?? [],
        httpStatus: link?.fetch?.status ?? null, type: link?.type ?? null, dated: s.dated ?? null, ...s.match, reason,
      });
      if (reason) findings.push({ level: LEVELS.UNMATCHED, rule: 'K-8', field: `sources[${i}]`, value: s.url ?? null, message: `by 'read': ${reason}` });
      // The date check (standard §4): the document's own date beside the source's `dated`. Noted, never blocking.
      const dateNote = dateCheckOf(s.dated, s.match.documentDate);
      if (dateNote) findings.push({ level: LEVELS.NOTED, rule: 'standard §4', field: `sources[${i}].dated`, value: s.dated ?? null, message: dateNote });
    }

    for (const { cell, field, question, measure } of measureCellsOf(record)) {
      if (!isPlain(cell)) continue;
      const kind = cellKindOf(cell);
      const where = { question: question?.id ?? null, measure: measure?.name ?? null, symbol: cell.symbol ?? null, field };
      if (kind === 'notReported') { delete cell.matched; figures.push({ ...where, kind, sourced: false }); continue; }
      if (kind === 'stated') {
        const ref = byId.get(cell.sourceId);
        cell.matched = excerptMatched(cell.excerpt, ref?.link);
        figures.push({ ...where, kind, value: cell.value ?? null, sourceId: cell.sourceId ?? null, matched: cell.matched, sourced: cell.matched });
        if (!cell.matched) findings.push({ level: LEVELS.UNMATCHED, rule: 'K-8', field: `${field}.matched`, value: cell.excerpt ?? null, message: `not found in source ${JSON.stringify(cell.sourceId)} (${ref?.source?.url ?? 'no link'})${ref?.link?.ruled ? '' : `: ${ref?.link?.reason ?? 'no text was read'}`}; it will arrive in an investigation as not checked` });
        continue;
      }
      // computed: each input carries its own `matched`; the cell itself has no excerpt and gets none
      delete cell.matched;
      const inputs = (Array.isArray(cell.inputs) ? cell.inputs : []).map((inp, k) => {
        if (!isPlain(inp)) return { index: k, matched: false };
        const ref = byId.get(inp.sourceId);
        inp.matched = excerptMatched(inp.excerpt, ref?.link);
        if (!inp.matched) findings.push({ level: LEVELS.UNMATCHED, rule: 'K-8', field: `${field}.inputs[${k}].matched`, value: inp.excerpt ?? null, message: `not found in source ${JSON.stringify(inp.sourceId)} (${ref?.source?.url ?? 'no link'})${ref?.link?.ruled ? '' : `: ${ref?.link?.reason ?? 'no text was read'}`}; the figure computed from it will arrive as not checked` });
        return { index: k, value: inp.value ?? null, sourceId: inp.sourceId ?? null, matched: inp.matched };
      });
      const sourced = inputs.length > 0 && inputs.every((i) => i.matched === true);
      figures.push({ ...where, kind, formula: cell.formula ?? null, inputs, sourced });
    }
    out.push({ id: story.id, record, sources: sourceRows, figures, findings, summary: summaryOf(figures) });
  }
  return { stories: out, links: [...links.keys()] };
}

/**
 * The plain summary (K-12): of the figures the story carries for an investigation, how many arrive as sourced (a
 * stated cell matched, or a computed one whose inputs all matched), how many as not checked, and how many are the
 * story's own "not reported" claim (never sourced: a match cannot prove an absence).
 */
export function summaryOf(figures) {
  const reported = figures.filter((f) => f.kind !== 'notReported');
  const sourced = reported.filter((f) => f.sourced === true).length;
  return { carried: reported.length, sourced, notChecked: reported.length - sourced, notReported: figures.length - reported.length };
}

/** Is a story unmatched (K-8): any source at 'read', or any cell or input at matched: false? */
export const isUnmatched = (matched) => matched.findings.some((f) => f.level === LEVELS.UNMATCHED);
