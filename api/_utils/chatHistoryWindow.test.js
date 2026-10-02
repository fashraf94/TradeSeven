// api/_utils/chatHistoryWindow.test.js
//
// Cockpit Build 1a — THE HISTORY WINDOWS (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §3 "History windows", §15.1; Astra B1R2-5).
//
// Two history windows read chatExchanges: the legacy chat window (chat.js —
// the last ten exchanges, research cards out first, then the null-user drop)
// and the grounded window (voiceLayerGrounding.js selectHistoryWindow, which
// buildGroundedConversationHistory and buildEarlierMessagesBlock read). Both
// SLICE BEFORE they drop agent-initiated entries, so a cockpit filing — an
// exchange with `source: 'cockpit'` and no user half — would displace one
// ordinary turn from the window if it were merely dropped afterwards.
//
// THE PRE-BUILD FIXTURE (api/_utils/__fixtures__/historyWindowPreBuild.json)
// holds what both windows (and the two blocks that read them) returned on the
// untouched tree — origin/main @ 9dfbea21, before any Build 1a source change —
// for one exchange list: ONCE without any cockpit filing (what every window
// must equal at CALL_RECORDS_MODE 'off' / 'shadow' once cockpit filings are
// present — the pre-build window, exactly) and ONCE with two cockpit filings
// inserted (the chip-like treatment the resolved 'on' mode keeps: sliced in,
// then excluded). SHA-256 pinned. Regenerate ONLY from such a tree:
//   GENERATE_HISTORY_WINDOW_PREBUILD=1 npx vitest run api/_utils/chatHistoryWindow.test.js
// The generating run fails on purpose after writing, and refuses CI.
//
// The import of ./voiceLayerGrounding.js is the BUILD_RULES §4 dependency-surface
// guard and must never be mocked.

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectHistoryWindow, buildGroundedConversationHistory, buildEarlierMessagesBlock, buildPlatformResearchBlock,
} from './voiceLayerGrounding.js';
import { RESEARCH_MESSAGE_TYPE } from '../../src/data/decisionRecord.js';
import { selectLegacyChatHistory, excludeCockpitFilings, isCockpitFiling, COCKPIT_SOURCE } from './chatHistoryWindow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(HERE, '__fixtures__/historyWindowPreBuild.json');
/** The fixture's SHA-256 as captured from the untouched tree. */
const FIXTURE_SHA256 = '802163826276d6aa483b8887f6a63ec0f139d5427a8fe3faa9637dbebd11ae30';
const ENV = globalThis.process?.env || {};
const GENERATE = ENV.GENERATE_HISTORY_WINDOW_PREBUILD === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_HISTORY_WINDOW_PREBUILD is a local, deliberate act — never on CI');

// ---------------------------------------------------------------------------
// The exchange list: 14 entries, so a window of ten is exceeded and the slice
// is what decides membership. Ordinary pairs, a first message, a legacy
// proactive line (no marker), a research card, a chip filing.

const pair = (n, ts) => ({
  userMessage: `Question ${n}?`, agentResponse: `Answer ${n}.`, scratchpad: null, hasDirective: false, directive: null,
  directiveThreadId: null, suggestedActions: null, elicitationTarget: 'risk_appetite', timestamp: ts, mode: 'battle',
});
const T = (m) => `2026-09-09T${String(13 + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00.000Z`;

