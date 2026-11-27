// scripts/practice-field-founder.mjs
//
// Practice Field B0 — THE FOUNDER'S COMMAND-LINE DOOR. It runs the founder actions of the idea book
// (api/_utils/practiceField/founderControls.js) from the founder's own checkout, under the same gates as the HTTP door
// (api/practice-field/founder.js), which needs a Firebase ID token that no screen sends yet.
//
// USAGE (from the repo root of the founder's checkout on `main`, where .env.local lives):
//
//   node scripts/practice-field-founder.mjs status [--owner <uid>]                                 --uid <uid>
//   node scripts/practice-field-founder.mjs books                                                  --uid <uid>
//   node scripts/practice-field-founder.mjs create-book [--agent <agentId>]                        --uid <uid> [--go]
//   node scripts/practice-field-founder.mjs create-book-for --owner <uid> [--agent <agentId>] [--archetype <id>]
//                                                                                                  --uid <uid> [--go]
//   node scripts/practice-field-founder.mjs admit --file <contract.json> [--dry-run]               --uid <uid> [--go]
//   node scripts/practice-field-founder.mjs resolve --file <ruling.json> [--owner <uid>]           --uid <uid> [--go]
//   node scripts/practice-field-founder.mjs pause | resume | wind-down [--owner <uid>]             --uid <uid> [--go]
//
//   --uid is always THE ACTING FOUNDER. --owner (build B4) names the player whose book a command reads or acts on.
//   Add --json to any command for the answer as JSON instead of plain text. --help prints this and touches nothing.
//
// WHAT EACH COMMAND DOES
//   status       Reads only. The mode, whether the uid is a founder, whether the book's owner (--owner, else the uid) is on
//                the idea book's player list ON THIS MACHINE (build B4; the deployed app reads its own copy) — and
//                (build B6) a warning with the COUNT of entries on that list the door's owner-id rule would refuse, the
//                book (state, cash, its three slots: each idea's names, status, lines and sessions left after the last
//                close — the agent's and the screen's own count), the open
//                records the founder can rule on (each with its idea, kind and record id — what `resolve` needs), and the
//                latest parse-report alerts for the book's own symbols — only those its ideas held or had reserved when
//                that session's report was written (build B4). Build B2: whether the agent's switches are on in
//                this checkout, the LATEST CLOSE ROW's agent block — each desk's note under its name, where the note came
//                from, each idea's action and reason and what came of it, the drafts considered (admitted, refused with
//                their codes, or not chosen) — and this month's spend against the $3 bound. It prints no ids but the
//                book's own and its owner's, and no credential.
//   books        (build B4) Reads only. One line per open idea book (the founder cap's registry): the owner's uid, the
//                book's state, its value, its last close, each desk's latest source ("not checked" when that close row
//                has no part for it), the month's spend, and the count of open records waiting on the founder. Books with
//                open records first.
//   create-book  The door's create_book: an idea book for the uid and its one ranked agent (or the one --agent names).
//   create-book-for  (build B4) The door's create_book_for: an idea book for the player --owner names, for the player's
//                own ranked agent (or the one --agent names) and its archetype (or the one --archetype names). The player
//                must be on the player list — and HERE, on THIS machine's copy (the shell's, else .env.local's): the script
//                runs the door in its own process, so this copy decides the creation, while the DEPLOYED app's copy
//                (Vercel's) decides the player's screen and their agent's admissions. Make the two agree, and redeploy,
//                BEFORE create-book-for (review A1/C1): a book made for a player the deployed app does not admit holds a
//                cap place, and its desks are checked and charged while every draft is refused.
//   admit        The door's admit_fixture: the contract in the file, on the uid's open book. The door sets the origin
//                to a founder fixture whatever the file says. With --dry-run it sends nothing: it runs the door's own
//                admission (admission.js admitIdea, normalizeIdeaContract inside it) on a READ-ONLY view of the
//                database — every read real, every write caught and thrown away — and prints what would be refused
//                and why, the permitted maximum, and whether each name is on the latest price list.
//   resolve      The door's resolve_hold: the ruling in the file (late_adjustment, conflict, suspicion or coverage_gap).
//   pause, resume, wind-down   The door's pause, resume and wind_down on the uid's open book.
//   With --owner (build B4), resolve, pause, resume and wind-down act on THAT player's open book — listed or removed.
//
// THE GATES — every one is required before anything is sent. The door's own dispatcher (runFounderAction) checks the first
// two again, but in THIS process, against the same checkout and environment: a second check, not an independent one.
//   1. PRACTICE_FIELD_MODE is not 'off' — read from THIS checkout (src/config/practiceFieldFlags.js), not from the deployed
//      app: run the script from a checkout of `main` as deployed;
//   2. the uid is a founder: on MANDATE_FOUNDER_UIDS in THIS process's environment — the shell's, else .env.local's
//      (scripts/loadLocalEnv.js: a variable already set in the shell wins);
//   3. --go is on the command line.
// Without --go a write command prints exactly the body it would send, and stops (exit 2: nothing sent). With gate 1 or 2
// failing, nothing is read and nothing is sent (exit 2). `status` and `admit --dry-run` need gates 1 and 2 too: the
// script reads nothing for a uid that is not a founder.
// At 'allowlist', creating a book and admitting an idea ALSO need the book's owner on the idea book's own player list,
// PRACTICE_FIELD_PLAYER_UIDS (build B4; mode.js practiceFieldAdmits) — the door refuses `mode_not_admitted` otherwise, and
// create_book_for `owner_not_on_player_list`. Run from this script, THIS machine's copy is the one read (the door runs in
// this process); `status` says whether the owner is on it. The deployed app reads its own copy, and a change there needs a
// production redeploy.
//
// HOW IT SENDS. It calls runFounderAction — the function the HTTP door calls — with the body the door would receive
// (`{ action, requestKey, … }`) and the uid given. It never writes Firestore itself. The uid is the command line's: the
// gates are a seatbelt for the founder's own machine, not authentication — the service account in .env.local is what
// grants access, as for every founder script. Unlike the HTTP door it has no rate limit, and its clock is this machine's.
//
// THE REQUEST KEY is derived from the command and what it sends (a hash of the body without its key — for admit and
// resolve, the file's content), and for every command that acts on a book, the book's id. So running the same command
// again is the door's own idempotent replay: it answers the stored response and changes nothing ("REPLAY" below). A
// changed file is a new request. The door stores a REFUSAL as it stores a success, so a refused request is refused again
// on every re-run, even after its cause has gone (a book resumed, a list updated) — and pause → resume → pause, or a
// create-book after the last book closed, would replay the first one. To send such a request again as a NEW one, add
// `--again <word>` (letters, digits, - or _): the word goes into the key; without it the key is as above. A replay of
// pause or resume names the book's state as it is now; `admit --dry-run` says when --go would replay a stored answer.
//
// FILES. JSON. A top-level `_notes` key (the examples carry the fields' meanings there) is removed before the body is
// built, so it never reaches the door and never changes the key. Examples: scripts/practice-field-founder.examples/.
//
// EXIT CODES: 0 done (or, for status and a dry run that would be admitted, read); 2 refused — by a gate, by the door
// (its error and every refusal printed), or not sent for want of --go; 1 failed (a bad argument, a bad file, an error).
//
// CREDENTIALS load only inside main(), after the arguments are checked (scripts/loadLocalEnv.js + getFirebaseAdmin()).
// Importing this module reads no environment file and opens no connection; --help exits before either.
//
// Tests: scripts/practice-field-founder.test.js, on the in-memory Firestore harness.

