// src/components/Research/Sheet/latestLine.js
//
// Research Modal Build C — THE LATEST SENTENCE (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md BC-3). PURE, Node-clean.
//
// The archetype's latest sentence about one stock is QUOTED from the record,
// never written. In order:
//   1. the first sentence of the LATEST check's `rationale` that names the
//      symbol as a whole token (the latest evaluation entry carrying a
//      rationale; older checks are not searched);
//   2. else the latest call record's `said` for this symbol (by mintedAt);
//   3. for a bench name, the latest check's `candidates[].signalSummary`
//      (the latest entry that recorded a candidates list);
//   4. else a template: "Checked at 1:15 · nothing said about EOG" for a name
//      a check has looked at (held now, or on a check's evidence or candidates
//      before), or "{Archetype} hasn't looked at this one" (never on a check).
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
      if (SPLIT_EXCEPTIONS.some((abbr) => head.endsWith(` ${abbr}`) || head === abbr)) continue;
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

/** The latest evaluation entry carrying a non-empty rationale, or null. */
export function latestRationaleEntry(battle) {
  return byTimeDesc(evaluationsOf(battle).filter((e) => typeof e.rationale === 'string' && e.rationale.trim()), (e) => e.timestamp)[0] ?? null;
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

/** This symbol's bench entry on the latest candidates list, or null. */
export function benchCandidateOf(battle, symbol) {
  const entry = latestCandidatesEntry(battle);
  const candidate = entry ? entry.candidates.find((c) => c?.symbol === symbol) : null;
  return candidate ? { entry, candidate } : null;
}

/**
 * @param {object} p
 * @param {object} p.battle     the agent-battle document
 * @param {string} p.symbol
 * @param {boolean} p.held      the player's agent holds the name (the mount's row)
 * @param {Array}  [p.calls]    the battle's call records (any order)
 * @returns {{ source: 'rationale'|'call'|'bench'|'template_checked'|'template_never', text: string|null, atMs: number|null, recordId: string|null }}
 *   `text` is the quoted sentence (null for a template: the caller renders it).
 */
export function latestLineOf({ battle, symbol, held = false, calls = null }) {
  if (typeof symbol !== 'string' || !symbol) return { source: 'template_never', text: null, atMs: null, recordId: null };
  // 1. The latest check's rationale.
  const latest = latestRationaleEntry(battle);
  if (latest) {
    const sentence = splitSentences(latest.rationale).find((s) => namesSymbol(s, symbol));
    if (sentence) return { source: 'rationale', text: sentence, atMs: finiteMs(latest.timestamp), recordId: typeof latest.evalId === 'string' ? latest.evalId : null };
  }
  // 2. The latest call record's `said` for this symbol.
  const own = (Array.isArray(calls) ? calls : []).filter((c) => c && c.symbol === symbol && typeof c.said === 'string' && c.said.trim());
  const call = byTimeDesc(own, (c) => c.mintedAt)[0];
  if (call) return { source: 'call', text: call.said.trim(), atMs: finiteMs(call.mintedAt), recordId: typeof call.callId === 'string' ? call.callId : (call.id ?? null) };
  // 3. A bench name's signal summary on the latest candidates list.
  if (!held) {
    const bench = benchCandidateOf(battle, symbol);
    const summary = bench?.candidate?.signalSummary;
    if (typeof summary === 'string' && summary.trim()) {
      return { source: 'bench', text: summary.trim(), atMs: finiteMs(bench.entry.timestamp), recordId: typeof bench.entry.evalId === 'string' ? bench.entry.evalId : null };
    }
  }
  // 4. The templates.
  const looked = latestCheckOn(battle, symbol);
  if (looked || (held && latest)) {
    const at = looked ?? latest;
    return { source: 'template_checked', text: null, atMs: finiteMs(at.timestamp), recordId: typeof at.evalId === 'string' ? at.evalId : null };
  }
  return { source: 'template_never', text: null, atMs: null, recordId: null };
}
