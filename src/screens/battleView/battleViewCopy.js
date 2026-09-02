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
  heldLabel: 'Held',
  swappedLabel: (symbolOut, symbolIn) => `Swapped · ${symbolOut ?? '—'} → ${symbolIn ?? '—'}`,

  // The absence state is a real state, not a failure (honesty rule 7): the
  // tick ran (lastScoredAt advanced) and recorded no evaluation entry.
  noDecision: 'No decision recorded at this check',

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
});

export default BATTLE_VIEW_COPY;
