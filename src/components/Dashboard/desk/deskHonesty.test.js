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

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Every source file that can put a string on a Command Center Sync surface.
// The two dashboard shells DUPLICATE their copy rather than share it
// ('Talk it over', 'Deploy on this read' and friends each exist twice), so a
// guard that covered only one shell would half-guard the product.
const GUARDED = [
  path.join(HERE, 'deskCopy.js'),
  path.join(HERE, 'AgentDesk.jsx'),
  path.join(HERE, '..', 'ManageStation.jsx'),
  path.join(HERE, '..', '..', '..', 'adapters', 'baggerbombAdapter.js'),
  path.join(HERE, '..', '..', '..', 'hooks', 'useCommandCenterSync.js'),
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

describe('the copy module is the single source of Desk strings (spec §9)', () => {
  const deskFiles = readdirSync(HERE).filter((f) => f.endsWith('.jsx') && !f.includes('.test.'));

  it('there is at least one Desk component to check', () => {
    expect(deskFiles.length).toBeGreaterThan(0);
  });

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
});
