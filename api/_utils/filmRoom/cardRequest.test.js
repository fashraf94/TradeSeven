// api/_utils/filmRoom/cardRequest.test.js
//
// Film Room B2 item 5 — the card endpoint's request boundary (Build B spec
// §4; Amendment G RG-8): the note (S10, code points after trimming; a control
// character refused, never stripped), the question menu (S11), and the moment
// matched exactly against the moments the helper derives from a day's STORED
// tags.items.

import { describe, it, expect } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): cardRequest.js imports src/data/situationQuestions.js, src/data/cardSlots.js,
// src/utils/filmRoomMoments.js and src/utils/tapeSchedule.js; this import is the runtime guard that they stay Node-clean — never mocked.
import { parseCreateBody, parseRetireBody, normalizeNote, noteLength, questionFor, momentOfDay, NOTE_MAX_CHARS, CONTROL_CHAR } from './cardRequest.js';
import { CARD_SLOTS } from '../../../src/data/cardSlots.js';
import { SITUATION_QUESTIONS } from '../../../src/data/situationQuestions.js';

const code = (fn) => { try { fn(); return null; } catch (e) { return e.cardInput ? e.code : `thrown:${e.message}`; } };
const T0 = Date.parse('2026-09-24T13:30:20.000Z');
const atOf = (seq) => new Date(T0 + (seq - 1) * 15 * 60_000).toISOString();
const item = (symbol, seq, extra = {}) => ({ situationId: 'stalled', version: 2, symbol, tickSeq: seq, at: atOf(seq), count: 3, effectiveTicksThreshold: 5, ...extra });
const GOOD = { opId: 'op_1', battleId: 'b-1', etDate: '2026-09-24', agentId: 'agent-1', moment: { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', note: ' Let it go sooner. ', route: 'watch' };

describe('the note — S10 after trimming, control characters refused', () => {
  it('S10 is the slots module\'s 280; the length counts code points after trimming', () => {
    expect(NOTE_MAX_CHARS).toBe(CARD_SLOTS.S10.noteMaxChars);
    expect(NOTE_MAX_CHARS).toBe(280);
    expect(noteLength('  ab  ')).toBe(2);
    expect(noteLength('😀'.repeat(3))).toBe(3);   // three code points, six UTF-16 units
    expect(noteLength(null)).toBe(0);
  });
  it('trims, keeps the words verbatim, and accepts exactly 280 code points — astral characters counted once', () => {
    expect(normalizeNote('  Let it go sooner.  ')).toBe('Let it go sooner.');
    expect(normalizeNote('x'.repeat(280))).toHaveLength(280);
    expect(normalizeNote('😀'.repeat(280))).toBe('😀'.repeat(280));
    expect(normalizeNote(`  ${'x'.repeat(280)}  `)).toHaveLength(280);
  });
  it('refuses 281 code points after trimming, a control character anywhere inside (a newline, a tab, DEL, NUL) — never stripped — and an empty or non-string note', () => {
    expect(code(() => normalizeNote('x'.repeat(281)))).toBe('note_too_long');
    expect(code(() => normalizeNote('😀'.repeat(281)))).toBe('note_too_long');
    for (const c of ['\n', '\t', '\u007f', '\u0000', '\r', '\u001b']) expect(code(() => normalizeNote(`let it${c}go`)), JSON.stringify(c)).toBe('note_control_char');
    expect(code(() => normalizeNote(''))).toBe('note_empty');
    expect(code(() => normalizeNote('   '))).toBe('note_empty');
    expect(code(() => normalizeNote(42))).toBe('note_required');
    expect(code(() => normalizeNote(undefined))).toBe('note_required');
    expect(CONTROL_CHAR.test('plain words, punctuation; and é ü — fine')).toBe(false);
  });
  it('whitespace at the ends is trimmed, not refused: a trailing newline goes with the trim; one inside stays a refusal', () => {
    expect(normalizeNote('words\n')).toBe('words');
    expect(code(() => normalizeNote('two\nlines'))).toBe('note_control_char');
  });
});

describe('parseCreateBody / parseRetireBody — typed, every field checked', () => {
  it('a good create body, typed, with the note trimmed and no questionVersion unless sent', () => {
    expect(parseCreateBody(GOOD)).toEqual({ ...GOOD, note: 'Let it go sooner.', questionVersion: null });
    expect(parseCreateBody({ ...GOOD, questionVersion: 1 }).questionVersion).toBe(1);
    expect(parseCreateBody({ ...GOOD, moment: { ...GOOD.moment, fromTickSeq: null, toTickSeq: null } }).moment).toEqual({ situationId: 'stalled', symbol: 'ACN', fromTickSeq: null, toTickSeq: null });
  });
  it.each([
    ['opId', 'a/b', 'invalid_op_id'], ['opId', undefined, 'invalid_op_id'], ['battleId', '', 'invalid_battle_id'], ['agentId', 'x y', 'invalid_agent_id'],
    ['etDate', '2026-13-01', 'invalid_et_date'], ['etDate', '20260924', 'invalid_et_date'],
    ['moment', null, 'invalid_moment'], ['moment', { symbol: 'ACN' }, 'invalid_moment'], ['moment', { situationId: 'stalled', symbol: 'ACN', fromTickSeq: '4', toTickSeq: 5 }, 'invalid_moment'], ['moment', { situationId: 'stalled', symbol: 'ACN', fromTickSeq: -1, toTickSeq: 5 }, 'invalid_moment'],
    ['questionId', 7, 'invalid_question'], ['questionVersion', 0, 'invalid_question'], ['questionVersion', '1', 'invalid_question'],
    ['note', 'x'.repeat(281), 'note_too_long'], ['route', 'practice', 'invalid_route'], ['route', undefined, 'invalid_route'],
  ])('a bad %s (%j) → %s', (field, value, want) => {
    expect(code(() => parseCreateBody({ ...GOOD, [field]: value }))).toBe(want);
  });
  it('a retire body: opId, agentId, entryId and a positive integer expectedVersion', () => {
    expect(parseRetireBody({ opId: 'r1', agentId: 'agent-1', entryId: 'op_1', expectedVersion: 1 })).toEqual({ opId: 'r1', agentId: 'agent-1', entryId: 'op_1', expectedVersion: 1 });
    expect(code(() => parseRetireBody({ opId: 'r1', agentId: 'agent-1', entryId: 'op_1', expectedVersion: 0 }))).toBe('invalid_expected_version');
    expect(code(() => parseRetireBody({ opId: 'r1', agentId: 'agent-1', entryId: 'a/b', expectedVersion: 1 }))).toBe('invalid_entry_id');
    expect(code(() => parseRetireBody(null))).toBe('invalid_op_id');
  });
});

describe('questionFor — the menu for the moment\'s situation and version (S11)', () => {
  it('each of the three stalled questions, by id; a version that is not the menu\'s is refused; another situation has no menu', () => {
    for (const q of SITUATION_QUESTIONS) expect(questionFor('stalled', q.id)).toBe(q);
    expect(questionFor('stalled', 'stalled.want', 1)).toBe(SITUATION_QUESTIONS[0]);
    expect(questionFor('stalled', 'stalled.want', 2)).toBeNull();
    expect(questionFor('stalled', 'stalled.nope')).toBeNull();
    expect(questionFor('down', 'stalled.want')).toBeNull();
    expect(questionFor('stalled', '')).toBeNull();
  });
});

describe('momentOfDay — only a moment the stored items hold, matched exactly', () => {
  const tape = { tags: { items: [item('ACN', 4), item('ACN', 5), item('MSFT', 8)] } };
  it('the whole moment: found, with the situation version its items were tagged under', () => {
    expect(momentOfDay(tape, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 })).toEqual({
      moment: { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, from: atOf(4), to: atOf(5), checks: 2 }, situationVersion: 2,
    });
    expect(momentOfDay(tape, { situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 8, toTickSeq: 8 }).moment.checks).toBe(1);
  });
  it('a sub-range, a superset, the whole day, another symbol, another situation, a day with no items: null (the mutant: a moment the items do not hold)', () => {
    for (const wanted of [
      { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 4 },
      { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 5, toTickSeq: 5 },
      { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 3, toTickSeq: 5 },
      { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 1, toTickSeq: 26 },
      { situationId: 'stalled', symbol: 'NVDA', fromTickSeq: 4, toTickSeq: 5 },
      { situationId: 'down', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 },
      { situationId: 'stalled', symbol: 'ACN', fromTickSeq: null, toTickSeq: null },
    ]) expect(momentOfDay(tape, wanted), JSON.stringify(wanted)).toBeNull();
    expect(momentOfDay({ tags: { items: null } }, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 })).toBeNull();
    expect(momentOfDay({}, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 })).toBeNull();
  });
  it('the version is the first item\'s; an item with no version gives null, never a guess', () => {
    const t = { tags: { items: [{ ...item('ACN', 4), version: undefined }, item('ACN', 5)] } };
    expect(momentOfDay(t, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }).situationVersion).toBeNull();
  });
});

