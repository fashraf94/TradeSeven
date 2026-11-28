// api/_utils/explore/storyCheck.js
//
// Explore publish step — THE CHECK (build prompt K-2, K-3, K-4, K-7; editorial standard V1.4 §2–§6, §9, §11; the
// content chat's note of Nov 25 §3–§4; the Work an idea chat's additions of Nov 25). Pure: no I/O, no clock (the
// publish instant is handed in), no fetch.
//
// ONE SOURCE FOR THE PAGE'S HARD RULES (K-2). The page's own `storyOf` (src/components/Explore/exploreView.js) is
// called on the story AS IT WOULD BE ONCE PUBLISHED — `status: 'published'` and a real instant — never on the file as
// it sits (a draft with a placeholder date). A story it drops is refused. The reason is named by asking `storyOf`
// itself: each part it judges (the id, `sample`, the title, the version, the questions) is replaced in turn by one it
// accepts, and a part whose repair alone the record cannot do without is a reason. No hard rule is restated here.
// (exploreView.js imports nothing; storyCheck.test.js imports this module in Node as the dependency guard.)
//
// THREE LEVELS (K-3). `refused`: the story cannot be published, whatever the founder says (K-4's list, K-7, the two
// formulas, a stored key off a given list). `unmatched` is the matcher's (matchStory.js), never this module's.
// `noted`: worth the founder's attention, never blocking. Every finding names the field, the value and the rule.
//
// LINKS (K-4(e)). A story the record links to is looked up in the stories checked together first, then among the
// collection's documents the caller read (`others`). For a publish (`linkMode: 'published'`) a story outside the set
// counts only when it is published: an overview's door must open a story players can read, and a deep story's way
// back must lead to one.

import { storyOf, STORY_ID, BASES } from '../../../src/components/Explore/exploreView.js';
import { ALL_TICKERS, isRetiredStock } from '../rankingConfig.js';
import { PRACTICE_FIELD_FUNDS } from '../../../src/data/practiceFieldFunds.js';
import {
  KINDS, WORD_LIMITS, BROAD_SHAPE, SHAPES, MEASURE_KINDS, FORMULAS, LIMITS, authorRecordOf, measureCellsOf, cellKindOf,
  figureInExcerpt, wordsIn,
} from './storyRecord.js';

export const LEVELS = Object.freeze({ REFUSED: 'refused', UNMATCHED: 'unmatched', NOTED: 'noted' });

const TICKERS = new Set(ALL_TICKERS);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const textOf = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const listOf = (v) => (Array.isArray(v) ? v : []);
const show = (v) => (v === undefined ? '(missing)' : JSON.stringify(v));
/** An id (or a reference to one) with spaces at its ends: the page reads every id trimmed (exploreView.js). */
const padded = (v) => typeof v === 'string' && v.trim() !== '' && v !== v.trim();
/**
 * F-2 (the Explore chat's fix prompt of Nov 27; review N-5): a padded id is REFUSED, not noted and not repaired — the
 * standing of SQ-5. The page reads ids trimmed, so the stored record and the id the page hands on would not match.
 */
const paddedMessage = (field, value) => `${field} is ${show(value)}, with spaces at its ends: the page reads ids trimmed, so a padded id would not be found`;

/** A finding (K-3): the level, the rule, the field, the value as found, and what is wrong in plain words. */
const finding = (level, rule, field, value, message) => ({ level, rule, field, value: value === undefined ? null : value, message });

// ── K-2: the page's own judgment ─────────────────────────────────────────────────────────────────────────────────

/** Each part `storyOf` judges, and a value it accepts there. Used only to NAME a reason, never to accept a story. */
const REPAIRS = Object.freeze([
  { part: 'id', message: `the document id is not one the page accepts (letters, digits, "-" and "_", 1 to 200 of them: STORY_ID)`, fix: (s) => ({ ...s, id: 'story' }) },
  { part: 'sample', message: 'the record carries `sample`, which the page drops', fix: (s) => { const data = { ...s.data }; delete data.sample; return { ...s, data }; } },
  { part: 'title', message: 'the title is blank', fix: (s) => ({ ...s, data: { ...s.data, title: 'title' } }) },
  { part: 'version', message: 'the version is not a whole number of 0 or more', fix: (s) => ({ ...s, data: { ...s.data, version: 0 } }) },
  { part: 'questions', message: 'no question has text', fix: (s) => ({ ...s, data: { ...s.data, questions: [{ id: 'q', text: 'question' }] } }) },
]);

/**
 * Why the page would drop this record, by asking `storyOf` (K-2): `[]` when it draws it. A part is a reason when the
 * record with EVERY OTHER part repaired is still dropped.
 */
