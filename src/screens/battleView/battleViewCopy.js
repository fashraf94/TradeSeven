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
//      Expired`. Filed is not heard; heard is not will-do. No `Heard`,
//      `Holding`, `Declined`, `Honored`, `Superseded` (those are Phase B or
//      never).
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
  if (tier === 'star') return 'Star';
  if (tier === 'core') return 'Core';
  if (tier === 'support') return 'Support';
  return null;
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
  // The door out of the extract and into the whole paragraph (the book panel).
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
  wokenByType: Object.freeze({
    price_drop: 'Woken by a price drop',
    forced_open: 'Woken by the first check of the battle',
    forced_close: 'Woken by the final hour',
    threshold_proximity: 'Woken by a piece near a scoring tier',
    bench_outperformance: 'Woken by a bench name outrunning the book',
    vwap_deviation: 'Woken by a move away from the day\'s average price',
    bandwidth_squeeze: 'Woken by a volatility squeeze',
    nr7_contraction: 'Woken by a narrow-range day',
    news_catalyst: 'Woken by a news story on a piece',
  }),
  wokenBy: (triggers) => {
    if (!Array.isArray(triggers)) return null;
    for (const type of triggers) {
      const line = BATTLE_VIEW_COPY.wokenByType[type];
      if (line) return line;
    }
    return null;
  },

  // ── The guardrail's provenance code, in plain words (A2.3, D-80, ruling 1) ─
  // The cron composes a forced exit's rationale as
  // `Guardrail override (${result.sourceNote || 'hard'}): ${overrideNote}`
  // (api/cron/agent-evaluate.js:2121), so the guardrail module's own
  // `guardrail_${forcedType}` token (api/_utils/agentGuardrails.js:495 / :558)
  // rides INSIDE the sentence C1 renders verbatim. Two rules meet there: C1
  // says render the engine's motive verbatim, hazard 29 / D-64 say a
  // machinery-provenance code never reaches the screen (A2 review L5-F3, the
  // one finding recorded for a founder ruling rather than fixed).
  //
  // The ruling separates them. The guardrail TYPE is a fact a player can read,
  // so it is translated into the words that guardrail is called by; the
  // sentence keeps its shape and everything after the colon is untouched. Any
  // OTHER token — `guardrail_max_sector_weight`, the cron's own `hard`
  // fallback, anything added later — loses the parenthetical entirely, because
  // a code with no ruled words is not a fact a player can read. A raw
  // `guardrail_*`, and any `_`-joined code, never reaches the screen.
  //
  // The three words are NOT invented here: they are the founder's existing
  // taxonomy in src/components/League/battleArena/leagueSwapLedger.js:63-69,
  // where the same three `exitReason` stamps already render for the League
  // swap ledger. A source tripwire in TapeCards.render.test.jsx keeps the two
  // tables in step; the copy is not shared because that module's table answers
  // a different question (nine `exitReason` values, with a swapMotive
  // precedence rule) and importing it would drag that rule onto this surface.
  guardrailTypeWords: Object.freeze({
    guardrail_stopLoss: 'stop-loss',
    guardrail_trailingStop: 'trailing stop',
    guardrail_profitTarget: 'profit target',
  }),

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
  planAtDeploy: (iso) => {
    const d = etDate(iso);
    return d ? `The plan at deploy · ${d}` : null;
  },
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
  downgradedLabel: 'Argued for a swap · held by a guardrail',
  downgradedFooter: 'The agent\'s own words · the system held it',

  // The FOURTH state (A4.0, D-66). `downgraded === true` is also stamped when
  // executeSwapServer threw (agent-evaluate.js: `validationErrors[0]` =
  // `Swap execution failed: …`) — no guardrail held anything; the swap the
  // agent argued for simply did not go through. selectWhyState.js branches
  // on that prefix, so the guardrail label never over-claims on this path.
  failedLabel: 'Argued for a swap · it did not go through',
  failedFooter: 'The agent\'s own words · the position stayed as it was',

  // The FIFTH state (A2.0, D-70). A guardrail — not the agent — called for the
  // swap: applyGuardrails returned SWAP with `sourceNote: guardrail_*` and a
  // `forced_exit` override, the cron OVERWROTE the rationale with its own
  // `Guardrail override (…): …` text, and the swap was then blocked (a
  // distressed replacement, validation) or threw. Under the fourth state's
  // words that tick read `Argued for a swap · The agent's own words` over text
  // the agent never wrote (A4 handover item 21). The subject is the guardrail
  // and the footer names whose reason follows.
  guardrailForcedFailedLabel: 'A guardrail called for a swap · it did not go through',
  guardrailForcedFailedFooter: 'The guardrail\'s reason · the position stayed as it was',
  heldLabel: 'Held',
  swappedLabel: (symbolOut, symbolIn) => `Swapped · ${symbolOut ?? '—'} → ${symbolIn ?? '—'}`,

  // The absence state is a real state, not a failure (honesty rule 7): the
  // tick ran (lastScoredAt advanced) and recorded no evaluation entry.
  noDecision: 'No decision recorded at this check',
  // The more specific absence (A4.0, D-65): the latest entry carries
  // `haikuError` with `failureClass: 'timeout'` — the model call timed out
  // and the tick defaulted to HOLD with the system's placeholder words. The
  // fact is persisted on the entry itself; the label states it and nothing
  // more. Every other outage class takes the class-neutral line below (D-69).
  noDecisionOutage: 'No decision recorded at this check · the evaluation timed out',
  // Every OTHER outage class (A2.0, D-69): `budget_skipped`, `truncated_response`,
  // an HTTP status, an error's class name, `unknown`. The tick recorded an entry
  // whose words are the cron's placeholder, so a decision is still absent — but
  // "timed out" would name a verb the evidence does not support (honesty rule 8,
  // A4 review L1-F1). `did not complete` is true of every class including the
  // timeout; the timeout keeps the more specific line above.
  noDecisionIncomplete: 'No decision recorded at this check · the evaluation did not complete',

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
  // What the scoped stream announces when the filter lands or lifts. A live
  // region, so it is spoken without moving focus — which the door does not
  // move to the stream anyway (it goes to the composer, with the prefill).
  scopeAnnounce: (symbol, n) => (symbol
    ? `Showing ${n} ${symbol} ${n === 1 ? 'entry' : 'entries'}`
    : 'Showing the whole tape'),

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
  motiveAgent: 'The agent\'s own words',
  motiveSystem: 'The system\'s reason',
  // The shipped echo on a swap the model attributed to a directive (D-51's
  // `Acted`, unchanged wording).
  fromDirective: '↳ from directive',

  // A check card per decided check: the tick's own header and its state label,
  // in one line, then the first sentence of the rationale.
  checkCardLabel: (iso, label) => {
    const header = BATTLE_VIEW_COPY.atCheck(iso);
    if (!header) return label ?? null;
    if (!label) return header;
    // The two absence labels already END in "at this check" (D-65, D-69), so
    // the full header in front of them said "check" three times in one line
    // (review L5-F7). The time alone carries the same fact. Composed from the
    // ruled strings either way — no third string is invented here.
    if (label.includes('at this check')) {
      const t = slotLabel(iso);
      return t ? `${t} · ${label}` : label;
    }
    return `${header} · ${label}`;
  },
  readMore: 'Read more',
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
  filed: (iso) => {
    const t = etTime(iso);
    return t ? `Filed ${t}` : 'Filed';
  },
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

  // ── The chat's send failure (A2.3, addendum item 11) ──────────────────────
  // The shipped line is `Agent is thinking too hard. Try again.` — an agent
  // verb (honesty rule 2) on a sentence that is not even about the agent: the
  // model was never reached, so nothing it did or did not do explains the
  // failure. It also leaves the player unsure whether the message went, and
  // the founder's smoke found exactly that doubt: three failed sends, the
  // budget still reading 0/10.
  //
  // So the line says the two true things — the character could not answer,
  // and NOTHING WAS SENT. The second half is the one that matters, because a
  // message the player believes was spent is a message they will not send
  // again. The budget is prop-driven from the server's own write, and a failed
  // request produces no write, which is why the sentence can promise it.
  //
  // Flag-off keeps the shipped string until bug 2's own PR.
  chatSendFailed: 'The character couldn\'t answer just now · nothing was sent',

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

  receiptLine: (receipt) => {
    if (!receipt || typeof receipt !== 'object') return null;
    if (receipt.state === 'filed') return BATTLE_VIEW_COPY.filed(receipt.at);
    if (receipt.state === 'replaced') return BATTLE_VIEW_COPY.replaced(receipt.at);
    if (receipt.state === 'expired') return BATTLE_VIEW_COPY.expired;
    return null;
  },
});

export default BATTLE_VIEW_COPY;
