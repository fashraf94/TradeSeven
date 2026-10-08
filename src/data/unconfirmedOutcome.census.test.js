// src/data/unconfirmedOutcome.census.test.js
//
// Enforce readiness (8 Oct 2026) — the Part 1 surface census, executable.
// Report: docs/audits/20261008_BUILD_ENFORCE_READINESS.md §2; table G is
// docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md (V1.4).
//
// The markers the integrity follow-up 2 build added — `executionOutcome:
// 'unknown'` (entries, and the risk loop's / R11 pass's `message: null` beats),
// `executionLanded`, `auto_execution_unknown`, `heldLegs` / `heldLegCount`, a
// leg's `not_run` — reach the client on three records: `evaluations[]`, the
// `statusFeed`, and the two histories. This file pins WHICH client files can
// see each record, with the census disposition of each, so a new reader fails
// here until it is ruled — and drives the pure surfaces with every marker.
// The rendering surfaces have their own rows (unconfirmedOutcome.surfaces.test.js,
// unconfirmedOutcome.feed.jsdom.test.jsx, WhyPanel.render, AgentDesk.render,
// the Flat6 pane's record test, AgentChat.test.js).
//
// The scan reads source with comments stripped: a file that only MENTIONS a
// record in prose is not a reader.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusFeedToVoice } from '../components/League/battleArena/statusFeedToVoice';
import { statusFeedToEvents } from '../components/AgentPresence/presenceBinding';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// A filesystem walk, not `git ls-files`: an LF `git archive` snapshot has no .git.
const SOURCES = readdirSync(path.join(REPO, 'src'), { recursive: true })
  .map((f) => `src/${String(f).split(path.sep).join('/')}`)
  .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.|__fixtures__|__snapshots__/.test(f))
  .sort();
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const CODE = new Map(SOURCES.map((f) => [f, stripComments(readFileSync(path.join(REPO, f), 'utf8'))]));
const readersOf = (re) => [...CODE].filter(([, code]) => re.test(code)).map(([f]) => f).sort();

/**
 * Every client file whose CODE names the feed, with its census disposition for
 * a beat carrying a marker. `fixed` = changed by this build; the rest render
 * something true or nothing without a change.
 */
const FEED_READERS = {
  'src/adapters/baggerbombAdapter.js': 'Desk line: carries `message` as is (null) — AgentDesk renders no line; alert feed is time-bounded only',
  'src/components/Agent/AgentActivityFeed.jsx': 'FIXED: a line-less marked beat is not a card; a marked beat never takes its action’s label',
  'src/components/Agent/AgentChat.jsx': 'flag-off trade line admits swap actions only; tape joins read directive ids — nothing rendered for it',
  'src/components/Agent/AgentFilmRoom.ARCHIVED.jsx': 'DEAD — no importer',
  'src/components/Agent/AgentStrategyTab.ARCHIVED.jsx': 'DEAD — no importer',
  'src/components/Agent/ForgeCitationCard.jsx': 'dormant under the pane; counts citedRules (the rule did call for the exit) — no line',
  'src/components/Agent/GameTapeView.jsx': 'FIXED (dormant under the pane): bookmarks skip a line-less beat; a marked beat is headed `Update`, never its action',
  'src/components/Agent/HypothesisTicker.jsx': 'DEAD — imported, never rendered; reads hypothesis entries only',
  'src/components/Agent/LiveActivityPanel.jsx': 'pulse (dormant): `Agent is active.` fallback; breakthrough alerts admit gameplan_meeting only',
  'src/components/Agent/StatusFeedTimeline.jsx': 'DEAD — only importer is AgentStrategyTab.ARCHIVED.jsx',
  'src/components/AgentPresence/presenceBinding.js': 'swap actions only — a marked beat is no event',
  'src/components/AgentPresence/useAgentPresence.js': 'pass-through to statusFeedToEvents',
  'src/components/Dashboard/desk/AgentDesk.jsx': 'renders the latest line only when it has a message — nothing for a line-less beat',
  'src/components/League/battleArena/statusFeedToVoice.js': 'drops a beat with no text — nothing for a line-less beat',
  'src/components/Tournament/Flat6BattleView.jsx': 'FIXED: a line-less beat is dropped before the window (was its raw action `risk_swap_failed`, to spectators too)',
  'src/hooks/useAgentBattle.js': 'pass-through',
  'src/screens/AgentBattleScreen.jsx': 'pass-through; flag-off unread dot counts feed length (dormant)',
  'src/screens/agentBattleScreenGoldenFixture.js': 'test data',
  'src/screens/battleView/ArenaHeader.jsx': 'passes `statusFeed: null` — not a reader',
  'src/screens/battleView/CharacterAvatar.jsx': 'passes `statusFeed: null` — not a reader',
  'src/screens/battleView/CharacterPane.jsx': 'passes `statusFeed: null` — not a reader',
  'src/screens/battleView/PaneTape.jsx': 'FIXED: bookmarks skip a line-less beat; mounts the log',
  'src/screens/battleView/buildTape.js': 'joins trades / deferred checks by id and pair — renders no beat message or action',
  'src/screens/battleView/shadowCpuQuoteIntegrity.js': 'returns `statusFeed: null` — not a reader',
};
/** Every client file whose code names `proposalHistory`. */
const PROPOSAL_READERS = {
  'src/components/Agent/AgentChat.jsx': 'filterUnansweredProposals admits `lapsed` only — `auto_execution_unknown` and every marker render nothing',
  'src/screens/AgentBattleScreen.jsx': 'pass-through to AgentChat',
  'src/screens/agentBattleScreenGoldenFixture.js': 'test data',
};
/** Every client file whose code reads a marker by name. */
const MARKER_READERS = {
  'src/data/decisionRecord.js': 'the table G vocabulary: executionOutcomeUnconfirmed, feedBeatUnconfirmed, feedBeatWithoutLine',
  'src/screens/battleView/selectWhyState.js': 'the Why? state: the marker before every decision state',
};