export function pageDropReasonsOf(id, published) {
  if (storyOf(id, published) !== null) return [];
  const start = { id, data: isPlain(published) ? published : {} };
  if (!isPlain(published)) return [{ part: 'record', message: 'the file does not hold one JSON object' }];
  const reasons = REPAIRS.filter((r) => {
    const others = REPAIRS.filter((o) => o !== r).reduce((s, o) => o.fix(s), start);
    return storyOf(others.id, others.data) === null;
  });
  const all = REPAIRS.reduce((s, o) => o.fix(s), start);
  if (reasons.length === 0 || storyOf(all.id, all.data) === null) {
    return reasons.length ? reasons : [{ part: 'unknown', message: 'the page drops this record for a reason this check cannot name' }];
  }
  return reasons;
}

/** The story as it would be once published (K-2): its own fields, `status: 'published'`, a real instant. */
export const asPublished = (record, now) => ({ ...(isPlain(record) ? record : {}), status: 'published', publishedAt: now });

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A company entry's symbol: `{ symbol }` (null allowed where the caller allows it) or a bare string. */
const symbolOf = (entry) => (isPlain(entry) ? entry.symbol : entry);
const listedTicker = (s) => typeof s === 'string' && TICKERS.has(s) && !isRetiredStock(s);

/** Currency signs and words a unit may begin with, and the code each names. */
const CURRENCY_WORDS = Object.freeze([
  [/^(?:\$|us\s*\$|us dollars?\b|u\.s\. dollars?\b|dollars?\b)/i, 'USD'],
  [/^(?:€|euros?\b)/i, 'EUR'],
  [/^(?:£|pounds? sterling\b|pounds?\b)/i, 'GBP'],
  [/^(?:¥|yen\b)/i, 'JPY'],
]);
/**
 * The currency a unit names first, as a code, or null: an ISO-shaped code ("USD millions" → "USD"), or a sign or a
 * word ("$ millions", "US dollars, millions" → "USD"; review A10). A unit naming no currency (percent, GW) has none.
 */
export function currencyOf(unit) {
  if (typeof unit !== 'string') return null;
  const u = unit.trim();
  const code = u.match(/^([A-Z]{3})(?![A-Za-z])/)?.[1];
  if (code) return code;
  return CURRENCY_WORDS.find(([re]) => re.test(u))?.[1] ?? null;
}

/** The words a story never uses of its evidence (standard §4). */
const BANNED_WORDS = /\b(?:supported|verified|confirmed)\b/i;

/** The keys a computed cell may carry (addition 2: never a result). */
const COMPUTED_CELL_KEYS = Object.freeze(['symbol', 'formula', 'inputs']);

/** Every story id the records link to (parents and doors) that is not among them: what the caller reads. */
export function linkedIdsOf(entries) {
  const inSet = new Set(entries.map((e) => e.id));
  const out = new Set();
  for (const { raw } of entries) {
    if (!isPlain(raw)) continue;
    if (isPlain(raw.parent) && typeof raw.parent.storyId === 'string') out.add(raw.parent.storyId);
    for (const c of listOf(raw.connections)) if (isPlain(c) && typeof c.leadsToStory === 'string' && c.leadsToStory) out.add(c.leadsToStory);
  }
  return [...out].filter((id) => !inSet.has(id) && STORY_ID.test(id));
}

// ── the check of one story ───────────────────────────────────────────────────────────────────────────────────────

