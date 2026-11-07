// src/constants/loadoutCopy.js
//
// Build A2 — the per-game loadout surfaces' words: the hub's (boards 1, 2, 4: the Loadout tab's cards, the Deploy card's
// line, the armory's context; src/components/CommandCenter/) and the League lobby's (board 3: the League and Training
// lines; src/components/League/). One table for both, outside the hub's directory so the League's line never reaches into
// the hub chunk (commandCenterHub.mount.guard.test.js: the main graph reaches the hub only through the gate). It imports
// nothing. It is a copy table of the hub copy guard (hubCopy.guard.test.js COPY_TABLES): every literal here passes the
// guard's banned words and digits, and its own A2 rows.

/**
 * Read while PER_GAME_LOADOUT_ENABLED and AGENT_FORM_ARMORY_ENABLED are both on. Names, one-liners and paragraphs are not here:
 * the hub takes them through hub/archetypeLines.js, the League through its leagueAdapter.js archetypeLabel. What the rulings shape:
 *   - FD-1: a BaggerBomb change applies to the NEXT deploy, so "next deploy" is now true — for BaggerBomb only. The
 *     League strings never say it (hubCopy.guard.test.js);
 *   - FD-3: a League lock always says why and until when, with the real date from the player's group (passed in);
 *   - the boards' "No book blocks Deploy" is reversed: a loadout with no book reads "No book · open market", and
 *     Deploy keeps working; the boards' "record facts · later" slot is not rendered (A4 fills that space);
 *   - D4: no count but the book's names, passed as an argument; no growth word anywhere.
 */
export const LOADOUT_COPY = /* @__PURE__ */ Object.freeze({
  games: Object.freeze({ baggerbomb: 'BaggerBomb', league: 'League' }),
  /** The card's region label. */
  card: (game) => `${game} loadout`,
  /** The one state tag a card wears (board 7 #3). */
  tags: Object.freeze({ next: 'Next deploy', running: 'Game running', locked: 'Locked', open: 'Open', nobook: 'No book', checking: 'Checking' }),
  /** The armor row's second line (the boards' record slot is not rendered). */
  set: 'Set',
  /** The book row: the list and its names, or no book. */
  book: (names) => `Book · ${names}`,
  bookUncounted: 'Book',
  noBook: 'No book · open market',
  chooseBook: 'Choose a list',
  /** The book sheet's context (today's watchlist sheet, opened from a card's book row). */
  bookTitle: (game) => `Choose a book for ${game}`,
  /** The rows' accessible names: what a tap does, or that it is locked and only looks. */
  changeArmor: (game) => `Change ${game} armor`,
  lookArmor: (game) => `${game} armor, locked. Open the armory to look.`,
  changeBook: (game) => `Change ${game} book`,
  bookLocked: (game) => `${game} book, locked`,
  /** The line under a card's rows: when a change lands. */
  lines: Object.freeze({
    next: 'The next deploy wears this.',
    running: (name) => `The running game keeps the ${name}. The next deploy wears what you set here.`,
    nobook: 'No book · open market. Deploy works without one.',
    // Founder ruling Q3 (Nov 7 2026): the lock names the day the week is scored after, date only (formatLockDay)
    locked: (day) => `Locked until the week is scored, after the close on ${day}.`,
    lockedUndated: 'Locked until the week is scored.',
    // A2R-3 (a): the ranked record has a game running (a League game, or a BaggerBomb game that fell back to it):
    // A1's words, no date (the game's end is not the week's)
    lockedBattle: 'Locked while a game is running.',
    open: 'Open until you register for next week. It locks then.',
    checking: 'Checking your League week',
  }),
  /** The running strip: the game in the armor it deployed with. */
  runningNow: 'Running now',
  /** Board 2, the Deploy card's line. */
  nextCarries: 'Next deploy carries',
  deployLine: (name, book) => `${name} · ${book}`,
  openCard: 'Open the BaggerBomb loadout',
  /** The desktop stage's third control and the phone stage's summary: both loadouts. */
  summary: (bb, league) => `BaggerBomb · ${bb} · League · ${league}`,
  /** Board 4, the armory with a loadout context. */
  context: (game) => `Choosing armor for ${game}`,
  contextNext: 'applies to the next deploy',
  contextLocked: (day) => `locked until the week is scored, after the close on ${day}`,
  contextLockedUndated: 'locked until the week is scored',
  contextLockedBattle: 'locked while a game is running',
  contextOpen: 'open · locks when you register',
  equipFor: (name, game) => `Equip ${name} for ${game}`,
  lockedEquip: 'Locked until the week is scored',
  lockedEquipBattle: 'Locked while a game is running',
  lockedEquipNote: (day) => `After the close on ${day}. Try sets on; nothing changes until then.`,
  lockedEquipNoteUndated: 'Try sets on; nothing changes until the week is scored.',
  lockedEquipNoteBattle: 'Try sets on; nothing changes until the game ends.',
  /**
   * A2R-3 (b), founder ruling Nov 7 2026: with per-game loadouts on, a BaggerBomb deploy whose casual clone could not be
   * ensured is refused, never run on the ranked record (it would wear the League loadout and hold the ranked record's
   * battle). The deploy strip shows this line with its Retry (src/services/agentDeploy.js).
   */
  deployCloneFailed: 'Couldn’t start the BaggerBomb game · try again',
  /** Ruling N3's footnote, made context-specific (FD-1 for BaggerBomb; the lock or open line for League). */
  footnoteBaggerbomb: 'Applies to the next deploy · a game already running keeps the armor it deployed with.',
  /** The forge line under the cards (FD-10): the strategy stays on the agent. */
  forgeLine: 'Your Forge strategy rides into both games.',
  /** Board 3, the League tab's line and the Training tab's. */
  leagueEyebrow: 'Your League loadout',
  leagueLocked: (day) => `Locked until the week is scored, after the close on ${day}`,
  leagueLockedUndated: 'Locked until the week is scored',
  leagueOpen: 'Open · locks when you register',
  leagueDoor: 'Change your League loadout in the Command Center',
  /** The League line's separator and an unnamed list's name (the hub's own, HUB_COPY.sep and loadout.watchlistFallback). */
  sep: ' · ',
  bookFallback: 'Watchlist',
  trainingTitle: 'Training uses your League loadout',
  trainingWhere: 'Change it on the League tab, between weeks.',
});
