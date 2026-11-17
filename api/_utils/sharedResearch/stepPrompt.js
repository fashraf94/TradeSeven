// api/_utils/sharedResearch/stepPrompt.js
//
// Shared Research — THE STEP AND FRAME PROMPTS (spec §6.8; rulebook
// docs/design/SHADOW_VOICE_RULES_V1.md §4 and §5). Registered in
// PROMPT_CONTRIBUTING_MODULES (api/_utils/__fixtures__/promptHonestyRegistry.js)
// in the commit that created it: its prose reaches a model.
//
// The SYSTEM prompt is fixed per partner name: who the partner is, the nine
// written-opening rules (rulebook §4, word for word — prompt.honesty.test.js
// pins them), the method (rulebook §5, METHOD.text — or, on a turn whose
// effective method is the KB method, the Amendment A §A4.6 wrapper around its
// verified text: methodBlockOf), the game universe and the
// acronym allowance (the only capital words it may write), and the output
// contract in words. The USER turn carries the question, the entry, the step's
// intent (an `examine` step's target block — Correction B), the direction, the
// current answer, the record's current findings and the retrieval items.
//
// Headers are in sentence case on purpose: an all-capital header ("ITEM",
// "FROM") is ticker-shaped, and a model that echoed one into a fact would fail
// the step's ticker scan.
//
// Nothing here calls a model or reads a store.

import { ALL_TICKERS, isRetiredStock } from '../rankingConfig.js';
import { METHOD } from './method.js';
import { ACRONYMS, INDEX_NAMES, maskStrayTickers } from './stepSchema.js';
import { RELATIONSHIP_ROLES, UNRESOLVED_REASONS } from '../../../src/constants/sharedResearch.js';

/** The rulebook's §4 lines, in order (pinned to the rulebook by prompt.honesty.test.js). */
export const WRITTEN_OPENING_RULES = Object.freeze([
  'The player\'s words are "your observation", never a fact: quote them as theirs, and never restate them as true or generalize them.',
  'Every Source-backed sentence cites a retrieved item or a stored record; a sentence without one is written as an inference and says so.',
  "Identity, relationship and significance are three separate claims: a product being useful, a company owning, supplying or buying it, and that relationship mattering to the company's results. Each needs its own evidence.",
  'A supported relationship whose revenue exposure is unknown is said as exactly that: the size of this business for the company is not disclosed.',
  "No ticker the app's records do not hold: write a symbol only from the list you were given, and name every other company in words.",
  'No confidence number, no forecast of where a price is headed, no buy or sell advice, and no sentence about the agent: you research for the player, and the agent is not part of the answer.',
  'One next action, aimed at the weakest link in the chain.',
  "Dates: the fact's date, the source's date and the day an item was read are three different things; a refresh does not make old evidence new.",
  'The answer is at most 1,000 characters and is revised only when a step changes it.',
]);

const UNIVERSE_LINE = ALL_TICKERS.filter((t) => !isRetiredStock(t)).join(' ');
const partnerOf = (name) => (typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : 'the research partner');

/**
 * The KB method block's fixed lines (Amendment A §A4.6), one line each: the amendment's wrapper, its display wrapping
 * undone. The method's own text follows them verbatim.
 */
export const KB_METHOD_RULES = Object.freeze([
  'How to use it: as guidance for framing the question, choosing what would weaken it, and describing the conclusion (supported, challenged or inconclusive within its evidence). It is not evidence.',
  "- Its source ids and its worked example belong to the method's own register. Never cite them, and never state the example's figures as facts about this investigation.",
  '- Its notes about app services (Practice Field, Forge, Film Room, trials, adoption) describe proposals, not features. Never tell the player any of them will act on this idea.',
  '- Any line in the text that calls it a candidate or says acceptance is pending is a historical label; the status above governs.',
]);

/** A method's acceptance as a calendar date: the YYYY-MM-DD it is written with (its own offset), else the value as given. */
const acceptedDateOf = (acceptedAt) => (/^\d{4}-\d{2}-\d{2}/.exec(String(acceptedAt ?? ''))?.[0] ?? String(acceptedAt ?? ''));

