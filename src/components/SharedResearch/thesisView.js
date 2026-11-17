// src/components/SharedResearch/thesisView.js
//
// Shared Research — WHAT THE THESIS BUILDER SHOWS, pure (B4 build prompt K-4, K-7,
// K-9, K-10, K-11; Amendment B §B7). Every function here reads the server's
// `thesis` view (api/_utils/sharedResearch/thesis.js thesisViewOf) and the session
// as received, and ORDERS or LABELS what it holds. None decides a fact the server
// owns: not `ready`, not the blockers, not the sentence, not which goals or free
// choices are on offer, not a part's state, not a pick's basis, not a company's
// support (STOP list).
//
// The one display rule that is the client's (K-4): THE PART IN FRONT — the first of
// theme, segment, names, why, wrong if, time frame whose state is not `set`, a stale
// part first in `blockers` order. The foot holds that part's free choices, its pick
// choice, and every research choice that names no part; every other choice opens
// from its part on the card. The functions below only sort the server's entries
// into those places: every entry they return is one the server offered, unchanged.

import { THESIS_PARTS, HORIZON_LABELS } from '../../constants/sharedResearch';

/** A builder session (§B2; §B10 S-B2): stamped so by the server. The view is chosen by the SESSION, never the flag (K-2). */
export const isBuilderSession = (session) => session?.shape === 'builder';

/** The research goals that name no part: they belong in the foot whatever part is in front (K-4). */
export const PARTLESS_GOALS = Object.freeze(['verify_source', 'map_segments', 'find_names', 'build_why']);

/**
 * K-4: the part in front — the first stale part in `blockers` order, else the first part (in the sentence's order)
 * whose state is not `set`; null when every part is set.
 */
