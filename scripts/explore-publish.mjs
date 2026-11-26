// scripts/explore-publish.mjs
//
// Explore — THE FOUNDER'S COMMAND FOR CHECKING, MATCHING AND PUBLISHING STORIES (build prompt of Nov 25, 2026, K-1 to
// K-12; editorial standard V1.4, docs/design/explore/20261125_EXPLORE_EDITORIAL_STANDARD_V1_4.md). A thin door over
// api/_utils/explore/: the check (storyCheck.js), the fetch and match (fetchSource.js, extractText.js, matchStory.js)
// and the writer (storyWriter.js). This script never writes Firestore itself, calls no model and no provider, and
// nothing in the app calls it.
//
// USAGE (from the repo root of the founder's checkout on `main`, where .env.local lives):
//
//   node scripts/explore-publish.mjs check     --file <story.json> [--file …]                   --uid <uid>
//   node scripts/explore-publish.mjs match     --file <story.json> [--file …]                   --uid <uid>
//   node scripts/explore-publish.mjs draft     --file <story.json> [--file …]                   --uid <uid> [--go]
//   node scripts/explore-publish.mjs publish   --file <story.json> … | --id <id> … [--accept-unmatched] --uid <uid> [--go]
//   node scripts/explore-publish.mjs unpublish --id <id> … | --file <story.json> …              --uid <uid> [--go]
//   node scripts/explore-publish.mjs status    [--id <id> … | --file <story.json> …]            --uid <uid>
//
//   A story file holds one story record as JSON, and its NAME is the story's document id: ai-buildout.json is the
//   story `ai-buildout`. Add --json to any command for the answer as JSON. --help prints this and touches nothing.
//
// WHAT EACH COMMAND DOES
//   check      The files against the standard (K-4) and the figure-in-its-quote rule (K-7). Reads the collection only
//              to find a story the files link to that is not among them. No fetch, no write.
//   match      check, then fetch every source's link once and look for every quote in it, word for word (K-6). Prints
//              the report (K-12). No write.
//   draft      check, match, then write the stories as drafts (`status: 'draft'`): no player can read a draft.
//   publish    check and match AFRESH (a stored match is never reused), then write `status: 'published'`. With --id it
//              publishes the stored story by that id, checked and matched again. A story with any source a machine
//              could not confirm, or any figure not found in its source, is refused unless --accept-unmatched is given;
//              with it, the report says each such figure will arrive in an investigation as not checked. Stories named
//              together are checked as a set and written in one transaction, so an overview and its deep story can go
//              out together.
//   unpublish  A published story back to draft: the one-step way back.
//   status     Every story in the collection (or those named): kind, status, version, links, and its match summary.
//
// THE GATES, as the precedent's (scripts/practice-field-founder.mjs):
//   1. the uid is a founder: on MANDATE_FOUNDER_UIDS in THIS process's environment — the shell's, else .env.local's
//      (scripts/loadLocalEnv.js: a variable already set in the shell wins). Otherwise nothing is read (exit 2);
//   2. --go is on the command line, for a command that writes. Without it, a writing command prints exactly what it
//      would write, and stops (exit 2: nothing written).
//   match, draft and publish also need a contact address for the user agent (EXPLORE_PUBLISH_CONTACT, an email address
//   or an https link): without one nothing is fetched (exit 2). There is no gate on EXPLORE_MODE: stories are
//   published before the switch moves. The gates are a seatbelt for the founder's own machine, not authentication —
//   the service account in .env.local is what grants access.
//
// EXIT CODES: 0 done; 2 refused — by a gate, by the check, by the matcher's rule (K-8), by the version rule, or not
// written for want of --go; 1 failed (a bad argument, a bad file, an error).
//
// CREDENTIALS load only inside main, after the arguments are checked; the database is opened only when something must
// be read. Importing this module reads no environment file and opens no connection; --help exits before either.
//
// Tests: scripts/explore-publish.test.js, on the in-memory Firestore harness, with an injected fetcher.