export const EXCHANGES_WITHOUT_COCKPIT = Object.freeze([
  pair(1, T(31)),
  { userMessage: null, agentResponse: "Agent's live. Leaning into semis today.", scratchpad: null, hasDirective: false, directive: null, suggestedActions: null, elicitationTarget: 'first_message', timestamp: T(32), mode: 'battle', messageType: 'first_message', groundingVersion: 1 },
  pair(2, T(40)),
  { userMessage: null, agentResponse: 'Legacy proactive line (no marker).', scratchpad: null, hasDirective: false, directive: null, suggestedActions: null, elicitationTarget: 'anticipation', timestamp: T(45), mode: 'battle', isAutoDebrief: true },
  pair(3, T(50)),
  { userMessage: null, agentResponse: '', scratchpad: null, hasDirective: false, directive: null, suggestedActions: null, elicitationTarget: 'research', timestamp: T(55), mode: 'battle', messageType: RESEARCH_MESSAGE_TYPE, groundingVersion: 1, card: { symbol: 'AMD', platformDataLabel: 'platform data as of 2026-09-09', technicals: { label: 'Technicals (as of 2026-09-09)', facts: ['RS 88th %ile', 'above the 20-day'] }, fundamentals: null, standing: { line: 'Bench, support candidate' } } },
  { userMessage: null, agentResponse: '', scratchpad: null, hasDirective: true, directive: { text: 'Require stronger confirmation before entering', expiry: 'end_of_battle', directiveThreadId: 'thread-chip-0001', adjustmentId: 'TF-02', canonicalTextVersion: 1 }, directiveThreadId: 'thread-chip-0001', suggestedActions: null, elicitationTarget: 'directive_filed', timestamp: T(60), mode: 'battle', messageType: 'directive_filed', source: 'chip', groundingVersion: 1 },
  pair(4, T(65)), pair(5, T(70)), pair(6, T(75)), pair(7, T(80)), pair(8, T(85)), pair(9, T(90)), pair(10, T(95)),
]);

/** A cockpit filing: chip-shaped, `source: 'cockpit'`, a call-family directive record. */
export function makeCockpitFiling(n, ts) {
  return {
    userMessage: null, agentResponse: '', scratchpad: null, hasDirective: true,
    directive: {
      text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: `thread-call-000${n}`,
      family: 'call', expiresAtMs: Date.parse('2026-09-09T20:00:00.000Z'), basis: 'this_session', callId: `battle-1:eval_00${n}:call:0`,
      kind: 'call_hold', action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' },
      answerId: `battle-1:eval_00${n}:call:0:answer:hold:`, filedAt: ts, textVersion: 'callActions.v1',
    },
    directiveThreadId: `thread-call-000${n}`, suggestedActions: null, elicitationTarget: 'directive_filed', timestamp: ts,
    mode: 'battle', messageType: 'directive_filed', source: 'cockpit', groundingVersion: 1, callId: `battle-1:eval_00${n}:call:0`,
  };
}

/** The same list with two cockpit filings: one inside the window of ten, one last. */
export function withCockpitFilings(list = EXCHANGES_WITHOUT_COCKPIT) {
  const out = [...list];
  out.splice(6, 0, makeCockpitFiling(1, T(57)));
  out.push(makeCockpitFiling(2, T(96)));
  return out;
}

/**
 * THE PRE-BUILD LEGACY CHAT WINDOW — chat.js:664-675 at 9dfbea21, copied
 * verbatim: research cards out, the last ten, then the null-user drop, then
 * the alternating user/assistant array the model receives. Kept here as the
 * historical definition the shared helper is held to.
 */
export function legacyChatHistoryAtHead(chatExchanges) {
  const previousExchanges = (chatExchanges || [])
    .filter((ex) => ex?.messageType !== RESEARCH_MESSAGE_TYPE)
    .slice(-10)
    .filter((ex) => typeof ex?.userMessage === 'string' && ex.userMessage.length > 0);
  return previousExchanges.flatMap((ex) => [
    { role: 'user', content: ex.userMessage },
    { role: 'assistant', content: ex.agentResponse || ex.agentMessage || '' },
  ]);
}

/** Every window output for one exchange list, as the untouched tree computes them. */
export function windowOutputs(chatExchanges) {
  return {
    legacyHistory: legacyChatHistoryAtHead(chatExchanges),
    grounded: selectHistoryWindow(chatExchanges),
    groundedHistory: buildGroundedConversationHistory(chatExchanges),
    earlierMessagesBlock: buildEarlierMessagesBlock(chatExchanges),
    platformResearchBlock: buildPlatformResearchBlock(chatExchanges),
  };
}

const serialize = (v) => JSON.stringify(v);

