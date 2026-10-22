// src/components/CommandCenter/hub/hubCopy.js
//
// Command Center hub — every user-visible string the hub renders (spec V1.2
// §2: "copy in hub/hubCopy.js"; §11.3: all strings centralized). It travels in
// the lazy hub chunk, never the main one. The gate's few strings stay in
// ../hubGateCopy.js, which ships in the main chunk; together the two tables
// hold every string of the hub, and hubCopy.guard.test.js checks both.
//
// Slice S1 (the approved shell). The words follow the design of record
// (docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html) except
// where the spec replaces them, and every replacement is the spec's own text:
//   - Partnership's reserved line (§8.3), exactly;
//   - the hold helper lines (§5.5), exactly — the shipped hold is 1,300 ms;
//   - Games' and the strip's initial lines (§3): "Checking your games",
//     "Checking eligibility…";
//   - the activity heading (§8.2), exactly;
//   - the career caption (§7), exactly.
// One replacement is the build's, not the spec's: the confirmed Deploy line
// says the game appears "in Games", not the design's "above", because the
// tablet and stacked compositions put Deploy above Games (S1 review L1-6).
//
// Slice S2a (the deploy vocabulary, spec §3, §3.1, §5.2) adds the words of
// every eligibility and attempt display state. The spec's own: "Switching
// account…", "Create your agent first", "Eligibility unavailable" + Retry,
// "Ready to deploy · as of {time}", "Finishing deployment", "Deployed",
// "Battle confirmed", "Already running" + Open game, "Couldn't confirm the
// deploy", "Sign in required". Two are the shipped ceremony's
// (CeremonyError.jsx), so the hub and the overlay say the same thing:
// "Deployment failed" and "Couldn't confirm the deploy". The build's own,
// where the spec names a state but no words: the agent's loading state says
// "Checking eligibility…" like the poll's (eligibility cannot be known
// before the agent, and one line avoids a flicker of two), its error "Agent
// unavailable" + Retry, a block with no reason (concurrency off, whose
// helper gives none) "Unavailable", the cooldown "Next deploy at {time}",
// the in-flight control labels, "Verifying deployment…", "Check
// deployment", "Enter battle", and the as-of and refresh notes.
// Slice S3 (the readers) adds the founder's strip words for the review-due
// refusal, "Deployment refused" (ruling R-S3-1).
//
// No string claims learning, improvement, intelligence or an earned tier,
// counts anything the hub does not hold, or says "since your last visit"
// (§8.2, §11.3) — the copy guard pins that.