import process from 'node:process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORY_ID } from '../src/components/Explore/exploreView.js';
import { founderAllowlist } from '../api/_utils/practiceField/founderControls.js';
import { checkStories, linkedIdsOf, LEVELS } from '../api/_utils/explore/storyCheck.js';
import { matchStories, isUnmatched } from '../api/_utils/explore/matchStory.js';
import { contactOf, CONTACT_ENV } from '../api/_utils/explore/fetchSource.js';
import { measureCellsOf, cellKindOf } from '../api/_utils/explore/storyRecord.js';
import {
  readStories, readAllStories, planSet, planUnpublish, commitSet, commitUnpublish, ACTIONS, COLLECTION,
} from '../api/_utils/explore/storyWriter.js';

/**
 * The research server's list of stored-measure keys (src/constants/compareMeasures.js, per the Work an idea chat of
 * Nov 25). It is not on main yet: null, so the check notes each key as not checked. When the list lands, import its
 * keys here and the check refuses a key not on it (storyCheck.js takes the list as an argument).
 */
export const STORED_MEASURE_KEYS = null;

export const COMMANDS = Object.freeze(['check', 'match', 'draft', 'publish', 'unpublish', 'status']);
const WRITES = new Set(['draft', 'publish', 'unpublish']);
const FETCHES = new Set(['match', 'draft', 'publish']);
/** The flags each command takes (every command also takes --uid and --json). */
const FLAGS_OF = Object.freeze({
  check: ['--file'],
  match: ['--file'],
  draft: ['--file', '--go'],
  publish: ['--file', '--id', '--accept-unmatched', '--go'],
  unpublish: ['--file', '--id', '--go'],
  status: ['--file', '--id'],
});
const VALUE_FLAGS = new Set(['--uid', '--file', '--id']);
const REPEATABLE = new Set(['--file', '--id']);
const BOOLEAN_FLAGS = new Set(['--go', '--accept-unmatched', '--json', '--help']);
/** What a writing command prints for a server-clock field it would set. */
export const SERVER_TIME_PREVIEW = '(the server\'s clock, at the write)';

export const EXIT = Object.freeze({ DONE: 0, FAILED: 1, REFUSED: 2 });

export const USAGE = [
  'Explore — the founder\'s command for checking, matching and publishing stories.',
  '',
  '  node scripts/explore-publish.mjs check     --file <story.json> [--file …]                     --uid <uid>',
  '  node scripts/explore-publish.mjs match     --file <story.json> [--file …]                     --uid <uid>',
  '  node scripts/explore-publish.mjs draft     --file <story.json> [--file …]                     --uid <uid> [--go]',
  '  node scripts/explore-publish.mjs publish   --file <story.json> … | --id <id> … [--accept-unmatched] --uid <uid> [--go]',
  '  node scripts/explore-publish.mjs unpublish --id <id> … | --file <story.json> …                --uid <uid> [--go]',
  '  node scripts/explore-publish.mjs status    [--id <id> … | --file <story.json> …]              --uid <uid>',
  '',
  '  A story file\'s name is its document id: ai-buildout.json is the story ai-buildout.',
  '  --go                write it. Without it a writing command prints what it would write, and writes nothing.',
  '  --accept-unmatched  (publish) publish although a quote was not confirmed by machine; each such figure',
  '                      will arrive in an investigation as not checked. Given per run, never stored.',
  '  --json              the answer as JSON.',
  `  match, draft and publish need ${CONTACT_ENV} (an email address or an https link) for the user agent.`,
  '',
  '  Exit codes: 0 done; 2 refused (a gate, the check, an unmatched quote, the version rule, or no --go); 1 failed.',
].join('\n');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A refusal or failure the script names itself (never a credential, never a uid). */
export class ScriptError extends Error {
  constructor(message, exitCode = EXIT.FAILED) { super(message); this.exitCode = exitCode; }
}

// ── ARGUMENTS ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A story file's document id: its name without `.json`, by the page's id rule. */
export function idOfFile(file) {
  const id = path.basename(String(file)).replace(/\.json$/i, '');
  if (!STORY_ID.test(id)) throw new ScriptError(`the file name "${path.basename(String(file))}" is not a document id (letters, digits, - and _), followed by .json`);
  return id;
}