export function frontPartOf(thesis) {
  const parts = thesis?.parts;
  if (!parts) return null;
  const stale = (Array.isArray(thesis.blockers) ? thesis.blockers : []).find((b) => b?.state === 'stale' && THESIS_PARTS.includes(b.part));
  if (stale) return stale.part;
  return THESIS_PARTS.find((p) => parts[p]?.state !== 'set') ?? null;
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isText = (v) => typeof v === 'string' && v.length > 0;

/** Is this free choice a text box (the composer) or the price-line input, rather than a button? */
export const isInputChoice = (c) => c?.input === 'text' || c?.input === 'priceLines';
/** The segment's "skip": a pass, drawn last. */
export const isSkipChoice = (c) => c?.op === 'set' && c.part === 'segment' && c.value === 'skip';

/**
 * The value a `set` choice would give its part, as the card says it — so a confirm for the same value can stand in its
 * place (K-10: the agent's pick marks the matching free choice). wrongIf options are named by index.
 */
function setValueOf(choice, thesis) {
  if (choice.part === 'wrongIf' && choice.value && Number.isSafeInteger(choice.value.option)) return thesis.parts.wrongIf.options?.[choice.value.option]?.text ?? null;
  return choice.value;
}

/**
 * What marks a confirm choice (K-10): the agent's pick on a free choice (`pick`, not asked), the pick it was asked for
 * (`asked`), or a suggestion the server holds for the part (`suggestion`: the theme's, the time frame's). Null for a
 * confirm with no such mark (the why's).
 */
export function confirmMarkOf(choice, thesis) {
  if (choice?.op !== 'confirm') return null;
  const pick = thesis?.pick;
  if (pick && pick.part === choice.part && sameValue(choice.value, pick.value)) return pick.asked ? 'asked' : 'pick';
  if (choice.part === 'theme' && isText(thesis?.parts?.theme?.suggestion)) return 'suggestion';
  if (choice.part === 'timeFrame' && thesis?.parts?.timeFrame?.suggestion) return 'suggestion';
  return null;
}

/**
 * The free choices for one part, in the server's order, as buttons: a marked confirm (K-10) takes the place of the
 * `set` choice for the same value, so a value is never drawn twice; inputs, the skip and the part's Change (`clear`)
 * are left to their own places. `drop_unsourced` (a names choice offered for the why, SQ-3) belongs to the why.
 */
export function valueChoicesOf(thesis, part) {
  const free = Array.isArray(thesis?.choices?.free) ? thesis.choices.free : [];
  const owner = (c) => (c.reason === 'drop_unsourced' ? 'why' : c.part);
  const mine = free.filter((c) => owner(c) === part && c.op !== 'clear' && !isInputChoice(c) && !isSkipChoice(c));
  const marked = mine.filter((c) => c.op === 'confirm' && confirmMarkOf(c, thesis) && c.value !== undefined);
  const out = [];
  for (const c of mine) {
    if (marked.includes(c)) continue;
    const stand = c.op === 'set' ? marked.find((m) => sameValue(m.value, setValueOf(c, thesis))) : null;
    out.push(stand ?? c);
  }
  // a marked confirm whose value no `set` choice holds (a names pick; an asked pick) stands first
  for (const m of marked) if (!out.includes(m)) out.unshift(m);
  return out;
}

/** The part's text box, if it offers one (K-6: the theme, the wrong if). */
export const textChoiceOf = (thesis, part) => (thesis?.choices?.free ?? []).find((c) => c.part === part && c.input === 'text') ?? null;
/** The part's Change (its `clear`), if the server offers one (every set part but the theme). */
export const clearChoiceOf = (thesis, part) => (thesis?.choices?.free ?? []).find((c) => c.op === 'clear' && c.part === part) ?? null;
/** The price-line input (a set wrong-if with names set). */
export const priceLinesChoiceOf = (thesis) => (thesis?.choices?.free ?? []).find((c) => c.input === 'priceLines') ?? null;
/** The revised-why confirm (§B12 W-13), only when the server offers it. */
export const revisedWhyChoiceOf = (thesis) => (thesis?.choices?.free ?? []).find((c) => c.op === 'confirm' && c.part === 'why' && c.revised === true) ?? null;
/** The research choices that name `part` (strengthen, pick). */
export const researchForPartOf = (thesis, part) => (thesis?.choices?.research ?? []).filter((g) => g.part === part);
/** Is a direction step on offer (the composer's 1-step mode)? */
export const directionOffered = (thesis) => (thesis?.choices?.research ?? []).some((g) => g.goal === 'direction');

/**
 * K-4: the foot for the part in front — its value choices (marked confirms in place), its pick research choice, every
 * research choice that names no part, and its skip last. A STALE part in front also brings its Change and its
 * strengthen (K-7: a stale part names what to do). With no part in front (every part set) the foot lists every
 * research choice but direction — the ready view's "Keep researching".
 * @returns {{ part: string|null, values: object[], research: object[], skip: object|null, change: object|null, text: object|null }}
 */
export function footOf(thesis) {
  const part = frontPartOf(thesis);
  const research = Array.isArray(thesis?.choices?.research) ? thesis.choices.research : [];
  const stale = part !== null && thesis.parts[part]?.state === 'stale';
  if (part === null) {
    return { part, values: [], research: research.filter((g) => g.goal !== 'direction'), skip: null, change: null, text: null };
  }
  const own = research.filter((g) => g.part === part && (g.goal === 'pick' || (stale && g.goal === 'strengthen')));
  const partless = research.filter((g) => PARTLESS_GOALS.includes(g.goal));
  const free = Array.isArray(thesis?.choices?.free) ? thesis.choices.free : [];
  return {
    part,
    values: valueChoicesOf(thesis, part),
    research: [...own, ...partless],
    skip: free.find((c) => isSkipChoice(c) && c.part === part) ?? null,
    change: stale ? clearChoiceOf(thesis, part) : null,
    text: textChoiceOf(thesis, part),
  };
}

/**
 * The choices a TAPPED part's panel holds (K-4, K-7): its Change, its strengthen and pick research, its value choices
 * and its text box when it is not the part in front (the foot holds those), and — for the why — the revised confirm.
 */
export function panelOf(thesis, part) {
  const front = frontPartOf(thesis) === part;
  const revised = part === 'why' ? revisedWhyChoiceOf(thesis) : null;
  return {
    change: clearChoiceOf(thesis, part),
    research: researchForPartOf(thesis, part).filter((g) => !(front && g.goal === 'pick')),
    values: front ? [] : valueChoicesOf(thesis, part).filter((c) => c !== revised),
    text: front ? null : textChoiceOf(thesis, part),
    skip: front ? null : (thesis?.choices?.free ?? []).find((c) => isSkipChoice(c) && c.part === part) ?? null,
    revised,
    priceLines: part === 'wrongIf' ? priceLinesChoiceOf(thesis) : null,
  };
}

// ── the card ──────────────────────────────────────────────────────────────────

/** "A", "A and B", "A, B and C" — how a list of names is said. */
export const joinNames = (xs) => {
  const list = Array.isArray(xs) ? xs : [];
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
};
/** A horizon's label as the card says it: the shared HORIZON_LABELS row with a capital. */
export const horizonLabelOf = (h) => {
  const l = Object.hasOwn(HORIZON_LABELS, h ?? '') ? HORIZON_LABELS[h] : null;
  return l ? `${l[0].toUpperCase()}${l.slice(1)}` : null;
};

/**
 * What a part's slot in the card's sentence shows (K-7; DR-3): its state as the server derives it and the text the
 * server holds for it — the value when set or stale, the suggestion (marked "suggested", never drawn as filled) when
 * suggested, nothing when unset. The client composes no sentence: the finished one is `thesis.sentence`.
 * @returns {{ part, state, text: string|null, skipped: boolean }}
 */
export function slotOf(thesis, part) {
  const p = thesis?.parts?.[part] ?? {};
  const state = p.state ?? 'unset';
  const pick = thesis?.pick && thesis.pick.part === part && thesis.pick.asked ? thesis.pick : null;
  let text = null;
  let skipped = false;
  if (state === 'set' || state === 'stale') {
    if (part === 'segment' && p.skipped) skipped = true;
    else if (part === 'names') text = joinNames(p.value);
    else if (part === 'why') text = p.shared ?? null;
    else if (part === 'wrongIf') text = p.text ?? null;
    else if (part === 'timeFrame') text = p.label ?? null;
    else text = p.value ?? null;
  } else if (state === 'suggested') {
    if (part === 'theme') text = p.suggestion ?? null;
    else if (part === 'why') text = p.proposal?.shared ?? null;
    else if (part === 'timeFrame') text = horizonLabelOf(p.suggestion?.value ?? pick?.value);
    else if (part === 'names') text = pick ? joinNames(pick.value) : null;
    else text = pick?.value ?? null;
  }
  return { part, state, text: isText(text) ? text : null, skipped };
}

const bare = (s) => String(s ?? '').trim().replace(/[\s.!?;:,]+$/u, '');
/**
 * The server's finished sentence cut into runs, so each part that holds a value (set, or stale) can be tapped where it
 * stands (K-7) and a stale one marked there: each part's own text is FOUND in the sentence, in order; nothing is added or
 * reworded, and the runs join back to the sentence exactly (pinned by a table row). A part whose text is not found is
 * simply not tappable there.
 * @returns {{ text: string, part: string|null, state?: string }[]}
 */
export function sentenceRunsOf(sentence, thesis) {
  const s = typeof sentence === 'string' ? sentence : '';
  const runs = [];
  let at = 0;
  for (const part of THESIS_PARTS) {
    const slot = slotOf(thesis, part);
    if ((slot.state !== 'set' && slot.state !== 'stale') || !slot.text) continue;
    const needle = part === 'timeFrame' ? slot.text : bare(slot.text);
    if (!needle) continue;
    const i = s.indexOf(needle, at);
    if (i < 0) continue;
    if (i > at) runs.push({ text: s.slice(at, i), part: null });
    runs.push({ text: needle, part, state: slot.state });
    at = i + needle.length;
  }
  if (at < s.length) runs.push({ text: s.slice(at), part: null });
  return runs;
}

/**
 * The finding ids behind a part (K-7 "its sources"): the ids the server lists for it — for the names, each set name's
 * evidence as `companies.supported` lists it; for the why, its reasons' and its point against's. Each id once.
 */
export function partFindingIdsOf(thesis, part, companies) {
  const p = thesis?.parts?.[part] ?? {};
  let ids = [];
  if (part === 'segment' || part === 'wrongIf') ids = p.findingIds ?? [];
  else if (part === 'why') ids = [...(p.reasons ?? []).flatMap((r) => r.findingIds ?? []), ...(p.against?.findingIds ?? [])];
  else if (part === 'names') {
    const supported = Array.isArray(companies?.supported) ? companies.supported : [];
    ids = (p.value ?? []).flatMap((sym) => supported.find((c) => c.symbol === sym)?.evidence ?? []);
  }
  return ids.filter((id, i, a) => typeof id === 'string' && a.indexOf(id) === i);
}

/** The part a research goal works on, for the working slot while its request is in flight (K-15: only then). */
export function partOfGoal(goal, part = null) {
  if (part) return part;
  return { verify_source: 'theme', map_segments: 'segment', find_names: 'names', build_why: 'why' }[goal] ?? null;
}

// ── the conversation (K-9) ──────────────────────────────────────────────────────

/**
 * The conversation, from `session.exchanges` in order: the player's words and directions, the player's research tap
 * (a step's partner exchange records its goal and part — the server stores no player line for a research tap but a
 * direction's), the partner's reply as the server stored it, and each free tap's `card` line (R-21).
 * @returns {{ kind: 'words'|'direction'|'tap'|'said'|'card'|'mine', text?: string, goal?: string, part?: string|null, at?: string, key: string }[]}
 */
export function conversationOf(session) {
  const exs = Array.isArray(session?.exchanges) ? session.exchanges : [];
  const rows = [];
  exs.forEach((x, i) => {
    const key = `${x?.at ?? ''}:${i}`;
    if (!x || typeof x !== 'object') return;
    if (x.who === 'partner' && x.kind === 'step') {
      if (x.goal && x.goal !== 'direction') rows.push({ kind: 'tap', goal: x.goal, part: x.part ?? null, key: `${key}:tap` });
      rows.push({ kind: 'said', text: x.text ?? '', at: x.at, key });
    } else if (x.who === 'player' && x.kind === 'card') rows.push({ kind: 'card', text: x.text ?? '', key });
    else if (x.who === 'player' && x.kind === 'observation') rows.push({ kind: 'words', text: x.text ?? '', key });
    else if (x.who === 'player' && x.kind === 'direction') rows.push({ kind: 'direction', text: x.text ?? '', key });
    else if (x.who === 'player') rows.push({ kind: 'mine', text: x.text ?? '', key });
    else rows.push({ kind: 'said', text: x.text ?? '', at: x.at, key });
  });
  return rows;
}

/** Is any part waiting on the player's confirm (state `suggested`)? — the server's states, read. */
export const hasSuggestedPart = (thesis) => THESIS_PARTS.some((p) => thesis?.parts?.[p]?.state === 'suggested');
