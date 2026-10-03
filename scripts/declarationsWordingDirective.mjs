// scripts/declarationsWordingDirective.mjs
//
// Declarations wording experiment, round 3 — S2, the synthetic-directive
// sub-sample (round 3 brief §2). Where an active directive's block goes in a
// recorded request, and which canonical directives S2 may insert. PURE: no
// I/O, no clock, no flag read — the experiment script and the transient
// insertion probe both import it, so the rule the probe proves against the
// real assembler is the rule the replay applies.
//
// THE INSERTION POINT (VERIFIED at e6a84445, read only — the assembler is
// fenced): buildLiveContextBlock (api/_utils/agentEvalPromptAssembly.js:1122)
// pushes its parts in a fixed order and returns parts.join('\n\n') (:1285).
// The resolved controls are pushed at 3e3b (:1229-1242): the directive block,
// then the leans block. Before them come Trigger (3e, :1190-1194), the
// Intraday Momentum Snapshot (3e2, :1196-1202) and Risk Status (3e3,
// :1204-1208); after them come Institutional Intelligence (3e4, :1244-1255),
// News (3f, :1257-1276) and Recent Evaluation History (3g, :1278-1283). So the
// directive block sits immediately before the FIRST later part present, or at
// the end when none is. The block itself is never built here: the script
// renders it with the production renderer (controlPromptRenderer.js
// resolveControls → renderControlBlocks → renderDirectiveBlock).

import { getAllowlist } from '../src/data/archetypeAdjustments.js';

const SEP = '\n\n';

/** The directive block's own first line (controlPromptRenderer.js:215). */
export const DIRECTIVE_HEADER = 'ACTIVE DIRECTIVE (from your Coach):';

/** The first line of each part the assembler pushes AFTER the directive, in push order. */
export const POST_DIRECTIVE_HEADERS = Object.freeze([
  'STANDING LEANS (user-equipped persistent adjustments):',          // controlPromptRenderer.js:235 (3e3b, after the directive)
  '=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===',                // agentEvalPromptAssembly.js:946 (3e4)
  'FANTASYTIMES INTELLIGENCE (recent stories from your newsroom):',  // agentNewsContext.js:211 (3f)
  'FANTASYTIMES BREAKING NEWS:',                                     // agentNewsContext.js:301 (3f)
  'YOUR LAST 3 DECISIONS:',                                          // agentEvalPromptAssembly.js:1281 (3g)
]);

/**
 * What the line right after each later part's header looks like, so a header string sitting
 * inside an earlier part is never mistaken for the part itself (review L6, mutant M15).
 */
const AFTER_HEADER = Object.freeze({
  [POST_DIRECTIVE_HEADERS[0]]: (next) => next.startsWith('- "'),                                        // a lean row (controlPromptRenderer.js:236)
  [POST_DIRECTIVE_HEADERS[1]]: (next) => next.startsWith('NOTE: This data is from quarterly SEC filings.'), // agentEvalPromptAssembly.js:947
  [POST_DIRECTIVE_HEADERS[2]]: (next) => next === '',                                                 // its parts join with '\n\n' (agentNewsContext.js:286)
  [POST_DIRECTIVE_HEADERS[3]]: (next) => next.startsWith('- ['),                                      // a story row (agentNewsContext.js:296-301)
  [POST_DIRECTIVE_HEADERS[4]]: (next) => /^\S+ \([^)]*\): (HOLD|SWAP)/.test(next),                    // an evaluation row (agentEvalPromptAssembly.js:1400)
});

/** The first line of the parts pushed immediately BEFORE the directive, when present. */
export const PRE_DIRECTIVE_HEADERS = Object.freeze([
  'TRIGGER (why you were woken up):',  // agentEvalPromptAssembly.js:1192 (3e)
  'INTRADAY MOMENTUM SNAPSHOT:',       // agentEvalPromptAssembly.js:1861 (3e2)
  'RISK STATUS:',                      // agentEvalPromptAssembly.js:1803 (3e3)
]);

/**
 * Insert a rendered directive block into a recorded live-context string at
 * the assembler's position. Throws — never guesses — when the text already
 * carries a directive, when a later part's header occurs twice, or when an
 * earlier part's header sits after the insertion point.
 *
 * @returns {{ text: string, index: number, before: string|null }} `before` is
 *   the header the block now precedes (null = appended as the last part)
 */