function checkOne({ id, record, discarded }, ctx) {
  const out = [];
  const refuse = (rule, field, value, message) => out.push(finding(LEVELS.REFUSED, rule, field, value, message));
  const note = (rule, field, value, message) => out.push(finding(LEVELS.NOTED, rule, field, value, message));

  // (`status`, `publishedAt` and `revisedAt` are replaced on every write and need no note: an author's draft carries a
  // placeholder date. A match result is worth saying, wherever it sat: this step never keeps one.)
  const matchFields = discarded.filter((f) => /(^|\.)match(ed)?$/.test(f));
  if (matchFields.length) note('K-11', matchFields.join(', '), null, 'the record arrived with match results (written in the file, or stored by an earlier run); this step never keeps one: they were removed before anything else read the record, and only this run\'s are recorded');

  // (a) the page's own judgment, on the story as it would be once published (K-2)
  for (const r of pageDropReasonsOf(id, asPublished(record, ctx.now))) {
    if (r.part === 'sample') continue; // (b) names it, for any value
    refuse('K-4(a)', r.part, r.part === 'id' ? id : record?.[r.part], `the page would not draw this story: ${r.message}`);
  }
  if (!isPlain(record)) return out;

  // (b) sample, of any value
  if (Object.hasOwn(record, 'sample')) refuse('K-4(b)', 'sample', record.sample, 'a story never carries `sample`, of any value: samples live only in fixtures');

  // (c) kind
  const kind = KINDS.includes(record.kind) ? record.kind : null;
  if (!kind) refuse('K-4(c)', 'kind', record.kind, `\`kind\` must be 'overview' or 'deep'`);

  // (d) the body's words, over all paragraphs
  if (kind) {
    const words = wordsIn(record.body);
    if (words > WORD_LIMITS[kind]) refuse('K-4(d)', 'body', words, `the body has ${words} words; a${kind === 'overview' ? 'n overview' : ' deep story'} has ${WORD_LIMITS[kind]} at most`);
  }
  if (!Array.isArray(record.body) || record.body.some((p) => typeof p !== 'string')) note('record', 'body', record.body, 'the body is a list of paragraphs, each a string; anything else is not drawn');

  const connections = listOf(record.connections);
  const sources = listOf(record.sources);
  const questions = listOf(record.questions);
  const sourceIds = new Set(sources.filter(isPlain).map((s) => s.id).filter((v) => typeof v === 'string' && v));
  const connById = new Map();

  // (g) connections
  if (!Array.isArray(record.connections)) refuse('K-4(g)', 'connections', record.connections, 'a story has a list of connections');
  connections.forEach((c, i) => {
    const at = `connections[${i}]`;
    if (!isPlain(c)) { refuse('K-4(g)', at, c, 'a connection is an object'); return; }
    // The id is the address (standard §8): looked up exactly as written, never trimmed (review A5); a padded one is refused (F-2).
    const cid = textOf(c.id) ? c.id : null;
    if (!cid) refuse('K-4(g)', `${at}.id`, c.id, 'every connection has an `id`');
    else if (connById.has(cid)) refuse('K-4(g)', `${at}.id`, c.id, `the connection id "${cid}" is used twice`);
    else connById.set(cid, c);
    if (cid && padded(cid) && connById.get(cid) === c) refuse('F-2', `${at}.id`, c.id, paddedMessage(`${at}.id`, c.id)); // one refusal per field: a reused id is refused above
    if (!BASES.includes(c.basis)) refuse('K-4(g)', `${at}.basis`, c.basis, `\`basis\` is one of ${BASES.join(', ')}`);
    if (!textOf(c.unknown)) refuse('K-4(g)', `${at}.unknown`, c.unknown, 'every connection states its one unknown (the gap, standard §5)');
    if (!textOf(c.whereToLook)) refuse('K-4(g)', `${at}.whereToLook`, c.whereToLook, 'every connection says where to look (the gap, standard §5)');
    if (c.basis === 'source_cited' && listOf(c.sourceIds).length === 0) refuse('K-4(g)', `${at}.sourceIds`, c.sourceIds, 'a connection labelled "Source cited" names at least one source');
    if (!textOf(c.who)) note('page', `${at}.who`, c.who, 'the page does not draw a connection without `who`');
    if (c.basis !== 'source_cited' && textOf(c.known)) note('standard §5', `${at}.known`, c.known, '"Known" holds what a cited source establishes; it is blank when nothing is cited');
    if (c.basis === 'source_cited' && !textOf(c.known)) note('standard §5', `${at}.known`, c.known, 'a "Source cited" connection states what its source establishes in "Known"');
    if (c.basis !== 'source_cited' && BASES.includes(c.basis) && listOf(c.sourceIds).length > 0) note('standard §4', `${at}.sourceIds`, c.sourceIds, `labelled "${c.basis}" but cites a source: it counts as unsourced by its label`);
  });
  if (!connections.some((c) => isPlain(c) && BASES.includes(c.basis) && c.basis !== 'source_cited')) {
    refuse('K-4(g)', 'connections', null, 'at least one connection is not sourced ("Reporter\'s reading" or "No source yet")');
  }
  if (kind) {
    const [lo, hi] = kind === 'overview' ? [3, 5] : [2, 5];
    if (connections.length < lo || connections.length > hi) note('standard §2', 'connections', connections.length, `a${kind === 'overview' ? 'n overview' : ' deep story'} has ${lo} to ${hi} connections`);
  }

  // (h) sources: every cited id exists; every link is https
  const cites = [];
  connections.forEach((c, i) => { if (isPlain(c)) listOf(c.sourceIds).forEach((s, k) => cites.push([`connections[${i}].sourceIds[${k}]`, s])); });
  const cells = measureCellsOf(record);
  for (const { cell, field } of cells) {
    if (!isPlain(cell)) continue;
    if (cellKindOf(cell) === 'stated') cites.push([`${field}.sourceId`, cell.sourceId]);
    if (cellKindOf(cell) === 'computed') listOf(cell.inputs).forEach((inp, k) => { if (isPlain(inp)) cites.push([`${field}.inputs[${k}].sourceId`, inp.sourceId]); });
  }
  for (const [field, sid] of cites) {
    if (!sourceIds.has(sid)) refuse('K-4(h)', field, sid, `names no source: there is no source with id ${show(sid)}`);
    else if (padded(sid)) refuse('F-2', field, sid, paddedMessage(field, sid));
  }
  const seenSource = new Set();
  sources.forEach((s, i) => {
    const at = `sources[${i}]`;
    if (!isPlain(s)) { refuse('K-4(h)', at, s, 'a source is an object'); return; }
    let https = false;
    try { https = typeof s.url === 'string' && new URL(s.url).protocol === 'https:'; } catch { https = false; }
    if (!textOf(s.url)) refuse('K-4(h)', `${at}.url`, s.url, 'every source has a link');
    else if (!https) refuse('K-4(h)', `${at}.url`, s.url, 'a source\'s link is https');
    if (!textOf(s.name)) note('page', `${at}.name`, s.name, 'the page does not draw a source without a name');
    if (!textOf(s.excerpt)) note('standard §4', `${at}.excerpt`, s.excerpt, 'a source with no excerpt can never be matched by machine');
    // Two sources under one id: a citation of it names no ONE source, and a figure's match could rest on the other
    // (review H5/A7). Refused under K-4(h).
    if (typeof s.id === 'string' && seenSource.has(s.id)) refuse('K-4(h)', `${at}.id`, s.id, 'two sources share this id: a citation of it names no one source');
    else if (padded(s.id)) refuse('F-2', `${at}.id`, s.id, paddedMessage(`${at}.id`, s.id));
    seenSource.add(s.id);
    if (typeof s.id === 'string' && !cites.some(([, sid]) => sid === s.id)) note('record', `${at}.id`, s.id, 'no connection and no figure cites this source');
  });

  // (f) tickers
  const tickers = listOf(record.tickers);
  if (tickers.length > LIMITS.TICKERS_MAX) refuse('K-4(f)', 'tickers', tickers.length, `a story names ${LIMITS.TICKERS_MAX} tickers at most`);
  tickers.forEach((t, i) => { if (!listedTicker(t)) refuse('K-4(f)', `tickers[${i}]`, t, 'not in the game\'s 228-stock list (ALL_TICKERS), or retired'); });
  listOf(record.about).forEach((a, i) => { if (!listedTicker(symbolOf(a))) refuse('K-4(f)', `about[${i}].symbol`, symbolOf(a), 'not in the game\'s 228-stock list (ALL_TICKERS), or retired'); });
  connections.forEach((c, i) => {
    if (!isPlain(c)) return;
    listOf(c.leads).forEach((l, k) => {
      const s = symbolOf(l);
      if (s === null && isPlain(l)) { if (!textOf(l.name)) note('record', `connections[${i}].leads[${k}].name`, l.name, 'an unlisted company (symbol null) is named'); return; }
      if (!listedTicker(s)) refuse('K-4(f)', `connections[${i}].leads[${k}].symbol`, s, 'not in the game\'s 228-stock list (ALL_TICKERS), or retired; an unlisted company has symbol null');
    });
  });
  if (kind === 'deep') {
    const about = listOf(record.about);
    if (about.length < 1 || about.length > 2) note('standard §9', 'about', about.length, 'a deep story names one or two companies of its own in `about`');
  }
  if (kind === 'overview' && record.about !== undefined) note('standard §9', 'about', record.about, 'only a deep story names its own company');

  // (i) questions. "Exactly one featured" is counted on what the page draws — the page's own view of the story as it
  // would be once published (K-2; review A15): a featured question with no text is not drawn, so it is not a card.
  const view = storyOf(id, asPublished(record, ctx.now));
  const featured = view ? view.questions.filter((q) => q.featured).length : questions.filter((q) => isPlain(q) && q.featured === true).length;
  if (featured !== 1) refuse('K-4(i)', 'questions', featured, `exactly one question the page draws is featured; ${featured} ${featured === 1 ? 'is' : 'are'}`);
  const seenQ = new Set();
  const shapesUsed = [];
  questions.forEach((q, i) => {
    const at = `questions[${i}]`;
    if (!isPlain(q)) { refuse('K-4(i)', at, q, 'a question is an object'); return; }
    if (!connById.has(q.fromConnection)) refuse('K-4(i)', `${at}.fromConnection`, q.fromConnection, 'names no connection of this story');
    else if (padded(q.fromConnection)) refuse('F-2', `${at}.fromConnection`, q.fromConnection, paddedMessage(`${at}.fromConnection`, q.fromConnection));
    if (!SHAPES.includes(q.shape)) refuse('K-4(i)', `${at}.shape`, q.shape, `\`shape\` is one of ${SHAPES.join(', ')}`);
    else shapesUsed.push(q.shape);
    // The founder's ruling SQ-5 (Nov 26): refused, not noted. An investigation starts from a question by its id, and
    // the page invents an id for a question without one and renames the second of two that share one (it compares
    // them trimmed, so this check does too).
    const qid = textOf(q.id);
    if (!qid) refuse('SQ-5', `${at}.id`, q.id, 'every question has an id: without one the page invents one, which an investigation started from this question could not name');
    else if (seenQ.has(qid)) refuse('SQ-5', `${at}.id`, q.id, `the id "${qid}" is already used by another question of this story; the page would rename this one`);
    else if (padded(q.id)) refuse('F-2', `${at}.id`, q.id, paddedMessage(`${at}.id`, q.id));
    seenQ.add(qid);
    if (!textOf(q.text)) note('page', `${at}.text`, q.text, 'the page does not draw a question without text');
    else if (q.text.trim().length > 120) note('standard §6 rule 7', `${at}.text`, q.text.trim().length, 'a question reads in one sentence, under 120 characters where possible');
    if (!textOf(q.wrongIfSeed)) note('standard §6 rule 9', `${at}.wrongIfSeed`, q.wrongIfSeed, 'a question says what would weaken a thesis built from it');
    if (!isPlain(q.watch) || !textOf(q.watch.document) || !textOf(q.watch.updates)) note('standard §6 rule 10', `${at}.watch`, q.watch, 'a question names its watch document and how often it comes out');
    if (kind === 'overview' && q.shape !== BROAD_SHAPE && SHAPES.includes(q.shape)) note('standard §2', `${at}.shape`, q.shape, 'an overview\'s questions are broad (who_leads)');
    if (kind === 'deep' && q.shape === BROAD_SHAPE) note('standard §2', `${at}.shape`, q.shape, 'a deep story\'s questions are specific');
    if (q.shape === BROAD_SHAPE) checkBroad(q, at, connById, ctx, refuse, note);
    else {
      // K-4(f) checks "a question's group", whatever its shape (review A3). A specific question's group and measures
      // are written, checked and matched like a broad one's; no compare-and-narrow investigation starts from it.
      listOf(q.group).forEach((g, k) => { if (!listedTicker(symbolOf(g))) refuse('K-4(f)', `${at}.group[${k}].symbol`, symbolOf(g), 'not in the game\'s 228-stock list (ALL_TICKERS), or retired'); });
      if (q.group !== undefined || q.measures !== undefined) note('standard §6', at, null, 'a specific question carries a group or measures: they are checked and matched, but only a broad question\'s start a comparison');
    }
  });
  if (questions.length < 1 || questions.length > 3) note('standard §2', 'questions', questions.length, 'a story has one to three questions');
  if (kind === 'deep' && new Set(shapesUsed).size !== shapesUsed.length) note('standard §6', 'questions', shapesUsed, 'a deep story\'s questions use different shapes');
  const feat = questions.find((q) => isPlain(q) && q.featured === true && q.shape === BROAD_SHAPE);
  if (feat) {
    const group = listOf(feat.group).map(symbolOf);
    if (group.some((s, k) => tickers[k] !== s)) note('standard §9', 'tickers', tickers, 'the story\'s tickers hold the featured question\'s group first');
  }

  // The story's own words never say "Supported", "Verified" or "Confirmed" (standard §4). Quotes are the documents'.
  const own = [
    ['title', record.title], ['deck', record.deck], ['openQuestion', record.openQuestion],
    ...listOf(record.body).map((p, i) => [`body[${i}]`, p]),
    ...connections.flatMap((c, i) => (isPlain(c) ? ['who', 'what', 'basisLine', 'known', 'unknown', 'whereToLook'].map((k) => [`connections[${i}].${k}`, c[k]]) : [])),
    ...questions.flatMap((q, i) => (isPlain(q) ? ['text', 'angleLabel', 'unknown', 'wrongIfSeed'].map((k) => [`questions[${i}].${k}`, q[k]]) : [])),
  ];
  for (const [f, v] of own) {
    const word = typeof v === 'string' ? v.match(BANNED_WORDS)?.[0] : null;
    if (word) note('standard §4', f, word, 'the words "Supported", "Verified" and "Confirmed" are never used');
  }

  // (k) cells, and K-7: the figure inside its own quote
  for (const { cell, field } of cells) checkCell(cell, field, refuse, note);

  // (e) links
  checkLinks({ id, record, kind, connById }, ctx, refuse, note);
  return out;
}

