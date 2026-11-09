// src/components/Research/Sheet/latestLine.js
//
// Research Modal Build C — THE LATEST SENTENCE (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md BC-3). PURE, Node-clean.
//
// The archetype's latest sentence about one stock is QUOTED from the record,
// never written. In order:
//   1. the first sentence naming the symbol (as a whole token) in the
//      rationale of the latest check that LOOKED at the name — its evidence or
//      its candidates (founder ruling FQ-1, 2026-11-08) — attributed to that
//      check's time. An entry whose model call failed or was budget-skipped
//      (`haikuError` set — agent-evaluate.js writes a canned "defaulting to
//      HOLD" rationale) is not a check that said anything, so it never counts
//      (review A2's reading, carried over);
//   2. else the latest call record's `said` for this symbol (by mintedAt);
//   3. else the latest candidates list's flag for it (the latest entry that
//      recorded a candidates list), in its own words (`signalSummary`):
//      a `potential_exit` flag on any name reads "What it flagged · exit ·
//      {time}" (FQ-5) — never a bench flag; a bench (entry) flag on a name not
//      held reads "What it flagged";
//   4. else a template, about ONE check — the newest of the latest check that
//      looked at the name (rule 1's) and, for a held name, the latest check
//      with a rationale:
//        "Checked at 1:15 · nothing said about EOG" when that check said nothing
//        about the name (no naming sentence in its rationale, no signal summary
//        for it), else "Last looked at 1:15" — the template never claims
//        "nothing said" about a check that did say something;
//      or "{Archetype} hasn't looked at this one" (never on a check).
//
// THE SENTENCE RULE (deterministic, pinned by latestLine.test.js): a rationale
// splits after `.`, `!` or `?` (with any closing quote or bracket) followed by
// whitespace and then an uppercase letter, a digit, `$` or an opening quote or
// bracket — never after one of SPLIT_EXCEPTIONS ("vs.", "e.g.", "Inc." …) — and
// at every line break. Each piece is trimmed and quoted as written.
//
// THE TOKEN RULE (BC-10's, applied here too): a symbol names itself only as a
// whole uppercase token — no letter, digit, `.` or `-` touching it — and only
// when it has three or more letters. A one- or two-letter ticker ("F", "GE",
// "ON") never matches by text, because prose cannot be told apart from it; such
// a name falls through to its calls, its bench summary or the template.

/** Abbreviations a sentence never ends on (the split rule's fixed exceptions). */
export const SPLIT_EXCEPTIONS = Object.freeze(['vs.', 'e.g.', 'i.e.', 'etc.', 'approx.', 'Inc.', 'Corp.', 'Co.', 'Ltd.', 'U.S.', 'Mr.', 'Ms.', 'Dr.', 'St.']);

const finiteMs = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return Number.isFinite(ms) ? ms : null; } catch { return null; } }
  return null;
};

