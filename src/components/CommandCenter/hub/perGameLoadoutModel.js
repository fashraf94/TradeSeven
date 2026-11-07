// src/components/CommandCenter/hub/perGameLoadoutModel.js
//
// Build A2 — the hub's loadout cards and lines, as data (boards 1–4; rulings D1, FD-1, FD-2, FD-3, FD-11). Pure, like
// the hub's other selectors: it reads only its arguments, and the words are LOADOUT_COPY's, chosen by token.
//
//   - Each loadout comes from the ranked record through the shared model (src/constants/perGameLoadout.js): BaggerBomb's
//     slot or its default, League's own fields. The book is named and counted from the committed lists the hub read
//     (one count per list, selectors/loadout.js symbolsOf), never the names themselves.
//   - The running BaggerBomb game is the deploy gate's own (commandCenterLiveBattles.js findLiveBaggerBomb), and the
//     armor it shows is that battle's frozen snapshot, `agentContext.archetype` (BUILD_RULES §9: the strip shows what
//     the game wears, never the slot).
//   - The League lock is the client read's answer (src/services/leagueLockService.js), the same rule the writers
//     refuse by; until it answers (or when it failed) League is CHECKING and nothing on it is a door to change.
//   - A game on the ranked record (`agent.activeBattleId`: a League game, or a BaggerBomb deploy that fell back to the
//     ranked agent) also locks League, undated (review A2R-3 (a)): the writers answer 409 `battle_active` then. The week
//     lock, which the writers read first, wins when both hold, so a League game's card keeps its dated line.
//
// Every module-level call is marked pure: flag-off nothing imports this module, and nothing of it may survive.

import { baggerbombLoadoutOf, bookIdOf, formatLockDay, leagueLoadoutOf, LOADOUT_KINDS } from '../../../constants/perGameLoadout';
import { LOADOUT_COPY } from '../../../constants/loadoutCopy';
import { findLiveBaggerBomb } from '../../../utils/commandCenterLiveBattles';
import { archetypeLines } from './archetypeLines';
import { HUB_COPY } from './hubCopy';
import { symbolsOf } from './selectors/loadout';

/** A card's one state (board 7 #3); CHECKING until the League read answers. */
export const CARD_STATE = /* @__PURE__ */ Object.freeze({ NEXT: 'next', RUNNING: 'running', LOCKED: 'locked', OPEN: 'open', NOBOOK: 'nobook', CHECKING: 'checking' });

/** "Fri Nov 6" — the day the week is scored after, read in ET (the shared model's one formatter, ruling Q3); null when it has none. */
export const lockWhenOf = formatLockDay;

/** Why a League card is locked: the week (dated when the calendar can say) or a game on the ranked record (never dated). */
export const LOCK_KIND = /* @__PURE__ */ Object.freeze({ WEEK: 'week', BATTLE: 'battle' });

/** A book as a card shows it: its id, its name, its count of names (null while the lists have not answered). */
export function bookViewOf(book, committed) {
  const id = bookIdOf(book);
  if (!id) return { id: null, name: null, count: null };
  const found = Array.isArray(committed) ? committed.find((list) => list?.watchlistId === id) : null;
  return { id, name: (found && found.name) || book?.name || HUB_COPY.loadout.watchlistFallback, count: found ? symbolsOf(found).length : null };
}

/** The owner's running BaggerBomb game, in the armor it deployed with (its snapshot), or null. */
export function runningBaggerbombOf(activeBattles) {
  const live = findLiveBaggerBomb(Array.isArray(activeBattles) ? activeBattles : []);
  const archetype = live?.agentContext?.archetype;
  return typeof archetype === 'string' && archetype ? { battleId: live.id ?? null, archetype, name: archetypeLines(archetype).name } : null;
}

/**
 * The two cards. `lock` is the League read's answer ({ locked, endsAtMs, … }) or null while it has none; `lockFailed`
 * says the read failed, which stays CHECKING (the server is the authority, and the card never claims an open week it
 * could not check). Null without an agent.
 */