/**
 * Parse the command line. Pure. Every flag is checked against the command's own list: an unknown or misplaced flag is
 * an error, never ignored (a misspelt --go must not read as a dry run the founder did not mean, nor the reverse).
 */
export function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) return { help: true };
  const command = args.shift();
  if (!COMMANDS.includes(command)) throw new ScriptError(`unknown command "${command}" — one of: ${COMMANDS.join(', ')}`);
  const allowed = new Set(['--uid', '--json', ...FLAGS_OF[command]]);
  const out = { command, uid: null, files: [], ids: [], go: false, acceptUnmatched: false, json: false };
  const seen = new Set();
  while (args.length > 0) {
    const token = args.shift();
    const eq = token.startsWith('--') ? token.indexOf('=') : -1;
    const flag = eq > 0 ? token.slice(0, eq) : token;
    if (!VALUE_FLAGS.has(flag) && !BOOLEAN_FLAGS.has(flag)) throw new ScriptError(`unknown argument "${token}"`);
    if (!allowed.has(flag)) throw new ScriptError(`"${flag}" is not an option of ${command}`);
    if (seen.has(flag) && !REPEATABLE.has(flag)) throw new ScriptError(`"${flag}" given twice`);
    seen.add(flag);
    if (BOOLEAN_FLAGS.has(flag)) {
      if (eq > 0) throw new ScriptError(`"${flag}" takes no value`);
      if (flag === '--go') out.go = true;
      if (flag === '--accept-unmatched') out.acceptUnmatched = true;
      if (flag === '--json') out.json = true;
      continue;
    }
    const value = eq > 0 ? token.slice(eq + 1) : args.shift();
    if (typeof value !== 'string' || value.length === 0 || (eq < 0 && value.startsWith('--'))) throw new ScriptError(`"${flag}" needs a value`);
    if (flag === '--uid') out.uid = value;
    if (flag === '--file') out.files.push(value);
    if (flag === '--id') {
      if (!STORY_ID.test(value)) throw new ScriptError(`--id "${value}" is not a document id (letters, digits, - and _)`);
      out.ids.push(value);
    }
  }
  if (out.uid === null) throw new ScriptError('--uid <uid> is required');
  if (['check', 'match', 'draft'].includes(command) && out.files.length === 0) throw new ScriptError(`${command} needs --file <story.json>`);
  if ((command === 'publish' || command === 'unpublish') && out.files.length + out.ids.length === 0) throw new ScriptError(`${command} needs --file <story.json> or --id <id>`);
  if (out.files.length > 0 && out.ids.length > 0) throw new ScriptError('give stories by --file or by --id, not both');
  for (const f of out.files) idOfFile(f);
  return out;
}

// ── FILES ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A story file's JSON: one object. Pure on the text. */
export function parseStoryText(text, label = 'the file') {
  let value;
  try { value = JSON.parse(text); } catch (err) { throw new ScriptError(`${label} is not valid JSON (${err.message})`); }
  if (!isPlain(value)) throw new ScriptError(`${label} must hold one JSON object`);
  return value;
}