// ── the review's rows (docs/audits/20261021_BUILD_FILM_ROOM_B2_CARD.md §9) ──
describe('review L1-5 / L2-5 — every control character (Unicode Cc), C1 included, is refused; review L2-6 — a reserved __id__ is refused', () => {
  it('C1 controls (U+0080–U+009F) are refused like C0 and DEL; a letter with a diacritic, an emoji and a non-breaking space pass', () => {
    for (const c of ['\u0085', '\u009c', '\u0080', '\u009f']) expect(code(() => normalizeNote(`let it${c}go`)), JSON.stringify(c)).toBe('note_control_char');
    expect(normalizeNote('café 😀 x\u00a0y')).toBe('café 😀 x\u00a0y');
    expect(CONTROL_CHAR.test('\u0085')).toBe(true);
    expect(CONTROL_CHAR.test('\u2028')).toBe(false);   // a line separator is not Cc: outside the spec's refusal
  });
  it('an id of the form __x__ passes the forge-id class but is a reserved Firestore id: refused as an op id, a battle id, an agent id and an entry id', () => {
    expect(code(() => parseCreateBody({ ...GOOD, opId: '__op__' }))).toBe('invalid_op_id');
    expect(code(() => parseCreateBody({ ...GOOD, battleId: '__b__' }))).toBe('invalid_battle_id');
    expect(code(() => parseCreateBody({ ...GOOD, agentId: '__a__' }))).toBe('invalid_agent_id');
    expect(code(() => parseRetireBody({ opId: 'r1', agentId: 'agent-1', entryId: '__e__', expectedVersion: 1 }))).toBe('invalid_entry_id');
    expect(parseCreateBody({ ...GOOD, opId: '_op_' }).opId).toBe('_op_');   // one underscore each side is not reserved
    expect(parseCreateBody({ ...GOOD, opId: '__op' }).opId).toBe('__op');
  });
});