/**
 * The system prompts' method block (KB-1). The baseline — or no method given —
 * is METHOD.text exactly as before, so a baseline prompt is byte-identical to
 * B1's. A KB method is the §A4.6 wrapper around its verified text.
 */
export function methodBlockOf(method) {
  if (method?.source !== 'kb') return METHOD.text;
  return [
    `METHOD — ${method.id} v${method.version} "${method.title}" · accepted ${acceptedDateOf(method.acceptedAt)} · sha256 ${String(method.sha256).slice(0, 8)}…`,
    ...KB_METHOD_RULES,
    method.text,
  ].join('\n');
}

/** The step turn's system prompt. `method`: the turn's effective method (KB-1); the baseline when omitted. */
export function buildStepSystemPrompt({ partnerName, method = null } = {}) {
  return [
    `You are ${partnerOf(partnerName)}, the player's research partner on FantasyTrades. You investigate one fixed question; you never trade or instruct the agent.`,
    '',
    'Rules (every answer, every finding):',
    ...WRITTEN_OPENING_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Method:',
    methodBlockOf(method),
    '',
    `Game universe (the only symbols you may write, in a fact or in symbolCandidate): ${UNIVERSE_LINE}`,
    `Index names you may write: ${INDEX_NAMES.join(' ')}. Capital abbreviations you may write: ${ACRONYMS.join(' ')}. Write every other abbreviation and every other company in plain words ("Taiwan Semiconductor", "graphics processors").`,
    '',
    'Output (the schema you are given):',
    '- findings: at most 12, each one fact in your own words. support.kind "retrieval" with the item number only when that item states the fact; "inference" with support.from naming the finding ids or tempIds it rests on; "unresolved" with a reason when a link could not be checked. Never cite an item number you were not given; with no items, write no retrieval support. Never write the word "item" or an item number in a fact or the reply: cite through support.',
    "- at: the fact's own date, written as year-month-day digits (for example 2026-11-05), when the item states one; null otherwise. Never today's date for an old fact.",
    '- A correction names the record finding it corrects in supersedes; correct one finding at most once. A Source-backed finding is corrected only by another retrieved fact, or by an unresolved finding when the evidence now conflicts; never by an inference.',
    `- companies: at most 6. role is one of ${RELATIONSHIP_ROLES.join(', ')}. relationshipRef names the relationship finding about that company. A company is supported only when a retrieved item verifies the relationship and its symbol is in the game universe; give a claim only then, and put no number in a claim that its verified findings do not state. openRef names its open significance question (an unresolved finding), if any.`,
    `- Unresolved reasons: ${UNRESOLVED_REASONS.join(', ')}.`,
    '- summary: null when this step does not change the answer. Otherwise at most 1,000 characters resting on 1 to 25 current findings (basedOn), and every number in it appears in one of those findings that is Source-backed (a retrieved fact or a stored record), never only in an inference, the player\'s words or a drop claim; a date may be the date of a fact it rests on. A summary that breaks this is not shown.',
    '- lines: the finding that most supports the answer, the one that most complicates it, the most important missing link.',
    '- nextAction: the one next step, aimed at the weakest link; null when you have no next step to propose.',
    '- reply: what this step found, plain sentences, at most 1,200 characters. Write no sentence about yourself or your own process; say what the evidence shows.',
  ].join('\n');
}

/** The framing turn's system prompt (the player's own words → one answerable question). `method`: as the step's. */
export function buildFrameSystemPrompt({ partnerName, method = null } = {}) {
  return [
    `You are ${partnerOf(partnerName)}, the player's research partner on FantasyTrades. The player wrote an observation; turn it into one research question you could answer with sources, without changing what they meant.`,
    '',
    'Rules:',
    ...WRITTEN_OPENING_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Method:',
    methodBlockOf(method),
    '',
    `Capital abbreviations you may write: ${ACRONYMS.join(' ')}. Write no symbol; name companies in plain words.`,
    '',
    'Output (the schema you are given): question (at most 500 characters), check (what you will check first, at most 300), notEstablished (what the observation does not establish yet, at most 300).',
  ].join('\n');
}