/** The story files named, `[{ id, raw, file }]`. */
export function readStoryFiles(files, { readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  return files.map((file) => {
    let text;
    try { text = readFile(path.resolve(file)); } catch (err) { throw new ScriptError(`cannot read ${file} (${err.code ?? err.message})`); }
    return { id: idOfFile(file), raw: parseStoryText(text, file), file };
  });
}

// ── THE GATES ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The gates that need no read: the founder list, the contact address. */
export function readGates(command, uid, env = process.env) {
  const founder = typeof uid === 'string' && uid.length > 0 && founderAllowlist().includes(uid);
  const contact = FETCHES.has(command) ? contactOf(env) : null;
  const refused = [];
  if (!founder) refused.push({ gate: 'founder', message: 'the uid is not on MANDATE_FOUNDER_UIDS in this machine\'s environment (.env.local): nothing was read' });
  else if (FETCHES.has(command) && !contact) refused.push({ gate: 'contact', message: `${CONTACT_ENV} is not set to an email address or an https link: nothing was fetched` });
  return { founder, contactSet: Boolean(contact), contact, refused };
}

// ── REPORT PIECES ───────────────────────────────────────────────────────────────────────────────────────────────────

const byLevel = (findings, level) => findings.filter((f) => f.level === level);

/** A story's report: its findings by level, and (after a match) its sources, figures and summary. */
function storyReport(checked, matched = null) {
  const findings = [...checked.findings, ...(matched?.findings ?? [])];
  return {
    id: checked.id, kind: checked.kind, version: checked.version,
    refused: byLevel(findings, LEVELS.REFUSED), unmatched: byLevel(findings, LEVELS.UNMATCHED), noted: byLevel(findings, LEVELS.NOTED),
    ...(matched ? { sources: matched.sources, figures: matched.figures, summary: matched.summary } : {}),
  };
}

/** The would-be or written document, with any server-clock value shown as such. */
const shownDocument = (doc, stamp) => (doc ? JSON.parse(JSON.stringify(doc, (k, v) => (v === stamp ? SERVER_TIME_PREVIEW : v))) : null);

/** A plan as reported. */
const planReport = (p, stamp) => ({ id: p.id, action: p.action, reason: p.reason, version: p.version, storedVersion: p.storedVersion, storedStatus: p.storedStatus, document: shownDocument(p.document, stamp) });

/** An instant as ISO, for the report (a Firestore Timestamp, a Date, a string), or null. */
function isoOf(v) {
  try {
    const d = typeof v?.toDate === 'function' ? v.toDate() : v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null;
    return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
  } catch { return null; }
}

/** A stored story's summary for `status`: kind, status, version, dates, links, and its stored match results. */
export function statusRowOf(id, data) {
  const sources = Array.isArray(data.sources) ? data.sources.filter(isPlain) : [];
  const figures = { carried: 0, sourced: 0, notReported: 0 };
  for (const { cell } of measureCellsOf(data)) {
    if (!isPlain(cell)) continue;
    const kind = cellKindOf(cell);
    if (kind === 'notReported') { figures.notReported += 1; continue; }
    figures.carried += 1;
    const ok = kind === 'stated' ? cell.matched === true : (Array.isArray(cell.inputs) && cell.inputs.length > 0 && cell.inputs.every((i) => isPlain(i) && i.matched === true));
    if (ok) figures.sourced += 1;
  }
  return {
    id, kind: data.kind ?? null, status: data.status ?? null, version: data.version ?? null, title: typeof data.title === 'string' ? data.title : null,
    publishedAt: isoOf(data.publishedAt), revisedAt: isoOf(data.revisedAt),
    parent: isPlain(data.parent) ? { storyId: data.parent.storyId ?? null, connectionId: data.parent.connectionId ?? null } : null,
    doors: (Array.isArray(data.connections) ? data.connections : []).filter((c) => isPlain(c) && typeof c.leadsToStory === 'string').map((c) => ({ connectionId: c.id ?? null, leadsToStory: c.leadsToStory })),
    match: {
      sources: sources.length,
      machine: sources.filter((s) => s.match?.by === 'machine').length,
      read: sources.filter((s) => s.match?.by === 'read').length,
      none: sources.filter((s) => !isPlain(s.match)).length,
      figures: { ...figures, notChecked: figures.carried - figures.sourced },
    },
  };
}

// ── THE COMMANDS ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Run one parsed command. `deps`: `db()` (lazy: the database is opened at the first read), `nowIso`, `readFile`,
 * `fetchDocument`, `extract`, `serverTime` (the value written for a new instant), `storedKeys`, `env`. Returns
 * `{ exitCode, result }`; the result is what --json prints.
 */
export async function runCommand(parsed, deps) {
  const { command, uid } = parsed;
  const { db, nowIso, readFile, fetchDocument, extract, serverTime, storedKeys = STORED_MEASURE_KEYS, env = process.env } = deps;
  const gates = readGates(command, uid, env);
  const base = { command, founder: gates.founder, contactSet: gates.contactSet, collection: COLLECTION };
  if (gates.refused.length > 0) return { exitCode: EXIT.REFUSED, result: { ...base, refused: gates.refused } };

  const now = new Date(nowIso);
  const matchOpts = { contact: gates.contact, ...(fetchDocument ? { fetchDocument } : {}), ...(extract ? { extract } : {}) };

  if (command === 'status') {
    const ids = parsed.files.length ? parsed.files.map(idOfFile) : parsed.ids;
    const rows = ids.length
      ? [...(await readStories(await db(), ids)).entries()].map(([id, data]) => statusRowOf(id, data))
      : (await readAllStories(await db())).map(({ id, data }) => statusRowOf(id, data));
    const missing = ids.filter((id) => !rows.some((r) => r.id === id));
    return { exitCode: EXIT.DONE, result: { ...base, stories: rows, missing } };
  }

  if (command === 'unpublish') {
    const ids = parsed.files.length ? parsed.files.map(idOfFile) : parsed.ids;
    const database = await db();
    const stored = await readStories(database, ids);
    const plans = ids.map((id) => planUnpublish(id, stored.get(id) ?? null));
    // Published stories that link to one being unpublished: noted, never blocking (the way back must always work).
    const all = await readAllStories(database);
    const linking = all.filter(({ id, data }) => !ids.includes(id) && data.status === 'published' && (
      (isPlain(data.parent) && ids.includes(data.parent.storyId))
      || (Array.isArray(data.connections) && data.connections.some((c) => isPlain(c) && ids.includes(c.leadsToStory)))
    )).map(({ id }) => ({ level: LEVELS.NOTED, rule: 'K-9', field: 'links', value: id, message: `"${id}" is published and links to a story being unpublished; it stays published` }));
    if (plans.some((p) => p.action === ACTIONS.REFUSED)) return { exitCode: EXIT.REFUSED, result: { ...base, written: [], plans: plans.map((p) => planReport(p)), noted: linking } };
    if (!parsed.go) return { exitCode: EXIT.REFUSED, result: { ...base, written: [], refused: [{ gate: 'go', message: 'not written: add --go to write it' }], plans: plans.map((p) => planReport(p)), noted: linking } };
    const done = await commitUnpublish(database, ids);
    return { exitCode: done.refused ? EXIT.REFUSED : EXIT.DONE, result: { ...base, written: done.written, plans: done.plans.map((p) => planReport(p)), noted: linking } };
  }

  // check, match, draft, publish: the stories, from their files or (publish --id) from the collection
  let entries;
  let stored = new Map();
  const publishing = command === 'publish';
  if (parsed.ids.length > 0) {
    stored = await readStories(await db(), parsed.ids);
    const missing = parsed.ids.filter((id) => !stored.has(id));
    if (missing.length) return { exitCode: EXIT.REFUSED, result: { ...base, refused: missing.map((id) => ({ gate: 'id', message: `no story "${id}" in the collection` })) } };
    entries = parsed.ids.map((id) => ({ id, raw: stored.get(id), file: null }));
  } else {
    entries = readStoryFiles(parsed.files, readFile ? { readFile } : {});
  }
  // What the collection is read for: the stories linked to from outside the set; for a write, the set's own too.
  const toRead = [...linkedIdsOf(entries), ...(WRITES.has(command) ? entries.map((e) => e.id) : [])].filter((id) => !stored.has(id));
  if (toRead.length) stored = new Map([...stored, ...(await readStories(await db(), toRead))]);
  const read = [...new Set([...parsed.ids, ...toRead])];

  const checked = checkStories(entries, { others: stored, linkMode: publishing ? 'published' : 'any', storedKeys, now });
  if (command === 'check') {
    return { exitCode: checked.refused ? EXIT.REFUSED : EXIT.DONE, result: { ...base, read, stories: checked.stories.map((s) => storyReport(s)) } };
  }
  if (checked.refused && command !== 'match') {
    return { exitCode: EXIT.REFUSED, result: { ...base, read, written: [], refused: [{ gate: 'check', message: 'the check refused a story: nothing was fetched and nothing written' }], stories: checked.stories.map((s) => storyReport(s)) } };
  }

  const matched = await matchStories(checked.stories, matchOpts);
  const stories = checked.stories.map((s, i) => storyReport(s, matched.stories[i]));
  if (command === 'match') return { exitCode: checked.refused ? EXIT.REFUSED : EXIT.DONE, result: { ...base, read, fetched: matched.links, stories } };

  // K-8: publishing an unmatched story needs the founder's yes on this command line.
  const unmatchedIds = matched.stories.filter(isUnmatched).map((s) => s.id);
  if (publishing && unmatchedIds.length > 0 && !parsed.acceptUnmatched) {
    return {
      exitCode: EXIT.REFUSED,
      result: { ...base, read, fetched: matched.links, written: [], refused: [{ gate: 'unmatched', message: `${unmatchedIds.join(', ')}: a quote was not confirmed by machine. Nothing was written. To publish anyway, add --accept-unmatched: each figure below then arrives in an investigation as not checked.` }], stories },
    };
  }
  // What the report says of each plan (review H4): an unmatched figure "will arrive as not checked" only for a story
  // this run writes (or would write); a story left as stored (a no-op) keeps the stored record and ITS match results.
  const acceptanceFor = (plans) => (publishing && parsed.acceptUnmatched && unmatchedIds.length > 0
    ? matched.stories.filter((s) => plans.some((p) => p.id === s.id && p.action !== ACTIONS.NOOP && p.action !== ACTIONS.REFUSED))
      .flatMap((s) => s.figures.filter((f) => f.kind !== 'notReported' && !f.sourced).map((f) => ({ id: s.id, question: f.question, measure: f.measure, symbol: f.symbol, message: 'published unmatched (--accept-unmatched): this figure will arrive in an investigation as not checked' })))
    : []);
  const keptFor = (plans) => plans.filter((p) => p.action === ACTIONS.NOOP).map((p) => ({
    id: p.id,
    message: 'the stored story stays as it is, with the match results recorded when it was written; this run\'s match above is shown for information and is NOT recorded. To record a fresh match, raise the version (standard §10).',
  }));

  const status = publishing ? 'published' : 'draft';
  const items = matched.stories.map((s) => ({ id: s.id, record: s.record }));
  if (!parsed.go) {
    const stamp = { preview: true };
    const ownStored = new Map(entries.map((e) => [e.id, stored.get(e.id) ?? null]).filter(([, d]) => d));
    const plan = planSet(items, ownStored, { status, stamp });
    return {
      exitCode: EXIT.REFUSED,
      result: { ...base, read, fetched: matched.links, written: [], refused: [{ gate: 'go', message: 'not written: add --go to write it' }], plans: plan.plans.map((p) => planReport(p, stamp)), acceptance: acceptanceFor(plan.plans), kept: keptFor(plan.plans), stories },
    };
  }
  const database = await db();
  const done = await commitSet(database, items, { status, serverTime });
  // After the write, the stored dates as the server set them.
  const after = done.written.length ? await readStories(database, done.written) : new Map();
  const dates = done.written.map((id) => ({ id, status: after.get(id)?.status ?? null, publishedAt: isoOf(after.get(id)?.publishedAt), revisedAt: isoOf(after.get(id)?.revisedAt) }));
  return {
    exitCode: done.refused ? EXIT.REFUSED : EXIT.DONE,
    result: { ...base, read, fetched: matched.links, written: done.written, dates, plans: done.plans.map((p) => planReport(p)), acceptance: done.refused ? [] : acceptanceFor(done.plans), kept: done.refused ? [] : keptFor(done.plans), stories },
  };
}

// ── PLAIN-TEXT RENDERING ────────────────────────────────────────────────────────────────────────────────────────────

const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v ?? null));

