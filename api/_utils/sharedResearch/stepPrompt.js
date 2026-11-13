// api/_utils/sharedResearch/stepPrompt.js
//
// Shared Research — THE STEP AND FRAME PROMPTS (spec §6.8; rulebook
// docs/design/SHADOW_VOICE_RULES_V1.md §4 and §5). Registered in
// PROMPT_CONTRIBUTING_MODULES (api/_utils/__fixtures__/promptHonestyRegistry.js)
// in the commit that created it: its prose reaches a model.
//
// The SYSTEM prompt is fixed per partner name: who the partner is, the nine
// written-opening rules (rulebook §4, word for word — prompt.honesty.test.js
// pins them), the method (rulebook §5, METHOD.text), the game universe and the
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
import { ACRONYMS, INDEX_NAMES } from './stepSchema.js';
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

/** The step turn's system prompt. */
export function buildStepSystemPrompt({ partnerName } = {}) {
  return [
    `You are ${partnerOf(partnerName)}, the player's research partner on FantasyTrades. You investigate one fixed question; you never trade or instruct the agent.`,
    '',
    'Rules (every answer, every finding):',
    ...WRITTEN_OPENING_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Method:',
    METHOD.text,
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
    '- nextAction: the one next step, aimed at the weakest link; null only when the question is answered.',
    '- reply: what this step found, plain sentences, at most 1,200 characters.',
  ].join('\n');
}

/** The framing turn's system prompt (the player's own words → one answerable question). */
export function buildFrameSystemPrompt({ partnerName } = {}) {
  return [
    `You are ${partnerOf(partnerName)}, the player's research partner on FantasyTrades. The player wrote an observation; turn it into one research question you could answer with sources, without changing what they meant.`,
    '',
    'Rules:',
    ...WRITTEN_OPENING_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Method:',
    METHOD.text,
    '',
    `Capital abbreviations you may write: ${ACRONYMS.join(' ')}. Write no symbol; name companies in plain words.`,
    '',
    'Output (the schema you are given): question (at most 500 characters), check (what you will check first, at most 300), notEstablished (what the observation does not establish yet, at most 300).',
  ].join('\n');
}

/** The framing turn's user message. */
export const renderFrameUser = ({ observation }) => `The player's observation (their words, not a fact):\n${observation}`;

const STARTED = {
  item: 'a FantasyTimes story (reporter content, not a primary source)',
  observation: "the player's own words (their observation, not a fact)",
  signaldrop: "the player's SignalDrop (their own material, not a fact)",
};
const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

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
  findings, items, retrieval, firstStep = false, room = null,
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