function checkBroad(q, at, connById, ctx, refuse, note) {
  const conn = connById.get(q.fromConnection);
  const leadSymbols = new Set(listOf(conn?.leads).map(symbolOf).filter((s) => typeof s === 'string'));
  const group = listOf(q.group);
  // Counted as companies, not entries (review A2): a company named twice is refused, and the limits count each once.
  const groupSymbols = group.map(symbolOf);
  const companies = new Set(groupSymbols).size;
  if (companies < LIMITS.GROUP_MIN || companies > LIMITS.GROUP_MAX) refuse('K-4(j)', `${at}.group`, companies, `a broad question compares ${LIMITS.GROUP_MIN} to ${LIMITS.GROUP_MAX} companies`);
  group.forEach((g, k) => {
    const s = symbolOf(g);
    if (!listedTicker(s)) refuse('K-4(f)', `${at}.group[${k}].symbol`, s, 'not in the game\'s 228-stock list (ALL_TICKERS), or retired');
    if (conn && !leadSymbols.has(s)) refuse('K-4(j)', `${at}.group[${k}].symbol`, s, `is not a lead of the question's connection "${q.fromConnection}"`);
    if (groupSymbols.indexOf(s) !== k) refuse('K-4(j)', `${at}.group[${k}].symbol`, s, 'names a company already in the group');
  });
  const measures = listOf(q.measures);
  if (measures.length < LIMITS.MEASURES_MIN || measures.length > LIMITS.MEASURES_MAX) refuse('K-4(j)', `${at}.measures`, measures.length, `a broad question names ${LIMITS.MEASURES_MIN} to ${LIMITS.MEASURES_MAX} measures`);
  const storedMeasures = measures.filter((m) => isPlain(m) && m.kind === 'stored');
  const stored = new Set(storedMeasures.map((m) => m.storedKey)).size;
  if (stored < LIMITS.STORED_MIN) refuse('K-4(j)', `${at}.measures`, stored, `at least ${LIMITS.STORED_MIN} measures are stored; ${stored} ${stored === 1 ? 'is' : 'are'}`);
  measures.forEach((m, k) => {
    const mat = `${at}.measures[${k}]`;
    if (!isPlain(m) || !MEASURE_KINDS.includes(m.kind)) { refuse('K-4(j)', `${mat}.kind`, m?.kind, 'a measure is stored or reported (standard §6); this one is neither'); return; }
    if (m.kind === 'stored') {
      // The key is used exactly as written (review A5); a blank one is refused.
      const key = textOf(m.storedKey) ? m.storedKey : null;
      if (!key) refuse('K-4(l)', `${mat}.storedKey`, m.storedKey, 'a stored measure names its key');
      else if (ctx.storedKeys) { if (!ctx.storedKeys.has(key)) refuse('K-4(l)', `${mat}.storedKey`, key, 'is not on the research server\'s list of stored measures'); }
      else note('K-4(l)', `${mat}.storedKey`, key, 'not checked: the list is not built yet (src/constants/compareMeasures.js)');
      if (key && storedMeasures.findIndex((x) => x.storedKey === m.storedKey) !== storedMeasures.indexOf(m)) refuse('K-4(j)', `${mat}.storedKey`, key, 'names a stored measure already in this question');
      if (m.name !== undefined || m.plain !== undefined) note('standard §6', mat, null, 'a stored measure writes no label of its own: the research server\'s list holds it');
      return;
    }
    if (!textOf(m.name) || !textOf(m.plain)) note('standard §6', mat, null, 'a reported measure has its label in plain words (`name`, `plain`)');
    const cells = listOf(m.cells);
    const cellSymbols = cells.map((c) => (isPlain(c) ? c.symbol : undefined));
    for (const s of groupSymbols) if (!cellSymbols.includes(s)) refuse('K-4(j)', `${mat}.cells`, s, `has no cell for ${s}, a company of the group`);
    cellSymbols.forEach((s, c) => { if (!groupSymbols.includes(s)) refuse('K-4(j)', `${mat}.cells[${c}].symbol`, s, 'is not a company of the question\'s group'); });
    if (new Set(cellSymbols).size !== cellSymbols.length) note('record', `${mat}.cells`, cellSymbols, 'a company has two cells in this measure');
  });
  if (!textOf(q.benchmark)) note('standard §6', `${at}.benchmark`, q.benchmark, 'a broad question suggests a benchmark fund');
  else if (!Object.hasOwn(PRACTICE_FIELD_FUNDS, q.benchmark)) note('standard §6', `${at}.benchmark`, q.benchmark, 'is not a fund the idea book holds (src/data/practiceFieldFunds.js)');
}