function findingLines(s) {
  const out = [];
  for (const [label, list] of [['REFUSED  ', s.refused], ['UNMATCHED', s.unmatched], ['NOTED    ', s.noted]]) {
    for (const f of list) out.push(`  ${label} ${f.rule.padEnd(7)} ${f.field} = ${show(f.value)} — ${f.message}`);
  }
  return out;
}

function sourceLines(s) {
  return (s.sources || []).map((r) => {
    const what = r.by === 'machine' ? 'machine' : 'read   ';
    const detail = [r.type ? r.type : null, r.readAt ? `read ${r.readAt}` : 'nothing received', r.documentDate ? `document dated ${r.documentDate}` : 'no document date', r.dated ? `source says ${r.dated}` : null, r.redirects?.length ? `${r.redirects.length} redirect(s)` : null].filter(Boolean).join(', ');
    return `    ${String(r.id).padEnd(4)} ${what}  ${detail}${r.reason ? `\n         why: ${r.reason}` : ''}\n         ${r.url}`;
  });
}

function figureLines(s) {
  return (s.figures || []).map((f) => {
    if (f.kind === 'notReported') return `    ${String(f.symbol).padEnd(6)} not reported (the story's own claim; never sourced)`;
    if (f.kind === 'stated') return `    ${String(f.symbol).padEnd(6)} ${String(f.value).padEnd(8)} from ${f.sourceId}: ${f.matched ? 'found → arrives as sourced' : 'NOT found → arrives as not checked'}`;
    const inputs = f.inputs.map((i) => `${i.value} from ${i.sourceId} ${i.matched ? 'found' : 'NOT found'}`).join('; ');
    return `    ${String(f.symbol).padEnd(6)} ${f.formula}: ${inputs} → arrives as ${f.sourced ? 'sourced' : 'not checked'}`;
  });
}