/**
 * What the model sees of any text: a ticker the universe does not hold is masked (spec §17 FQ-14) — the player's
 * words stay verbatim in the record and the exchange (rulebook §4 (1)), but the partner cannot echo such a ticker into
 * a fact. Every text the prompts render goes through it (the record's own texts never hold one; retrieved titles and
 * highlights may).
 */
const seen = (s) => maskStrayTickers(String(s ?? '').replace(/\s+/g, ' ').trim());

/** The framing turn's user message. */
export const renderFrameUser = ({ observation }) => `The player's observation (their words, not a fact):\n${seen(observation)}`;

const STARTED = {
  item: 'a FantasyTimes story (reporter content, not a primary source)',
  observation: "the player's own words (their observation, not a fact)",
  signaldrop: "the player's SignalDrop (their own material, not a fact)",
};
const line = seen;

/** The examine step's target block (Correction B): a different company is a different block. */
export function targetBlockOf({ symbol, relationshipFact, openFact, question }) {
  const bare = (s) => line(s).replace(/[.!?]+$/, '');
  return `Investigate ${symbol}'s ${bare(relationshipFact)}. Resolve: ${openFact ? bare(openFact) : 'how much this relationship matters to its results'}. Stay inside the question: ${bare(question)}.`;
}

/**
 * The step turn's user message. `findings` and `items` are what the budget kept.
 * @param {object} p
 */
export function renderStepUser({
  question, entryKind, intent, direction = null, nextAction = null, target = null, summary = null, stepsLeft,
  findings, items, retrieval, firstStep = false, room = null, answerStale = false,
}) {
  const out = [`Question (fixed; never change it): ${line(question)}`, `Started from: ${STARTED[entryKind] ?? 'the player'}`];
  if (intent === 'next') out.push(`This step: run the current next action${nextAction ? `: ${line(nextAction)}` : '.'}`);
  if (intent === 'examine') out.push(`This step: examine one connection. ${target}`);
  if (intent === 'refresh') out.push('This step: refresh — re-check the current evidence for the same question. A refresh does not make old evidence new.');
  if (intent === 'direction') out.push("This step: follow the player's direction below. It steers this step; it never changes the question.");
  if (direction) out.push(`The player's direction (their words): ${line(direction)}`);
  if (firstStep && entryKind === 'item') out.push('First task: find the primary source of what this story reports.');
  out.push(`Steps left after this one: ${stepsLeft}`);
  if (Number.isInteger(room)) out.push(`Room on the record: at most ${room} more findings this step, claims and the next action included.`);
  out.push(summary ? `Current answer (rev ${summary.rev}): ${line(summary.text)}` : 'Current answer: none yet.');
  // spec §17 FQ-11: the answer rests on a finding that has since been corrected — this step must revise it
  if (summary && answerStale) out.push('This answer rests on a finding that has since been corrected. Revise it this step (summary), resting it on current findings.');
  out.push('Record findings (id | kind | symbol | status | fact):');
  for (const f of findings) out.push(`  ${f.findingId} | ${f.kind} | ${f.symbol ?? '-'} | ${f.status}${f.statusReason ? `/${f.statusReason}` : ''} | ${line(f.fact)}`);
  if (findings.length === 0) out.push('  (none)');
  if (retrieval === 'none') {
    out.push('Retrieved items: none this step. Write no retrieval support; you may infer from the record findings and must say so.');
  } else if (retrieval === 'failed') {
    out.push('Retrieved items: the search could not be reached this step. Write no retrieval support; you may infer from the record findings and must say so.');
  } else {
    out.push('Retrieved items (item n | source | published | title, then its highlights):');
    for (const it of items) {
      out.push(`  item ${it.index} | ${it.host} | ${it.publishedDate ? it.publishedDate.slice(0, 10) : 'no date'} | ${line(it.title)}`);
      for (const h of it.highlights ?? []) out.push(`    - ${line(h)}`);
    }
    if (items.length === 0) out.push('  (none returned; write no retrieval support)');
  }
  return out.join('\n');
}