/** One input or stated cell's figure (K-7). */
function checkFigure(item, field, refuse) {
  if (typeof item.value !== 'number' || !Number.isFinite(item.value)) refuse('K-7', `${field}.value`, item.value, 'the figure is a number');
  else if (!figureInExcerpt(item.value, item.excerpt)) refuse('K-7', `${field}.value`, item.value, `is not written in its own excerpt ${show(item.excerpt)} as a whole number`);
}

function checkCell(cell, field, refuse, note) {
  if (!isPlain(cell)) { refuse('K-4(k)', field, cell, 'a cell is an object'); return; }
  const kind = cellKindOf(cell);
  if (kind === 'notReported') {
    const extra = Object.keys(cell).filter((k) => k !== 'symbol' && k !== 'notReported');
    if (extra.length) note('standard §6', field, extra, 'a "not reported" cell carries nothing but its company');
    return;
  }
  if (kind === 'stated') {
    checkFigure(cell, field, refuse);
    if (!textOf(cell.unit) || !textOf(cell.period)) note('standard §9', field, null, 'a stated cell names its unit and its period');
    return;
  }
  // computed: a named formula, its inputs, never its result
  const spec = Object.hasOwn(FORMULAS, cell.formula) ? FORMULAS[cell.formula] : null;
  if (!spec) { refuse('K-4(k)', `${field}.formula`, cell.formula, `a computed cell's formula is one of ${Object.keys(FORMULAS).join(', ')}`); return; }
  // Its company, its formula and its inputs, and nothing else: a result under any name is refused (addition 2;
  // review A6). The research server does the arithmetic.
  for (const k of Object.keys(cell).filter((x) => !COMPUTED_CELL_KEYS.includes(x))) refuse('K-4(k)', `${field}.${k}`, cell[k], 'a computed cell carries its company, its formula and its inputs, never a result: the research server does the arithmetic');
  const inputs = listOf(cell.inputs);
  if (!Array.isArray(cell.inputs) || inputs.length !== spec.inputs.length) {
    refuse('K-4(k)', `${field}.inputs`, inputs.length, `${cell.formula} takes ${spec.inputs.length} inputs [${spec.inputs.join(', ')}]`);
    return;
  }
  inputs.forEach((inp, k) => {
    if (!isPlain(inp)) refuse('K-4(k)', `${field}.inputs[${k}]`, inp, 'an input is an object');
    else checkFigure(inp, `${field}.inputs[${k}]`, refuse);
  });
  if (!inputs.every(isPlain)) return;
  const [a, b] = inputs;
  if (cell.formula === 'growth_from_year_ago') {
    if (!textOf(a.unit) || textOf(a.unit) !== textOf(b.unit)) refuse('K-4(k)', `${field}.inputs`, [a.unit, b.unit], 'growth_from_year_ago: the current figure and the year-ago figure are in the same unit');
    if (!textOf(a.period) || !textOf(b.period) || a.period.trim() === b.period.trim()) refuse('K-4(k)', `${field}.inputs`, [a.period, b.period], 'growth_from_year_ago: the two figures are of two different periods');
    if (b.value === 0) refuse('K-4(k)', `${field}.inputs[1].value`, b.value, 'growth_from_year_ago: the year-ago figure is not zero');
  } else {
    if (!textOf(a.period) || textOf(a.period) !== textOf(b.period)) refuse('K-4(k)', `${field}.inputs`, [a.period, b.period], 'ratio: the numerator and the denominator are of the same period');
    const ca = currencyOf(a.unit);
    if (!ca || ca !== currencyOf(b.unit)) refuse('K-4(k)', `${field}.inputs`, [a.unit, b.unit], 'ratio: the two units are in the same currency (a unit names its currency first: a code as "USD millions", a sign as "$ millions", or a word as "US dollars")');
    if (b.value === 0) refuse('K-4(k)', `${field}.inputs[1].value`, b.value, 'ratio: the denominator is not zero');
  }
}

