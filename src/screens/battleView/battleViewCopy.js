// src/screens/battleView/battleViewCopy.js
//
// EVERY user-visible string the Battle View controller renders that is not
// already a Desk posture string lives here (Phase A rulings §3.4). The three
// shipped posture strings and the two Phase A additions (late, closed) stay in
// deskCopy.js so the Desk and the turn line cannot disagree (D-62); this
// module holds what is Battle-View-only: Why?, the receipts, the doors, Game
// Tape, This turn. deskHonesty.test.js scans this file and every component in
// this directory for the forbidden agent verbs — see that file's header for
// the rules and why each exists. In short:
//
//   1. SCOREBOARD LANGUAGE ONLY. Distance to a scoring tier is a fact; distance
//      to a trade is a forecast and never ships.
//   2. NO AGENT VERBS between checks. The agent acts at confirmed checks and
//      does nothing in between; nothing here implies otherwise.
//   3. RECEIPTS ARE PROVEN OR ABSENT (D-51): `Filed · Acted · Replaced ·
//      Expired`, and — since Phase B — `Heard`. Filed is not heard; heard is
//      not will-do. `Heard` is now PROVEN and therefore allowed, with its
//      claim fixed at exactly one thing (D-110): the thread was in the
//      decider's prompt at that check, proven by the cron's own stamp. It is
//      never upgraded to considered, used, noticed, understood or decided
//      because, and a withheld directive gets the reasonless system line
//      (`NOT_HEARD_LINE`), never one of the four resolver words. `Holding`,
//      `Declined`, `Honored`, `Superseded` remain unproven and stay out.
//   4. THE AGENT'S OWN WORDS ONLY (C1): Why? quotes `rationale` verbatim and
//      never paraphrases it; the labels around it are scoreboard facts.
//
// Every string is a REQUEST to the design chat; change them here, never inline.
//
// A CHECK IS NAMED BY ITS SLOT (D-83). Four labels here name a check —
// `fromCheck`, `notNamedAtCheck`, `atCheck` (which `checkCardLabel` composes)
// and `nothingQueued`'s `next check ~` — and all four take `slotLabel` rather
// than `etTime`, so a tick is called the same thing wherever it appears. The
// labels that name something OTHER than a check keep the exact minute, on
// purpose: `tradeLine` / `tradeCardLine` (a swap EXECUTES at an instant),
// `filed` / `replaced` (a chat exchange), `factHeldSince` (an entry).

import { etTime } from '../../components/Dashboard/desk/deskCopy';
import { slotLabel } from './deriveTurnLine';
// Phase C §1 — the door's integer comes from the ONE cap display function
// (D-122): server, client and tests share it, so `Show it · 1 of 3` cannot
// drift from what the route enforces (BUILD_RULES §9).
import { RESEARCH_CAP, researchDoorOrdinal, researchDoorEnabled } from '../../data/researchCap';
// The persisted decision record's SHARED vocabulary (voice-grounding hazard
// 26): the strings the narrator's YOUR RECORD block renders too live in the
// zero-import src/data/decisionRecord.js and are re-exposed here under their
// shipped names, so the pane and the narrator cannot disagree about one check.
import {
  WOKEN_BY_TYPE,
  wokenBy as recordWokenBy,
  NO_DECISION,
  NO_DECISION_OUTAGE,
  NO_DECISION_INCOMPLETE,
  HELD_LABEL,
  swappedLabel as recordSwappedLabel,
  DOWNGRADED_LABEL,
  FAILED_LABEL,
  MOTIVE_AGENT,
  MOTIVE_SYSTEM,
  GUARDRAIL_TYPE_WORDS,
  tierLabel as recordTierLabel,
  planAtDeployLabel,
  filesChip as recordFilesChip,
  filedLabel,
  heardLabel,
  NOT_HEARD_LINE,
  evidenceHeading,
  evidenceFacts as recordEvidenceFacts,
  provenanceLine,
  regimeWord,
  regimeLabel as recordRegimeLabel,
  NO_CHANGE_STATUS_LINE,
  FILING_CONFLICT_LINE,
  FILING_BUDGET_LINE,
  FILING_REJECTED_LINE,
  FILING_FAILED_LINE,
  filingFailureLine as recordFilingFailureLine,
  GUARDRAIL_FORCED_FAILED_LABEL,
} from '../../data/decisionRecord';

/**
 * "Sep 1" — an ET calendar date, for a fact that is about a DAY (the deploy)
 * rather than an instant. deskCopy owns the time formatters both surfaces
 * share; this one is Battle-View-only, so it lives here with its one caller.
 */
const etDate = (raw) => {
  if (raw == null) return null;
  const d = raw?.toDate?.() ?? new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
};

/**
 * A tier key as the word a player reads on the tier header.
 *
 * SHARED by `atDeployTier` (A2.1b) and `tradeCardLine` (A2.2), and written as
 * a FUNCTION for a git reason as much as a style one (review L5-F1). A2.1b
 * introduced this mapping as a frozen object, A2.2 then consumed it, and
 * `git revert` of A2.1b — which D-76 requires to stay possible in isolation —
 * AUTO-MERGED that declaration away and left every trade card throwing at
 * render, with no conflict to warn anyone.
 *
 * What the rewrite bought, measured rather than assumed (review FIX-6): the
 * revert now CONFLICTS instead of corrupting. It is five conflicted files, not
 * a clean apply — `tierLabel` still falls inside a hunk git groups with the
 * A2.1b copy helpers, so a reviewer must resolve it by KEEPING `tierLabel` and
 * dropping `etDate` / `planAtDeploy` / `atDeployTier`. Resolved that way the
 * suite is green. Loud and correct beats silent and broken; it is not clean.
 */
function tierLabel(tier) {
  return recordTierLabel(tier);
}