describe('the census is complete — a new reader fails here until it is ruled', () => {
  it('every client file that names the feed is in the census, and every census entry still names it', () => {
    expect(readersOf(/\bstatusFeed\b/)).toEqual(Object.keys(FEED_READERS).sort());
  });

  it('every client file that names proposalHistory is in the census', () => {
    expect(readersOf(/\bproposalHistory\b/)).toEqual(Object.keys(PROPOSAL_READERS).sort());
  });

  it('no client file reads the meeting history, held legs or a leg’s outcome — nothing renders them', () => {
    expect(readersOf(/\bgameplanMeetingHistory\b|\bheldLegs\b|\bheldLegCount\b|'not_run'|\bexecutionFailed\b|\blegRefusals\b/)).toEqual([]);
  });

  it('only the ruled modules read a marker by name', () => {
    expect(readersOf(/executionOutcome|executionLanded|auto_execution_unknown|confirmed_after_error|risk_swap_failed/)).toEqual(Object.keys(MARKER_READERS).sort());
  });
});

// ── the pure surfaces, fed every beat shape ──────────────────────────────────
const RISK_UNKNOWN = { timestamp: '2026-09-09T15:01:00.000Z', message: null, action: 'risk_swap_failed', source: 'risk_manager', executionOutcome: 'unknown', symbolOut: 'KO', symbolIn: 'AMD' };
const PASS_UNKNOWN = { ...RISK_UNKNOWN, timestamp: '2026-09-09T15:02:00.000Z', source: 'guardrail' };
const PUBLIC_UNKNOWN = { timestamp: '2026-09-09T15:03:00.000Z', message: null, action: 'risk_swap_failed', symbolOut: 'KO', symbolIn: 'AMD' };
const MODEL_STATUS = { timestamp: '2026-09-09T15:04:00.000Z', message: 'Rotating KO into AMD.', action: 'hold', source: 'haiku', executionOutcome: 'unknown' };
// A success beat after an executor error whose read-back found the trade (Part D): a swap that happened.
const LANDED = { timestamp: '2026-09-09T15:05:00.000Z', message: 'Emergency exit: KO → AMD', action: 'emergency_swap', symbolOut: 'KO', symbolIn: 'AMD', executionLanded: 'confirmed_after_error' };

describe('the arena voice lane (statusFeedToVoice)', () => {
  it('a line-less beat is no line; a marked beat with words keeps them; nothing is "null" or "undefined"', () => {
    const { live } = statusFeedToVoice({ statusFeed: [RISK_UNKNOWN, PASS_UNKNOWN, PUBLIC_UNKNOWN, MODEL_STATUS] }, '2026-09-09T15:10:00.000Z', 'Aurora');
    expect(live.map((l) => l.text)).toEqual(['Rotating KO into AMD.']);
    expect(JSON.stringify(live)).not.toMatch(/risk_swap_failed|null|undefined/);
  });
});

describe('the presence face (statusFeedToEvents)', () => {
  it('an exit whose outcome could not be confirmed is no swap event; a landed one is', () => {
    expect(statusFeedToEvents([RISK_UNKNOWN, PASS_UNKNOWN, PUBLIC_UNKNOWN, MODEL_STATUS])).toEqual([]);
    expect(statusFeedToEvents([LANDED])).toHaveLength(1);
  });
});