function checkLinks({ id, record, kind, connById }, ctx, refuse, note) {
  const found = (sid) => ctx.lookup(sid);
  const where = ctx.linkMode === 'published' ? 'published, or published with it' : 'in the collection, or checked with it';
  if (kind === 'deep') {
    const p = record.parent;
    if (!isPlain(p) || !textOf(p.storyId) || !textOf(p.connectionId)) {
      refuse('K-4(e)', 'parent', p, 'a deep story names its parent: `{ storyId, connectionId }` of one overview\'s connection');
    } else {
      const parent = found(p.storyId);
      if (!parent) refuse('K-4(e)', 'parent.storyId', p.storyId, `names no existing overview (${where})${ctx.describeMissing(p.storyId)}`);
      else if (parent.kind !== 'overview') refuse('K-4(e)', 'parent.storyId', p.storyId, 'names a story that is not an overview');
      else {
        const conn = listOf(parent.connections).find((c) => isPlain(c) && c.id === p.connectionId);
        if (!conn) refuse('K-4(e)', 'parent.connectionId', p.connectionId, `names no connection of "${p.storyId}"`);
        else if (conn.leadsToStory !== id) refuse('K-4(e)', 'parent.connectionId', p.connectionId, `the parent connection's leadsToStory is ${show(conn.leadsToStory)}, not this story`);
        else if (padded(p.connectionId)) refuse('F-2', 'parent.connectionId', p.connectionId, paddedMessage('parent.connectionId', p.connectionId));
      }
    }
  }
  if (kind === 'overview' && record.parent !== undefined) note('standard §9', 'parent', record.parent, 'an overview has no parent; only a deep story does');
  for (const [cid, c] of connById) {
    // No door yet: the key is absent (the note §4). A null or empty door is a door that names no story, refused as
    // K-4(e) reads (review A12 put the looser reading to the founder: SQ-8).
    if (c.leadsToStory === undefined) continue;
    const at = `connections[${cid}].leadsToStory`;
    if (kind !== 'overview') {
      // a deep story's own door is still followed by the page (doorOf), which drops a padded one: refused (F-2, review B-1)
      if (padded(c.leadsToStory)) refuse('F-2', at, c.leadsToStory, paddedMessage(at, c.leadsToStory));
      else note('standard §7', at, c.leadsToStory, 'only an overview\'s connection leads to a deep story');
      continue;
    }
    const target = typeof c.leadsToStory === 'string' && c.leadsToStory ? found(c.leadsToStory) : null;
    if (!target || target.kind !== 'deep') {
      refuse('K-4(e)', at, c.leadsToStory, `names no existing deep story (${where})${typeof c.leadsToStory === 'string' ? ctx.describeMissing(c.leadsToStory) : ''}`);
    } else if (!isPlain(target.parent) || target.parent.storyId !== id || target.parent.connectionId !== cid) {
      note('standard §11', at, c.leadsToStory, `the deep story's own parent is ${show(target.parent)}, not this connection: the two do not point at each other`);
    }
  }
}

