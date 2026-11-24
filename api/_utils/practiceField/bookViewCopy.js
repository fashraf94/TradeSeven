// api/_utils/practiceField/bookViewCopy.js
//
// Practice Field build B3 — THE IDEA BOOK SCREEN'S FIXED WORDS (rulings B3-1, B3-2, B3-5). DATA ONLY, one import (the
// agent's own failed-check sentence, so the screen and the close row say the same words). Every sentence the view
// (bookView.js) puts on the screen in the book's own voice comes from here: the design of record's fixed strings
// (docs/design/practice-field/IDEA_BOOK_ROUND_2.html), the plain-words reason for each refusal code (B3-5), each mark
// quality's "waiting on data" reason, and the result's five columns in plain words (B3-3).
//
// NO REASON IS EVER INVENTED OR TAKEN FROM THE MODEL (B3-5): a refusal code not in REFUSAL_REASONS reads
// "Refused: not admitted". The words validated, proven and supported appear nowhere here (contract §4.4).

import { CODE_FALLBACK_NOTE } from './agentConfig.js';

/** The failed-check sentence: the agent's own code-built note (agentConfig.js), the mock-up's fixed string. */
export const FAILED_CHECK = CODE_FALLBACK_NOTE;

/** An entering name, in place of its mark (the mock-up's B2_BUYS). */
export const BUYS_NEXT_WINDOW = 'Buys at the next session’s first window';

/** The sale that follows an exit or a review date (the mock-up's header line). */
export const SELLS_NEXT_WINDOW = 'sells at the next session’s first window';

/** The book line's small print and its paused line (the mock-up's BookLine2). */
export const PAPER_MONEY = 'Paper money. Your agents run this book; you watch.';
export const PAUSED_LINE = 'Code still sells at lines.';
/** Not drawn by the mock-up: a book winding down (contract §3.2). */
export const WINDING_DOWN_LINE = 'No new ideas. Code still sells at lines and settles what is open.';

/** The slots in order, with their names and lengths (the idea record's window table; windows.js slotSessions). */
export const SLOT_NAMES = Object.freeze({ short: 'Short', medium: 'Medium', long: 'Long' });

/** The desks as the screen names them (the mock-up's DESKS). `the` opens a sentence's middle. */
export const DESK_COPY = Object.freeze({
  shadow: Object.freeze({ name: 'Shadow desk', the: 'the Shadow desk', The: 'The Shadow desk', lane: 'Medium · Long' }),
  archetype: Object.freeze({ name: 'Archetype desk', the: 'the archetype desk', The: 'The archetype desk', lane: 'Short' }),
});

/** Where an idea came from, as its source chip says it (by the contract's origin kind). */
export const SOURCE_CHIPS = Object.freeze({
  founder_fixture: 'Entered by the founder',
  market_scan: 'From the price list',
  research: 'From your saved thesis',
  signaldrop: 'From a SignalDrop pick',
  conversation: 'From a conversation',
  game_moment: 'From a game moment',
  film_room_card: 'From a Film Room card',
  agent_prior_ideas: 'From the desk’s earlier ideas',
});
export const SOURCE_CHIP_UNKNOWN = 'Source on record';

/** The comparison's plain name (a sector fund names itself by its symbol). */
export const COMPARISON_NAMES = Object.freeze({
  same_stock_held: 'holding the same stocks',
  frozen_basket: 'its fixed basket',
});

/** A name's sentence when a sentence takes the place of its figures (the mock-up spans them). */
export const NAME_SENTENCES = Object.freeze({
  soldAtLine: (date) => `Sold at its line by code · ${date}`,
  // Not drawn by the mock-up: a line recognised at the close, its sale queued for the next session's first window.
  lineHit: 'Below its line · code sells at the next session’s first window',
  soldAtSettlement: (date) => `Sold at the settlement · ${date}`,
  soldAfterDelisting: (date) => `Sold after its delisting · ${date}`,
  closedByDelisting: (date) => `Closed by its delisting · ${date}`,
  delistedWaiting: 'Delisted · code sells it when a price comes',
  // A name below its line at the close (its sale queued): how far below, never "−0.3% away".
  belowLine: (pct) => `${pct} below its line`,
  soldOther: (date) => `Sold · ${date}`,
  // Not drawn by the mock-up (its note: state 3 is drawn after the close): bought at a window since the last close.
  boughtToday: 'Bought today · first mark at tonight’s close',
  waiting: 'Waiting on data',
});

/** The group header's second line, by what the idea is doing. */
export const GROUP_LINES = Object.freeze({
  entering: 'Entering',
  boughtToday: 'Bought today',
  settledToday: 'Settled today',
  day: (n, of) => `Day ${n} of ${of}`,
  sessionsLeft: (n) => `${n} session${n === 1 ? '' : 's'} left`,
});

/** The header line of an idea that reached its endpoint and waits for its one sale, by endpoint kind. */
export const SELLING_WORDS = Object.freeze({
  manager_exit: 'Exit',
  due_session: 'Review date',
  late: 'Review date',
  early_resolution: 'Ended',
});

