// src/components/League/backing/backingCopy.js
//
// Backing Beta PR 4 — EVERY user-facing string on the backing surfaces, in one
// module (the deskCopy.js precedent): the landing strip's four states, the pod
// list, the team card, the stake control, the attestation step, Your Backing,
// and the plain sentence for every refusal the stake endpoint can return.
//
// WHY ONE MODULE: the copy guard (backingCopy.guard.test.js, the deskHonesty
// shape) scans every backing UI file for the FORBIDDEN_TERMS in
// src/constants/backing.js — bet, wager, odds, cash out, win money, gamble —
// and a single home for the words is what makes that scan complete rather than
// hopeful. Brand discipline (spec V1.3 §5/§9): the lexicon is back / backing /
// backer / pool / pot / pays ×, and this module makes no legal claim.
//
// THE SPEC'S OWN STRINGS ARE NOT RE-TYPED HERE. The three Confirm disclosures,
// the fine print and the two pool-strip states come from src/constants/
// backing.js VERBATIM (§4, §5, Amendment B §B6) and the attestation lines from
// src/constants/eligibility.js; this module only composes around them. A
// second copy of any of them would be the §9 display-agreement failure mode
// applied to copy.
//
// WHERE THE DESIGN'S COPY WAS CORRECTED, and why (the briefs are the contract;
// the HTML is its reference implementation, and the spec wins on facts):
//   · "Pools stay sealed until Friday" → "until they close". The reveal is at
//     CLOSE (Sunday 23:59 ET on lobby pods, the fire instant on slot pods —
//     spec §3/§4, Amendment B §B6); Friday is the RESULT.
//   · The CPU pick-layer line no longer claims the house "holds them all week
//     with no adjustments": CPU seats contest the overnight waiver wire
//     (api/_utils/tournamentCpuClaims.js), so that would be false.
//   · Nothing here says "how they stand in the bracket right now" — rev3 §2
//     cut the live standing from the card.
//
// FACTS ON THE WIRE, WORDS HERE: the team-card projection returns what the
// writers recorded (held / flipped / swapped, the day, the counterpart symbol)
// and the sentence is composed below, so a change of wording never touches the
// server and never escapes the guard.

import { ALLOWANCE_BP, MIN_STAKE_BP, PER_TEAM_CAP_BP } from '../../../constants/backing';

/** Backing Points, formatted the way the design formats them (1,000). */
export const bp = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US');

/** 1st · 2nd · 3rd · 4th — the design's ordinal, one home. */
export const ordinal = (n) => {
  if (!Number.isInteger(n) || n < 1) return '—';
  return `${n}${['st', 'nd', 'rd', 'th'][Math.min(n, 4) - 1]}`;
};