export function renderText(result) {
  const out = [];
  out.push(`founder        ${result.founder ? 'yes' : 'no'}   (MANDATE_FOUNDER_UIDS, this machine)`);
  if (['match', 'draft', 'publish'].includes(result.command)) out.push(`contact        ${result.contactSet ? 'set' : 'not set'}   (${CONTACT_ENV}, for the user agent)`);
  for (const r of result.refused || []) out.push(`REFUSED (${r.gate}): ${r.message}`);
  if (result.command === 'status' && result.stories) {
    out.push('', `collection     ${result.collection}: ${result.stories.length} ${result.stories.length === 1 ? 'story' : 'stories'}${result.missing?.length ? `   (not found: ${result.missing.join(', ')})` : ''}`);
    for (const r of result.stories) {
      out.push('', `${r.id}   ${r.kind ?? '—'}   ${r.status ?? '—'}   version ${r.version ?? '—'}   published ${r.publishedAt ?? '—'}${r.revisedAt ? `   revised ${r.revisedAt}` : ''}`);
      if (r.title) out.push(`  ${r.title}`);
      if (r.parent) out.push(`  way back       ${r.parent.storyId} / ${r.parent.connectionId}`);
      for (const d of r.doors) out.push(`  door           ${d.connectionId} → ${d.leadsToStory}`);
      const m = r.match;
      out.push(`  match          ${m.sources} sources: ${m.machine} by machine, ${m.read} read${m.none ? `, ${m.none} never matched` : ''}; figures: ${m.figures.sourced} of ${m.figures.carried} sourced${m.figures.notReported ? `, ${m.figures.notReported} not reported` : ''}`);
    }
    return out;
  }
  if (result.read?.length) out.push(`read           ${result.collection}: ${result.read.join(', ')}`);
  for (const s of result.stories || []) {
    out.push('', `STORY ${s.id}   ${s.kind ?? '(no kind)'}   version ${s.version ?? '—'}   ${s.refused.length} refused, ${s.unmatched.length} unmatched, ${s.noted.length} noted`);
    out.push(...findingLines(s));
    if (s.sources) {
      out.push('  sources');
      out.push(...sourceLines(s));
      if (s.figures.length) { out.push('  carried figures'); out.push(...figureLines(s)); }
      const sm = s.summary;
      out.push(`  summary        ${sm.carried} carried figure(s): ${sm.sourced} will arrive as sourced, ${sm.notChecked} as not checked${sm.notReported ? `; ${sm.notReported} not reported` : ''}`);
    }
  }
  for (const a of result.acceptance || []) out.push(`ACCEPTED UNMATCHED  ${a.id} ${a.question}/${a.measure} ${a.symbol}: ${a.message}`);
  for (const k of result.kept || []) out.push(`KEPT AS STORED  ${k.id}: ${k.message}`);
  for (const n of result.noted || []) out.push(`NOTED     ${n.message}`);
  for (const p of result.plans || []) {
    out.push('', `${result.written?.includes(p.id) ? 'WRITTEN' : (p.action === ACTIONS.REFUSED ? 'REFUSED' : (p.action === ACTIONS.NOOP ? 'NO CHANGE' : 'WOULD WRITE'))}  ${p.id}   ${p.action}: ${p.reason}`);
    if (p.document && !result.written?.includes(p.id)) out.push(JSON.stringify(p.document, null, 2));
  }
  for (const d of result.dates || []) out.push(`STORED   ${d.id}   ${d.status}   publishedAt ${d.publishedAt ?? '—'}${d.revisedAt ? `   revisedAt ${d.revisedAt}` : ''}`);
  return out;
}