import process from 'node:process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRACTICE_FIELD_MODE as SHIPPED_MODE } from '../src/config/practiceFieldFlags.js';
import { practiceFieldMode, practiceFieldAdmits, practiceFieldAgentOn, practiceFieldAgentThesesOn } from '../api/_utils/practiceField/mode.js';
import { spendMonthOf, MONTHLY_SPEND_BOUND_USD } from '../api/_utils/practiceField/spend.js';
import { DESKS, DESK_IDS } from '../api/_utils/practiceField/agentConfig.js';
import {
  runFounderAction, isPracticeFieldFounder, founderAllowlist, founderRequestFingerprint, FOUNDER_FIXTURE_ORIGIN, validOwnerUid,
} from '../api/_utils/practiceField/founderControls.js';
import { admitIdea, ideaIdFor } from '../api/_utils/practiceField/admission.js';
import { normalizeIdeaContract } from '../api/_utils/practiceField/contract.js';
import { readAdmissionMarkSet } from '../api/_utils/practiceField/admissionMarks.js';
import { HOLD_KINDS } from '../api/_utils/practiceField/holdRulings.js';
import {
  basisSuspicionRecords, openAmbiguities, heldActionRecords,
} from '../api/_utils/practiceField/ledger.js';
import { openProposals } from '../api/_utils/practiceField/adjustments.js';
import { coverageGapIdOf, closedDoubtIdOf, parseEntryVerdict, parseReportEntry } from '../api/_utils/practiceField/dailyCoverage.js';
import { PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../src/data/practiceFieldFunds.js';
import { getSessionForDate } from '../api/_utils/marketSchedule.js';
import { isIdeaBook } from '../api/_utils/mandateBookKind.js';
import { canonicalContentHash } from '../api/_utils/canonicalHash.js';
// Build B4: the idea book's own player list (read here from THIS machine's environment), the founder cap's registry (the
// list of open books `books` reads — never written here), and the screen's own sessions-left count (Q-7: one count).
import { PRACTICE_FIELD_PLAYER_ENV, readPracticeFieldPlayerList } from '../api/_utils/practiceField/playerList.js';
import { PRACTICE_FIELD_BOOK_REGISTRY_ID } from '../api/_utils/practiceField/constants.js';
import { sessionsLeftOf } from '../api/_utils/practiceField/bookView.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

/** The command line's commands → the door's actions (null: read-only). */
export const COMMANDS = Object.freeze({
  status: null,
  books: null,
  'create-book': 'create_book',
  'create-book-for': 'create_book_for',
  admit: 'admit_fixture',
  resolve: 'resolve_hold',
  pause: 'pause',
  resume: 'resume',
  'wind-down': 'wind_down',
});
/** The flags each command takes (every command also takes --uid and --json). Build B4: --owner, --archetype. */
const FLAGS_OF = Object.freeze({
  status: ['--owner'],
  books: [],
  'create-book': ['--agent', '--go', '--again'],
  'create-book-for': ['--owner', '--agent', '--archetype', '--go', '--again'],
  admit: ['--file', '--dry-run', '--go', '--again'],
  resolve: ['--file', '--owner', '--go', '--again'],
  pause: ['--owner', '--go', '--again'],
  resume: ['--owner', '--go', '--again'],
  'wind-down': ['--owner', '--go', '--again'],
});
const VALUE_FLAGS = new Set(['--uid', '--agent', '--file', '--again', '--owner', '--archetype']);
/** An --again word: it goes into the request key. */
const AGAIN_WORD = /^[A-Za-z0-9_-]{1,40}$/;
const BOOLEAN_FLAGS = new Set(['--go', '--dry-run', '--json', '--help']);
/** The fields of a resolve_hold body the door reads (founderControls.js resolveFieldsOf) — the only ones sent. */
export const RESOLVE_FIELDS = Object.freeze(['ideaId', 'kind', 'recordId', 'decision', 'ratio', 'payload', 'actionId']);
/** Each kind's decisions (holdRulings.js), for the founder's eye only: the door is what judges a ruling. */
export const DECISIONS_OF = Object.freeze({
  suspicion: ['price_move', 'split'], conflict: ['payload', 'none'], coverage_gap: ['no_action', 'row'], late_adjustment: ['approve', 'decline'],
});
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
const SHARE_BASIS = new Set(['split', 'reverse_split', 'stock_distribution']);
/** The door's own request-key shape (founderControls.js REQUEST_KEY). */
const REQUEST_KEY = /^[A-Za-z0-9][A-Za-z0-9_\-:.]{0,199}$/;

export const EXIT = Object.freeze({ DONE: 0, FAILED: 1, REFUSED: 2 });
/** The exit code of a door answer. */
const exitOfStatus = (status) => (status >= 200 && status < 300 ? EXIT.DONE : status >= 500 ? EXIT.FAILED : EXIT.REFUSED);

export const USAGE = [
  'Practice Field — the founder\'s command-line door.',
  '',
  '  node scripts/practice-field-founder.mjs status [--owner <uid>]                                 --uid <uid>',
  '  node scripts/practice-field-founder.mjs books                                                  --uid <uid>',
  '  node scripts/practice-field-founder.mjs create-book [--agent <agentId>]                        --uid <uid> [--go]',
  '  node scripts/practice-field-founder.mjs create-book-for --owner <uid> [--agent <agentId>] [--archetype <id>]',
  '                                                                                                 --uid <uid> [--go]',
  '  node scripts/practice-field-founder.mjs admit --file <contract.json> [--dry-run]               --uid <uid> [--go]',
  '  node scripts/practice-field-founder.mjs resolve --file <ruling.json> [--owner <uid>]           --uid <uid> [--go]',
  '  node scripts/practice-field-founder.mjs pause | resume | wind-down [--owner <uid>]             --uid <uid> [--go]',
  '',
  '  --uid       the acting founder (always).',
  '  --owner <u> the player whose book the command reads or acts on (create-book-for needs it).',
  '  --go        send it. Without it a write command prints what it would send, and sends nothing.',
  '  --again <w> (any write command) send it as a NEW request: a re-run otherwise replays the stored answer, a refusal too.',
  '  --dry-run   (admit) run the door\'s admission on a read-only view: what would be refused, and why.',
  '  --json      the answer as JSON.',
  '',
  '  Exit codes: 0 done; 2 refused (a gate, the door, or no --go); 1 failed.',
  '  Examples: scripts/practice-field-founder.examples/',
].join('\n');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const dataOf = (snap) => (snap && snap.exists ? snap.data() : null);
const upper = (s) => String(s || '').trim().toUpperCase();
const usd = (n) => (typeof n === 'number' && Number.isFinite(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
const pct = (n) => (typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n * 10000) / 100}%` : '—');

/** A refusal or failure the script names itself (never a credential, never another user's id). */
export class ScriptError extends Error {
  constructor(message, exitCode = EXIT.FAILED) { super(message); this.exitCode = exitCode; }
}

// ── ARGUMENTS ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Parse the command line. Pure. Every flag is checked against the command's own list: an unknown or misplaced flag is
 * an error, never ignored (a misspelt `--go` must not read as a dry run the founder did not mean, nor the reverse).
 * @returns {{ help: true } | { command, uid, agentId, file, go, dryRun, json }}  throws ScriptError on a bad line
 */
export function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) return { help: true };
  const command = args.shift();
  if (!Object.hasOwn(COMMANDS, command)) throw new ScriptError(`unknown command "${command}" — one of: ${Object.keys(COMMANDS).join(', ')}`);
  const allowed = new Set(['--uid', '--json', ...FLAGS_OF[command]]);
  const out = { command, uid: null, owner: null, agentId: null, archetype: null, file: null, again: null, go: false, dryRun: false, json: false };
  const seen = [];
  while (args.length > 0) {
    const token = args.shift();
    const eq = token.startsWith('--') ? token.indexOf('=') : -1;
    const flag = eq > 0 ? token.slice(0, eq) : token;
    if (!VALUE_FLAGS.has(flag) && !BOOLEAN_FLAGS.has(flag)) throw new ScriptError(`unknown argument "${token}"`);
    if (!allowed.has(flag)) throw new ScriptError(`"${flag}" is not an option of ${command}`);
    if (seen.includes(flag)) throw new ScriptError(`"${flag}" given twice`);
    seen.push(flag);
    if (BOOLEAN_FLAGS.has(flag)) {
      if (eq > 0) throw new ScriptError(`"${flag}" takes no value`);
      if (flag === '--go') out.go = true;
      if (flag === '--dry-run') out.dryRun = true;
      if (flag === '--json') out.json = true;
      continue;
    }
    const value = eq > 0 ? token.slice(eq + 1) : args.shift();
    if (typeof value !== 'string' || value.length === 0 || (eq < 0 && value.startsWith('--'))) throw new ScriptError(`"${flag}" needs a value`);
    if (flag === '--uid') out.uid = value;
    if (flag === '--owner') {
      // Build B4 (review A5): the door's own rule, before anything is read for it.
      if (!validOwnerUid(value)) throw new ScriptError('--owner takes a player\'s uid: 1 to 128 printable characters, no "/", not starting with "_"');
      out.owner = value;
    }
    if (flag === '--archetype') out.archetype = value;
    if (flag === '--agent') out.agentId = value;
    if (flag === '--file') out.file = value;
    if (flag === '--again') {
      if (!AGAIN_WORD.test(value)) throw new ScriptError('--again takes one word: letters, digits, - or _ (at most 40)');
      out.again = value;
    }
  }
  if (out.uid === null) throw new ScriptError('--uid <uid> is required');
  if (command === 'create-book-for' && out.owner === null) throw new ScriptError('create-book-for needs --owner <uid> (the player); --uid is the acting founder');
  if ((command === 'admit' || command === 'resolve') && out.file === null) throw new ScriptError(`${command} needs --file <file.json>`);
  if (out.dryRun && out.go) throw new ScriptError('--dry-run and --go together: choose one (a dry run sends nothing)');
  return out;
}

// ── FILES AND BODIES ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A request file's JSON, its top-level `_notes` removed. Pure on the text. */
export function parseRequestText(text, label = 'the file') {
  let value;
  try { value = JSON.parse(text); } catch (err) { throw new ScriptError(`${label} is not valid JSON (${err.message})`); }
  if (!isPlain(value)) throw new ScriptError(`${label} must hold one JSON object`);
  const { _notes: _ignored, ...rest } = value;
  return rest;
}

/** Read a request file (relative to the current directory). */
export function readRequestFile(file, { readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  let text;
  try { text = readFile(path.resolve(file)); } catch (err) { throw new ScriptError(`cannot read ${file} (${err.code ?? err.message})`); }
  return parseRequestText(text, file);
}

/**
 * The body the door would receive, WITHOUT its request key. Built from a whitelist: a file can add no field the door
 * would read as something else (an `action` in a ruling file is not sent).
 */
export function bodyWithoutKey(command, { agentId = null, fileValue = null, owner = null, archetype = null } = {}) {
  const action = COMMANDS[command];
  // Build B4: the owner a command names, from --owner only (never from a file). Absent, the body is exactly as before B4,
  // so its request key is too.
  const ownerPart = owner !== null ? { ownerUid: owner } : {};
  if (action === 'create_book') return { action, ...(agentId !== null ? { agentId } : {}) };
  if (action === 'create_book_for') return { action, ownerUid: owner, ...(agentId !== null ? { agentId } : {}), ...(archetype !== null ? { archetypeCodeId: archetype } : {}) };
  if (action === 'admit_fixture') return { action, contract: fileValue };
  if (action === 'resolve_hold') {
    const body = { action };
    for (const f of RESOLVE_FIELDS) if (fileValue[f] !== undefined) body[f] = fileValue[f];
    return { ...body, ...ownerPart };
  }
  return { action, ...ownerPart };
}

/**
 * THE REQUEST KEY (see the header): the action, then a hash of the body without its key and — for a command that acts on
 * a book — the book's id. The same request on the same book is the same key: the door's idempotent replay.
 */
export function requestKeyFor(body, bookId = null, again = null) {
  // (`again` only when given: every key without it is unchanged.)
  const hash = canonicalContentHash(again === null ? { body, bookId } : { body, bookId, again }).replace(/[^A-Za-z0-9]/g, '').slice(-24);
  const key = `pf-${body.action}-${hash}`;
  if (!REQUEST_KEY.test(key)) throw new ScriptError('internal: the derived request key is not a valid key');
  return key;
}

// ── READS (the uid's own documents only) ────────────────────────────────────────────────────────────────────────────────

/** The uid's open idea book, as the door finds it (its claim names it; it is the uid's idea book) — or null. */
export async function ownBookOf(db, uid) {
  const claim = dataOf(await db.collection('practiceFieldBooks').doc(uid).get());
  if (!claim || typeof claim.bookId !== 'string' || claim.bookId.length === 0) return null;
  const book = dataOf(await db.collection('mandates').doc(claim.bookId).get());
  if (!book || !isIdeaBook(book) || book.userId !== uid) return null;
  return { bookId: claim.bookId, book };
}

/** The book's open ideas and the ideas its slots name, each read once. */
async function ideasOf(db, bookId, book) {
  const ids = [...new Set([...(book.openIdeaIds || []), ...Object.values(book.slots || {}).filter((v) => typeof v === 'string')])];
  const out = [];
  for (const id of ids) {
    const idea = dataOf(await db.collection('mandates').doc(bookId).collection('ideas').doc(id).get());
    if (idea) out.push({ ideaId: id, ...idea });
  }
  return out;
}

// ── THE OPEN RECORDS (what `resolve` rules on) ──────────────────────────────────────────────────────────────────────────

const settledIdsOf = (ledger) => new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);

/**
 * Every open record of an idea the founder can rule on, by the door's own kinds and ids (holdRulings.js planHoldRuling):
 *   suspicion        an open gap-screen record on a holding (ledger.js basisSuspicionRecords);
 *   conflict         an unsettled conflict or possible re-date, a ruled id revised since (ledger.js openAmbiguities), or a
 *                    refused share-basis record on a holding (its `heldActions`, `refused`);
 *   coverage_gap     an open coverage gap (`caCoverageGaps`) or a sold holding's coverage doubt (`closedCoverageDoubts`);
 *   late_adjustment  an open late proposal (adjustments.js openProposals).
 * A record the founder has already ruled on, whose ruling waits for the next close, is listed with `ruled: true`. Pure.
 * @returns {Array<{ ideaId, kind, recordId, symbol, reason, ledgers: string[], ruled: boolean, decisions: string[] }>}
 */
export function openRecordsOf(idea) {
  const byKey = {};
  const add = (kind, recordId, symbol, reason, ledger) => {
    if (typeof recordId !== 'string' || recordId.length === 0) return;
    const key = `${kind}\u0000${recordId}`;
    const r = byKey[key] ?? { ideaId: idea.ideaId ?? null, kind, recordId, symbol: symbol ? upper(symbol) : null, reason: reason ?? null, ledgers: [] };
    if (ledger && !r.ledgers.includes(ledger)) r.ledgers.push(ledger);
    byKey[key] = r;
  };
  for (const f of LEDGERS) {
    const l = idea?.[f];
    if (!isPlain(l)) continue;
    for (const s of basisSuspicionRecords(l)) add('suspicion', s.actionId, s.symbol, `split-shaped move ×${s.ratio} first seen ${s.suspectedOn}`, f);
    for (const r of openAmbiguities(l)) add('conflict', r.actionId, r.ticker, r.reason, f);
    const settled = settledIdsOf(l);
    for (const r of heldActionRecords(l)) {
      if (typeof r.refused === 'string' && SHARE_BASIS.has(r.type) && !settled.has(r.actionId)) add('conflict', r.actionId, r.symbol, `refused: ${r.refused}`, f);
    }
    for (const p of openProposals(l)) add('late_adjustment', p.id, p.ticker, `${p.kind} of $${p.netUsd}`, f);
  }
  for (const [sym, gap] of Object.entries(idea?.caCoverageGaps || {})) {
    if (isPlain(gap)) add('coverage_gap', coverageGapIdOf(sym, gap.since), sym, `no corporate-action data since ${gap.since}`, 'ledger');
  }
  for (const [sym, d] of Object.entries(idea?.ledger?.closedCoverageDoubts || {})) {
    if (isPlain(d) && Array.isArray(d.dates) && d.dates.length > 0) add('coverage_gap', closedDoubtIdOf(sym, d.dates[0].date), sym, `sold holding: a rejected row dated ${d.dates.map((x) => x?.date).join(', ')}`, 'ledger');
  }
  const pending = new Set((idea?.founderRulings || []).filter((r) => r && r.appliedOn == null).map((r) => r.recordId));
  return Object.values(byKey).map((r) => ({ ...r, ruled: pending.has(r.recordId), decisions: DECISIONS_OF[r.kind] }));
}

// ── STATUS ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Sessions left AFTER THE BOOK'S LAST CLOSE (build B4, Q-7): the agent's own count (agentRun.js) as the screen shows it —
 * bookView.js sessionsLeftOf, imported, so the script, the desks' notes and the screen say one number: the sessions after
 * `lastClose` up to and including `due` (0 on the due session's close and after). Null with no close yet.
 */
export function sessionsLeft(lastClose, due) {
  return sessionsLeftOf(lastClose, due);
}

/** What one idea looks like in status. Pure. `lastClose` is the book's last closed session. */
function ideaView(idea, slot, lastClose) {
  const contract = idea.contract || {};
  const entered = Array.isArray(idea.lines) && idea.lines.length > 0;
  const lines = entered
    ? idea.lines.map((l) => ({ symbol: l.symbol, level: l.level ?? null, distancePct: l.distancePct ?? null, entered: true }))
    : (contract.lines || []).map((l) => ({ symbol: l.symbol, level: null, distancePct: l.distancePct ?? null, entered: false }));
  const due = contract.schedule?.dueSession ?? null;
  return {
    slot, ideaId: idea.ideaId, status: idea.status ?? null, names: contract.names || [],
    comparison: contract.comparison ? { type: contract.comparison.type, symbols: contract.comparison.symbols || [] } : null,
    capitalUsd: contract.capitalUsd ?? null, cashUsd: idea.ledger?.cash ?? null, lines,
    startSession: contract.schedule?.startSession ?? null, dueSession: due, sessionsLeft: sessionsLeft(lastClose, due),
  };
}

/** The symbols a book's own ideas need (names, comparison, the benchmark, every holding), upper-cased and sorted. */
function bookSymbolsOf(ideas) {
  const out = [];
  const put = (s) => { if (!out.includes(upper(s))) out.push(upper(s)); };
  for (const idea of ideas) {
    for (const s of idea.contract?.names || []) put(s);
    for (const s of idea.contract?.comparison?.symbols || []) put(s);
    put(idea.contract?.benchmarkSymbol ?? PRACTICE_FIELD_BENCHMARK_SYMBOL);
    for (const f of LEDGERS) for (const s of Object.keys(idea?.[f]?.holdings || {})) put(s);
  }
  return out.sort();
}

/** An instant as epoch ms — an ISO string, a Date or a Firestore Timestamp; NaN for anything else. */
function msOf(v) {
  if (typeof v === 'string') return Date.parse(v);
  if (v instanceof Date) return v.getTime();
  if (v && typeof v.toDate === 'function') { try { return v.toDate().getTime(); } catch { return NaN; } }
  if (v && Number.isFinite(v._seconds)) return v._seconds * 1000 + Math.floor((Number(v._nanoseconds) || 0) / 1e6);
  return NaN;
}

/**
 * The latest parse-report alerts: the parse report of the book's last closed session (`practiceFieldCaParseReports`),
 * for the book's OWN symbols only, each entry that is not clean (dailyCoverage.js parseEntryVerdict) — or missing.
 *
 * Build B4: ONLY the symbols the book held or had reserved WHEN THAT REPORT WAS WRITTEN. The session's daily build writes
 * the report (caParseReport.js, inside mandateUniverseSnapshot.js ensureDailySnapshot — built once a session), for the
 * symbols the books held or had reserved then; a name admitted after it is not in it, and is no alert (its first report is
 * the next session's). The cut-off is the daily layer's `builtAt` (`mandateUniverseDaily/{session}`); with none stored,
 * the session's close. An idea counts when its `admittedAt` is at or before the cut-off — or unreadable (fail closed).
 * On 25 Nov the status listed 15 alerts for the 15 symbols of two ideas admitted at that close: those are not alerts.
 * Review C6: only a MISSING entry is excused for a symbol of an idea admitted after the cut-off. An entry the report DOES
 * hold for it that is not clean (two daily builds racing can merge one in after the kept `builtAt`) still alerts.
 */
async function parseAlertsOf(db, book, ideas) {
  const session = typeof book.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  if (session === null) return { session: null, stored: false, alerts: [], cutoff: null, admittedAfter: [] };
  const report = dataOf(await db.collection('practiceFieldCaParseReports').doc(session).get());
  const daily = dataOf(await db.collection('mandateUniverseDaily').doc(session).get());
  const builtMs = msOf(daily?.builtAt);
  const closeMs = getSessionForDate(session)?.closeMs;
  const cutoff = Number.isFinite(builtMs)
    ? { at: new Date(builtMs).toISOString(), source: 'daily_build' }
    : (Number.isFinite(closeMs) ? { at: new Date(closeMs).toISOString(), source: 'session_close' } : { at: null, source: 'none' });
  const cutoffMs = cutoff.at === null ? Infinity : Date.parse(cutoff.at);
  const after = ideas.filter((i) => msOf(i.admittedAt) > cutoffMs);
  const covered = ideas.filter((i) => !(msOf(i.admittedAt) > cutoffMs));
  const alerts = [];
  const held = new Set(bookSymbolsOf(covered));
  for (const sym of bookSymbolsOf(ideas)) {
    const entry = parseReportEntry(report, session, sym);
    const verdict = parseEntryVerdict(entry);
    if (verdict.clean) continue;
    // Build B6 (ruling B6-8, Astra B4-A03): a late symbol is excused only when the report has NO entry for it. A stored
    // `null` or array is an entry — malformed — and alerts, under the verdict's own reason (parseEntryVerdict reads every
    // non-object entry as missing; that shared verdict is the close's, and is not changed here).
    if (held.has(sym) || entry !== undefined) alerts.push({ session, symbol: sym, reason: verdict.reason });
  }
  return { session, stored: report !== null, alerts, cutoff, admittedAfter: after.map((i) => i.ideaId) };
}

/**
 * Build B2 — THE AGENT'S LATEST CHECK, from the latest close row of the book's window ledger
 * (`mandates/{bookId}/windows/{lastClose}_close`, field `agent`): per desk, its note and where it came from, each idea's
 * action and reason and what came of it, and the drafts considered. The book's own records only.
 */
async function agentCheckOf(db, bookId, book) {
  const session = typeof book.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  const out = { enabled: practiceFieldAgentOn(), thesesEnabled: practiceFieldAgentThesesOn(), session, desks: null };
  // With the agent off in this checkout nothing of it is read (review C-4): the flag's own promise.
  if (session === null || !out.enabled) return out;
  const row = dataOf(await db.collection('mandates').doc(bookId).collection('windows').doc(`${session}_close`).get());
  const desks = row?.agent?.desks ?? null;
  if (!desks) return out;
  out.desks = {};
  for (const id of DESK_IDS) {
    const p = desks[id];
    if (!p) { out.desks[id] = null; continue; }
    out.desks[id] = {
      name: p.deskName ?? DESKS[id].name, status: p.status ?? null, source: p.source ?? null, note: p.note ?? null, fallbackReason: p.fallbackReason ?? null,
      actions: (p.actions || []).map((a) => ({ ideaId: a.ideaId, action: a.action, reason: a.reason, outcome: a.outcome ?? null })),
      considered: (p.considered || []).map((c) => ({
        index: c.index, slot: c.slot, names: c.names || [], outcome: c.outcome, ideaId: c.ideaId ?? null, capitalUsd: c.capitalUsd ?? null,
        refusals: (c.refusals || []).map((r) => r.code), thesis: c.thesis ?? null, source: c.source?.kind ?? null,
      })),
      calls: (p.attempts || []).length,
      chargedUsd: (p.attempts || []).reduce((n, a) => n + (Number(a.chargedUsd) || 0), 0),
    };
  }
  return out;
}

/** This month's spend against the bound (the book's `spend` totals; a stored month older than now's is last month's). */
function spendOfBook(book, nowIso) {
  const month = spendMonthOf(nowIso);
  const s = book.spend ?? null;
  const current = s && s.month === month;
  return {
    month, boundUsd: MONTHLY_SPEND_BOUND_USD,
    committedUsd: current ? (s.reservedUsd ?? 0) : 0, settledUsd: current ? (s.settledUsd ?? 0) : 0,
    calls: current ? (s.calls ?? 0) : 0, exhausted: current ? s.exhausted === true : false,
  };
}

/**
 * The gates that need no read: the mode and the founder list (for the acting uid), and — build B4 — whether the book's
 * owner (`owner`, else the uid) is on the idea book's player list ON THIS MACHINE, and so admitted by the mode here.
 */
export function readGates(uid, owner = null) {
  const mode = practiceFieldMode();
  const subject = owner ?? uid;
  return {
    mode, modeSource: 'src/config/practiceFieldFlags.js', shippedMode: SHIPPED_MODE,
    founder: isPracticeFieldFounder(uid), onFounderList: founderAllowlist().includes(uid),
    owner: subject, ownerIsUid: subject === uid,
    onPlayerList: readPracticeFieldPlayerList().includes(subject), modeAdmitsOwner: practiceFieldAdmits(subject),
    playerListMalformed: malformedPlayerEntries(),
  };
}

/**
 * Build B6 (ruling B6-7, Astra B4-A02): how many entries of THIS machine's player list the door's own owner-id rule
 * (founderControls.js validOwnerUid) would refuse. The gate keeps reading the list as it is — a typo must not lock every
 * player out; a malformed entry admits nobody by itself — and status warns. A count only: no entry's value is printed.
 */
export function malformedPlayerEntries() {
  return readPracticeFieldPlayerList().filter((u) => !validOwnerUid(u)).length;
}

/** Why gates 1 and 2 refuse, by name (the founder's own machine: the script says which — the door does not). */
function gateRefusals(gates) {
  const out = [];
  if (gates.mode === 'off') out.push({ gate: 'mode', message: `PRACTICE_FIELD_MODE is 'off' in this checkout (${gates.modeSource})` });
  else if (!gates.founder) out.push({ gate: 'founder', message: 'the uid is not on MANDATE_FOUNDER_UIDS in this machine\'s environment (.env.local)' });
  return out;
}

export async function runStatus(db, { uid, owner = null, nowIso }) {
  const gates = readGates(uid, owner);
  const result = { command: 'status', ...gates, book: null };
  const refused = gateRefusals(gates);
  if (refused.length > 0) return { exitCode: EXIT.REFUSED, result: { ...result, refused } };
  // Build B4: --owner reads THAT player's book (the founder's reach); without it, the uid's own, as before.
  const own = await ownBookOf(db, owner ?? uid);
  if (!own) return { exitCode: EXIT.DONE, result: { ...result, book: null } };
  const { bookId, book } = own;
  const ideas = await ideasOf(db, bookId, book);
  const byId = new Map(ideas.map((i) => [i.ideaId, i]));
  const lastClose = typeof book.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  const slots = {};
  for (const slot of ['short', 'medium', 'long']) {
    const id = book.slots?.[slot] ?? null;
    slots[slot] = id === null ? null : (byId.has(id) ? ideaView(byId.get(id), slot, lastClose) : { slot, ideaId: id, status: 'unreadable' });
  }
  const inSlots = new Set(Object.values(book.slots || {}));
  const otherOpen = ideas.filter((i) => !inSlots.has(i.ideaId)).map((i) => ideaView(i, i.contract?.slot ?? null, lastClose));
  const records = ideas.flatMap((i) => openRecordsOf(i));
  const parse = await parseAlertsOf(db, book, ideas);
  const agent = await agentCheckOf(db, bookId, book);
  return {
    exitCode: EXIT.DONE,
    result: {
      ...result,
      agent,
      spend: spendOfBook(book, nowIso),
      book: {
        bookId, status: book.status ?? null, drafting: book.drafting ?? null, windDownRequestedAt: book.windDown?.requestedAt ?? null,
        archetype: book.archetypeCodeId ?? null, agentId: book.attributionAgentId ?? null,
        unreservedCashUsd: book.treasury?.unreservedCash ?? null, cashUsd: book.portfolio?.cash ?? null, totalValueUsd: book.portfolio?.totalValue ?? null,
        lastClosedSession: book.execState?.lastCloseKey ?? null,
        slots, otherOpenIdeas: otherOpen,
      },
      records,
      parseReport: parse,
    },
  };
}

// ── BOOKS (build B4): one line per open idea book ───────────────────────────────────────────────────────────────────────

/**
 * A desk's latest source on a close row, for `books`: its part's `source` (model, code_fallback, no_work); `not_finished`
 * for a part still in progress (its call deferred to a later fire); `not_checked` when the row holds NO part for the desk —
 * a desk the close window's time never reached writes none (agentRun.js: a deferral reserves and writes nothing), and
 * neither does a close the pass skips (a caught-up close, one not on time) or a book it never visits (a draining one, or
 * any book while the agent is off on the server). Pure.
 */
export function deskSourceOf(part) {
  if (!isPlain(part)) return { source: 'not_checked', fallbackReason: null };
  if (part.status !== 'done') return { source: 'not_finished', fallbackReason: null };
  return { source: part.source ?? 'unknown', fallbackReason: part.fallbackReason ?? null };
}

/**
 * THE FOUNDER'S OVERVIEW: every open idea book (the founder cap's registry, `practiceFieldBooks/{registry}` — READ ONLY:
 * the list createIdeaBook writes and the close that completes a wind-down trims), one line each — the owner's uid, the
 * book's state, its value, its last close, each desk's latest source on that close's row, the month's spend, and the count
 * of open records waiting on the founder (openRecordsOf, not yet ruled). Books with open records first, then by owner.
 * Gates 1 and 2 first: nothing is read for a uid that is not a founder.
 */
export async function runBooks(db, { uid, nowIso }) {
  const gates = readGates(uid);
  const base = { command: 'books', ...gates, books: [] };
  const refused = gateRefusals(gates);
  if (refused.length > 0) return { exitCode: EXIT.REFUSED, result: { ...base, refused } };
  const registry = dataOf(await db.collection('practiceFieldBooks').doc(PRACTICE_FIELD_BOOK_REGISTRY_ID).get());
  const open = isPlain(registry?.openBooks) ? registry.openBooks : {};
  const agentOn = practiceFieldAgentOn();
  const lines = [];
  for (const [bookId, listedOwner] of Object.entries(open)) {
    const book = dataOf(await db.collection('mandates').doc(bookId).get());
    if (!book || !isIdeaBook(book)) { lines.push({ bookId, ownerUid: typeof listedOwner === 'string' ? listedOwner : null, unreadable: true, openRecords: 0 }); continue; }
    const ideas = await ideasOf(db, bookId, book);
    const records = ideas.flatMap((i) => openRecordsOf(i));
    const lastClose = typeof book.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
    let desks = null;
    // With the agent off in this checkout nothing of it is read (review C-4), as in status.
    if (agentOn && lastClose !== null) {
      const row = dataOf(await db.collection('mandates').doc(bookId).collection('windows').doc(`${lastClose}_close`).get());
      desks = Object.fromEntries(DESK_IDS.map((id) => [id, deskSourceOf(row?.agent?.desks?.[id])]));
    }
    lines.push({
      bookId, ownerUid: book.userId ?? null, ...(book.userId !== listedOwner ? { registryOwner: listedOwner ?? null } : {}),
      status: book.status ?? null, drafting: book.drafting ?? null, windDownRequestedAt: book.windDown?.requestedAt ?? null,
      valueUsd: book.portfolio?.totalValue ?? null, lastClose, agentOn, desks, spend: spendOfBook(book, nowIso),
      openRecords: records.filter((r) => !r.ruled).length, ruledAwaitingClose: records.filter((r) => r.ruled).length,
    });
  }
  lines.sort((a, b) => ((b.openRecords > 0) - (a.openRecords > 0)) || (b.openRecords - a.openRecords) || String(a.ownerUid).localeCompare(String(b.ownerUid)) || String(a.bookId).localeCompare(String(b.bookId)));
  return { exitCode: EXIT.DONE, result: { ...base, books: lines } };
}

// ── ADMIT --dry-run: the door's own admission on a read-only view ───────────────────────────────────────────────────────

const UNDER = Symbol('practiceFieldFounder.readOnlyRef');
function readOnlyDoc(real) {
  return Object.freeze({ [UNDER]: real, id: real.id, path: real.path, get: () => real.get(), collection: (name) => readOnlyCollection(real.collection(name)) });
}
function readOnlyCollection(real) {
  return Object.freeze({ id: real.id, path: real.path, doc: (id) => readOnlyDoc(real.doc(id)) });
}
/**
 * A READ-ONLY VIEW of `db` for a dry run: its references can only be read (no write method exists on them), and its
 * "transaction" reads for real and CATCHES every write into `caught` — nothing is committed, nothing is locked. A
 * reference that did not come from this view is refused.
 */
export function readOnlyView(db, caught) {
  const under = (ref) => {
    const real = ref?.[UNDER];
    if (!real) throw new ScriptError('dry run: a reference outside the read-only view');
    return real;
  };
  const catchWrite = (op) => (ref, data) => { caught.push({ op, path: under(ref).path, fields: isPlain(data) ? Object.keys(data).sort() : [] }); };
  const tx = Object.freeze({
    get: (ref) => under(ref).get(),
    set: catchWrite('set'), update: catchWrite('update'), create: catchWrite('create'), delete: catchWrite('delete'),
  });
  return Object.freeze({
    collection: (name) => readOnlyCollection(db.collection(name)),
    runTransaction: async (fn) => fn(tx),
  });
}

/**
 * The door's record of a request under this key (founderControls.js: `practiceFieldBooks/{uid}/founderOps/{key}`), as
 * --go would meet it: a stored answer it would REPLAY, a conflict, a pending request — or null (a new request). Read only.
 */
async function storedRequestOf(db, uid, requestKey, fullBody) {
  const rec = dataOf(await db.collection('practiceFieldBooks').doc(uid).collection('founderOps').doc(requestKey).get());
  if (!rec) return null;
  if (rec.action !== fullBody.action || rec.fingerprint !== founderRequestFingerprint(fullBody.action, fullBody)) return { kind: 'conflict', action: rec.action ?? null };
  if (rec.state !== 'done' || !rec.response) return { kind: 'pending', createdAt: rec.createdAt ?? null };
  return { kind: 'replay', httpStatus: rec.response.status, answer: rec.response.body, completedAt: rec.completedAt ?? null };
}

export async function runAdmitDryRun(db, { uid, contractRaw, requestKey, nowIso, fullBody = null }) {
  const gates = readGates(uid);
  const refused = gateRefusals(gates);
  // What the door admits: the file's contract with the door's own origin (founderControls.js admitFixture).
  const contract = isPlain(contractRaw) ? { ...contractRaw, origin: { ...FOUNDER_FIXTURE_ORIGIN } } : contractRaw;
  const shape = normalizeIdeaContract(contract);
  const base = { command: 'admit', dryRun: true, ...gates, requestKey, shapeRefusals: shape.refusals, normalized: shape.contract };
  if (refused.length > 0) return { exitCode: EXIT.REFUSED, result: { ...base, refused } };
  if (!isPlain(contractRaw)) return { exitCode: EXIT.REFUSED, result: { ...base, verdict: { ok: false, error: 'contract_required', refusals: [] } } };
  // What --go would meet FIRST: the door answers a key it has recorded from that record (a stored refusal included).
  const stored = fullBody ? await storedRequestOf(db, uid, requestKey, fullBody) : null;
  const own = await ownBookOf(db, uid);
  if (!own) return { exitCode: stored?.kind === 'replay' ? exitOfStatus(stored.httpStatus) : EXIT.REFUSED, result: { ...base, stored, verdict: { ok: false, error: 'no_open_book', refusals: [] } } };
  const caught = [];
  let res;
  try {
    res = await admitIdea(readOnlyView(db, caught), { bookId: own.bookId, contract, opId: requestKey, nowIso });
  } catch (err) {
    // admitIdea throws on a book that does not reconcile as read (reconcile.js): the door answers 500 then.
    return { exitCode: EXIT.FAILED, result: { ...base, bookId: own.bookId, verdict: { ok: false, error: 'internal_error', message: err?.message ?? String(err), refusals: [] } } };
  }
  // The price list: the latest snapshot admission measured against (its one set of marks). Entry needs each name priced.
  const markSet = await readAdmissionMarkSet({ get: (ref) => ref.get() }, db, { nowIso });
  const listed = markSet?.snapshot?.symbols || {};
  const needed = shape.contract ? [...shape.contract.names, ...(shape.contract.comparison?.symbols || []), PRACTICE_FIELD_BENCHMARK_SYMBOL] : [];
  const priceList = {
    snapshotKey: markSet?.snapshotKey ?? null, basis: markSet?.basis ?? null, reason: markSet?.reason ?? null,
    symbols: [...new Set(needed)].map((s) => ({ symbol: s, priced: listed[s]?.complete === true && typeof listed[s]?.price === 'number', price: listed[s]?.price ?? null })),
  };
  const verdict = res.ok
    ? { ok: true, ideaId: res.ideaId, replay: res.idempotentReplay === true, status: res.status ?? null, startSession: res.startSession, dueSession: res.dueSession, permittedMaxUsd: res.permittedMaxUsd, binding: res.binding }
    : {
      ok: false, error: (res.refusals || []).some((r) => r.code === 'op_id_conflict') ? 'op_id_conflict' : 'admission_refused',
      refusals: res.refusals || [], permittedMaxUsd: res.permittedMaxUsd ?? null, binding: res.binding ?? [],
    };
  // With a stored answer, --go replays it whatever admission would say now: that is the dry run's exit too.
  const exitCode = stored?.kind === 'replay' ? exitOfStatus(stored.httpStatus) : stored?.kind === 'conflict' ? EXIT.REFUSED : (res.ok ? EXIT.DONE : EXIT.REFUSED);
  return {
    exitCode,
    result: { ...base, bookId: own.bookId, stored, verdict, wouldWrite: caught, priceList },
  };
}

// ── THE WRITE COMMANDS ──────────────────────────────────────────────────────────────────────────────────────────────────


/**
 * Run one command. `fileValue` is the request file as read (its `_notes` removed). Returns `{ exitCode, result }`; the
 * result is what --json prints. Nothing is sent unless gates 1–3 all pass.
 */
export async function runCommand(db, parsed, { nowIso, fileValue = null }) {
  const { command, uid } = parsed;
  const owner = parsed.owner ?? null;
  if (command === 'status') return runStatus(db, { uid, owner, nowIso });
  if (command === 'books') return runBooks(db, { uid, nowIso });

  const action = COMMANDS[command];
  if ((command === 'admit' || command === 'resolve') && !isPlain(fileValue)) throw new ScriptError(`${command} needs a file holding one JSON object`);
  const body = bodyWithoutKey(command, { agentId: parsed.agentId, fileValue, owner, archetype: parsed.archetype ?? null });
  const gates = readGates(uid, owner);
  const refused = gateRefusals(gates);
  const base = { command, action, ...gates };
  if (refused.length > 0) return { exitCode: EXIT.REFUSED, result: { ...base, sent: false, refused, body } };

  // The book a book-scoped request acts on, for its key (create_book and create_book_for have none yet). Build B4: with
  // --owner, that player's book.
  const own = action === 'create_book' || action === 'create_book_for' ? null : await ownBookOf(db, owner ?? uid);
  const requestKey = requestKeyFor(body, own?.bookId ?? null, parsed.again ?? null);
  const fullBody = { action, requestKey, ...Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'action')) };

  if (command === 'admit' && parsed.dryRun) return runAdmitDryRun(db, { uid, contractRaw: body.contract, requestKey, nowIso, fullBody });

  if (!parsed.go) {
    return { exitCode: EXIT.REFUSED, result: { ...base, sent: false, refused: [{ gate: 'go', message: 'not sent: add --go to send it' }], body: fullBody, bookId: own?.bookId ?? null } };
  }

  // ALL THREE GATES PASSED. The one call that can write — the door's own dispatcher, which checks gates 1 and 2 again.
  const answer = await runFounderAction(db, { uid, body: fullBody, nowIso });
  const replay = answer.body?.idempotentReplay === true;
  let bookNow = null;
  if (replay && (action === 'pause' || action === 'resume' || action === 'wind_down')) {
    const now = await ownBookOf(db, owner ?? uid);
    bookNow = now ? { bookId: now.bookId, status: now.book.status ?? null, drafting: now.book.drafting ?? null } : null;
  }
  return {
    exitCode: exitOfStatus(answer.status),
    result: { ...base, sent: true, body: fullBody, httpStatus: answer.status, answer: answer.body, replay, bookNow },
  };
}

// ── PLAIN-TEXT RENDERING ────────────────────────────────────────────────────────────────────────────────────────────────

/** The sentence status adds under the player-list line (build B4). */
export const PLAYER_LIST_REDEPLOY_SENTENCE = 'The deployed app reads its own copy of the list: a change there needs a production redeploy.';

/** Build B6 (B6-7): status's warning for malformed player-list entries — how many, never which. */
export function playerListWarning(n) {
  return `                WARNING: ${n} ${n === 1 ? 'entry' : 'entries'} on this machine's player list (${PRACTICE_FIELD_PLAYER_ENV}) ${n === 1 ? 'is' : 'are'} not a uid the door accepts (1 to 128 characters from ! to ~, so no space and no accent; no "/"; not "." or ".."; not starting with "_"). No book can be made for ${n === 1 ? 'it' : 'them'}; the other entries still count. Correct the list here and in the deployed app's copy.`;
}

function gateLines(r) {
  const whose = r.ownerIsUid === false ? ` for owner ${r.owner}` : '';
  return [
    `mode            ${r.mode}   (this checkout: ${r.modeSource} ships '${r.shippedMode}')`,
    `founder list    ${r.onFounderList ? 'yes' : 'no'}   (MANDATE_FOUNDER_UIDS, this machine)`,
    `player list     ${r.onPlayerList ? 'yes' : 'no'}${whose}   (${PRACTICE_FIELD_PLAYER_ENV}, this machine — at 'allowlist' creating a book, admitting an idea and the screen need it)`,
    ...(r.playerListMalformed > 0 ? [playerListWarning(r.playerListMalformed)] : []),
    `                ${PLAYER_LIST_REDEPLOY_SENTENCE}`,
    `founder         ${r.founder ? 'yes' : 'no'}   (the door's gate: the mode is not 'off' AND on the founder list)`,
    `mode admits     ${r.modeAdmitsOwner ? 'yes' : 'no'}${whose}   (the mode's own gate for creating a book, admitting an idea and the screen)`,
  ];
}

/** A desk's source in a `books` line. */
const deskWord = (d) => (d ? `${d.source}${d.fallbackReason ? ` (${d.fallbackReason})` : ''}` : '—');

/** One `books` line. */
function bookLine(b) {
  if (b.unreadable) return `${b.ownerUid ?? '—'}   book ${b.bookId}: listed open, but it could not be read as an idea book`;
  const state = `${b.status}${b.drafting ? `/${b.drafting}` : ''}${b.windDownRequestedAt ? ' (winding down)' : ''}`;
  const desks = !b.agentOn ? 'agent off in this checkout' : (b.desks ? DESK_IDS.map((id) => `${id} ${deskWord(b.desks[id])}`).join(' · ') : 'no close yet');
  const sp = b.spend;
  return [
    `${b.ownerUid}   ${state}   value ${usd(b.valueUsd)}   last close ${b.lastClose ?? 'none yet'}`,
    `    desks ${desks}   spend ${sp.month} ${usd(sp.settledUsd)} of ${usd(sp.boundUsd)}${sp.exhausted ? ' EXHAUSTED' : ''}   open records ${b.openRecords}${b.ruledAwaitingClose ? ` (+${b.ruledAwaitingClose} ruled, waiting for the next close)` : ''}${b.registryOwner !== undefined ? `   (the registry lists ${b.registryOwner})` : ''}`,
  ].join('\n');
}

function refusalLines(refused) {
  return (refused || []).map((x) => `REFUSED (${x.gate}): ${x.message}`);
}

function ideaLines(v) {
  if (!v) return ['  (empty)'];
  if (v.status === 'unreadable') return [`  ${v.ideaId}: the slot names it, but it could not be read`];
  const lines = v.lines.map((l) => (l.entered ? `${l.symbol} line ${usd(l.level)} (${pct(l.distancePct)} below entry)` : `${l.symbol} ${pct(l.distancePct)} below entry (not entered)`));
  return [
    `  ${v.ideaId}  ${v.status}`,
    `    names       ${v.names.join(', ')}${v.comparison ? `   vs ${v.comparison.type}${v.comparison.symbols.length ? ` ${v.comparison.symbols.join(', ')}` : ''}` : ''}`,
    `    capital     ${usd(v.capitalUsd)}   cash ${usd(v.cashUsd)}`,
    `    lines       ${lines.join('; ') || '—'}`,
    `    sessions    ${v.startSession ?? '—'} → due ${v.dueSession ?? '—'}   (${v.sessionsLeft === null ? 'unknown' : v.sessionsLeft} left after the last close)`,
  ];
}

export function renderText(result) {
  const out = [];
  if (result.command === 'books') {
    out.push(...gateLines(result).filter((l) => !/^(player list|mode admits) /.test(l) && l.trim() !== PLAYER_LIST_REDEPLOY_SENTENCE));
    out.push(...refusalLines(result.refused));
    if (result.refused?.length) return out;
    out.push('', `open books      ${result.books.length}${result.books.length ? '   (books with open records first)' : ''}`);
    for (const b of result.books) out.push(bookLine(b));
    return out;
  }
  if (result.command === 'status') {
    out.push(...gateLines(result));
    out.push(...refusalLines(result.refused));
    if (result.refused?.length) return out;
    if (!result.book) { out.push('', `book            none open for ${result.ownerIsUid === false ? `owner ${result.owner} (create-book-for makes one)` : 'this uid (create-book makes one)'}`); return out; }
    const b = result.book;
    out.push('', `book            ${b.bookId}   ${b.status}${b.drafting ? `, drafting ${b.drafting}` : ''}${b.windDownRequestedAt ? `, wind-down requested ${b.windDownRequestedAt}` : ''}`);
    if (result.ownerIsUid === false) out.push(`owner           ${result.owner}`);
    out.push(`agent           ${b.agentId ?? '—'} (${b.archetype ?? '—'})`);
    out.push(`cash            ${usd(b.unreservedCashUsd)} unreserved   ${usd(b.cashUsd)} in all   value ${usd(b.totalValueUsd)}`);
    out.push(`last close      ${b.lastClosedSession ?? 'none yet'}`);
    for (const slot of ['short', 'medium', 'long']) { out.push('', `slot ${slot}`); out.push(...ideaLines(b.slots[slot])); }
    if (b.otherOpenIdeas.length) { out.push('', 'open ideas outside a slot'); for (const v of b.otherOpenIdeas) out.push(...ideaLines(v)); }
    out.push('', `open records    ${result.records.length === 0 ? 'none' : ''}`);
    for (const r of result.records) {
      out.push(`  ${r.kind.padEnd(15)} ${r.recordId}${r.ruled ? '   (ruled — waits for the next close)' : ''}`);
      out.push(`    idea ${r.ideaId}   ${r.symbol ?? ''}   ${r.reason ?? ''}   ledgers ${r.ledgers.join(', ')}   decisions: ${r.decisions.join(' | ')}`);
    }
    const p = result.parseReport;
    out.push('', `parse report    ${p.session === null ? 'no close yet' : `${p.session}${p.stored ? '' : ' (none stored)'}: ${p.alerts.length === 0 ? 'clean for the book\'s symbols' : `${p.alerts.length} alert(s)`}`}`);
    for (const a of p.alerts) out.push(`  ${a.symbol}  ${a.reason}`);
    // Build B4: ideas admitted after the report was written are not in it; their first report is the next session's.
    if (p.admittedAfter?.length) out.push(`  ${p.admittedAfter.length} idea(s) admitted after this report was written (${p.cutoff?.source === 'daily_build' ? 'the daily build' : 'the close'}, ${p.cutoff?.at}): their names are checked from the next session's report`);
    // Build B2: the agent's latest check, desk by desk, and the month's spend.
    const ag = result.agent;
    if (ag) {
      out.push('', `agent           ${ag.enabled ? 'on' : 'off'} in this checkout (saved theses ${ag.thesesEnabled ? 'on' : 'off'})   latest check: ${ag.session ?? 'no close yet'}${ag.desks ? '' : ' — no check recorded'}`);
      for (const id of DESK_IDS) {
        const d = ag.desks?.[id];
        if (!ag.desks) break;
        if (!d) { out.push(`  ${DESKS[id].name}: nothing recorded`); continue; }
        out.push(`  ${d.name}   ${d.source ?? d.status}${d.fallbackReason ? ` (${d.fallbackReason})` : ''}   ${d.calls} call(s), ${usd(d.chargedUsd)}`);
        out.push(`    note        ${d.note === null ? '—' : JSON.stringify(d.note)}`);
        for (const a of d.actions) out.push(`    action      ${a.ideaId}  ${a.action} → ${a.outcome ?? '—'}   ${JSON.stringify(a.reason)}`);
        for (const c of d.considered) {
          const what = c.outcome === 'admitted' ? `ADMITTED ${c.ideaId} at ${usd(c.capitalUsd)}` : (c.outcome === 'refused' ? `refused: ${c.refusals.join(', ')}` : c.outcome);
          out.push(`    draft ${c.index}     ${c.slot}  ${c.names.join(', ')}  (${c.source ?? '—'})  ${what}`);
        }
      }
    }
    const sp = result.spend;
    if (sp) out.push('', `spend           ${sp.month}: ${usd(sp.settledUsd)} charged, ${usd(sp.committedUsd)} committed of ${usd(sp.boundUsd)}   ${sp.calls} call(s)${sp.exhausted ? '   EXHAUSTED — no call until next month' : ''}`);
    return out;
  }
  if (result.dryRun) {
    out.push(...gateLines(result), ...refusalLines(result.refused));
    out.push(`request key     ${result.requestKey}`);
    if (result.refused?.length) return out;
    out.push(`book            ${result.bookId ?? 'none open'}`);
    const st = result.stored;
    if (st?.kind === 'replay') {
      out.push(`--go WOULD REPLAY the answer stored under this key (${st.completedAt ?? 'earlier'}): ${st.httpStatus} ${st.answer?.error ?? (st.answer?.ok ? 'ok' : '')}`);
      for (const x of st.answer?.refusals || []) out.push(`  stored: ${x.code}`);
      out.push('  To send it as a new request, add --again <word>. Admission as it stands now, for that new request:');
    } else if (st?.kind === 'conflict') {
      out.push(`--go would be REFUSED request_key_conflict: this key holds a different request (${st.action}); add --again <word>.`);
    } else if (st?.kind === 'pending') {
      out.push(`--go would re-run the request recorded under this key at ${st.createdAt ?? 'an earlier time'}, never completed.`);
    }
    const v = result.verdict;
    if (v?.ok) {
      out.push(`DRY RUN: would be ADMITTED${v.replay ? ' (already admitted under this key: --go would replay it)' : ''} — idea ${v.ideaId}, start ${v.startSession}, due ${v.dueSession}, permitted maximum ${usd(v.permittedMaxUsd)}`);
      for (const w of result.wouldWrite || []) out.push(`  would ${w.op} ${w.path}`);
    } else {
      out.push(`DRY RUN: would be REFUSED — ${v?.error}${v?.message ? ` (${v.message})` : ''}`);
      for (const r of v?.refusals || []) out.push(`  ${r.code}   ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'code')))}`);
      if (v?.permittedMaxUsd !== undefined && v?.permittedMaxUsd !== null) out.push(`  permitted maximum ${usd(v.permittedMaxUsd)}`);
    }
    for (const b of v?.binding || []) out.push(`  binding: ${b.constraint}${b.symbol ? ` ${b.symbol}` : ''}${b.sector ? ` ${b.sector}` : ''} at ${usd(b.limitUsd)}`);
    if (result.priceList) {
      out.push(`price list      ${result.priceList.snapshotKey ?? `none (${result.priceList.reason})`}`);
      for (const s of result.priceList.symbols) out.push(`  ${s.symbol.padEnd(6)} ${s.priced ? usd(s.price) : 'NOT PRICED — entry needs a price'}`);
    }
    return out;
  }
  // A write command.
  out.push(...refusalLines(result.refused));
  out.push(`${result.sent ? 'SENT' : 'WOULD SEND'}       ${JSON.stringify(result.body)}`);
  // Build B4 (review A1/C1): which copy of the player list decides a creation run from here.
  if (result.action === 'create_book_for') out.push(`player list     ${result.onPlayerList ? 'yes' : 'no'} for owner ${result.owner} on THIS machine's copy, which decides here; the deployed app reads its own. ${PLAYER_LIST_REDEPLOY_SENTENCE}`);
  if (!result.sent) return out;
  const a = result.answer || {};
  if (result.replay) {
    out.push('REPLAY: this exact request was already sent; the stored answer is below and nothing changed now.');
    out.push('        To send it as a NEW request (its cause has gone, or you mean it again), add --again <word>.');
  }
  if (result.bookNow) out.push(`book now        ${result.bookNow.status}${result.bookNow.drafting ? `, drafting ${result.bookNow.drafting}` : ''}`);
  out.push(`door answered   ${result.httpStatus} ${a.ok === false || a.error ? `REFUSED: ${a.error}` : 'ok'}`);
  for (const r of a.refusals || []) out.push(`  ${r.code}   ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'code')))}`);
  out.push(JSON.stringify(a, null, 2));
  return out;
}

// ── MAIN ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The whole run, with its effects injected (the tests pass the in-memory db and a fixed clock). */
export async function runCli(argv, { getDb, nowIso = () => new Date().toISOString(), print = (s) => console.log(s), readFile } = {}) {
  let parsed;
  try { parsed = parseArgs(argv); } catch (err) {
    print(`FAILED: ${err.message}`);
    print('');
    print(USAGE);
    return EXIT.FAILED;
  }
  if (parsed.help) { print(USAGE); return EXIT.DONE; }
  try {
    const fileValue = parsed.file !== null ? readRequestFile(parsed.file, readFile ? { readFile } : {}) : null;
    const db = await getDb();
    const { exitCode, result } = await runCommand(db, parsed, { nowIso: nowIso(), fileValue });
    if (parsed.json) print(JSON.stringify({ exitCode, ...result }, null, 2));
    else for (const line of renderText(result)) print(line);
    return exitCode;
  } catch (err) {
    print(err instanceof ScriptError ? `${err.exitCode === EXIT.REFUSED ? 'REFUSED' : 'FAILED'}: ${err.message}` : `FAILED: ${err?.name ?? 'Error'}: ${err?.message ?? err}`);
    return err instanceof ScriptError ? err.exitCode : EXIT.FAILED;
  }
}

/** Credentials, loaded here only — after the arguments are checked. */
async function productionDb() {
  const { requireFirebaseCreds } = await import('./loadLocalEnv.js');
  requireFirebaseCreds();
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  return getFirebaseAdmin();
}

/** Is this module the entry point? The FULL resolved paths, compared (a file-name suffix match ran it from `founder.mjs`). */
export function isDirectRun(moduleUrl, argv1) {
  if (typeof argv1 !== 'string' || argv1.length === 0) return false;
  const norm = (q) => path.resolve(q).replace(/\\/g, '/').replace(/^[a-z]:/, (d) => d.toUpperCase());
  return norm(fileURLToPath(moduleUrl)) === norm(argv1);
}

const invokedDirectly = isDirectRun(import.meta.url, process.argv[1]);
if (invokedDirectly) {
  runCli(process.argv.slice(2), { getDb: productionDb }).then((code) => { process.exitCode = code; });
}
