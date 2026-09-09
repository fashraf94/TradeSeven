// src/components/Dashboard/desk/deskHonesty.test.js
//
// THE C1 GUARD (Pass 1 spec §9, framework §5.1-5.2).
//
// WHY THIS TEST EXISTS — read this before editing an assertion below, because
// the assertion is downstream of a design ruling and the ruling is the thing
// to argue with.
//
// The Desk renders only what the decision path actually produces or the
// scoring path actually persists. The specific failure it guards against is
// SCORE PROXIMITY BEING READ AS ACTION PROXIMITY. The one persisted,
// comparable proximity object measures distance to the next bonus/bust SCORING
// threshold — not distance to a risk trigger. A position can sit 0.2 ATR from
// a bonus tier and the agent may hold straight through it. Copy that says
// "PLTR is close to a trade" or "the agent is eyeing PLTR" makes a causal
// promise the system cannot keep, and users would be right to feel misled.
//
// The second failure is CONTINUOUS-COGNITION FRAMING. Everything runs at 15
// minutes: evals, the voiceLayerCache refresh, the statusFeed. The Desk cannot
// be more live than the system it reports on. "Watching", "thinking",
// "analyzing" all imply the agent is awake between checks. It is not.
//
// So: scoreboard nouns and market facts, never agent verbs. If you are adding
// copy that trips this test, the fix is almost always to say what the
// SCOREBOARD is doing rather than what the AGENT is doing.
//
// `analyzing` is grandfathered in exactly one place — LiveActivityPanel's
// long-shipped idle string ("Your agent will start analyzing when the market
// opens"), which this pass does not touch. The Desk introduces no new use, and
// the exemption is scoped to that file so it cannot spread.

// PHASE B (B1 client half, seed §5) — THE TWO VERBS, AND THEIR UPGRADES.
//
// Phase B lets two new claims onto the surfaces: `Heard` (this thread was in
// the decider's prompt at that check) and `Saw` (this value was rendered for
// this held name in that prompt). Both are proven by the cron's own stamps.
// Neither may be upgraded, and the whole third failure this file now guards is
// THE SILENT UPGRADE OF A PROVEN VERB: "heard" quietly becoming "considered",
// "saw" quietly becoming "noticed" or "decided because".
//
// The upgrades are banned outright. Two families need scoping instead, and
// the scoping is the point rather than a weakness:
//
//   `changed` / `moved` / `today` are banned BESIDE `chg` ONLY. The field is
//   the position's gain SINCE ENTRY, and those three words would make it read
//   as today's move (Sol M-3) — but they are all legitimate elsewhere ("This
//   piece today", "No check yet today", "The current directive changed before
//   this could be filed"). So the guard reads the RENDERED evidence, not the
//   file, and pins the label instead of outlawing three ordinary words.
//
//   `considered` / `caused` are banned in the client copy, where they can only
//   be an upgrade — and are checked on the narrator's RENDERED RECORD rather
//   than in voiceLayerGrounding.js's source, because that file's grounding
//   rules must NAME both words in order to forbid them to the model. A guard
//   that scanned the source would ban the sentence that enforces the rule.
//
// The suppression words (`malformed`, `mode_not_enforce`, `epoch_killed`,
// `unknown`) are banned everywhere on both surfaces: they are resolver
// diagnostics, and a negative receipt is system-owned and reasonless (Sol M-1).

import { describe, it, expect } from 'vitest';
// Phase B: the scoped guards read RENDERED copy rather than source text, so
// they import the renderers themselves. Both are zero-import / Node-clean; the
// import is also the dependency-surface guard (BUILD_RULES §4).
import { evidenceFactLines } from '../../../data/decisionRecord.js';
import { buildYourRecordBlock, renderEvidenceLines } from '../../../../api/_utils/voiceLayerGrounding.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** One held position's full eight-field stamp, for the rendered-copy guards. */
const FULL_EVIDENCE = Object.freeze({
  px: 123.6, chg: 2.57, atrX: 0.83, vwapDev: 0.95, bbPct: 15, nr7: true,
  regime: 'directional_expansion', risk: { action: 'LOCK', reason: 'threshold_proximity' },
});

// Every source file that can put a string on a Command Center Sync surface.
// The two dashboard shells DUPLICATE their copy rather than share it
// ('Talk it over', 'Deploy on this read' and friends each exist twice), so a
// guard that covered only one shell would half-guard the product.
//
// Phase A (the Battle View controller, D-59 → D-62) puts Battle View strings
// under the same guard: its copy module (battleViewCopy.js) and EVERY
// component under src/screens/battleView/ — the directory is scanned, so a
// new file there is guarded the moment it exists rather than when someone
// remembers to list it (PHASE_A_RULINGS_AND_AMENDMENTS_V1.md §3.4).
const BATTLE_VIEW_DIR = path.join(HERE, '..', '..', '..', 'screens', 'battleView');
const BATTLE_VIEW_SOURCES = readdirSync(BATTLE_VIEW_DIR)
  .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f))
  .map((f) => path.join(BATTLE_VIEW_DIR, f));