describe('the pre-build history-window fixture (captured from the untouched tree)', () => {
  it('GENERATE (local only) or load the frozen fixture', () => {
    if (!GENERATE) {
      expect(existsSync(FIXTURE_PATH), 'fixture missing — it is captured once, from the untouched tree').toBe(true);
      return;
    }
    writeFileSync(FIXTURE_PATH, `${JSON.stringify({
      capturedFrom: 'origin/main @ 9dfbea21dbb1c22f2e35009d95ef60a51f00078a — the untouched tree, before any Build 1a source change',
      exchangesWithoutCockpit: EXCHANGES_WITHOUT_COCKPIT,
      exchangesWithCockpit: withCockpitFilings(),
      outputs: {
        withoutCockpit: windowOutputs(EXCHANGES_WITHOUT_COCKPIT),
        withCockpit: windowOutputs(withCockpitFilings()),
      },
    }, null, 2)}\n`);
    throw new Error(`fixture written to ${FIXTURE_PATH} — this generating run fails on purpose; re-run WITHOUT GENERATE_HISTORY_WINDOW_PREBUILD to verify`);
  });

  const fixture = existsSync(FIXTURE_PATH) ? JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) : null;

  it('the fixture file is exactly the one captured from the untouched tree (SHA-256 pinned, LF)', () => {
    expect(createHash('sha256').update(readFileSync(FIXTURE_PATH)).digest('hex')).toBe(FIXTURE_SHA256);
    expect(readFileSync(FIXTURE_PATH).includes(0x0d)).toBe(false);
    const attributes = readFileSync(resolve(HERE, '../../.gitattributes'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    expect(attributes).toContain('api/_utils/__fixtures__/historyWindowPreBuild.json text eol=lf');
  });

  it('the fixture is not vacuous: the cockpit filings DISPLACE an ordinary turn on the untouched tree (the hazard the build removes at off/shadow)', () => {
    expect(fixture).not.toBeNull();
    const without = fixture.outputs.withoutCockpit;
    const withC = fixture.outputs.withCockpit;
    // Without: research cards leave before the slice, so the last ten of thirteen hold pairs 3..10 (eight pairs).
    expect(without.legacyHistory.length).toBe(2 * 8);
    expect(without.grounded.pairs.map((p) => p.userMessage)).toEqual(['Question 3?', 'Question 4?', 'Question 5?', 'Question 6?', 'Question 7?', 'Question 8?', 'Question 9?', 'Question 10?']);
    expect(without.platformResearchBlock).toContain('AMD');
    // With: the two filings take slots in both windows, so pair 3 falls out of each — and the research
    // card, whose block slices the RAW list, is pushed out of its window too (the card vanishes).
    expect(withC.legacyHistory.length).toBe(2 * 7);
    expect(withC.grounded.pairs.map((p) => p.userMessage)).toEqual(['Question 4?', 'Question 5?', 'Question 6?', 'Question 7?', 'Question 8?', 'Question 9?', 'Question 10?']);
    expect(withC.platformResearchBlock).toBeNull();
    // Neither window ever renders a cockpit filing's words: no user half, excluded as a chip filing.
    expect(serialize(withC)).not.toContain('Hold off on the AMD entry');
    expect(serialize(withC)).not.toContain('thread-call-000');
  });

  it('the untouched functions reproduce the fixture on the cockpit-free list', () => {
    expect(serialize(windowOutputs(fixture.exchangesWithoutCockpit))).toBe(serialize(fixture.outputs.withoutCockpit));
    expect(serialize(EXCHANGES_WITHOUT_COCKPIT)).toBe(serialize(fixture.exchangesWithoutCockpit));
    expect(serialize(withCockpitFilings())).toBe(serialize(fixture.exchangesWithCockpit));
  });
});

// ---------------------------------------------------------------------------
// THE BUILD: with cockpit filings present, every window equals the pre-build
// window at off / shadow / no mode, and the chip-like window at on.

/** The build's window outputs for one list and one resolved mode. */
function builtOutputs(chatExchanges, callsMode) {
  return {
    legacyHistory: selectLegacyChatHistory(chatExchanges, { callsMode }),
    grounded: selectHistoryWindow(chatExchanges, { callsMode }),
    groundedHistory: buildGroundedConversationHistory(chatExchanges, { callsMode }),
    earlierMessagesBlock: buildEarlierMessagesBlock(chatExchanges, { callsMode }),
    platformResearchBlock: buildPlatformResearchBlock(chatExchanges, { callsMode }),
  };
}

describe('Build 1a — cockpit filings leave every window BEFORE the slice unless the resolved mode is on (spec §3)', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  const withC = fixture.exchangesWithCockpit;

  for (const mode of ['off', 'shadow', null, undefined]) {
    it(`mode ${String(mode)}: every window with the two cockpit filings present equals the PRE-BUILD window without them`, () => {
      expect(serialize(builtOutputs(withC, mode))).toBe(serialize(fixture.outputs.withoutCockpit));
    });
  }

  it("mode on: the chip-like treatment — sliced in, then excluded (the untouched tree's own output with the filings present)", () => {
    expect(serialize(builtOutputs(withC, 'on'))).toBe(serialize(fixture.outputs.withCockpit));
  });

  it('without cockpit filings the build equals the pre-build window in every mode (behavior-preserving)', () => {
    for (const mode of ['off', 'shadow', 'on', null]) {
      expect(serialize(builtOutputs(fixture.exchangesWithoutCockpit, mode)), String(mode)).toBe(serialize(fixture.outputs.withoutCockpit));
    }
  });

  it('selectLegacyChatHistory IS the pre-build chat.js expression on any cockpit-free list (the historical definition above)', () => {
    for (const list of [fixture.exchangesWithoutCockpit, [], [pair(1, T(1))], [pair(1, T(1)), { userMessage: null, agentResponse: 'x', messageType: 'anticipation' }], undefined]) {
      expect(selectLegacyChatHistory(list, { callsMode: 'off' })).toEqual(legacyChatHistoryAtHead(list));
      expect(selectLegacyChatHistory(list)).toEqual(legacyChatHistoryAtHead(list));
    }
  });

  it('the filter keys on the durable source marker only — a chip filing is never removed; a non-array passes through', () => {
    const filing = makeCockpitFiling(3, T(10));
    expect(isCockpitFiling(filing)).toBe(true);
    expect(isCockpitFiling({ ...filing, source: 'chip' })).toBe(false);
    expect(isCockpitFiling({ ...filing, source: undefined })).toBe(false);
    expect(isCockpitFiling(null)).toBe(false);
    expect(COCKPIT_SOURCE).toBe('cockpit');
    const list = [pair(1, T(1)), { ...filing, source: 'chip' }, filing];
    expect(excludeCockpitFilings(list, 'off')).toEqual([list[0], list[1]]);
    expect(excludeCockpitFilings(list, 'shadow')).toEqual([list[0], list[1]]);
    expect(excludeCockpitFilings(list, 'on')).toBe(list);
    expect(excludeCockpitFilings('not-a-list', 'off')).toBe('not-a-list');
  });

  it('source pins: chat.js reads the shared helper for the legacy window and hands the grounded builders the resolved mode; the voice prompt passes callsMode through', () => {
    const chat = readFileSync(resolve(HERE, '../agent/chat.js'), 'utf8');
    expect(chat).toContain("import { selectLegacyChatHistory } from '../_utils/chatHistoryWindow.js';");
    expect(chat).toContain('const conversationHistoryOld = selectLegacyChatHistory(battle.chatExchanges, { callsMode });');
    expect(chat.match(/buildGroundedConversationHistory\(battle\.chatExchanges, \{ callsMode \}\)/g)).toHaveLength(2);
    expect(chat).not.toMatch(/\.slice\(-10\)/);
    expect(chat).toContain('const callsMode = resolveCallRecordsMode(battle);');
    // The research-reply lint judges the SAME window the prompt rendered (BUILD_RULES §9 display-agreement; review L3 B-1).
    expect(chat).toContain('buildPlatformResearchBlock(battle?.chatExchanges, { callsMode }) !== null');
    const prompt = readFileSync(resolve(HERE, 'voiceLayerPrompt.js'), 'utf8');
    expect(prompt).toContain('buildEarlierMessagesBlock(battle?.chatExchanges, { callsMode })');
    expect(prompt).toContain('buildPlatformResearchBlock(battle?.chatExchanges, { callsMode })');
  });
});