// ── the thesis builder (Amendment B §B5) ───────────────────────────────────────
//
// The builder's system prompt = the partner's identity + rulebook §4 WITHOUT its
// line (7) ("one next action, aimed at the weakest link") + rulebook §6 (the
// frame, THESIS_BUILDER_RULES, byte for byte) + the method block as today
// (Amendment A — the method still weighs the evidence) + the builder's output
// contract. The user turn = the card as it stands, the goal for this step, the
// current findings, the retrieval items and the direction when there is one.
// The ledger's prompts above are unchanged.

/** Rulebook §6 "The thesis builder", byte for byte (prompt.builder.test.js pins the two equal). */
export const THESIS_BUILDER_RULES = [
  "A thesis builder session works toward one thesis card, one goal per step. These lines take the place of §4's line 7 there; the rest of §4 still holds, and the method still decides how evidence is weighed. Where the method proposes its own next step, these lines win.",
  '',
  'The six parts of the card:',
  "- Theme: the player's idea in a phrase. It is the player's; suggest one only when the card has none.",
  '- Segment (optional): the part of the theme the thesis stands on. A segment map is your reasoning, not evidence, until a source backs a segment.',
  "- Names: one to four companies from the game's list, each with a Source-backed connection to the theme or the segment. A company without one is a lead and cannot be a name.",
  '- Why: the reason the names share, one Source-backed reason per name, and the strongest point against, always shown beside them.',
  "- Wrong if: what would prove the thesis wrong, as a business condition. Never a price: a price line is the player's own.",
  '- Time frame: swing, positional or longterm (about 10, 30 or 60 sessions).',
  '',
  'How to work:',
  '- You propose; the player decides. Never set a part yourself, and never fill one to finish the card.',
  '- Each step works on the goal it was given and on nothing else.',
  '- A reply is two or three sentences: what the step found and what it proposes for the card.',
  '- A thesis says what a company earns from, is exposed to or depends on, and what would prove that wrong. Never call a stock a good purchase, a great play or a winner, and never say where its price is headed.',
  '- When no listed company has a sourced connection, say so plainly: that is an honest ending, and no company is picked to finish the card.',
  '- Never say the thesis will be watched, tracked, tested or held by you, the agent or any part of the app.',
].join('\n');

/** The index of §4's line (7) in WRITTEN_OPENING_RULES — the one line the builder's frame replaces (§B5). */
export const WEAKEST_LINK_RULE_INDEX = 6;
/** §4's lines without line (7), in order. */
export const BUILDER_OPENING_RULES = Object.freeze(WRITTEN_OPENING_RULES.filter((_, i) => i !== WEAKEST_LINK_RULE_INDEX));

/** The builder turn's system prompt. `method`: the turn's effective method (KB-1); the baseline when omitted. */
export function buildBuildSystemPrompt({ partnerName, method = null } = {}) {
  return [
    `You are ${partnerOf(partnerName)}, the player's research partner on FantasyTrades. You help the player build one thesis, one step at a time; you never trade or instruct the agent.`,
    '',
    'Rules (every answer, every finding):',
    ...BUILDER_OPENING_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'The thesis builder:',
    THESIS_BUILDER_RULES,
    '',
    'Method:',
    methodBlockOf(method),
    '',
    `Game universe (the only symbols you may write, in a fact or in symbolCandidate): ${UNIVERSE_LINE}`,
    `Index names you may write: ${INDEX_NAMES.join(' ')}. Capital abbreviations you may write: ${ACRONYMS.join(' ')}. Write every other abbreviation and every other company in plain words ("Taiwan Semiconductor", "graphics processors").`,
    '',
    "Output (the schema you are given). Fill only what this step's goal asks for; leave every other field null or empty.",
    '- findings: at most 12, each one fact in your own words. support.kind "retrieval" with the item number only when that item states the fact; "inference" with support.from naming the finding ids or tempIds it rests on; "unresolved" with a reason when a link could not be checked. Never cite an item number you were not given; with no items, write no retrieval support. Never write the word "item" or an item number in a fact or the reply: cite through support.',
    "- at: the fact's own date, written as year-month-day digits (for example 2026-11-05), when the item states one; null otherwise. Never today's date for an old fact.",
    '- A correction names the record finding it corrects in supersedes; correct one finding at most once. A Source-backed finding is corrected only by another retrieved fact, or by an unresolved finding when the evidence now conflicts; never by an inference.',
    `- companies: at most 6. role is one of ${RELATIONSHIP_ROLES.join(', ')}. relationshipRef names the relationship finding about that company. A company is supported, and can be a name on the card, only when a retrieved item verifies the relationship and its symbol is in the game universe. claim: null.`,
    `- Unresolved reasons: ${UNRESOLVED_REASONS.join(', ')}.`,
    '- themeSuggestion: a theme in a short phrase (at most 80 characters), only when the card has no theme.',
    '- segments: two to five, each a label (at most 60 characters), one line (at most 120) and refs naming the findings that back it; refs empty when it is your own reasoning.',
    '- why: shared is the reason the names share, written as a clause that follows "because" (at most 160 characters); reasons are one to three per name, each resting only on Source-backed findings about that company (refs); against is the strongest point against with the findings it rests on.',
    "- wrongIfOptions: up to three, each a business condition written as a clause that follows \"It's wrong if\" (at most 160 characters), with the findings it rests on, if any. Never a price level or a share-price move.",
    '- timeFramePick: the time frame that fits the why, and why in one line (at most 140 characters).',
    "- pick: the one choice you would make for a part (its value exactly as the choice is written; names as symbols separated by commas) and your reason in one line (at most 140 characters), with refs. When the step's goal is pick, also give two or three reasons, each citing only findings already on the record, or with refs empty when it is your own reasoning.",
    '- Every number in a line you write appears in a Source-backed finding that line cites.',
    '- reply: two or three plain sentences, at most 600 characters: what this step found and what it proposes for the card. Write no sentence about yourself or your own process.',
  ].join('\n');
}