const GUARDED = [
  path.join(HERE, 'deskCopy.js'),
  path.join(HERE, 'AgentDesk.jsx'),
  path.join(HERE, '..', 'ManageStation.jsx'),
  path.join(HERE, '..', '..', '..', 'adapters', 'baggerbombAdapter.js'),
  path.join(HERE, '..', '..', '..', 'hooks', 'useCommandCenterSync.js'),
  // The decision record's shared vocabulary (voice-grounding hazard 26): the
  // Battle View strings the narrator's YOUR RECORD block renders too.
  path.join(HERE, '..', '..', '..', 'data', 'decisionRecord.js'),
  ...BATTLE_VIEW_SOURCES,
];

const FORBIDDEN = [
  'watching',
  'thinking',
  'researching',
  'analyzing',
  'about to',
  'close to trading',
  'wants to',
  'looking at',
  'eyeing',
  'considering',
];

// ── Phase B (seed §5): the upgrades of the two proven verbs ────────────────
// `Heard` and `Saw` are the only verbs the stamps support. Each of these would
// claim something the record cannot prove.
//
// A SEPARATE LIST, and deliberately so. The Phase A agent verbs above are
// scanned in the CLIENT copy only: the narrator's own module names several of
// them on purpose — its off-surface vocabulary guard tabulates the phrases it
// hunts for, and `REPLY_LINT_RE` matches `eyeing|watching` by design. Scanning
// that file for them would be exactly backwards. This list is the one that
// travels to the narrator.
const PHASE_B_FORBIDDEN = [
  'considered',
  'used your directive',
  'noticed',
  'understood',
  'decided because',
  'caused',
  // Sol M-2: `techAt` is the newest HELD technical document's stamp, not a
  // freshness promise for every held symbol's technical context.
  'technical data as of',
  // Sol m-1: held names never received rsPct in the rendered prompt, so there
  // is no ninth field, no placeholder and no completeness rule.
  'rsPct',
  'rsPercentile',
  'RS percentile',
  'RS unavailable',
  // Sol M-1: the four suppression reasons are telemetry, never copy.
  'malformed',
  'mode_not_enforce',
  'epoch_killed',
  'unknown',
];

// The client copy answers to both lists.
FORBIDDEN.push(...PHASE_B_FORBIDDEN);

// The narrator's own source carries the SAFE SUBSET only — every term above
// except the two its grounding rules must name in order to forbid them
// (`considered`, `caused`) — and its record renderer is guarded on its
// RENDERED OUTPUT below, which is the stronger check anyway.
const NARRATOR_SOURCE = path.join(HERE, '..', '..', '..', '..', 'api', '_utils', 'voiceLayerGrounding.js');
const NARRATOR_EXEMPT = new Set(['considered', 'caused']);

/**
 * Comments are stripped before matching. The prose above and in each guarded
 * file NAMES the forbidden terms in order to explain them — if comments were
 * scanned, documenting the rule would violate it. What ships to a user is
 * string literals and JSX text, and that is what is scanned.
 */
function strippedSource(file) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('C1 — no agent-verb or action-proximity framing on the Desk', () => {
  for (const file of GUARDED) {
    const rel = path.relative(path.join(HERE, '..', '..', '..'), file);
    for (const term of FORBIDDEN) {
      it(`${rel} contains no "${term}"`, () => {
        const source = strippedSource(file);
        // Word-boundary, case-insensitive. Multi-word terms are matched as
        // phrases; the boundary keeps "considering" from firing on a longer
        // identifier that merely contains it.
        const re = new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i');
        const hit = source.match(re);
        expect(
          hit,
          hit
            ? `"${term}" appears in ${rel}. Say what the SCOREBOARD is doing, `
              + 'not what the AGENT is doing — see this file\'s header for why.'
            : '',
        ).toBeNull();
      });
    }
  }
});

describe('the grandfathered exemption is scoped, and still true', () => {
  it('LiveActivityPanel keeps its long-shipped idle string', () => {
    const panel = readFileSync(
      path.join(HERE, '..', '..', 'Agent', 'LiveActivityPanel.jsx'), 'utf8',
    );
    // If this ever stops being true, the exemption in this file's header is
    // stale and should be deleted rather than quietly carried.
    expect(panel).toContain('will start analyzing when the market opens');
  });

  it('the exemption does not leak — the Desk tree introduces no "analyzing"', () => {
    for (const file of GUARDED) {
      expect(strippedSource(file)).not.toMatch(/\banalyzing\b/i);
    }
  });
});