// ── MAIN ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The whole run, with its effects injected (the tests pass the in-memory db, a fixed clock and a fetcher). `loadEnv`
 * runs after the arguments are checked and before the gates; `getDb` is called at most once, at the first read.
 */
export async function runCli(argv, {
  getDb, loadEnv = async () => {}, nowIso = () => new Date().toISOString(), print = (s) => console.log(s), readFile,
  fetchDocument, extract, serverTime = () => new Date(), storedKeys, env,
} = {}) {
  let parsed;
  try { parsed = parseArgs(argv); } catch (err) {
    print(`FAILED: ${err.message}`);
    print('');
    print(USAGE);
    return EXIT.FAILED;
  }
  if (parsed.help) { print(USAGE); return EXIT.DONE; }
  try {
    await loadEnv();
    let dbPromise = null;
    const db = () => { dbPromise ??= Promise.resolve().then(() => getDb()); return dbPromise; };
    const { exitCode, result } = await runCommand(parsed, { db, nowIso: nowIso(), readFile, fetchDocument, extract, serverTime, storedKeys, env: env ?? process.env });
    if (parsed.json) print(JSON.stringify({ exitCode, ...result }, null, 2));
    else for (const line of renderText(result)) print(line);
    return exitCode;
  } catch (err) {
    print(err instanceof ScriptError ? `${err.exitCode === EXIT.REFUSED ? 'REFUSED' : 'FAILED'}: ${err.message}` : `FAILED: ${err?.name ?? 'Error'}: ${err?.message ?? err}`);
    return err instanceof ScriptError ? err.exitCode : EXIT.FAILED;
  }
}