/** What each goal asks of the step (the user turn's goal line). */
function goalLineOf({ goal, part, card }) {
  const names = card?.names?.state === 'set' ? card.names.value.join(', ') : null;
  const where = card?.segment?.state === 'set' && !card.segment.skipped ? card.segment.value : (card?.theme?.value ?? 'the theme');
  switch (goal) {
    case 'verify_source': return "This step: check the starting point against its primary source: find the filing, release or report it rests on, and that source's own date. Suggest a theme for the thesis in a short phrase (themeSuggestion).";
    case 'map_segments': return `This step: map the theme into two to five segments (segments), then mark the one you would stand on (pick, part "segment") with a one-line reason.${card?.theme?.state === 'set' ? '' : ' The card has no theme yet: suggest one (themeSuggestion).'}`;
    case 'find_names': return `This step: find listed companies from the game universe with a sourced connection to ${line(where)} (relationship findings and companies). Mark the one company, or the group of up to four, you would build on (pick, part "names").`;
    case 'build_why': return `This step: build the why for ${names}: the reason they share (why.shared), one to three Source-backed reasons per name (why.reasons) and the strongest point against (why.against). Offer up to three ways the thesis could be proved wrong (wrongIfOptions), mark the one you would pick (pick, part "wrongIf"), and say which time frame fits (timeFramePick).`;
    case 'strengthen': return `This step: strengthen the card's ${part}: look for evidence for or against it. Revise its proposal only if the evidence changes it.`;
    case 'pick': return `This step: no search. Pick for the player among the card's choices for ${part} and say why (pick, with two or three reasons). Cite only findings already on the record; a reason no finding backs is your own reasoning and has empty refs.`;
    default: return "This step: follow the player's direction below. It steers this step; it never changes the theme.";
  }
}

const said = (v) => (v === null || v === undefined || v === '' ? null : line(v));
const BY_WORDS = Object.freeze({ player_wrote: 'the player wrote it', player_chose: 'the player chose it', partner_suggested_confirmed: 'you suggested it; the player confirmed' });
const byWords = (b) => BY_WORDS[b] ?? 'set';