export const HUB_COPY = Object.freeze({
  /** The hub region's accessible name. */
  regionLabel: 'Command Center',

  /** The separator between two parts of one line. */
  sep: ' · ',

  header: Object.freeze({
    title: 'Command Center',
    /** The eyebrow: today's date in ET, then the player's name when there is one. */
    eyebrow: (dateText, name) => (name ? `${dateText} · ${name}` : dateText),
    /** The phone's account circle. S5 wires it to the profile; in S1 it is disabled. */
    profile: 'Your profile',
  }),

  shadow: Object.freeze({
    name: 'Shadow',
    role: 'your research partner',
    stageLabel: 'Shadow',
    /** The status line's idle words (the design's idle vocabulary). */
    statusIdle: 'Idle · nothing running',
    /** The status line while a hub-started deployment is submitting. */
    statusSubmitting: 'Submitting your deployment',
    /** Shadow's image label: what it shows, and the selected area. */
    imageLabel: (state, areaName) => `Shadow — ${state}${areaName ? `; ${areaName} selected` : ''}`,
    states: Object.freeze({ ambient: 'ambient', still: 'still', processing: 'processing' }),
  }),

  areas: Object.freeze({
    tablistLabel: 'Relationship areas',
    /** In the design's order: Partnership · Shared Research · Equipped Archetype. */
    names: Object.freeze(['Partnership', 'Shared Research', 'Equipped Archetype']),
    /** The phone stage's summary-line names. */
    shortNames: Object.freeze(['Partnership', 'Research', 'Loadout']),
    /** A phone summary line's tail, after the bold area name. */
    summaryTail: (status) => ` · ${status}`,
  }),

  phoneTabs: Object.freeze({
    listLabel: 'Command Center sections',
    overview: 'Overview',
    research: 'Research',
    partnership: 'Partnership',
    loadout: 'Loadout',
  }),

  partnership: Object.freeze({
    /** The area control's and the phone stage's summary. */
    summary: 'Not in this release',
    /** The reserved panel, exactly (spec §8.3). */
    reserved: "Partnership isn't part of this release. A preference will only ever stand once you confirm it.",
  }),

  research: Object.freeze({
    summaryLoading: 'Checking your research',
    loading: 'Checking your research',
    /** The Forge action. S6 wires it; in S1 it is disabled. */
    openForge: 'Open in the Forge',
    /** The panel's eyebrow, over its content (the design's header row). */
    ideas: 'Ideas',
  }),

  loadout: Object.freeze({
    summaryLoading: 'Checking your loadout',
    loading: 'Checking your loadout',
    archetype: 'Archetype',
    watchlist: 'Watchlist',
    equipped: 'Equipped',
    names: (n) => `${n} name${n === 1 ? '' : 's'}`,
    /** The pickers. S5 wires them; in S1 they are disabled. */
    changeArchetype: 'Change archetype',
    changeWatchlist: 'Change watchlist',
    nextDeploy: 'Changes apply to your next deploy.',
    /** The same line while the loadout is locked in a live game (the design's live variant). */
    nextDeployLocked: 'Locked in battle · changes apply to your next deploy.',
    changeInForge: 'Change in the Forge',
    /** After the Forge link: a game keeps the loadout it was deployed with (spec §2: battle-frozen). */
    neverRewrites: ' — never rewrites a game in progress.',
    /** The strip's and the Deploy card's loadout line while the loadout loads. */
    lineLoading: 'Checking your loadout',
    line: (archetype, watchlist) => `${archetype} · ${watchlist}`,
  }),

  nextAction: Object.freeze({
    label: 'Next action',
    later: 'Later',
  }),

  games: Object.freeze({
    label: 'Games',
    /** Spec §3: the initial state, before any result has resolved. */
    loading: 'Checking your games',
    empty: 'No games yet',
    emptySub: 'Your first BaggerBomb game against a CPU starts from Deploy.',
    /** The phone Overview's empty note: Deploy is the strip below. */
    emptySubPhone: 'Your first BaggerBomb game against a CPU starts from Deploy, below.',
    liveCount: (n) => `${n} live`,
    completedCount: (n) => `${n} completed`,
    history: 'History',
    vs: (mode) => `${mode} vs`,
    reviewTag: 'Review',
    reviewsAvailable: 'Reviews available',
    /** A game row's name: what it opens, the game, its outcome, a ready review and its detail line. */
    rowLabel: (live, mode, opponent, outcome, review, detail) => [`${live ? 'Open live game' : 'Open game record'}: ${mode} vs ${opponent}`, outcome, review ? 'review available' : '', detail].filter(Boolean).join(', '),

    // ── Slice S3: the rows' own words (spec §3, §6, §7) ──────────────────
    /** The opponent line: a BaggerBomb game is against a CPU; a ranked day is scored in its league group. */
    opponentCpu: 'CPU',
    opponentGroup: 'League group',
    /** A live game that has not opened yet: deployed, waiting for the open. */
    waitingForOpen: 'waiting for the open',
    timeLeft: (hours, minutes) => (hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`),
    ending: 'ending',
    /** A live row's line: its score as recorded, its trades, when it ends. */
    liveDetail: (score, trades, ends) => [`Score ${score}`, `${trades} trade${trades === 1 ? '' : 's'}`, ends ? `ends ${ends}` : ''].filter(Boolean).join(' · '),
    /** A score a reader may not show (v2 Ruling 16): a dash, never 0. */
    scoreUnavailable: '—',
    /** Spec §7's outcome words; each number is the row's own stored score. */
    outcomeWon: (score) => `Won ${score}`,
    outcomeLost: (score) => `Lost ${score}`,
    outcomeDraw: (score) => `Draw ${score}`,
    outcomeBanked: 'Day banked · no W/L',
    outcomeNoResult: 'No result',
    outcomeEnded: 'Ended',
    noScoreRecorded: 'no score was recorded',
    endedDetail: (mine, theirs) => `no final result recorded · last recorded ${mine} vs ${theirs}`,
    scorePair: (mine, theirs) => `${mine} vs ${theirs}`,
    /** A detail line from its parts. */
    detail: (...parts) => parts.filter(Boolean).join(' · '),
    /** Spec §3: a failed read is never an empty history. */
    loadFailed: 'Couldn’t load your games',
    staleAsOf: (time) => (time ? `As of ${time} · couldn’t refresh` : 'Couldn’t refresh'),
    nextAttempt: (time) => `next attempt at ${time}`,
    retry: 'Retry',
    /** Spec §6's review states, exactly where the spec gives the words. */
    review: Object.freeze({
      openTape: 'Open battle tape',
      pending: 'Review pending',
      unavailable: 'Review unavailable',
      checking: 'Checking the review',
      queued: (time) => (time ? `Review check queued · next attempt at ${time}` : 'Review check queued'),
      timedOut: (time) => (time ? `Review refresh timed out · Retry queued · next attempt at ${time}` : 'Review refresh timed out · Retry queued'),
      /** A tape link's name: what it opens, and for which game. */
      openTapeLabel: (mode, opponent, day) => [`Open battle tape: ${mode} vs ${opponent}`, day].filter(Boolean).join(', '),
    }),
  }),

  history: Object.freeze({
    label: 'Game history',
    title: 'Completed games',
    eyebrow: (n) => `Game history · ${n} completed`,
    rowTitle: 'Game history',
    rowSub: (n) => `${n} completed · results and reviews`,
    rowLabel: (n) => `Game history, ${n} completed games`,
    /** Spec §7, exactly. */
    careerCaption: 'career · BaggerBomb vs CPU · as recorded',
  }),

  deploy: Object.freeze({
    label: 'Deploy',
    title: 'Send Shadow into a game',
    loadoutLink: 'Loadout',
    hold: 'Hold to deploy',
    holdShort: 'Deploy',
    holdSubmitting: 'Submitting…',
    holdDeployed: 'Deployed',
    holdLabel: 'Hold to deploy. Press and hold, or press Enter or Space to deploy now.',
    /** Spec §5.5, exactly. The shipped hold is 1,300 ms (useHoldToDeploy.js HOLD_MS). */
    pointerHelp: 'Hold for 1.3 s. Release before the hold completes to cancel.',
    keyboardHelp: 'Or press Enter or Space to deploy now.',
    holdVerifying: 'Verifying…',
    holdFinishing: 'Finishing…',
    retry: 'Retry',
    openGame: 'Open game',
    /** The strip's Open game beside the hold (a live game with deploy still ready), so both fit one 63–69 px row. */
    openGameShort: 'Open',
    /** An attempt's actions (spec §5.2, §5.4). S2b wires them; until then each is disabled. */
    enterBattle: 'Enter battle',
    checkDeployment: 'Check deployment',
    openForge: 'Open in the Forge',
    /**
     * The Deploy card's and the strip's words for each display state, in the
     * spec §3.1 / §5.2 vocabulary (C1, C3): the eligibility states, then the
     * attempt's display words. Every key is a DISPLAY state; none is a stored
     * provider phase but `existing` and `uncertain`, which §5.2 uses as both.
     */
    states: Object.freeze({
      signed_out: 'Sign in required',
      account_transition: 'Switching account…',
      cooldown: (time) => `Next deploy at ${time}`,
      loading_agent: 'Checking eligibility…',
      agent_error: 'Agent unavailable',
      no_agent: 'Create your agent first',
      blocked: (reason) => (reason ? `Unavailable · ${reason}` : 'Unavailable'),
      eligibility_error: 'Eligibility unavailable',
      checking: 'Checking eligibility…',
      ready_stale: (time) => (time ? `Ready to deploy · as of ${time}` : 'Ready to deploy'),
      ready: 'Ready to deploy',
      submitting: 'Submitting deployment…',
      verifying: 'Verifying deployment…',
      finishing: 'Finishing deployment',
      confirmed: 'Deployed',
      existing: 'Already running',
      failed: 'Deployment failed',
      uncertain: 'Couldn’t confirm the deploy',
    }),
    /** A recovered confirmation: the battle is owned and admitted, but nothing proves this request created it (spec §5.2). */
    confirmedRecovered: 'Battle confirmed',
    /** The strip's words for the review-due refusal (slice S3, founder ruling R-S3-1); the server's line stays on the card. */
    reviewDueStrip: 'Deployment refused',
    /** The Deploy card's longer line for the in-flight states. */
    cardSubmitting: 'Submitting once · waiting for the game to be created',
    cardConfirmed: 'Deployed · the game appears in Games once its record arrives',
    /** The strip's second line while a live game holds the first. */
    blockedBehindGame: (reason) => (reason ? `Deploy unavailable · ${reason}` : 'Deploy unavailable'),
    /** The same line when the block is the last successful check's (spec §3.1 row 6: as-of if stale). */
    blockedStaleBehindGame: (time) => (time ? `Deploy unavailable · as of ${time}` : 'Deploy unavailable'),
    /** The freshness notes (spec §3.1): a refresh in flight, and a refresh that failed. */
    refreshing: (time) => (time ? `Refreshing · as of ${time}` : 'Refreshing'),
    refreshFailed: 'Couldn’t refresh',
    staleAsOf: (time) => (time ? `As of ${time} · couldn’t refresh` : 'Couldn’t refresh'),
  }),

  /** A clock time in ET, the market's clock (hub/hubDate.js formatHubTime). */
  time: Object.freeze({
    et: (clock) => `${clock} ET`,
  }),

  strip: Object.freeze({
    regionLabel: 'Game actions',
    /** The strip's status button names both lines, then where it goes. */
    openLoadoutLabel: (line1, line2) => `${line1.replace(/[.…]+$/, '')}. ${line2.replace(/[.…]+$/, '')}. Open loadout`,
    live: (clock) => `Live · ${clock}`,
    deployed: (clock) => `Deployed · ${clock}`,
  }),

  activity: Object.freeze({
    /** Spec §8.2, exactly. */
    label: 'Recent activity · your last 10 games and current loadout',
    loading: 'Checking your activity',
    empty: 'Nothing recorded yet.',
    /** The phone Overview's link to the whole list (the design's; S4 wires its sheet). */
    all: (n) => `All activity · ${n}`,
    /** An activity row's name: what happened, its line, and when (the visible time; S1 review L3-8). */
    rowLabel: (text, sub, at) => `${text}: ${sub}${at ? `, ${at}` : ''}`,
  }),

  brief: Object.freeze({
    label: 'Daily Regime Brief',
    loading: 'Checking the brief',
    more: 'More',
    less: 'Less',
  }),

  sheet: Object.freeze({
    close: 'Close',
  }),
});
