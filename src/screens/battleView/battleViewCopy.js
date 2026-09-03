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

import { etTime } from '../../components/Dashboard/desk/deskCopy';

const money = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const BATTLE_VIEW_COPY = Object.freeze({
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
    const t = etTime(iso);
    return t ? `From the ${t} check` : null;
  },
  // The door out of the extract and into the whole paragraph (the book panel).
  readFullCheck: 'Read the full check',
  // A truthful state, not an absence of data: the check recorded words, and
  // none of its sentences named this piece. The full paragraph is one tap away.
  notNamedAtCheck: (iso) => {
    const t = etTime(iso);
    return t ? `Not named at the ${t} check` : null;
  },

  // Why the tick ran at all (A2.1, D-78). `evaluation.triggers` persists the
  // TYPES only (agent-evaluate.js:2651 `triggers.map(t => t.type)`); the detail
  // string is not persisted, so the copy names the type and nothing more. A
  // trigger wakes the decider — it is not a rule the agent acts on, and this
  // line never becomes an "alert level".
  //
  // ONE type has a ruled string. api/_utils/agentTriggerGate.js also persists
  // `forced_open`, `forced_close`, `threshold_proximity`, `bench_outperformance`,
  // `vwap_deviation`, `bandwidth_squeeze`, `nr7_contraction` and `news_catalyst`;
  // each needs its own founder-ruled sentence (proposals are in the A2 handover).
  // An unruled or unknown type renders NOTHING — never a raw type string.
  wokenByType: Object.freeze({
    price_drop: 'Woken by a price drop',
  }),
  wokenBy: (triggers) => {
    if (!Array.isArray(triggers)) return null;
    for (const type of triggers) {
      const line = BATTLE_VIEW_COPY.wokenByType[type];
      if (line) return line;
    }
    return null;
  },

  // The panel header names the CHECK (the tick), never the piece: the tick's
  // rationale is the agent's reasoning for the book at that check, and the
  // header must not imply a per-position record that does not exist.
  atCheck: (iso) => {
    const t = etTime(iso);
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
    const next = etTime(nextIso);
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