export function insertDirectiveBlock(liveContext, directiveBlock) {
  if (typeof liveContext !== 'string' || !liveContext) throw new Error('S2: the live context is not a non-empty string');
  if (typeof directiveBlock !== 'string' || !directiveBlock.startsWith(`${DIRECTIVE_HEADER}\n`)) throw new Error('S2: not a rendered directive block');
  if (liveContext.includes(DIRECTIVE_HEADER)) throw new Error('S2: the live context already carries a directive block');
  // The assembler joins with '\n\n'; a CR would hide every part boundary (the block would land at the end).
  if (liveContext.includes('\r')) throw new Error('S2: the live context carries CR line endings');
  let at = null;
  for (const header of POST_DIRECTIVE_HEADERS) {
    const needle = SEP + header;
    const i = liveContext.indexOf(needle);
    if (i < 0) continue;
    if (liveContext.indexOf(needle, i + 1) >= 0) throw new Error(`S2: '${header}' begins more than one part`);
    if (at === null || i < at.index) at = { index: i, before: header };
  }
  const index = at ? at.index : liveContext.length;
  if (at) {
    const from = at.index + SEP.length + at.before.length + 1;
    const end = liveContext.indexOf('\n', from);
    if (!AFTER_HEADER[at.before](liveContext.slice(from, end < 0 ? undefined : end))) throw new Error(`S2: '${at.before}' is not followed by its own rows`);
  }
  for (const header of PRE_DIRECTIVE_HEADERS) {
    const i = liveContext.lastIndexOf(SEP + header);
    if (i >= index) throw new Error(`S2: '${header}' sits after the insertion point`);
  }
  // A model-called check always has a trigger, so the part just before the controls is the
  // trigger, the momentum snapshot or risk status; anything else means a later-part header was
  // matched inside an earlier part's free text.
  const prevStart = liveContext.lastIndexOf(SEP, index - 1);
  const prevPart = liveContext.slice(prevStart < 0 ? 0 : prevStart + SEP.length, index);
  if (!PRE_DIRECTIVE_HEADERS.some((header) => prevPart.startsWith(header))) throw new Error('S2: the part before the insertion point is not trigger / momentum / risk');
  // parts [... , prev, later, ...] → [... , prev, directive, later, ...], still joined by '\n\n'.
  const text = liveContext.slice(0, index) + SEP + directiveBlock + liveContext.slice(index);
  return { text, index, before: at ? at.before : null };
}

/**
 * The founder's ruling for S2 (2026-10-02): each check gets a seeded pick among
 * its own archetype's sector or style restrictions — the menu ids below —
 * excluding any id already equipped as a lean on that battle.
 */
export const S2_DIRECTIVE_POOL = Object.freeze({
  momentum_chaser: Object.freeze(['TF-01', 'TF-02', 'TF-03', 'TF-06', 'TF-08']),
  contrarian: Object.freeze(['CN-01', 'CN-02', 'CN-04', 'CN-06']),
});

/**
 * The adjustment ids of the leans a recorded live context renders, read back
 * from the leans block (controlPromptRenderer.js:231-239 renders each lean as
 * `- "<canonical text>"`) through the archetype's own menu. An unmapped or
 * ambiguous text throws.
 */
export function equippedLeanIds(liveContext, archetype) {
  const start = liveContext.indexOf(SEP + POST_DIRECTIVE_HEADERS[0]);
  if (start < 0) return [];
  const lines = liveContext.slice(start + SEP.length).split('\n').slice(1);
  const ids = [];
  for (const line of lines) {
    if (!line.startsWith('- "')) break;
    const text = line.slice(3, -1);
    const hits = getAllowlist(archetype).filter((a) => a.canonical === text);
    if (hits.length !== 1 || !line.endsWith('"')) throw new Error(`S2: lean text not on the ${archetype} menu exactly once: ${line}`);
    ids.push(hits[0].id);
  }
  if (!ids.length) throw new Error('S2: a leans block with no lean rows');
  return ids;
}

/** A version-4-shaped UUID from a seeded PRNG (production mints `randomUUID()`, file-directive.js:270). */
export function seededUuidV4(rand) {
  const b = Array.from({ length: 16 }, () => Math.floor(rand() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
