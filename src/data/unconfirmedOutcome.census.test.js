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
  'src/adapters/baggerbombAdapter.js': 'FIXED: the Desk line is null when the newest beat is marked — AgentDesk renders no line (never an older line standing in); alert feed is time-bounded only',
  'src/components/Agent/AgentActivityFeed.jsx': 'FIXED: a marked beat is not a card — line-less (was an empty `Update` card) or worded (words written before the swap ran)',
  'src/components/Agent/AgentChat.jsx': 'flag-off trade line admits swap actions only; tape joins read directive ids — nothing rendered for it',
  'src/components/Agent/AgentFilmRoom.ARCHIVED.jsx': 'DEAD — no importer',
  'src/components/Agent/AgentStrategyTab.ARCHIVED.jsx': 'DEAD — no importer',
  'src/components/Agent/ForgeCitationCard.jsx': 'dormant under the pane; counts citedRules (the rule did call for the exit) — no line',
  'src/components/Agent/GameTapeView.jsx': 'FIXED (dormant under the pane): bookmarks skip a marked beat (was a raw-action header over `No details available`)',
  'src/components/Agent/HypothesisTicker.jsx': 'DEAD — imported, never rendered; reads hypothesis entries only',
  'src/components/Agent/LiveActivityPanel.jsx': 'FIXED (pulse dormant): a marked newest beat lends no words — the neutral `Agent is active.`; breakthrough alerts admit gameplan_meeting only',
  'src/components/Agent/StatusFeedTimeline.jsx': 'DEAD — only importer is AgentStrategyTab.ARCHIVED.jsx',
  'src/components/AgentPresence/presenceBinding.js': 'swap actions only — a marked beat is no event',
  'src/components/AgentPresence/useAgentPresence.js': 'pass-through to statusFeedToEvents',
  'src/components/Dashboard/desk/AgentDesk.jsx': 'renders the latest line only when it has a message — nothing for a line-less beat',
  'src/components/League/battleArena/statusFeedToVoice.js': 'FIXED: a marked beat is no line in the agent’s voice, dropped before the six-line window',
  'src/components/Tournament/Flat6BattleView.jsx': 'FIXED: a marked beat is dropped before the window (was its raw action `risk_swap_failed`, or pre-execution words; spectators too — the projection carries the marker)',
  'src/hooks/useAgentBattle.js': 'pass-through',
  'src/screens/AgentBattleScreen.jsx': 'pass-through; flag-off unread dot counts feed length (dormant)',
  'src/screens/agentBattleScreenGoldenFixture.js': 'test data',
  'src/screens/battleView/ArenaHeader.jsx': 'passes `statusFeed: null` — not a reader',
  'src/screens/battleView/CharacterAvatar.jsx': 'passes `statusFeed: null` — not a reader',
  'src/screens/battleView/CharacterPane.jsx': 'passes `statusFeed: null` — not a reader',
  'src/screens/battleView/PaneTape.jsx': 'FIXED: bookmarks skip a marked beat; mounts the log',
  'src/screens/battleView/buildTape.js': 'joins trades / deferred checks by id and pair — renders no beat message or action',
  'src/screens/battleView/shadowCpuQuoteIntegrity.js': 'returns `statusFeed: null` — not a reader',
};
/**
 * Every client file whose code names `evaluations` (review ER3-1). A decision
 * LABEL for an entry comes only from selectWhyState (WhyPanel, the tape's
 * check cards, the bubble, the peek line and Bench all take its state), and
 * selectWhyState takes ONE entry — it never names the array — so a new reader
 * that labelled entries from `decision` / `downgraded` itself would land here.
 */
const EVALUATION_READERS = {
  'src/components/Agent/AgentActivityFeed.jsx': 'the word only — the group pill’s aria-label (`N grouped evaluations`)',
  'src/components/Season/SeasonLeaderboard.jsx': 'the word only — Season copy (another product)',
  'src/components/Tournament/Flat6BattleView.jsx': '`recentWhy`: the motive and hypothesis through renderMotive / renderHypothesis — no decision label',
  'src/data/decisionRecord.js': 'heardStamps: reads each entry’s `heard` stamp only',
  'src/data/forgeCollections.js': 'the word only — Forge rule copy',
  'src/data/forgeKnowledgeBase.js': 'the word only — Forge rule copy',
  'src/screens/AgentBattleScreen.jsx': 'pass-through to buildTape, deriveHeard, the cockpit and the Why? selectors',
  'src/screens/agentBattleScreenGoldenFixture.js': 'test data',
  'src/screens/battleView/buildTape.js': 'check cards take their label from selectWhyState',
  'src/screens/battleView/cockpitModel.js': 'promptBuiltAt by evalId — no decision field',
  'src/screens/battleView/deriveHeard.js': 'heard stamps via decisionRecord.heardStamps',
  'src/screens/battleView/deriveTurnLine.js': 'the latest check’s timestamp for the turn line’s decided dot — no label',
  'src/screens/battleView/selectBench.js': 'the newest entry with words, labelled through selectWhyState',
  'src/services/forgeStatsService.js': 'Forge citation counts from the model’s own cited rules — no decision label',
};
/**
 * Every client file whose code reads a DECISION field itself — the fields a
 * label is chosen from (review ERV3, the direct form of ER3-1's risk). Only the
 * selector and the shared vocabulary may choose a label from them; the tape
 * reads `downgraded` for its quiet-run fold, never for a label.
 */