// ── the set ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Check stories together (K-4, K-7). `entries`: `[{ id, raw }]`, the author's records as read. `others`: a Map of the
 * collection's documents the caller read for links (id → data). `linkMode`: 'any' (check, match, draft) or
 * 'published' (publish). `storedKeys`: the research server's stored-measure keys when that list exists (a Set or an
 * array), else null (each key noted as not checked). `now`: the publish instant storyOf is asked about.
 * Returns `{ stories: [{ id, record, kind, version, findings }], refused }`.
 */
export function checkStories(entries, { others = new Map(), linkMode = 'any', storedKeys = null, now = new Date(0) } = {}) {
  const prepared = entries.map(({ id, raw }) => ({ id, ...authorRecordOf(raw) }));
  const inSet = new Map(prepared.filter((p) => isPlain(p.record)).map((p) => [p.id, p.record]));
  const lookup = (sid) => {
    if (inSet.has(sid)) return inSet.get(sid);
    const doc = others.get(sid);
    if (!isPlain(doc)) return null;
    return linkMode === 'published' && doc.status !== 'published' ? null : doc;
  };
  const describeMissing = (sid) => {
    const doc = others.get(sid);
    if (linkMode === 'published' && isPlain(doc) && doc.status !== 'published') return `: "${sid}" is a ${doc.status ?? 'stored'} story — publish them together`;
    return '';
  };
  const ctx = { now, linkMode, lookup, describeMissing, storedKeys: storedKeys ? new Set(storedKeys) : null };
  const counts = new Map();
  for (const p of prepared) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  const stories = prepared.map((p) => {
    const findings = checkOne(p, ctx);
    if (counts.get(p.id) > 1) findings.unshift(finding(LEVELS.REFUSED, 'K-9', 'id', p.id, 'two files name this document id'));
    return {
      id: p.id,
      record: p.record,
      kind: isPlain(p.record) && KINDS.includes(p.record.kind) ? p.record.kind : null,
      version: isPlain(p.record) ? p.record.version ?? null : null,
      findings,
    };
  });
  return { stories, refused: stories.some((s) => s.findings.some((f) => f.level === LEVELS.REFUSED)) };
}