/** Does `head` end on `abbr` as a word — at the start, or after whitespace, an opening bracket or an opening quote ("(vs.", "“e.g.")? */
function endsOnAbbreviation(head, abbr) {
  if (!head.endsWith(abbr)) return false;
  const before = head.length > abbr.length ? head[head.length - abbr.length - 1] : '';
  return before === '' || /[\s(\["'“‘]/.test(before);
}

/** Split a rationale into sentences by the pinned rule. */
export function splitSentences(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const out = [];
  for (const line of text.split(/\r?\n+/)) {
    let start = 0;
    const re = /[.!?]["'”’)\]]*\s+(?=[A-Z0-9$"'“‘(\[])/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const endOfSentence = m.index + m[0].trimEnd().length;
      const head = line.slice(start, endOfSentence);
      if (SPLIT_EXCEPTIONS.some((abbr) => endsOnAbbreviation(head, abbr))) continue;
      const piece = head.trim();
      if (piece) out.push(piece);
      start = m.index + m[0].length;
    }
    const tail = line.slice(start).trim();
    if (tail) out.push(tail);
  }
  return out;
}

/** Does `text` name `symbol` as a whole uppercase token (three or more letters)? */
export function namesSymbol(text, symbol) {
  if (typeof text !== 'string' || typeof symbol !== 'string') return false;
  if ((symbol.match(/[A-Z]/g) || []).length < 3) return false;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9.\\-])${escaped}(?![A-Za-z0-9\\-]|\\.[A-Za-z0-9])`).test(text);
}

const evaluationsOf = (battle) => (Array.isArray(battle?.evaluations) ? battle.evaluations.filter((e) => e && typeof e === 'object') : []);
const byTimeDesc = (list, at) => [...list].sort((a, b) => (finiteMs(at(b)) ?? -Infinity) - (finiteMs(at(a)) ?? -Infinity));

/** A failed or budget-skipped call's entry: its rationale is the cron's canned default, never the archetype's words. */
const isDefaultRationale = (e) => e.haikuError !== null && typeof e.haikuError === 'object';

/** The latest evaluation entry carrying the archetype's own non-empty rationale, or null. */
export function latestRationaleEntry(battle) {
  return byTimeDesc(evaluationsOf(battle).filter((e) => typeof e.rationale === 'string' && e.rationale.trim() && !isDefaultRationale(e)), (e) => e.timestamp)[0] ?? null;
}

/** The latest evaluation entry that recorded a candidates list, or null. */
export function latestCandidatesEntry(battle) {
  return byTimeDesc(evaluationsOf(battle).filter((e) => Array.isArray(e.candidates)), (e) => e.timestamp)[0] ?? null;
}

/** The latest check that looked at `symbol` (its evidence or its candidates), or null. */
export function latestCheckOn(battle, symbol) {
  return byTimeDesc(evaluationsOf(battle).filter((e) => (e.evidence && typeof e.evidence === 'object' && e.evidence[symbol])
    || (Array.isArray(e.candidates) && e.candidates.some((c) => c?.symbol === symbol))), (e) => e.timestamp)[0] ?? null;
}

/**
 * The latest check that LOOKED at `symbol` and spoke for itself (FQ-1, FQ-2): its
 * evidence or its candidates name the symbol, and its call neither failed nor was
 * budget-skipped. The sentence rule 1 quotes, the stance's "Looked at" and the
 * check pin all name THIS check, so they never disagree (BUILD_RULES §9).
 */
export function latestVoicedCheckOn(battle, symbol) {
  return byTimeDesc(evaluationsOf(battle).filter((e) => !isDefaultRationale(e) && ((e.evidence && typeof e.evidence === 'object' && e.evidence[symbol])
    || (Array.isArray(e.candidates) && e.candidates.some((c) => c?.symbol === symbol)))), (e) => e.timestamp)[0] ?? null;
}

/** A candidate flagged to LEAVE (agentEvalToolSchema.js direction enum) is never a bench flag. */
const isExitFlag = (c) => c?.direction === 'potential_exit';

/** This symbol's EXIT flag on the latest candidates list, or null (FQ-5). */
export function exitFlagOf(battle, symbol) {
  const entry = latestCandidatesEntry(battle);
  const candidate = entry ? entry.candidates.find((c) => c?.symbol === symbol && isExitFlag(c)) : null;
  return candidate ? { entry, candidate } : null;
}

/** This symbol's bench (entry) flag on the latest candidates list, or null. */
export function benchCandidateOf(battle, symbol) {
  const entry = latestCandidatesEntry(battle);
  const candidate = entry ? entry.candidates.find((c) => c?.symbol === symbol && !isExitFlag(c)) : null;
  return candidate ? { entry, candidate } : null;
}

/** Did this check say anything about `symbol` — a naming sentence in its rationale, or a signal summary for it? */
function saidAbout(entry, symbol) {
  if (typeof entry?.rationale === 'string' && splitSentences(entry.rationale).some((s) => namesSymbol(s, symbol))) return true;
  return Array.isArray(entry?.candidates) && entry.candidates.some((c) => c?.symbol === symbol && typeof c.signalSummary === 'string' && c.signalSummary.trim() !== '');
}

/**
 * @param {object} p
 * @param {object} p.battle     the agent-battle document
 * @param {string} p.symbol
 * @param {boolean} p.held      the player's agent holds the name (the mount's row)
 * @param {Array}  [p.calls]    the battle's call records (any order)
 * @returns {{ source: 'rationale'|'call'|'bench'|'exit'|'template_checked'|'template_looked'|'template_never', text: string|null, atMs: number|null, recordId: string|null }}
 *   `text` is the quoted sentence (null for a template: the caller renders it).
 */
export function latestLineOf({ battle, symbol, held = false, calls = null }) {
  if (typeof symbol !== 'string' || !symbol) return { source: 'template_never', text: null, atMs: null, recordId: null };
  // 1. The latest check that LOOKED at the name: its first sentence naming it, at its time (FQ-1).
  const looked = latestVoicedCheckOn(battle, symbol);
  if (looked && typeof looked.rationale === 'string') {
    const sentence = splitSentences(looked.rationale).find((s) => namesSymbol(s, symbol));
    if (sentence) return { source: 'rationale', text: sentence, atMs: finiteMs(looked.timestamp), recordId: typeof looked.evalId === 'string' ? looked.evalId : null };
  }
  // 2. The latest call record's `said` for this symbol.
  const own = (Array.isArray(calls) ? calls : []).filter((c) => c && c.symbol === symbol && typeof c.said === 'string' && c.said.trim());
  const call = byTimeDesc(own, (c) => c.mintedAt)[0];
  if (call) return { source: 'call', text: call.said.trim(), atMs: finiteMs(call.mintedAt), recordId: typeof call.callId === 'string' ? call.callId : (call.id ?? null) };
  // 3. The latest candidates list's flag, in its own words: an exit flag on any name (FQ-5), …
  const exit = exitFlagOf(battle, symbol);
  const exitSummary = exit?.candidate?.signalSummary;
  if (typeof exitSummary === 'string' && exitSummary.trim()) {
    return { source: 'exit', text: exitSummary.trim(), atMs: finiteMs(exit.entry.timestamp), recordId: typeof exit.entry.evalId === 'string' ? exit.entry.evalId : null };
  }
  //    … or a bench (entry) flag on a name not held.
  if (!held) {
    const bench = benchCandidateOf(battle, symbol);
    const summary = bench?.candidate?.signalSummary;
    if (typeof summary === 'string' && summary.trim()) {
      return { source: 'bench', text: summary.trim(), atMs: finiteMs(bench.entry.timestamp), recordId: typeof bench.entry.evalId === 'string' ? bench.entry.evalId : null };
    }
  }
  // 4. The templates — about the newest of rule 1's check and, held, the latest check
  //    with a rationale; "nothing said" only when that check said nothing.
  const latest = latestRationaleEntry(battle);
  const at = byTimeDesc([looked, held ? latest : null].filter(Boolean), (e) => e.timestamp)[0] ?? null;
  if (at) {
    return { source: saidAbout(at, symbol) ? 'template_looked' : 'template_checked', text: null, atMs: finiteMs(at.timestamp), recordId: typeof at.evalId === 'string' ? at.evalId : null };
  }
  return { source: 'template_never', text: null, atMs: null, recordId: null };
}