/** The environment file, loaded here only — after the arguments are checked (a variable set in the shell wins). */
async function loadProductionEnv() {
  await import('./loadLocalEnv.js');
}

/** Credentials, loaded here only — at the first read. */
async function productionDb() {
  const { requireFirebaseCreds } = await import('./loadLocalEnv.js');
  requireFirebaseCreds();
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  return getFirebaseAdmin();
}

/** The server's own clock for publishedAt and revisedAt: Firestore's server timestamp. */
async function productionServerTime() {
  const { FieldValue } = await import('firebase-admin/firestore');
  return () => FieldValue.serverTimestamp();
}

/** Is this module the entry point? The FULL resolved paths, compared. */
export function isDirectRun(moduleUrl, argv1) {
  if (typeof argv1 !== 'string' || argv1.length === 0) return false;
  const norm = (q) => path.resolve(q).replace(/\\/g, '/').replace(/^[a-z]:/, (d) => d.toUpperCase());
  return norm(fileURLToPath(moduleUrl)) === norm(argv1);
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  const argv = process.argv.slice(2);
  // The server clock is loaded only for a real write: never for --help, which touches nothing (review S5b).
  const writing = WRITES.has(argv[0]) && argv.includes('--go') && !argv.includes('--help') && !argv.includes('-h');
  (writing ? productionServerTime() : Promise.resolve(undefined))
    .then((serverTime) => runCli(argv, { getDb: productionDb, loadEnv: loadProductionEnv, ...(serverTime ? { serverTime } : {}) }))
    .then((code) => { process.exitCode = code; });
}