describe('the Battle View directory is under the guard (Phase A)', () => {
  it('there is at least one Battle View source to guard', () => {
    expect(BATTLE_VIEW_SOURCES.length).toBeGreaterThan(0);
  });

  it('battleViewCopy.js exists and is guarded — the module every Battle View string goes through', () => {
    expect(BATTLE_VIEW_SOURCES.some((f) => path.basename(f) === 'battleViewCopy.js')).toBe(true);
  });

  it('every non-test source under src/screens/battleView is guarded', () => {
    for (const f of BATTLE_VIEW_SOURCES) expect(GUARDED).toContain(f);
  });
});

describe('the copy module is the single source of Desk strings (spec §9)', () => {
  const deskFiles = readdirSync(HERE).filter((f) => f.endsWith('.jsx') && !f.includes('.test.'));
  // Phase A: the same no-inline-copy rule binds the Battle View components —
  // their strings live in battleViewCopy.js (rulings §3.4).
  const battleViewComponents = BATTLE_VIEW_SOURCES.filter((f) => f.endsWith('.jsx'));

  it('there is at least one Desk component to check', () => {
    expect(deskFiles.length).toBeGreaterThan(0);
  });

  for (const abs of battleViewComponents) {
    const f = `battleView/${path.basename(abs)}`;
    it(`${f} renders no inline user-facing string literal`, () => {
      const source = strippedSource(abs);
      const jsxText = [...source.matchAll(/>\s*([A-Za-z][A-Za-z ,'.:·—-]{6,})\s*</g)]
        .map((m) => m[1].trim())
        .filter((t) => !/^[A-Z_]+$/.test(t));
      expect(jsxText, `inline copy in ${f}: ${JSON.stringify(jsxText)}`).toEqual([]);
    });
  }

  for (const f of deskFiles) {
    it(`${f} renders no inline user-facing string literal`, () => {
      const source = strippedSource(path.join(HERE, f));
      // JSX text nodes between tags. Style objects, props and imports are not
      // matched; this targets the thing the rule is about — prose typed
      // straight into the markup instead of going through deskCopy.
      const jsxText = [...source.matchAll(/>\s*([A-Za-z][A-Za-z ,'.:·—-]{6,})\s*</g)]
        .map((m) => m[1].trim())
        .filter((t) => !/^[A-Z_]+$/.test(t));
      expect(jsxText, `inline copy in ${f}: ${JSON.stringify(jsxText)}`).toEqual([]);
    });
  }
});

describe('the posture line is discrete, never continuous', () => {
  it('the LIVE posture keeps its "~" — the cron is not a metronome', async () => {
    const { DESK_COPY } = await import('./deskCopy.js');
    const line = DESK_COPY.postureLive('2026-09-01T16:47:00.000Z', '2026-09-01T17:02:00.000Z');
    expect(line).toContain('~');
    expect(line).toMatch(/^Checked /);
  });

  it('with no last check it promises a check without inventing a time', async () => {
    const { DESK_COPY } = await import('./deskCopy.js');
    const line = DESK_COPY.postureLive(null, '2026-09-01T17:02:00.000Z');
    expect(line).toBe('First check coming up');
    expect(line).not.toMatch(/\d/);
  });

  it('the LATE posture keeps its "~" too — "was due" is a fact about the schedule, past tense', async () => {
    // Phase A (D-62): the Battle View's late state. The due time stays
    // approximate and stays in the past tense; it never becomes a promise.
    const { DESK_COPY } = await import('./deskCopy.js');
    const line = DESK_COPY.postureLate('2026-09-01T16:47:00.000Z', '2026-09-01T17:02:00.000Z');
    expect(line).toBe('Last check 12:45 PM · next was due ~1:00 PM');
    expect(line).toContain('~');
    expect(line).not.toMatch(/\bnext ~/);
  });

  it('the CLOSED posture carries both facts in one sentence — as-of and resume (D-62)', async () => {
    const { DESK_COPY } = await import('./deskCopy.js');
    const line = DESK_COPY.postureClosed({ weekdayIndex: 2, hour: 9, minute: 30 }, '2026-09-01T19:45:00.000Z');
    expect(line).toBe('Market closed · last check 3:45 PM · next Tue 9:30 AM ET');
    // No tilde here: the next open is a scheduled fact, not a cron estimate.
    expect(line).not.toContain('~');
  });

  it('the CLOSED posture with no last check keeps the shipped `next check` cell (A4.0 copy ruling 3)', async () => {
    const { DESK_COPY } = await import('./deskCopy.js');
    expect(DESK_COPY.postureClosed({ weekdayIndex: 2, hour: 9, minute: 30 }, null)).toBe('Market closed · next check Tue 9:30 AM ET');
    expect(DESK_COPY.postureClosed(null, null)).toBe('Market closed');
  });
});

// ── Phase B (seed §5): the guard follows the copy where scoping is needed ───

describe('Phase B — the narrator\'s source carries the safe subset', () => {
  for (const term of PHASE_B_FORBIDDEN.filter((t) => !NARRATOR_EXEMPT.has(t))) {
    it(`api/_utils/voiceLayerGrounding.js contains no "${term}"`, () => {
      const re = new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i');
      expect(strippedSource(NARRATOR_SOURCE)).not.toMatch(re);
    });
  }

  it('the two exempt terms are exempt ONLY because the rules must forbid them to the model', () => {
    const source = strippedSource(NARRATOR_SOURCE);
    // If this stops being true the exemption is stale and should be deleted
    // rather than quietly carried (the LiveActivityPanel precedent).
    expect(source).toContain('do not say a value caused a hold or a swap');
    expect(source).toContain('never that it was considered, used, or acted on');
  });
});

describe('Phase B — `chg` is labelled SINCE ENTRY wherever it renders (Sol M-3)', () => {
  // Scoped, not global: "today" and "changed" are legitimate elsewhere on this
  // surface ("This piece today", "The current directive changed before this
  // could be filed"). What must never happen is those words landing beside the
  // gain-since-entry number, where they would read as today's move.
  const CHG_FORBIDDEN = ['changed', 'moved', 'today', 'change', 'move', 'session'];

  it('the rendered fact says "Gain since entry" and none of the misreadings', () => {
    const line = evidenceFactLines({ chg: 2.57 })[0];
    expect(line).toBe('Gain since entry +2.57%');
    for (const term of CHG_FORBIDDEN) {
      expect(line.toLowerCase()).not.toMatch(new RegExp(`\\b${term}\\b`));
    }
  });

  it('and in the full eight-field render, on both surfaces', () => {
    const facts = evidenceFactLines(FULL_EVIDENCE).join(' · ');
    expect(facts).toContain('Gain since entry +2.57%');
    for (const term of CHG_FORBIDDEN) {
      expect(facts.toLowerCase()).not.toMatch(new RegExp(`\\b${term}\\b`));
    }
  });
});

describe('Phase B — the narrator\'s RECORD RENDERER, on its rendered output', () => {
  const ENTRY = {
    evalId: 'e1', timestamp: '2026-09-01T16:45:00.000Z', decision: 'HOLD',
    rationale: 'Held the book into the afternoon.',
    evidence: { NVDA: FULL_EVIDENCE, TSLA: { px: 250, chg: -1.2, regime: 'choppy', risk: { action: 'HOLD' } } },
    vintages: {
      quote: 'tick', vwap: 'tick',
      techAt: '2026-09-01T18:29:55.000Z', fundAsOf: '2026-09-08', rankingsAt: '2026-09-01T18:30:00.000Z',
    },
  };
  const DIRECTIVE = { text: 'Protect the lead', directiveThreadId: 't-1', createdAt: '2026-09-01T15:31:00.000Z' };

  const rendered = (heard) => buildYourRecordBlock({
    evaluations: [{ ...ENTRY, ...(heard ? { heard } : {}) }],
    directive: DIRECTIVE,
  });

  // PHASE_B_FORBIDDEN only: the block renders `rationale` VERBATIM (C1), and
  // the decider's own words may legitimately contain a Phase A verb. What must
  // never appear is a word this phase's own rendering could have introduced.
  for (const term of PHASE_B_FORBIDDEN) {
    it(`the rendered record contains no "${term}"`, () => {
      const re = new RegExp(`\\b${term.replace(/ /g, '\\s+')}\\b`, 'i');
      // Heard, withheld, and unstamped — the three shapes the block can take.
      expect(rendered({ directiveThreadId: 't-1', suppressed: null })).not.toMatch(re);
      expect(rendered({ directiveThreadId: 't-1', suppressed: 'epoch_killed' })).not.toMatch(re);
      expect(rendered(null)).not.toMatch(re);
    });
  }

  it('the record\'s own evidence lines carry the SINCE ENTRY label too', () => {
    const lines = renderEvidenceLines(ENTRY).join('\n');
    expect(lines).toContain('Gain since entry +2.57%');
    expect(lines).toContain('Gain since entry -1.20%');
    for (const term of ['changed', 'moved', 'today']) {
      expect(lines.toLowerCase()).not.toMatch(new RegExp(`\\b${term}\\b`));
    }
  });

  it('a withheld directive produces NO negative line and NO reason in the prompt', () => {
    const block = rendered({ directiveThreadId: 't-1', suppressed: 'mode_not_enforce' });
    expect(block).not.toContain('heard at the');
    expect(block).not.toContain('Not heard');
  });
});