/** An open slot. With the agent off, or the book paused or winding down, no desk looks: the slot is only open. */
export const OPEN_SLOT = Object.freeze({
  row: (slotName, deskThe, looks) => (looks ? `${slotName} · open · ${deskThe} looks tonight.` : `${slotName} · open`),
  desks: (deskThe, looks) => (looks ? `Open. ${deskThe[0].toUpperCase()}${deskThe.slice(1)} looks for an idea at tonight’s close.` : 'Open.'),
});

/**
 * A desk's Exit that code did not carry out (agentRun.js action outcomes other than `exit_settled`): said beside the call,
 * so an Exit on an idea that is still holding is never read as done.
 */
export const EXIT_NOT_CARRIED = (outcome) => {
  if (typeof outcome === 'string' && outcome.startsWith('ignored_already')) return 'It was already selling, so nothing more was done.';
  if (outcome === 'ignored_not_entered') return 'It was not bought yet, so there was nothing to sell.';
  return 'Code did not carry it out; the idea is unchanged.';
};

/** The strip's parts, in the order they are said (B3 §1 "The strip"). */
export const STRIP = Object.freeze({
  opened: (symbols) => `opened ${symbols.join(', ')}`,
  admitted: (symbols) => `admitted ${symbols.join(', ')}`,
  held: (n) => `held ${n}`,
  exit: (symbols) => `called Exit on ${symbols.join(', ')}`,
  soldAtLine: (symbols) => `${symbols.join(', ')} sold at ${symbols.length === 1 ? 'its line' : 'their lines'} by code`,
  passedOn: (n) => `passed on ${n} draft${n === 1 ? '' : 's'}`,
  sep: ' · ',
});

/** The timestamp under the table (B3-7): the session of the last recorded valuation. */
export const MARKS_AS_OF = (date) => `Marks as of the close, ${date}.`;
export const MARKS_AS_OF_UNOBSERVED = (date) => `No close was recorded for ${date}; marks are carried from the last one.`;

/** A draft's outcome word (the mock-up's Desks tab). */
export const DRAFT_OUTCOMES = Object.freeze({ admitted: 'Admitted', not_chosen: 'Not chosen', refused: 'Refused', waiting: 'Waiting' });

/**
 * B3-5 — THE REFUSAL REASONS: every refusal code the drafting path can record (contract.js, admission.js,
 * admissionMarks.js, agentDrafting.js), each a plain sentence. bookViewCopy.test.js derives the code list from those
 * modules' source, so a code added there and not here fails the test rather than silently reading the fallback.
 */
export const REFUSAL_REASONS = Object.freeze({
  // The names
  ticker_held_by_other_idea: 'it overlaps a stock the book already holds',
  name_not_a_candidate: 'the name is not on the price list',
  name_not_in_universe: 'the name is not on the price list',
  name_invalid: 'a name could not be read',
  name_duplicate: 'it names the same stock twice',
  names_count_invalid: 'it names too few or too many stocks',
  etf_not_a_name: 'a fund cannot be one of its names',
  sector_unknown: 'a name’s sector is not known',
  // The lines
  line_distance_out_of_band: 'its line was outside the allowed range',
  lines_invalid: 'its lines did not match its names',
  // The prices
  admission_marks_unavailable: 'it had no price from today’s close',
  coverage_unavailable: 'its price data could not be set up',
  close_owed: 'the book’s close had not finished',
  // The slot and the desk
  slot_occupied: 'its slot was already taken',
  slot_not_empty: 'its slot was already taken',
  slot_invalid: 'it named no slot the book has',
  slot_not_this_desks: 'it was for another desk’s slot',
  desk_invalid: 'it was for another desk’s slot',
  desk_slot_mismatch: 'it was for another desk’s slot',
  // The thesis and its source
  thesis_missing: 'it had no thesis',
  thesis_too_long: 'its thesis was too long',
  thesis_author_invalid: 'its author was not recognised',
  thesis_source_unknown: 'its saved thesis could not be found',
  sources_invalid: 'its source could not be checked',
  origin_invalid: 'its source could not be checked',
  text_invalid: 'its text held a broken character',
  // The comparison
  comparison_type_unsupported: 'its kind of comparison is not offered yet',
  comparison_fund_unknown: 'its comparison fund is not on the list',
  comparison_sector_mismatch: 'its comparison fund is for another sector',
  comparison_symbols_invalid: 'its comparison did not fit the rules',
  comparison_basket_size_invalid: 'its comparison did not fit the rules',
  weights_invalid: 'its weights did not add up',
  // The money (code sizes every draft; the agent sets none)
  capital_invalid: 'its size could not be set',
  leg_too_small: 'a name’s share was too small to buy',
  no_capital_headroom: 'the book had no room for it',
  cash_floor_breached: 'the book had no room for it',
  capital_exceeds_slot_cap: 'the book had no room for it',
  single_position_cap_exceeded: 'one name would have been too large a share of the book',
  sector_cap_exceeded: 'it would have put too much of the book in one sector',
  position_count_exceeded: 'the book already holds as many stocks as it may',
  // The book
  mode_not_admitted: 'the book is not open to new ideas',
  book_not_active: 'the book is not open to new ideas',
  book_not_found: 'the book is not open to new ideas',
  drafting_paused: 'drafting is paused',
  calendar_unsupported: 'its dates run past the market calendar',
  epoch_config_invalid: 'the book’s settings could not be read',
  // Internal answers of the engine's own calls (a replay, a race): said plainly, never as the draft's fault.
  contract_invalid: 'it could not be checked',
  op_id_conflict: 'it could not be checked',
  idea_not_found: 'it could not be checked',
  idea_already_filled: 'it could not be checked',
});
/** B3-5: what an unmapped code reads, word and reason together. */
export const REFUSAL_UNMAPPED = 'not admitted';