const DECISION_FIELD_READERS = {
  'src/data/decisionRecord.js': 'the thrown-swap prefix and the D-70 gate (validationErrors, guardrailSourceNote, guardrailOverrides) — the predicates the selector uses',
  'src/screens/battleView/selectWhyState.js': 'THE label: absence, table G, then the decision states',
  'src/screens/battleView/buildTape.js': '`quiet` (no-change fold) excludes downgraded and outage entries — no label',
  'src/screens/agentBattleScreenGoldenFixture.js': 'test data',
};
/** Every client file whose code names `proposalHistory`. */
const PROPOSAL_READERS = {
  'src/components/Agent/AgentChat.jsx': 'filterUnansweredProposals admits `lapsed` only — `auto_execution_unknown` and every marker render nothing',
  'src/screens/AgentBattleScreen.jsx': 'pass-through to AgentChat',
  'src/screens/agentBattleScreenGoldenFixture.js': 'test data',
};
/** Every client file whose code reads a marker FIELD by name — one module, by design. */
const MARKER_READERS = {
  'src/data/executionOutcome.js': 'the marker as data: executionOutcomeUnconfirmed, feedBeatUnconfirmed, feedBeatWithoutLine',
};
/** Every client file that decides on the marker through that module. */
const MARKER_MODULE_IMPORTERS = {
  'src/screens/battleView/selectWhyState.js': 'the Why? state: the marker before every decision state (table G labels)',
  'src/components/Agent/AgentActivityFeed.jsx': 'FIXED: a marked beat is not a card',
  'src/adapters/baggerbombAdapter.js': 'FIXED: the Desk line is null when the newest beat is marked',
  'src/components/Agent/LiveActivityPanel.jsx': 'FIXED (dormant): the pulse takes no words from a marked newest beat',
  'src/components/League/battleArena/statusFeedToVoice.js': 'FIXED: a marked beat is no voice line',
  'src/components/Agent/GameTapeView.jsx': 'FIXED (dormant): bookmarks skip a marked beat',
  'src/components/Tournament/Flat6BattleView.jsx': 'FIXED: a marked beat is dropped before the live feed’s window',
  'src/screens/battleView/PaneTape.jsx': 'FIXED: bookmarks skip a marked beat',
};

describe('the census is complete — a new reader fails here until it is ruled', () => {
  it('every client file that names the feed is in the census, and every census entry still names it', () => {
    expect(readersOf(/\bstatusFeed\b/)).toEqual(Object.keys(FEED_READERS).sort());
  });

  it('every client file that names evaluations is in the census (review ER3-1) — a decision label comes only through selectWhyState', () => {
    expect(readersOf(/\bevaluations\b/)).toEqual(Object.keys(EVALUATION_READERS).sort());
  });

  it('only the ruled files read a decision field — a new surface labelling from `downgraded` or `decision` lands here (review ERV3)', () => {
    expect(readersOf(/\bdowngraded\b|decision\s*===\s*'(HOLD|SWAP|PROPOSAL)'|\bhaikuError\b|\bguardrailOverrides\b|\bguardrailSourceNote\b|\.validationErrors\b/)).toEqual(Object.keys(DECISION_FIELD_READERS).sort());
  });

  it('every client file that names proposalHistory is in the census', () => {
    expect(readersOf(/\bproposalHistory\b/)).toEqual(Object.keys(PROPOSAL_READERS).sort());
  });

  it('no client file reads the meeting history, held legs or a leg’s outcome — nothing renders them', () => {
    expect(readersOf(/\bgameplanMeetingHistory\b|\bheldLegs\b|\bheldLegCount\b|'not_run'|\bexecutionFailed\b|\blegRefusals\b/)).toEqual([]);
  });

  it('only the marker module reads a marker field by name (a module path or a predicate name is not a field read)', () => {
    expect(readersOf(/(?<![\w/])executionOutcome\b|executionLanded|auto_execution_unknown|confirmed_after_error|risk_swap_failed/)).toEqual(Object.keys(MARKER_READERS).sort());
  });

  it('every client file that imports the marker module is ruled', () => {
    expect(readersOf(/from\s+['"][./]+(?:data\/)?executionOutcome(?:\.js)?['"]/)).toEqual(Object.keys(MARKER_MODULE_IMPORTERS).sort());
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
  it('a marked beat is no line in the agent’s voice — line-less or worded; nothing is "null" or "undefined"', () => {
    const GUARDRAIL = { timestamp: '2026-09-09T15:04:30.000Z', message: 'Guardrail override: stop-loss … Forcing exit → AMD.', action: 'guardrail_forced_swap', executionOutcome: 'unknown' };
    const { live } = statusFeedToVoice({ statusFeed: [RISK_UNKNOWN, PASS_UNKNOWN, PUBLIC_UNKNOWN, MODEL_STATUS, GUARDRAIL] }, '2026-09-09T15:10:00.000Z', 'Aurora');
    expect(live).toEqual([]);
  });

  it('marked beats are dropped BEFORE the six-line window — they never cost a real line (review ER3-8)', () => {
    const real = Array.from({ length: 6 }, (_, i) => ({ timestamp: `2026-09-09T14:0${i}:00.000Z`, message: `Line ${i}.`, action: 'hold' }));
    const { live } = statusFeedToVoice({ statusFeed: [...real, RISK_UNKNOWN, PASS_UNKNOWN, MODEL_STATUS] }, '2026-09-09T15:10:00.000Z', 'Aurora');
    expect(live.map((l) => l.text)).toEqual(real.map((r) => r.message));
    expect(JSON.stringify(live)).not.toMatch(/risk_swap_failed|Rotating|null|undefined/);
  });
});

describe('the presence face (statusFeedToEvents)', () => {
  it('an exit whose outcome could not be confirmed is no swap event; a landed one is', () => {
    expect(statusFeedToEvents([RISK_UNKNOWN, PASS_UNKNOWN, PUBLIC_UNKNOWN, MODEL_STATUS])).toEqual([]);
    expect(statusFeedToEvents([LANDED])).toHaveLength(1);
  });
});
