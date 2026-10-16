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
    retry: 'Retry',
    openGame: 'Open game',
    /** The strip's Open game beside the hold (a live game with deploy still ready), so both fit one 63–69 px row. */
    openGameShort: 'Open',
    /**
     * The Deploy card's and the strip's words for each display state, in the
     * spec §3.1 / §5 vocabulary (C1, C3). S1 renders `checking`; the others
     * are the design's states, reached only from fixtures until S2a/S2b.
     */
    states: Object.freeze({
      checking: 'Checking eligibility…',
      ready: 'Ready to deploy',
      blocked: (reason) => `Unavailable · ${reason}`,
      eligibility_error: 'Eligibility unavailable',
      submitting: 'Submitting deployment…',
      confirmed: 'Deployed',
    }),
    /** The Deploy card's longer line for the in-flight states. */
    cardSubmitting: 'Submitting once · waiting for the game to be created',
    cardConfirmed: 'Deployed · the game appears in Games once its record arrives',
    /** The strip's second line while a live game holds the first. */
    blockedBehindGame: (reason) => `Deploy unavailable · ${reason}`,
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
    rowLabel: (text, sub) => `${text}: ${sub}`,
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