export function deriveLoadoutCards({ agent, lock = null, lockFailed = false, activeBattles = null, committed = null }) {
  if (!agent) return null;
  const bb = baggerbombLoadoutOf(agent);
  const lg = leagueLoadoutOf(agent);
  const running = runningBaggerbombOf(activeBattles);
  const bbBook = bookViewOf(bb.book, committed);
  const lgBook = bookViewOf(lg.book, committed);
  const known = Boolean(lock) && !lockFailed;
  const weekLocked = known && lock.locked === true;
  // A2R-3 (a): a game on the ranked record locks League whatever the week read says (the writers' `battle_active`)
  const battleLocked = !weekLocked && typeof agent.activeBattleId === 'string' && agent.activeBattleId !== '';
  const lockKind = weekLocked ? LOCK_KIND.WEEK : battleLocked ? LOCK_KIND.BATTLE : null;
  const lgState = lockKind ? CARD_STATE.LOCKED : !known ? CARD_STATE.CHECKING : !lgBook.id ? CARD_STATE.NOBOOK : CARD_STATE.OPEN;
  return {
    baggerbomb: {
      kind: LOADOUT_KINDS.BAGGERBOMB,
      game: LOADOUT_COPY.games.baggerbomb,
      archetype: bb.archetype,
      name: archetypeLines(bb.archetype).name,
      book: bbBook,
      // the boards' precedence (loadout-parts LoadoutCard): no book, then a running game, then the next deploy
      state: !bbBook.id ? CARD_STATE.NOBOOK : running ? CARD_STATE.RUNNING : CARD_STATE.NEXT,
      running,
      locked: false,
      when: null,
      lockKind: null,
    },
    league: {
      kind: LOADOUT_KINDS.LEAGUE,
      game: LOADOUT_COPY.games.league,
      archetype: lg.archetype,
      name: archetypeLines(lg.archetype).name,
      book: lgBook,
      state: lgState,
      running: null,
      // CHECKING holds like a lock: the armor row opens the armory to look; nothing changes the loadout
      locked: lgState === CARD_STATE.LOCKED || lgState === CARD_STATE.CHECKING,
      when: weekLocked ? lockWhenOf(lock.endsAtMs) : null,
      lockKind,
    },
  };
}

/** A card's tag: its words, and the hub tone (Locked and Checking pewter, No book gold, the rest teal). */
export function tagOf(card) {
  const label = LOADOUT_COPY.tags[card.state];
  if (card.state === CARD_STATE.LOCKED || card.state === CARD_STATE.CHECKING) return { label, tone: 'teal', dim: true };
  return { label, tone: card.state === CARD_STATE.NOBOOK ? 'gold' : 'teal', dim: false };
}

/** The line under a card's rows: when a change lands, or why it cannot and until when. */
export function lineOf(card) {
  const L = LOADOUT_COPY.lines;
  if (card.kind === LOADOUT_KINDS.LEAGUE) {
    if (card.state === CARD_STATE.CHECKING) return L.checking;
    if (card.state === CARD_STATE.LOCKED) return card.lockKind === LOCK_KIND.BATTLE ? L.lockedBattle : card.when ? L.locked(card.when) : L.lockedUndated;
    return L.open;
  }
  if (card.state === CARD_STATE.NOBOOK) return L.nobook;
  if (card.state === CARD_STATE.RUNNING) return L.running(card.running.name);
  return L.next;
}

/** The book row's second line: "Book · 12 names", or "Book" while the count is unknown. */
export function bookSubOf(book) {
  return book.count === null ? LOADOUT_COPY.bookUncounted : LOADOUT_COPY.book(HUB_COPY.loadout.names(book.count));
}

/** The strip's and the Deploy card's text line: what the next BaggerBomb deploy carries. */
export function deployLineOf(cards) {
  const bb = cards.baggerbomb;
  return LOADOUT_COPY.deployLine(bb.name, bb.book.id ? bb.book.name : LOADOUT_COPY.noBook);
}

/** The desktop stage's third control and the phone stage's summary: both loadouts. */
export function loadoutSummaryOf(cards) {
  return LOADOUT_COPY.summary(cards.baggerbomb.name, cards.league.name);
}

/** The armory's context line (board 4): the game, and when a change lands or why it cannot. */
export function armoryContextOf(card) {
  if (card.kind === LOADOUT_KINDS.BAGGERBOMB) return { title: LOADOUT_COPY.context(card.game), sub: LOADOUT_COPY.contextNext, locked: false };
  if (card.state === CARD_STATE.CHECKING) return { title: LOADOUT_COPY.context(card.game), sub: LOADOUT_COPY.lines.checking, locked: true };
  if (card.locked) {
    const sub = card.lockKind === LOCK_KIND.BATTLE ? LOADOUT_COPY.contextLockedBattle
      : card.when ? LOADOUT_COPY.contextLocked(card.when) : LOADOUT_COPY.contextLockedUndated;
    return { title: LOADOUT_COPY.context(card.game), sub, locked: true };
  }
  return { title: LOADOUT_COPY.context(card.game), sub: LOADOUT_COPY.contextOpen, locked: false };
}

/** The armory's footnote under Equip (ruling N3, made context-specific): FD-1 for BaggerBomb; the lock or open line for League. */
export function armoryFootnoteOf(card) {
  return card.kind === LOADOUT_KINDS.BAGGERBOMB ? LOADOUT_COPY.footnoteBaggerbomb : lineOf(card);
}