const money = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const BATTLE_VIEW_COPY = Object.freeze({
  // A PRICE, as this screen writes one (A2.3 review L5-F6). The row's current
  // price and the panel's `Bagger $ · Bust $` / `Entry $` are the same class of
  // number about the same piece, two lines apart — `src/utils/formatters.js`'s
  // `formatPrice` is `$${n.toFixed(2)}`, which drops the thousands separator
  // and made NVDA read `$1234.50` on the row beside `Entry $1,234.50` in the
  // panel. One formatter, so they cannot disagree (BUILD_RULES §9).
  price: (value) => money(value),

  // ── Why? (A2) ──────────────────────────────────────────────────────────────
  // The verb on a piece. Free — a pure read of persisted decision-path text.
  why: 'Why?',

  // ── Why? V2 — the piece's lines (A2.1, D-75, ruling 1) ────────────────────
  // The two SCORING tiers as prices: `thresholdBaseline × (1 ± baseATR/100)`,
  // the exact inverse of the percent the row already renders beside them and
  // the same formula the levels cron applies to V4 battles
  // (api/cron/compute-daily-baggerbomb-levels.js). Arithmetic on two persisted
  // values, never a third source — no agent battle persists a dollar level
  // (Phase 0 §2.1). NO stop line and NO alert line: the stop's entry basis is
  // fenced-private arithmetic (D-79) and `-0.5× ATR` is a wake-up trigger, not
  // a rule the agent acts on (D-78). Nothing here is estimated.
  tierPrices: (bagger, bust) => {
    const b = money(bagger);
    const s = money(bust);
    return b && s ? `Bagger ${b} · Bust ${s}` : null;
  },
  // The footer names where the two numbers come from, so the player can tell a
  // scoreboard fact from a trading level. There is no second source to name.
  fromScoringPath: 'from the scoring path',

  // The row's decision block (A2.1). The row carries the sentences that name
  // THIS piece — an extract — so its eyebrow says where they came from; the
  // book panel keeps `atCheck` below, because it IS the whole check.
  fromCheck: (iso) => {
    const t = slotLabel(iso);
    return t ? `From the ${t} check` : null;
  },
  // The door out of the extract and into the whole check — which, since D-89,
  // is the check's own CARD in the conversation, not the panel at the top of
  // the board. The words stay the same because what the player asked for did
  // not: they want the whole check, and the tape is where it lives whole,
  // beside the checks either side of it. The panel above the board carries the
  // book's latest check and opens collapsed; it was never the place a row's
  // reader was heading.
  readFullCheck: 'Read the full check',
  // A truthful state, not an absence of data: the check recorded words, and
  // none of its sentences named this piece. The full paragraph is one tap away.
  notNamedAtCheck: (iso) => {
    const t = slotLabel(iso);
    return t ? `Not named at the ${t} check` : null;
  },

  // Why the tick ran at all (A2.1, D-78). `evaluation.triggers` persists the
  // TYPES only (agent-evaluate.js:2651 `triggers.map(t => t.type)`); the detail
  // string is not persisted, so the copy names the type and nothing more. A
  // trigger wakes the decider — it is not a rule the agent acts on, and this
  // line never becomes an "alert level".
  //
  // ALL NINE persisted types are now ruled (D-81; the addendum's ruling 2
  // accepted the A2 handover's §5 proposals with one edit — `near`, not
  // `nearing`, because a piece's distance to a tier is a STATE and `nearing`
  // is a motion the surface cannot see). Each names a FACT ABOUT WHY THE
  // MODEL WAS WOKEN and never what it will do: a trigger is the gate's reason
  // for running the tick, not a rule the agent acts on (D-78).
  //
  // An UNKNOWN type still renders NOTHING — never a raw type string. The gate
  // is the only writer, and a tenth type added there arrives here unruled and
  // silent until it has its own sentence.
  wokenByType: WOKEN_BY_TYPE,
  wokenBy: (triggers) => recordWokenBy(triggers),

  // ── The guardrail's provenance code, in plain words (A2.3, D-80, ruling 1) ─
  // The cron composes a forced exit's rationale as
  // `Guardrail override (${result.sourceNote || 'hard'}): ${overrideNote}`
  // (api/cron/agent-evaluate.js:2124), so the guardrail module's own
  // `guardrail_${forcedType}` token (api/_utils/agentGuardrails.js:495 / :558)
  // rides INSIDE the sentence C1 renders verbatim. The table that translates
  // it, the ruling that separates the two rules, and the reason the three
  // words are the founder's existing swap-ledger taxonomy all moved to
  // src/data/decisionRecord.js beside `renderMotive` (voice-grounding hazard
  // 26: the narrator's YOUR RECORD block renders the same sentence on the
  // server). Re-exposed here under its shipped name — `COPY.guardrailTypeWords`
  // and its source tripwire in TapeCards.render.test.jsx are unchanged.
  guardrailTypeWords: GUARDRAIL_TYPE_WORDS,

  // ── The plan at deploy (A2.1b, D-76) ──────────────────────────────────────
  // The deploy decision's own persisted output, frozen at creation and in
  // front of the decider on every tick. It is HISTORY: every label carries the
  // deploy date so it can never read as a decision made now. Gated by
  // selectDeployPlan.js — a tournament battle's plan and the algorithmic
  // fallback's template are SYSTEM strings and never render (C1).
  // Null — the caller omits the section — when there is no deploy date to
  // stamp (review L5-F6). D-76 requires the date precisely so the block reads
  // as history; an undated `The plan at deploy` is a string the ruling does
  // not contain, and the honest branch is the one `tierPrices` already takes
  // when its inputs are missing: render nothing rather than something weaker.
  planAtDeploy: (iso) => planAtDeployLabel(etDate(iso)),
  // A row shows only its TIER's rationale, and only the sentences of it that
  // name the row's piece. The label says "tier" out loud, because the sentence
  // was written about the tier — never about this position alone.
  atDeployTier: (tier) => {
    const label = tierLabel(tier);
    return label ? `At deploy · ${label} tier` : null;
  },

  // The panel header names the CHECK (the tick), never the piece: the tick's
  // rationale is the agent's reasoning for the book at that check, and the
  // header must not imply a per-position record that does not exist.
  atCheck: (iso) => {
    const t = slotLabel(iso);
    return t ? `At the ${t} check` : null;
  },

  // The three decision states, in the order the panel branches: downgraded
  // FIRST (hazard 2 — a swap the model argued for that a guardrail held still
  // carries a swap rationale), then the decision.
  downgradedLabel: DOWNGRADED_LABEL,
  downgradedFooter: 'The agent\'s own words · the system held it',

  // The FOURTH state (A4.0, D-66). `downgraded === true` is also stamped when
  // executeSwapServer threw (agent-evaluate.js: `validationErrors[0]` =
  // `Swap execution failed: …`) — no guardrail held anything; the swap the
  // agent argued for simply did not go through. selectWhyState.js branches
  // on that prefix, so the guardrail label never over-claims on this path.
  failedLabel: FAILED_LABEL,
  failedFooter: 'The agent\'s own words · the position stayed as it was',

  // The FIFTH state (A2.0, D-70). A guardrail — not the agent — called for the
  // swap: applyGuardrails returned SWAP with `sourceNote: guardrail_*` and a
  // `forced_exit` override, the cron OVERWROTE the rationale with its own
  // `Guardrail override (…): …` text, and the swap was then blocked (a
  // distressed replacement, validation) or threw. Under the fourth state's
  // words that tick read `Argued for a swap · The agent's own words` over text
  // the agent never wrote (A4 handover item 21). The subject is the guardrail
  // and the footer names whose reason follows.
  guardrailForcedFailedLabel: GUARDRAIL_FORCED_FAILED_LABEL,
  guardrailForcedFailedFooter: 'The guardrail\'s reason · the position stayed as it was',
  heldLabel: HELD_LABEL,
  swappedLabel: (symbolOut, symbolIn) => recordSwappedLabel(symbolOut, symbolIn),

  // The absence state is a real state, not a failure (honesty rule 7): the
  // tick ran (lastScoredAt advanced) and recorded no evaluation entry.
  noDecision: NO_DECISION,
  // The more specific absence (A4.0, D-65): the latest entry carries
  // `haikuError` with `failureClass: 'timeout'` — the model call timed out
  // and the tick defaulted to HOLD with the system's placeholder words. The
  // fact is persisted on the entry itself; the label states it and nothing
  // more. Every other outage class takes the class-neutral line below (D-69).
  noDecisionOutage: NO_DECISION_OUTAGE,
  // Every OTHER outage class (A2.0, D-69): `budget_skipped`, `truncated_response`,
  // an HTTP status, an error's class name, `unknown`. The tick recorded an entry
  // whose words are the cron's placeholder, so a decision is still absent — but
  // "timed out" would name a verb the evidence does not support (honesty rule 8,
  // A4 review L1-F1). `did not complete` is true of every class including the
  // timeout; the timeout keeps the more specific line above.
  noDecisionIncomplete: NO_DECISION_INCOMPLETE,

  // Trades on this piece today — the section heading; each line is the swap
  // receipt's own time, symbols and reason (engine text, verbatim).
  thisPieceToday: 'This piece today',
  tradeLine: (iso, symbolOut, symbolIn) => {
    const t = etTime(iso);
    const pair = `${symbolOut ?? '—'} → ${symbolIn ?? '—'}`;
    return t ? `${t} · ${pair}` : pair;
  },

  // Facts — scoring facts about the piece. NO lock line: the row has no lock
  // tag and none is computed (hazards 6, 16). Distance to the next tier is the
  // row's own rendered proximity text, passed in, never re-derived.
  factEntry: (price) => {
    const m = money(price);
    return m ? `Entry ${m}` : null;
  },
  factHeldSince: (iso) => {
    const t = etTime(iso);
    return t ? `Held since ${t}` : null;
  },

  // The one door (D-45, D-53): the follow-up field, prefilled with a string
  // the user edits and sends through the shipped chat path. Costs a message.
  askFollowUp: 'Ask a follow-up · 1 message',
  followUpPrefill: (symbol) => `About ${symbol} — `,

  // ── The piece scope (A2.3, D-73) ──────────────────────────────────────────
  // The SECOND door: how much of the conversation is about this piece, and the
  // way into it. `n` is the LENGTH of the list the tap opens (scopeTape.js) —
  // never a second count — so the number and the filter cannot drift as rules
  // (BUILD_RULES §9); see that module's header for the one input they do not
  // share. Zero is a real answer and still renders: `In the chat · 0` says
  // something true about the piece, and the tap opens the WHOLE tape at its
  // composer prefill rather than a filter onto nothing (seed §A2.3). Free — a
  // count of what is already on screen.
  inTheChat: (n) => (Number.isFinite(n) ? `In the chat · ${n}` : null),
  // The chip on the scoped stream. `All` is the way OUT — the whole tape —
  // and it is a noun about the display, never a claim about the battle.
  scopeChip: (symbol) => (symbol ? `${symbol} · All` : null),
  // The two ACCESSIBLE names for the scope's ends (review RB-F10). Neither
  // visible label says what its button does: `In the chat · 2` reads as a
  // count and `NVDA · All` as a label, so a screen reader announced a number
  // and a word where a filter was about to be applied or cleared. Named for
  // the ACTION, exactly as `whyName` and `sheetHandleName` are.
  scopeDoorName: (symbol, n) => (Number.isFinite(n)
    ? `Show the ${symbol} messages · ${n} in the chat`
    : null),
  scopeChipName: (symbol) => (symbol ? `Showing ${symbol} only · show the whole tape` : null),

  // ── Show it (Phase C §1, D-116 / D-122) ───────────────────────────────────
  //
  // THE SECOND VERB. Tap a name and the platform shows you what it knows. Two
  // surfaces wear the words and they are deliberately different:
  //
  //   · the CHIP the character offers in the conversation names the NAME
  //     (`Show it · MPC`) — the chip's whole job is to say which piece;
  //   · the DOOR on a piece's own panel names the COST (`Show it · 1 of 3`),
  //     the D-31 cost-before-the-tap idiom `Ask a follow-up · 1 message` uses,
  //     because the panel is already about that piece and the scarce thing is
  //     the read.
  //
  // The door's integer is the ORDINAL OF THE NEXT CARD from the one shared
  // display function (src/data/researchCap.js, D-122) — never a second count
  // (BUILD_RULES §9). The exhausted door reads `3 of 3` exactly as the last
  // enabled one does and is distinguished by being disabled, so the text is
  // read off `used` alone and the enabled state off `researchDoorEnabled`.
  showItChip: (symbol) => (typeof symbol === 'string' && symbol.trim() ? `Show it · ${symbol.trim()}` : null),
  showItDoor: (used) => `Show it · ${researchDoorOrdinal(used)} of ${RESEARCH_CAP}`,
  // The ACCESSIBLE name (the scopeDoorName rule): the visible label reads as a
  // ratio, so a screen reader would announce two numbers where a read is about
  // to be spent. Named for the ACTION and for the name it acts on.
  // The exhausted state rides the NAME, not a `title` (review F-8). `aria-label`
  // wins the accessible-name computation, so a `title` beside it is a
  // description many AT pairings never announce; a `disabled` button is out of
  // the tab order, so a keyboard user cannot focus it to surface a tooltip; and
  // `title` never appears on touch at all. Without this, those users learn the
  // door is spent only from `opacity: 0.5` and a tap that does nothing — which
  // is indistinguishable from a broken button.
  showItDoorName: (symbol, used) => {
    const s = typeof symbol === 'string' ? symbol.trim() : '';
    if (!s) return null;
    const base = `Show the platform's data on ${s} · read ${researchDoorOrdinal(used)} of ${RESEARCH_CAP}`;
    return researchDoorEnabled(used) ? base : `${base} — ${BATTLE_VIEW_COPY.showItExhausted}`;
  },
  // The exhausted door's own line — the only place the three-of-three state
  // says anything the enabled door does not. It states the fact, never a
  // remedy the platform does not have.
  showItExhausted: 'All 3 reads used in this battle.',
  // The one failure line the client can be held to (the filingFailureLine
  // rule): it says the read did not happen and nothing about why the platform
  // thinks that.
  showItFailed: 'That read didn\u2019t come back. Try again.',
  // D-54's forward path, as a word on the card. `Equip` is the shipped verb for
  // putting a name in front of the agent; the card offers it and never promises
  // what the process will do with it.
  showItEquip: 'Equip',
  // What the scoped stream announces when the filter lands or lifts. A live
  // region, so it is spoken without moving focus — which the door does not
  // move to the stream anyway (it goes to the composer, with the prefill).
  scopeAnnounce: (symbol, n) => (symbol
    ? `Showing ${n} ${symbol} ${n === 1 ? 'entry' : 'entries'}`
    : 'Showing the whole tape'),

  // ── What KIND of entry this is (flip-prep, extends D-84) ──────────────────
  //
  // D-84 made the tape's four visual CLASSES unmistakable — speech, the
  // player's messages, engine records, directive cards. This names the kinds
  // INSIDE the speech class, which the eye cannot separate: a bench note, a
  // trade narration, the seeded opener and an answer to something the player
  // typed all arrive as the same left bubble in the same voice, and only the
  // record says which is which.
  //
  // FROM THE PERSISTED TYPE, NEVER FROM THE TEXT. Every value below is one the
  // server writes on the exchange itself — `first_message` (decide.js:1639,
  // ensure-opener.js:114), `anticipation` (voiceLayerAnticipation.js:200),
  // `trade_narration` (voiceLayerTradeNarration.js:203) — so an eyebrow is a
  // fact about the record rather than a reading of the prose. Guessing from
  // the words is exactly the class of inference hazard 24 forbids elsewhere on
  // this screen, and it would be wrong the moment a character mentions the
  // bench in an ordinary reply.
  //
  // AN UNKNOWN TYPE GETS NO EYEBROW. A new server type must reach the design
  // chat and get a word before it reaches the screen; falling back to a
  // neighbour's label would put a name on something nobody has named.
  //
  // `auto_debrief` is deliberately absent: it already has the shipped
  // `Post-Market Debrief` eyebrow (RENDER_CONFIG), and one exchange with two
  // eyebrows is worse than one with none.
  tapeKindEyebrow: (messageType, hasUserHalf, anticipationDirection = null, grounded = false) => {
    if (messageType === 'first_message') return 'Opener';
    // `Bench note` IS the bench's word, and the record splits the kind in two
    // (review L1-F1). `anticipationCandidates[].direction` is a required enum:
    // `potential_entry` is a bench candidate worth bringing in — a bench note,
    // exactly as ruled — while `potential_exit` is an ACTIVE HOLDING whose
    // signal profile degraded enough that leaving is plausible. That second
    // one is a note about a piece in the player's OWN BOOK, and calling it a
    // bench note is the reading-the-prose error this map exists to avoid, one
    // level down: the record disambiguates and the label ignored it.
    //
    // Only the ruled case gets the ruled word. The other gets NOTHING, by the
    // same rule an unknown type does — a word for it has to be ruled before it
    // reaches the screen, and inventing one here would be the guess. Recorded
    // for the founder; a direction-aware pair is one line when there is a
    // second word to use.
    //
    // THE SECOND WORD IS NOW RULED (voice-layer grounding spec §5, the Sep 7
    // founder adoption): a `potential_exit` note is about a piece in the
    // player's OWN BOOK, and its word is `Holding note` — for a note produced
    // UNDER THE GROUNDING CONTRACT (`grounded`: the exchange carries the
    // marker). A legacy, model-written exit note keeps no eyebrow, exactly as
    // shipped, so the flag-off page is byte-identical and the word is never
    // put on a forecast the retired prompt wrote (review R-02). A record with
    // no direction still gets nothing.
    if (messageType === 'anticipation') {
      if (anticipationDirection === 'potential_entry') return 'Bench note';
      if (anticipationDirection === 'potential_exit') return grounded ? 'Holding note' : null;
      return null;
    }
    if (messageType === 'trade_narration') return 'Trade note';
    // `research` is DELIBERATELY ABSENT from this map, exactly as `auto_debrief`
    // is: the research card carries its OWN `Research` eyebrow, composed onto it
    // by the server (decisionRecord.js RESEARCH_EYEBROW), and one exchange with
    // two eyebrows is worse than one with none — a second one here would also be
    // a second source for the same word (BUILD_RULES §9). An explicit `return
    // null` for it was REMOVED (review F-7): the fall-through already returns
    // null for every unnamed type, so the line could not fail under its own
    // deletion, and §2 says a branch that cannot fail is not a guard. The rule
    // lives here, in the same place `auto_debrief`'s does.
    // `Reply` is a claim about a PAIR — the player wrote and the character
    // answered — so it needs the user half to exist. `deriveChatMessages`
    // defaults a legacy exchange with no type to `user_initiated`, and one of
    // those with no `userMessage` is an agent-initiated exchange nobody
    // labelled: calling its answer a reply would invent the question.
    if (messageType === 'user_initiated' && hasUserHalf) return 'Reply';
    return null;
  },

  // ── The tape (A2.2, D-72 / D-77) ──────────────────────────────────────────
  // A trade card per EXECUTED swap: when, the pair, the tier. The tier is the
  // scoring tier the closed position sat in, from the trade record itself.
  tradeCardLine: (iso, symbolOut, symbolIn, tier) => {
    const t = etTime(iso);
    const pair = `${symbolOut ?? '—'} → ${symbolIn ?? '—'}`;
    return [t, pair, tierLabel(tier)].filter(Boolean).join(' · ');
  },
  // The points the closed position locked in — a scoreboard fact, from the
  // trade record's own `lockedPoints`. Absent when the record carries none.
  banked: (points) => {
    if (typeof points !== 'number' || !Number.isFinite(points)) return null;
    return `Banked ${points.toFixed(1)} pts`;
  },
  // WHOSE WORDS the motive is (ruling 5). The engine writes the rationale on
  // the risk loop, the guardrail path and the R11 pass; only the model's own
  // swap carries the agent's argument. An unlabelled system sentence under
  // the agent's name is the C1 failure this pair exists to prevent.
  motiveAgent: MOTIVE_AGENT,
  motiveSystem: MOTIVE_SYSTEM,
  // The shipped echo on a swap the model attributed to a directive (D-51's
  // `Acted`, unchanged wording).
  fromDirective: '↳ from directive',

  // A check card per decided check: what KIND of entry it is, the tick's own
  // slot, and its state label, in one line — then the first sentence of the
  // rationale. `Status check` is the check card's answer to the same question
  // `Bench note` and `Opener` answer for the speech kinds: a stream of records
  // and bubbles should say what each thing IS without the player parsing it.
  //
  // TWO DEFENSIVE BRANCHES CAME OFF (review L4-F9). `!t` and `!label` were both
  // unreachable from the only caller: `buildCheckEntries` emits an entry only
  // when the instant is readable, and `selectWhyState` sets a label on every
  // branch it can return. Three mutations walked the suite through them, which
  // is what an unreachable branch always does — §2's rule is that a branch
  // which cannot fail is not a guard, and an unreachable one cannot even be
  // reached to fail. The remaining `label &&` IS reachable and is the
  // absence-label rule.
  checkCardLabel: (iso, label) => {
    const t = slotLabel(iso);
    // THE TWO ABSENCE LABELS ALREADY END IN "at this check" (D-65, D-69), so
    // the kind word in front of them says "check" twice in one line (the
    // stutter review L5-F7 found in the previous composition, in its new
    // shape). The slot alone carries the same fact, and the ruled string is
    // untouched — those two are the founder's words and rewording them to fit
    // an eyebrow would be a ruling, not a composition.
    if (label.includes('at this check')) return `${t} · ${label}`;
    return `Status check · ${t} · ${label}`;
  },
  readMore: 'Read more',
  // D-89 — the book panel's own close. The glyph is decorative; this is the
  // accessible name, and it says what the control does rather than naming the
  // shape it is drawn as. Focus returns to the score header that opened it,
  // which is the disclosure contract the header's `aria-expanded` promises.
  closeWhyBookName: 'Close the check',
  // A run of consecutive checks that changed nothing a player can see (D-77):
  // HOLD, not downgraded, no outage, banked score unchanged, the position set
  // unchanged and the directive disposition unchanged. The live TOTAL is
  // deliberately not among them — it moves with price on nearly every tick,
  // and the board already shows it.
  checksNoChange: (n) => `${n} checks · no change`,

  // ── This turn (A3) ─────────────────────────────────────────────────────────
  // Strict membership (D-49): only the current directive. `Filed {t}` is the
  // filing EXCHANGE's timestamp. No "for the ~{t} check" — filed is not heard
  // (hazard 3). Empty is a truthful state, stamped with the adapter's next.
  thisTurn: 'This turn',
  filed: (iso) => filedLabel(etTime(iso)),
  nothingQueued: (nextIso) => {
    const next = slotLabel(nextIso);
    return next ? `Nothing queued · next check ~${next}` : 'Nothing queued';
  },

  // ── Receipts (A3, D-51 / D-60) ─────────────────────────────────────────────
  // `Filed · Acted · Replaced · Expired`. Acted is the shipped `↳ from
  // directive` on a statusFeed swap entry (AgentChat.jsx) and stays there.
  // Replaced shows text and time only — never "never seen". Expired is the
  // bare word: it is a battle-complete fact, not a time.
  // The directive card's eyebrow under the controller flag (A4.0, D-68): the
  // receipt line carries the state, so the eyebrow names the thing, not a
  // state (`DIRECTIVE LOCKED IN` above `Replaced {t}` contradicted itself).
  // Flag-off keeps the shipped label byte-for-byte until bug 2's own PR.
  directiveEyebrow: 'Directive',
  replaced: (iso) => {
    const t = etTime(iso);
    return t ? `Replaced ${t}` : 'Replaced';
  },
  expired: 'Expired',

  // ── Heard (Phase B, seed §1; D-110) ───────────────────────────────────────
  // The receipt's second line. `Heard at the {slot} check` when the record
  // proves the thread was in the decider's prompt at that check; the flat,
  // reasonless `Not heard at this check` when a directive existed and the
  // assembler withheld it (Sol M-1 — the four suppression words are telemetry,
  // never copy); NOTHING when no entry names the thread at all, which is the
  // honest answer for a filing that landed mid-tick and will be stamped on the
  // NEXT check.
  //
  // The slot goes through `slotLabel` like every other label that names a
  // check (D-83) — the same formatter the tape and the turn line use, so one
  // tick is called one thing everywhere (BUILD_RULES §9).
  heard: (iso) => heardLabel(slotLabel(iso)),
  notHeard: NOT_HEARD_LINE,

  /**
   * The second line for a receipt carrying a Heard stamp, or null.
   * Takes the whole receipt so the card and the strip cannot disagree about
   * which of the three outcomes they are in.
   */
  // ── What the check saw (Phase B, seed §2; D-111) ──────────────────────────
  // The evidence the decider's prompt rendered for this held piece, under a
  // heading that names the CHECK by its slot (D-83). The eight labels, the
  // `chg` carve-out and the risk carve-out all live in decisionRecord.js so
  // the narrator's record renders one check with one vocabulary (hazard 26).
  //
  // The provenance line is DETAIL, not a freshness promise: `techAt` is the
  // newest held technical document's stamp, `fundAsOf` the FUNDAMENTALS
  // block's own header date. Both name themselves; neither claims the eight
  // values are current as of anything (Sol M-2). These are DOCUMENT INSTANTS,
  // not checks, so they keep their exact minute like `tradeLine` and `filed`
  // — only a CHECK is named by its slot.
  evidenceHeading: (iso) => evidenceHeading(slotLabel(iso)),
  // The panel's facts, as ENTRIES rather than strings: `text` is the line the
  // decider's prompt printed, `label` the line a player reads, `title` the raw
  // token a translated label stands for. One walk feeds this and the
  // narrator's `evidenceFactLines` (decisionRecord.js), so the panel's regime
  // word and the prompt's regime token are the same token by construction.
  evidenceFacts: (evidence) => recordEvidenceFacts(evidence),
  // The check's own instant goes with it, so a vintage from another ET day
  // carries its date rather than reading as a time later today (review A-3).
  evidenceProvenance: (vintages, checkIso = null) => provenanceLine(vintages, etTime, checkIso),
  regimeWord: (value) => regimeWord(value),
  // `Expanding` — the shared player-facing word for a regime token, from the
  // one REGIME_LABELS map the two Agent feeds read too.
  regimeLabel: (value) => recordRegimeLabel(value),

  // THE POSITIVE TRAVELS, THE NEGATIVE STAYS PUT — the split review A-2 did
  // not make, and the reason A-2 itself gave for the scoping.
  //
  // `Heard at the {slot} check` NAMES ITS OWN CHECK. A thread that was in the
  // decider's prompt at the 12:45 check was in it at 12:45 whatever the card
  // now reads, so the line is true wherever it is read and the scrollback card
  // is exactly where that past fact is worth keeping: the receipt above it
  // says the directive is no longer the one in the slot, and this says it was
  // heard while it was. So the positive renders on ANY directive card whose
  // thread carries a null-suppression stamp — Replaced and Expired included.
  //
  // `Not heard at this check` is DEICTIC: it names no slot, so `this check`
  // can only mean the LATEST one. On a Replaced or Expired card that reading
  // is false — at the latest check the thread was not the directive at all and
  // the record says nothing about it — so the negative stays on the CURRENT
  // card, the `filed` receipt, exactly where A-2 put it. A replaced
  // directive's honest receipt for the latest check is `Replaced {t}`, which
  // the card already carries.
  //
  // The two are not symmetric because the two SENTENCES are not: one carries
  // its check with it and one borrows the reader's. That is the rule, not
  // which way the answer came out.
  heardLine: (receipt) => {
    const stamp = receipt?.heard;
    if (!stamp || typeof stamp !== 'object') return null;
    if (stamp.heard === true) return BATTLE_VIEW_COPY.heard(stamp.at);
    if (stamp.heard === false && receipt.state === 'filed') return BATTLE_VIEW_COPY.notHeard;
    return null;
  },

  // ── The chat's send failure (A2.3, addendum item 11) ──────────────────────
  // The shipped line is `Agent is thinking too hard. Try again.` — an agent
  // verb (honesty rule 2) on a sentence that is not even about the agent: the
  // model was never reached, so nothing it did or did not do explains the
  // failure. It also leaves the player unsure whether the message went, and
  // the founder's smoke found exactly that doubt: three failed sends, the
  // budget still reading 0/10.
  //
  // The line first said two things — the character could not answer, and
  // `· nothing was sent`. THE SECOND CLAUSE IS GONE (flip-prep item 5), and it
  // is worth saying why, because it was the half the ruling cared about.
  //
  // The justification was that the budget is prop-driven from the server's own
  // write and a failed request produces no write. That is false. In
  // `api/agent/chat.js` the durable write and the budget increment are ONE
  // `battleRef.update()` — `chatExchanges: arrayUnion(exchange)` beside
  // `[budgetField]: increment(1)` — INSIDE the `try` whose `catch` returns the
  // 500, so anything throwing after it returns 500 with the exchange appended
  // and the player charged. The same file flags exactly this asymmetry about
  // its League charge a few lines below and not about this one. Reproduced on
  // the real send path: `1/10` and "nothing was sent" on screen together
  // (A2 review RB-F4). The client's `catch` branch makes the same promise on
  // any network drop, which cannot prove the server did nothing either.
  //
  // Item 11's own reasoning is what condemns the clause: "a message the player
  // believes was spent is a message they will not send again". The mirror is
  // worse — a message that WAS spent, believed free, re-sent, charged twice
  // out of ten — and it is the one this sentence was causing.
  //
  // So the line says only what the client can see. `nothing was sent` comes
  // back when the server attests to it, and that attestation rides the P-1
  // concurrency branch. Flag-off keeps the shipped string until bug 2's own PR.
  chatSendFailed: 'The character couldn\'t answer just now',

  // ── The arena header (A3.0, D-96) ──────────────────────────────────────────
  // The score header becomes the arena: the player's side tinted --ft-teal, the
  // CPU's --ft-copper, the tug-of-war bar as the seam between them.
  //
  // `VS` sits in the CENTRE slot so the accessible reading order is player →
  // VS → CPU, which is the order the eye takes and the order the scores mean.
  // Upper case, against the arena mock's lower-case `vs`: this is a scoreboard,
  // and the header's own name row is already upper case.
  //
  // `Tap for the book` is a NEW visible string. The book tap surface has shipped
  // since Phase A with an aria-label and nothing a sighted player could read —
  // the whole book's Why? was discoverable only by trying the header. Desktop
  // only: on a phone the header is tighter and the turn line has the row to
  // itself.
  arenaVs: 'VS',
  arenaBookHint: 'Tap for the book',

  // ── The character (A3.1, D-91 / D-98) ──────────────────────────────────────
  // The avatar is the ONE door to the conversation, so its accessible name says
  // what it opens, not what it is drawn as. The unread count rides that name
  // rather than living only in a badge — a badge is a shape, and a shape is not
  // a name.
  //
  // `{n} new` is the badge's own label (the seed's string). It never counts raw
  // feed actions: the number is the difference between what the TAPE renders and
  // what the reader has seen (D-88).
  paneName: 'The agent\'s pane',
  paneOpen: 'Open the agent\'s pane',
  paneUnread: (n) => `${n} new`,
  paneOpenName: (n) => (n > 0
    ? `${BATTLE_VIEW_COPY.paneOpen} · ${BATTLE_VIEW_COPY.paneUnread(n)}`
    : BATTLE_VIEW_COPY.paneOpen),
  // The bubble is a second door onto the same pane. Its name leads with the
  // kind it is showing, so a screen reader hears WHAT landed before it hears
  // what the control does; a bubble with no kind word (a folded run) names the
  // action alone rather than an empty prefix.
  paneBubbleName: (eyebrow) => (eyebrow
    ? `${eyebrow} · ${BATTLE_VIEW_COPY.paneOpen.toLowerCase()}`
    : BATTLE_VIEW_COPY.paneOpen),

  // ── The pane (A3.2, D-91 / D-93) ───────────────────────────────────────────
  // Three sections, three words. They are the tabs' visible labels AND their
  // accessible names — a segmented control is a real tablist here, so the word
  // the eye reads is the word a screen reader announces.
  paneSectionChat: 'Chat',
  paneSectionBench: 'Bench',
  paneSectionTape: 'Tape',
  // The way out, named for what it does on the shell it appears on. Desktop
  // COLLAPSES (the board takes the full width, the pane is still there); mobile
  // CLOSES (the pane was covering the board). Two words because they are two
  // different promises — the A2 containers' longer strings (`Collapse the
  // chat`, `Open the chat`) named a chat; these name a place.
  paneCollapse: 'Collapse',
  paneClose: 'Close',
  // The overflow's control (A3.5 fills it). Named for what it holds, not for
  // the three dots it is drawn as.
  paneMore: 'More',
  // A3.5 (D-95): the overflow holds `Report a bug` ALONE. The mock's title
  // offers `Read · Equip · Report a bug`; Read and Equip are not built. The
  // string is the widget's own aria-label (ClashBotWidget.jsx), taken from copy
  // here rather than left as a literal in two places.
  paneReportBug: 'Report a bug',

  // ── Bench (A3.3, D-92) ─────────────────────────────────────────────────────
  // `Not named at the {t} check` (notNamedAtCheck) already exists and is REUSED
  // — Bench is not allowed a second way of naming a check (D-83), and the
  // heading below takes its slot from the same `slotLabel`.
  //
  // The absence line is a truthful state, not an error: no entry today carries
  // words at all. It is deliberately NOT "the agent has not checked yet" —
  // ticks may well have run; what is absent is WORDS.
  benchNoCheck: 'No check yet today',
  // The heading over the names the decider named — the SLOT OF THE CHECK
  // ACTUALLY USED, not "the last check" (founder ruling Sep 4, on the review's
  // open question 2). Under the scan-back the words may come from a check that
  // is not the last one: the turn line can say `Checked 1:00 PM` while these
  // sentences are the 12:45 check's, and a heading that said "the last check"
  // was then simply false.
  //
  // ONE string, not two. The first draft paired `Named at the last check` with
  // a separate `At the {t} check` line beneath it, which said "check" twice in
  // two lines — the stutter review L5-F7 found in its own shape. The slot lives
  // in the heading now and the second line is gone.
  benchNamed: (iso) => {
    const t = slotLabel(iso);
    return t ? `Named at the ${t} check` : null;
  },
  // The section's subtitle: the equipped watchlist's BARE name. The header's
  // chip prefixes it with `Watchlist: ` (watchlistEquipUI.getEquippedWatchlistLabel);
  // here the section heading already says Bench, so the prefix would stutter.
  benchWatchlist: (name) => (name ? `${name} · equipped` : null),
  // The rest of the roster — the names this check did not mention.
  benchRest: 'The rest of the roster',
  // Phase B (seed §3, D-112): THE FACT OF THE FLAG, and nothing else. The
  // decider's own anticipation output named this bench name as a potential
  // entry at this check. Not "the agent is eyeing it", not "about to buy it",
  // not why — `signalSummary` and `threshold` are persisted and never render
  // here (D-103). One word, and it is a past fact about a check that has
  // already run, so it carries no forecast (the C1 rule the whole surface is
  // built on: distance to a scoring tier is a fact, distance to a TRADE is a
  // forecast and never ships).
  benchFlaggedChip: 'Flagged',

  // ── Tape (A3.4, D-94) ──────────────────────────────────────────────────────
  // The shipped Game Tape's content, moved into the pane and simplified: trade
  // cards, bookmarks, the activity log. The Time / P&L / Tier sort controls are
  // dropped (the seed), and so is the overlay's `Back to the battle` — there is
  // nothing to go back FROM once Tape is a section rather than a page.
  tapeTrades: 'Trades',
  tapeNoTrades: 'No trades yet',
  // THE BOOKMARK DOT'S NEW HOME (the founder's ruling on §4 #12). The header
  // link's dot said only "there is at least one"; as a section header it can
  // say how many, which is the same fact with the number restored. Nowhere on
  // the board.
  tapeBookmarks: (n) => (n > 0 ? `Bookmarks · ${n}` : 'Bookmarks'),
  tapeNoBookmarks: 'No bookmarks yet',
  // The shipped Game Tape's own fallback for a bookmarked entry that carries
  // no words (GameTapeView.jsx:413) — kept identical so one bookmark cannot
  // read two ways across the two surfaces.
  tapeBookmarkNoDetail: 'No details available',
  tapeUnbookmark: 'Remove this bookmark',
  tapeActivityLog: 'Activity log',
  tapeActivityShow: 'Show the activity log',
  tapeActivityHide: 'Hide the activity log',

  // ── The bagger moment (A3.6, D-97) ─────────────────────────────────────────
  // Two strings, both from PERSISTED scoring, both about one crossing.
  //
  // `{pts}` is THE BAGGER BADGE'S OWN BONUS — `THRESHOLD_POINTS.bagger`, +15,
  // the entry the scorer sums for this crossing and nothing else
  // (`calculatePointsServer`, api/_utils/agentScoring.js:95-97, called at :286;
  // the client twin is baggerBombUtils.js:285-289, called at :613). The caller
  // passes it: this module holds words, not scoring constants.
  //
  // IT USED TO BE THE CONVICTION TIER MULTIPLIER — `Bagger hit · {mult}× banked`,
  // ruling 8 as first ruled. The A3.6 review measured that the bonus is FLAT:
  // the tier multiplier scales `basePoints` only (agentScoring.js:267-270,
  // baggerBombUtils.js:584-587), never the badge bonus, so the line named a
  // number the scoring path never applied to the thing the line is about — one
  // row, two sources, the family BUILD_RULES §9 exists to close. Ruling 8 is
  // CORRECTED (Sep 7, 2026; PHASE_A3_RULINGS_AND_AMENDMENTS_V1.md §2 ruling 8):
  // the footer states the banked bonus, and states nothing the scorer did not
  // bank.
  //
  // `banked` stands unchanged: the persisted peak is monotonic within the day
  // (agent-evaluate.js:893-900, off the scorer's `effectiveMax`), so the badge —
  // and with it the flat bonus — cannot be taken back by a later fall.
  //
  // NO NUMBER, NO CLAIM ABOUT ONE. An unreadable amount leaves `Bagger hit`
  // alone rather than nothing at all: the crossing is persisted and true on its
  // own, and the amount is the only part that could be wrong. Whether the
  // crossing happened is still the caller's question, not this one's.
  //
  // `{pct}` is the bagger LINE, `+{baseATR}%` (ruling 9) — the persisted
  // threshold the row reads at that price, the same number deriveTierPrices
  // turns into `Bagger $`. Not the piece's current percent, which is a live
  // value and would disagree with the line the moment the price moved again.
  //
  // The PERCENT keeps its decimal — `+3.0%`, not `+3%` (review lens 5). Every
  // other percent in this view carries one (computeProximity.js:213-215), and
  // one number in a family reading differently is the seam a reader trips on.
  baggerFooter: (pts) => {
    if (typeof pts !== 'number' || !Number.isFinite(pts) || pts <= 0) return 'Bagger hit';
    return `Bagger hit · +${pts} banked`;
  },
  baggerBubble: (symbol, pct) => {
    if (typeof symbol !== 'string' || !symbol.trim()) return null;
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0) return null;
    return `Bagger · ${symbol.trim()} hit +${pct.toFixed(1)}%`;
  },
  // The bubble's own eyebrow, so it reads as a RECORD like the tape's cards do
  // rather than as speech (D-98: the kind carries its colour as text).
  baggerEyebrow: 'Bagger',

  // ── The layout (A4) ────────────────────────────────────────────────────────
  // Game Tape is ONE header link that opens the shipped view full-screen; the
  // way back names the page it returns to. No `···` menu (rulings §2.5).
  gameTape: 'Game Tape',
  gameTapeBack: 'Back to the battle',

  // The mobile chat sheet — a non-modal region with three detents. The cycle
  // control is named for what its NEXT activation does; the region carries
  // the name a screen reader lands on; `new activity` rides the control's
  // name while the unread dot shows (the dot itself is decorative).
  sheetName: 'Agent chat',
  sheetOpen: 'Open the chat',
  sheetGrow: 'Show more of the chat',
  sheetCollapse: 'Collapse the chat',
  // The desktop strip's control (A2.4). Named for what its next activation
  // does, exactly as the sheet's three are.
  sheetExpand: 'Expand the chat',
  sheetUnread: 'new activity',
  // The cycle control's whole name: the action, plus `new activity` while
  // the dot shows. Composed HERE so the rule lives with the words.
  sheetHandleName: (action, unread) => (unread ? `${action} · ${BATTLE_VIEW_COPY.sheetUnread}` : action),

  // Accessible names for the two Why? tap surfaces (A4.3, review F16): the
  // row button is named for its verb and its piece, the score header for the
  // book — a short name instead of the whole visible content of each.
  whyName: (symbol) => `Why? ${symbol}`,
  whyBookName: 'Why? · the whole book',

  // ── Filing a directive by chip (voice-layer grounding §6.2 / §6.3) ─────────
  // A directive chip says what it FILES; a filing's outcome says only what the
  // client can be held to. ONE source with the League arena (decisionRecord.js).
  filesChip: (text) => recordFilesChip(text),
  noChangeStatusLine: NO_CHANGE_STATUS_LINE,
  filingConflict: FILING_CONFLICT_LINE,
  filingBudget: FILING_BUDGET_LINE,
  filingRejected: FILING_REJECTED_LINE,
  filingFailed: FILING_FAILED_LINE,
  filingFailureLine: (status) => recordFilingFailureLine(status),

  receiptLine: (receipt) => {
    if (!receipt || typeof receipt !== 'object') return null;
    if (receipt.state === 'filed') return BATTLE_VIEW_COPY.filed(receipt.at);
    if (receipt.state === 'replaced') return BATTLE_VIEW_COPY.replaced(receipt.at);
    if (receipt.state === 'expired') return BATTLE_VIEW_COPY.expired;
    return null;
  },
});

export default BATTLE_VIEW_COPY;