/** Signed one-decimal score for the tape headings (+8.7 / −2.9). */
export const signed = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}` : '—');

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ==================== THE LANDING STRIP (rev3 §1) ====================

export const STRIP = Object.freeze({
  eyebrow: Object.freeze({
    open: 'Window open',
    staked: 'You’re in',
    week: 'Watching',
    between: 'Last week banked',
    quiet: 'Backing',
  }),
  head: Object.freeze({
    open: (pods) => `Backing open · ${plural(pods, 'pod', 'pods')}`,
    staked: (pods) => `Your backing · ${plural(pods, 'pod', 'pods')}`,
    week: (day) => `Your backing · day ${day} of 5`,
    between: 'Last week’s result',
    quiet: 'Backing',
  }),
  when: Object.freeze({
    closes: (closeLabel) => (closeLabel ? `Closes ${closeLabel}` : 'Close pending'),
    locked: 'Closed · plays Monday',
    week: 'Settles after Friday’s close',
    settling: 'Complete · settling',
    reopensMonday: 'Pools open again Monday',
    reopensOnFormation: 'Pools open as pods form',
  }),
  sub: Object.freeze({
    open: `Read a team, back it with ${bp(ALLOWANCE_BP)} free points. Pools stay sealed until they close.`,
    quiet: 'No pods to back yet — they show here as next week’s pods form.',
    between: 'Your stakes have settled. Open Backing for the week’s standings.',
  }),
  stakeRow: (amount) => `${bp(amount)} BP`,
  lockedRow: 'locked',
  standingRank: (rank) => ordinal(rank),
});

// ==================== THE PREDICTIONS RELABEL (rev2 §1, rev3 §1) ====================

/**
 * The existing spectate affordance on pod rows reads "Predictions" — same act,
 * a reason attached. LABEL ONLY: LeaguePod.jsx swaps the string at call time
 * on BACKING_BETA_ENABLED and leaves the handler untouched.
 */
export const PREDICTIONS_LABEL = 'Tap a seat · Predictions';

// ==================== THE BACKING SCREEN ====================

export const SCREEN = Object.freeze({
  back: 'League',
  eyebrow: 'Backing',
  title: 'Back the pods you watch',
  intro: 'Read a team, then back it with this week’s points. Pools are sealed while open.',
  sealRule: 'Pools are sealed while open. No pot, no shares, no payouts until the pool closes. Read the teams — the numbers come after.',
  pointsMeter: (left, total) => `${bp(left)} of ${bp(total)} BP · resets Monday`,
  pointsSuffix: (total) => `of ${bp(total)} BP · resets Monday`,
  fineprintLabel: 'Backing Points',
  loading: 'Loading…',
  unavailable: 'Backing is unavailable right now.',
  cardUnavailable: 'This team card is unavailable right now.',
  allPods: 'All pods',
  toCard: 'Back to the card',
});

// ==================== THE PROFILE HOME (rev3 §3 — one line, two homes) ====================

export const PROFILE = Object.freeze({
  eyebrow: 'Your scouting line',
  empty: 'No line yet — one sentence on why someone should back you.',
  note: (agentName) => `Shown on your team card in Backing, above ${agentName}\u2019s approach. Editing it there changes this same line.`,
});

// ==================== THE POD LIST (Surface A) ====================

export const POD_LIST = Object.freeze({
  title: 'Upcoming pods',
  sub: 'Next week’s groups of four. Back a team in a pod you’re not in.',
  empty: 'No pods to back yet.',
  yours: 'Yours',
  humanMark: 'human',
  slot: 'Live-draft slot',
  lobby: 'Lobby pod',
  closes: (closeLabel) => (closeLabel ? `Closes ${closeLabel}` : 'Close pending'),
  seats: (humans, cpus) => `${plural(humans, 'human', 'humans')} · ${plural(cpus, 'CPU', 'CPUs')}`,
  noPool: 'No pool for this pod.',
  sealedPot: 'Pot',
  sealedPays: 'Pays ×',
  sealed: 'SEALED',
  tapSeat: 'Tap a seat · read the team',
  status: Object.freeze({
    closed: 'Closed · revealed',
    resolving: 'Settling',
    resolved: 'Settled',
    insufficient: 'Did not qualify · stakes void',
    refunded: 'Refunded · stakes void',
  }),
  revealed: Object.freeze({
    pot: (pot) => `Pot ${bp(pot)} BP`,
    backers: (n) => plural(n, 'backer', 'backers'),
    team: (stakeTotal, backerCount) => `${bp(stakeTotal)} BP · ${plural(backerCount, 'backer', 'backers')}`,
    pays: (x) => (Number.isFinite(x) ? `pays ×${x.toFixed(2)}` : null),
    winner: 'Winner',
  }),
});

// ==================== THE BACKERS CALL (three chairs) ====================

// The open pool's two lines are Amendment B §B6's, VERBATIM, from
// src/constants/backing.js POOL_STRIP (BackersCall renders them; DOM-3 /
// SEAL-4, the PR 4 review record) — no prose of this module's own.

// ==================== THE TEAM CARD (Surface B) ====================

export const CARD = Object.freeze({
  podLine: (podName, index, count) => `${podName} · seat ${index} of ${count} · one team, two layers`,
  humanRole: 'picks 3',
  houseSuffix: ' · house',
  agentRole: 'agent · runs 6',
  agentFallbackName: (displayName) => `${displayName}’s agent`,
  noAgent: 'No agent on this seat yet.',
  // The house's seat, as it is actually played: the three come off a fixed
  // board (a ranked-pool slice, no archetype in it — leagueTournament.js
  // buildCpuUserBoard), the six by the archetype's rankings; the house also
  // works the overnight wire like any seat (FAB-3, the PR 4 review record).
  cpuPicks: 'The house plays this seat: three picks from a fixed board, the agent’s six by its archetype. No owner behind the seat.',
  pitch: Object.freeze({
    quote: (text) => `“${text}”`,
    noneYours: 'No pitch yet — write one sentence.',
    noneTheirs: 'Hasn’t written a pitch yet.',
    write: 'WRITE',
    edit: 'EDIT',
    save: 'Save',
    cancel: 'Cancel',
    placeholder: 'One sentence. Why would someone back you?',
    counter: (len, max) => `${len}/${max}`,
    sameLine: 'Same line as your profile · edits here change it there',
    saving: 'Saving…',
    failed: 'Could not save your pitch. Try again.',
    tooLong: (max) => `A pitch is at most ${max} characters.`,
  }),
  firstWeek: 'FIRST WEEK · no tape yet',
  loadout: (traits, rules) => (Number.isInteger(traits) && Number.isInteger(rules)
    ? `${plural(traits, 'trait', 'traits')} · ${plural(rules, 'rule', 'rules')} · contents private · may change nightly`
    : 'contents private · may change nightly'),
  known: Object.freeze({
    career: 'Career',
    tier: 'Tier',
    last: 'Last 3 wks',
    weeks: 'Weeks played',
    history: 'History',
    rp: (rp) => `${bp(rp)} RP`,
    noWeeks: 'no weeks yet',
    dash: '—',
    cpuTier: 'CPU',
    none: 'none',
    finishes: (list) => list.map((n) => ordinal(n)).join(' '),
  }),
  tape: Object.freeze({
    firstWeekTitle: 'First week · no tape yet',
    firstWeekSub: 'Nothing to replay. Judge the team as stated.',
    // When the three land depends on how the pod formed: a lobby pod drafts
    // on its Monday; a live-draft (slot) pod drafts at its fire, the instant
    // its pool closes (spec §4; FAB-4, the PR 4 review record).
    firstWeekBody: ({ hasPitch, agentName, traits, rules, formationPath, poolOpen = true }) => {
      const loadout = Number.isInteger(traits) && Number.isInteger(rules) ? `a ${traits}-trait, ${rules}-rule loadout` : 'a loadout whose contents stay private';
      // Once the pool has closed the draft is no longer "after this pool closes" (R-A-6).
      const draft = !poolOpen ? 'This pool has closed; the three-stock draft follows.'
        : formationPath === 'slot' ? 'The three-stock draft lands at the slot’s fire — the moment this pool closes.' : 'The three-stock draft lands Monday — after this pool closes.';
      return `What you have: ${hasPitch ? 'their pitch' : 'no pitch yet'}, ${agentName}’s stated approach, and ${loadout}. ${draft}`;
    },
    // A team with completed weeks whose tape could not be read: said plainly,
    // never dressed as a first week (FAB-13, the PR 4 review record).
    noTapeTitle: 'No tape on file',
    noTapeSub: 'Completed weeks exist; none could be read back.',
    noTapeBody: 'Judge the team as stated: the pitch, the approach, the known facts below.',
    cpuTitle: 'CPU seat · no history',
    cpuSub: (archetypeLabel) => `The ${archetypeLabel} archetype runs the six`,
    cpuBody: 'The house picks three from a fixed board; the agent runs its six by the archetype’s rankings. No owner behind the seat.',
    lastWeekTitle: 'Last week · both layers',
    lastWeekSub: (place, count, composite) => `Finished ${ordinal(place)} of ${count} · ${signed(composite)} · both layers, as recorded`,
    humanCol: (name) => `${name} · 3`,
    houseCol: 'House · 3',
    agentCol: (agentName) => `${agentName} · 6`,
    pickLayer: 'pick layer',
    book: 'book',
    // The trade's recorded note — the agent's own reasoning, or the note a
    // guardrail or the risk manager left when it moved the book; the WHAT
    // projection carries no marker of which (FAB-5, the PR 4 review record).
    whyTitle: 'The why · as recorded on the trade',
    noSwaps: 'No swaps recorded — the agent held its six.',
    tradeAct: (symbolOut) => `in for ${symbolOut}`,
    noWhy: 'no why recorded',
    filmRoom: 'Full film room · every close, both layers',
  }),
  cta: Object.freeze({
    yoursTeam: 'This is your team. Backing is for the pods you watch.',
    yoursPod: 'Your pod. Backing is for the pods you watch.',
    closed: 'BACKING CLOSED FOR THE WEEK',
    backedPrefix: (amount) => `BACKED · ${bp(amount)} BP · `,
    back: (name, agentName) => `Back ${name} & ${agentName}`,
    addTo: (amount, name) => `Add to your ${bp(amount)} on ${name}`,
  }),
});

/** The sentence for a human pick, from the projection's recorded facts. */
export function humanPickDid(pick) {
  if (!pick) return '';
  if (pick.claimedIn) {
    const day = pick.claimedIn.day ? ` ${titleDay(pick.claimedIn.day)}` : '';
    return pick.claimedIn.forSymbol ? `Claimed${day} for ${pick.claimedIn.forSymbol}` : `Claimed${day}`;
  }
  if (pick.swappedOut) {
    const day = pick.swappedOut.day ? ` ${titleDay(pick.swappedOut.day)}` : '';
    return pick.swappedOut.forSymbol ? `Swapped out${day} for ${pick.swappedOut.forSymbol}` : `Swapped out${day}`;
  }
  // Dropped on the wire and claimed back later — not held all week.
  if (pick.dropped && pick.reclaimed) {
    const out = pick.dropped.day ? ` ${titleDay(pick.dropped.day)}` : '';
    const back = pick.reclaimed.day ? ` ${titleDay(pick.reclaimed.day)}` : '';
    return `Dropped${out} · back${back}`;
  }
  if (pick.heldAtClose && Number.isInteger(pick.flips) && pick.flips > 0) {
    const dir = pick.direction === 'short' ? 'short' : 'long';
    const day = pick.lastFlipDay ? ` ${titleDay(pick.lastFlipDay)}` : '';
    return `Flipped ${dir}${day}`;
  }
  // "All week" needs the draft record; without it the roster at close is the
  // only fact (FAB-6, the PR 4 review record).
  if (pick.heldAtClose) return pick.drafted === true ? 'Held all week' : 'On the roster at close';
  return '';
}

/** The sentence for an agent holding, from the projection's recorded facts. */
export function agentPickDid(pick) {
  if (!pick) return '';
  if (pick.addedIn) {
    const day = pick.addedIn.day ? ` ${titleDay(pick.addedIn.day)}` : '';
    return `In${day} for ${pick.addedIn.forSymbol}`;
  }
  if (pick.swappedOut) {
    const day = pick.swappedOut.day ? ` ${titleDay(pick.swappedOut.day)}` : '';
    return `Out${day} for ${pick.swappedOut.forSymbol}`;
  }
  // "Held" needs the opening book; without it the closing book is the only fact (FAB-7).
  if (pick.heldAtClose) return pick.drafted === true ? 'Held' : 'In the book at close';
  return '';
}

/** 'MON' → 'Mon' for prose; the tape's own column keeps the uppercase label. */
export function titleDay(day) {
  if (typeof day !== 'string' || day.length === 0) return '';
  return day.charAt(0) + day.slice(1).toLowerCase();
}

// ==================== THE STAKE CONTROL (Surface C) ====================

/** The design's presets (brief §2.C). Every value sits inside the economy's bounds. */
export const STAKE_PRESETS = Object.freeze([100, 250, 500]);

export const STAKE = Object.freeze({
  eyebrow: 'Back this team',
  title: (name, agentName) => `Back ${name} & ${agentName}`,
  presets: 'Amount',
  custom: 'Custom amount',
  customPlaceholder: (max) => `${MIN_STAKE_BP}–${bp(max)}`,
  cap: (staked, name) => `Per-team cap ${bp(PER_TEAM_CAP_BP)} BP · ${bp(staked)} already on ${name}`,
  capReached: (name) => `You are at the per-team cap on ${name}.`,
  remaining: (left) => `${bp(left)} BP left this week`,
  disclosuresTitle: 'Before you confirm',
  confirm: (amount) => `Confirm ${bp(amount)} BP`,
  confirmNone: 'Choose an amount',
  walletPending: 'Reading your points…',
  confirming: 'Confirming…',
  backed: (amount) => `Backed · ${bp(amount)} BP`,
  backedSub: 'Recorded by the server. Sealed until the pool closes.',
  replayed: 'Already recorded — this stake was placed once.',
  another: 'Back another team',
  belowMin: `The minimum stake is ${bp(MIN_STAKE_BP)} BP.`,
  aboveCap: `The per-team cap is ${bp(PER_TEAM_CAP_BP)} BP, including what you already have on this team.`,
  aboveAllowance: 'That is more than this week’s remaining allowance.',
  notWhole: 'Enter a whole number of BP.',
});

/**
 * Every refusal reason the stake endpoint (and the attestation endpoint) can
 * return, mapped to one plain sentence. `eligibility_required` is also the
 * signal to re-present the attestation step; `account_required` is the plain
 * sign-in message for an anonymous account (Amendment A §A3, D-ab).
 */
export const REFUSALS = Object.freeze({
  invalid_group_id: 'That stake could not be read. Try again.',
  invalid_team: 'That stake could not be read. Try again.',
  invalid_amount: STAKE.notWhole,
  invalid_request_id: 'That stake could not be read. Try again.',
  below_min_stake: STAKE.belowMin,
  above_team_cap: STAKE.aboveCap,
  per_team_cap: STAKE.aboveCap,
  no_pod: 'That pod is no longer available.',
  no_pool: 'That pod is not open for backing.',
  pool_not_open: 'That pod is not open for backing yet.',
  pool_closed: 'This pool has closed.',
  battle_started: 'This pod’s drafts are in — the window has closed.',
  account_required: 'Sign in with an account to back a team. An anonymous session can’t hold a confirmation.',
  eligibility_required: 'Confirm your eligibility first.',
  own_pod: 'You’re seated in this pod. Backing is for the pods you watch.',
  seat_not_present: 'That seat is no longer in the pod.',
  no_completed_battle: 'Complete one battle of your own before backing a team.',
  request_id_conflict: 'That request was already used. Start a new stake.',
  stake_already_spent: 'That request was already used. Start a new stake.',
  insufficient_allowance: STAKE.aboveAllowance,
  week_mismatch: 'Your allowance is on a different week. Reload and try again.',
  server_error: 'Could not place that stake. Try again.',
  network: 'No connection. Try again.',
});

/** The plain sentence for a refusal code — never the raw code, never a blank. */
export function refusalMessage(code) {
  return REFUSALS[code] ?? REFUSALS.server_error;
}

// ==================== THE ATTESTATION STEP (PR 0 placeholder copy) ====================

export const ATTEST = Object.freeze({
  eyebrow: 'Before you back a team',
  title: 'One-time confirmation',
  sub: 'Two statements, once. They are recorded to your account.',
  draftNote: 'Draft terms · pending counsel review',
  continue: 'Continue',
  saving: 'Recording…',
  incomplete: 'Confirm both statements to continue.',
  failed: 'Could not record your confirmation. Try again.',
  checking: 'Checking your eligibility…',
  adultLabel: 'Age',
  termsLabel: 'Terms',
});

// ==================== YOUR BACKING (Surface D) ====================

export const WEEK = Object.freeze({
  title: 'Your backing',
  sub: (day) => `Day ${day} of 5 · nothing to do but watch`,
  settledSub: 'Week complete',
  settlingSub: 'Week complete · settling',
  empty: 'No stakes in play this week.',
  backed: 'Backed',
  stakeRow: (teamName, amount, status = null) => `${teamName} · ${bp(amount)} BP${status ? ` · ${status}` : ''}`,
  // A stake that is no longer live says so beside its amount (DOM-6).
  stakeStatus: Object.freeze({ voided: 'void', won: 'settled', lost: 'settled' }),
  standing: 'Where the pod stands',
  noStanding: 'Standing appears after the first close.',
  // The books as they stand: the roster after the overnight wire and the
  // agent's book after its swaps — what the team HOLDS, never re-labelled as
  // Monday's draft (FAB-2 / DOM-5, the PR 4 review record).
  revealTitle: 'This week · both layers',
  revealSub: (teamName, agentName) => `What ${teamName} and ${agentName} hold`,
  revealPending: 'The books show once the pod has drafted.',
  humanPending: 'Three picks · not drafted yet',
  // What is KNOWN: no agent book has been read for the seat — never when one
  // will be built (a seat can be running without an agent layer; R-A-2).
  agentPending: (agentName) => `${agentName} · no book on file yet`,
  revealHuman: (teamName) => `${teamName} · 3`,
  revealAgent: (agentName) => `${agentName} · 6`,
  tape: 'Open the tape',
  settled: 'Settled',
  status: Object.freeze({
    battle: 'In play',
    awaiting: 'Locked · plays Monday',
    settling: 'Settling',
    complete: 'Complete',
  }),
});