/**
 * WAITING ON DATA (B3 §1 "A row below full quality never shows a P/L"): one plain reason per mark quality, for the symbol
 * whose mark is not the vendor's own timed close. `vendor_time` is full quality and has no reason.
 */
export const QUALITY_REASONS = Object.freeze({
  carried_forward: (sym, date) => `${sym} has no closing price for ${date} yet.`,
  receipt_time_fallback: (sym, date) => `${sym}’s closing price for ${date} has no time from the vendor.`,
  pre_open_print: (sym, date) => `${sym}’s price for ${date} is from before the open.`,
  unobserved: (_sym, date) => `No close was recorded for ${date}.`,
  ca_coverage_missing: (sym, date) => `${sym}’s corporate-action data for ${date} is not in yet.`,
});
export const QUALITY_REASON_UNKNOWN = (sym, date) => `${sym}’s close for ${date} is not complete yet.`;
/** A row below full quality whose marks are all clean: an action waits, or a standing reason holds it. */
export const ROW_REASON_HELD = 'A corporate action on this idea waits for a ruling.';
/** A row a standing reason holds below full quality (close.js L-6): the sale stands; nothing waits. */
export const ROW_REASON_STANDING = 'The shares this idea sold differ from the shares it was owed.';
export const ROW_REASON_UNKNOWN = (date) => `This idea’s data for ${date} is not complete yet.`;

/** How a finished idea ended (History), by its result's endpoint kind. */
export const ENDED_WORDS = Object.freeze({
  due_session: (sessions) => `Ran its ${sessions} sessions`,
  early_resolution: () => 'Ended early: nothing was left to hold',
  manager_exit: () => 'Settled early by the manager',
  late: () => 'Ended after its review date',
});
export const ENDED_UNKNOWN = () => 'Finished';

/** Why a result cannot be trusted (`economic.unmeasurableBecause`), each in plain words. */
export const UNMEASURABLE_REASONS = Object.freeze({
  endpoint_session_unobserved: 'No close was recorded on its last day.',
  endpoint_after_due_session: 'It was valued after its review date.',
  idea_mark_not_full_quality: 'One of its names had no usable closing price on its last day.',
  comparison_mark_not_full_quality: 'Its comparison had no usable closing price on its last day.',
  idea_unsettled_corporate_action: 'A corporate action on one of its names was never settled.',
  comparison_unsettled_corporate_action: 'A corporate action on its comparison was never settled.',
});
export const UNMEASURABLE_STANDING = 'The shares it sold differ from the shares it was owed.';
export const UNMEASURABLE_UNKNOWN = 'Its result could not be measured.';
/** A result whose stored evidence does not check (B2 §8: the packet's hash and its parts). */
export const EVIDENCE_UNCHECKED = 'Its stored evidence could not be checked.';
export const NOT_MEASURABLE = 'Not measurable';

/**
 * B3-3 — THE RESULT'S FIVE COLUMNS, as settlement.js writes them (contract §4.4), each value in plain words. The screen's
 * main result labels are ahead, behind and inconclusive (contract §4.4); within the band is inconclusive.
 */
export const RESULT_COLUMNS = Object.freeze({
  contractCondition: Object.freeze({ label: 'Lines', values: { met: 'Held', breached: 'Line hit', unobserved: 'Not seen' } }),
  economicResult: Object.freeze({ label: 'Result', values: { ahead: 'Ahead', behind: 'Behind', within_band: 'Inconclusive', unmeasurable: NOT_MEASURABLE } }),
  processQuality: Object.freeze({ label: 'Process', values: { followed_plan: 'Followed the plan', deviated: 'Deviated', blocked: 'Waited on data' } }),
  evidenceScope: Object.freeze({ label: 'Evidence', values: { single_forward_observation: 'One run', repeated_comparable: 'Repeated', controlled_experiment: 'Controlled' } }),
  adoption: Object.freeze({ label: 'Adoption', values: { no_offer: 'No offer', offered: 'Offered', accepted: 'Accepted', expired: 'Expired', retired: 'Retired' } }),
});
export const RESULT_VALUE_UNKNOWN = '—';

/** The empty History. */
export const NO_FINISHED_IDEAS = 'No finished ideas yet.';