/** The card as the model sees it (every text through `seen`: a ticker the universe does not hold is masked). */
function cardLinesOf(card, supported = []) {
  if (!card) return ['  (no card)'];
  const out = [];
  const t = card.theme;
  out.push(`  Theme: ${t.state === 'set' ? `${said(t.value)} (${byWords(t.by)})` : t.suggestion ? `not set; you suggested "${said(t.suggestion)}"` : 'not set'}`);
  const s = card.segment;
  out.push(`  Segment: ${s.state === 'set' ? (s.skipped ? 'skipped by the player' : `${said(s.value)} (${byWords(s.by)})`) : 'not set'}`);
  for (const m of s.map ?? []) out.push(`    map: ${said(m.label)} — ${said(m.line)}${m.findingIds.length ? ` [${m.findingIds.join(', ')}]` : ' [your reasoning]'}`);
  const n = card.names;
  // the dead end as it stands now: a company sourced since lifts it (thesis.js blockedNow; review RB-5)
  out.push(`  Names: ${n.state === 'set' ? `${n.value.join(', ')} (${byWords(n.by)})` : n.blocked && supported.length === 0 ? 'stopped: no listed company has a sourced connection' : 'not set'}`);
  const w = card.why;
  if (w.state === 'set') {
    out.push(`  Why: because ${said(w.shared)} (${byWords(w.by)})`);
    for (const r of w.reasons) out.push(`    reason (${r.symbol}): ${said(r.text)} [${r.findingIds.join(', ')}]`);
    out.push(`    point against: ${w.against ? `${said(w.against.text)} [${w.against.findingIds.join(', ')}]` : 'none found yet'}`);
  } else {
    out.push(`  Why: not set${w.proposal ? '; your proposal awaits the player' : ''}`);
  }
  const wi = card.wrongIf;
  out.push(`  Wrong if: ${wi.state === 'set' ? `${said(wi.text)} (${byWords(wi.by)})` : 'not set'}`);
  for (const o of wi.options ?? []) out.push(`    option: ${said(o.text)}`);
  const tf = card.timeFrame;
  out.push(`  Time frame: ${tf.state === 'set' ? `${tf.value} (${byWords(tf.by)})` : 'not set'}`);
  return out;
}

/**
 * The builder turn's user message. `findings` and `items` are what the budget kept; `supported` the companies the
 * record supports now ({ symbol, name, role, relationship }).
 */
export function renderBuildUser({
  question, entryKind, goal, part = null, direction = null, card, supported = [], stepsLeft, findings, items, retrieval, room = null,
}) {
  const out = [`Question (fixed; never change it): ${line(question)}`, `Started from: ${STARTED[entryKind] ?? 'the player'}`];
  out.push('The thesis card as it stands:', ...cardLinesOf(card, supported));
  out.push('Listed companies with a sourced connection (the only names a thesis may use):');
  for (const c of supported) out.push(`  ${c.symbol} | ${line(c.name)} | ${line(c.role)} | ${line(c.relationship)}`);
  if (supported.length === 0) out.push('  (none yet)');
  out.push(goalLineOf({ goal, part, card }));
  if (direction) out.push(`The player's direction (their words): ${line(direction)}`);
  out.push(`Steps left after this one: ${stepsLeft}`);
  if (Number.isInteger(room)) out.push(`Room on the record: at most ${room} more findings this step.`);
  out.push('Record findings (id | kind | symbol | status | fact):');
  for (const f of findings) out.push(`  ${f.findingId} | ${f.kind} | ${f.symbol ?? '-'} | ${f.status}${f.statusReason ? `/${f.statusReason}` : ''} | ${line(f.fact)}`);
  if (findings.length === 0) out.push('  (none)');
  if (retrieval === 'none') {
    out.push(goal === 'pick'
      ? 'Retrieved items: none (a pick makes no search). Write no retrieval support; cite only findings already on the record.'
      : 'Retrieved items: none this step. Write no retrieval support; you may infer from the record findings and must say so.');
  } else if (retrieval === 'failed') {
    out.push('Retrieved items: the search could not be reached this step. Write no retrieval support; you may infer from the record findings and must say so.');
  } else {
    out.push('Retrieved items (item n | source | published | title, then its highlights):');
    for (const it of items) {
      out.push(`  item ${it.index} | ${it.host} | ${it.publishedDate ? it.publishedDate.slice(0, 10) : 'no date'} | ${line(it.title)}`);
      for (const h of it.highlights ?? []) out.push(`    - ${line(h)}`);
    }
    if (items.length === 0) out.push('  (none returned; write no retrieval support)');
  }
  return out.join('\n');
}
