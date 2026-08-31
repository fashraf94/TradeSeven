// src/components/Dashboard/desk/deskAdapterBoundary.test.js
//
// THE DO-NOT LINE (Pass 1 spec §5 rule 1, framework §3): no new Dashboard
// component reads `agentBattles` / `voiceLayerCache` / `agents` document
// fields directly. Everything goes through the adapter.
//
// WHY IT MATTERS MORE THAN IT LOOKS. Only the BaggerBomb adapter exists today,
// so the rule buys nothing this pass — its whole value is Pass 3, when the
// league adapter maps into the same shape. Every direct document read that
// slips in now is a line the league work has to find and rewrite later, and
// the framework's own risk register rates "Pass 1 reads BaggerBomb fields
// directly; league becomes a rewrite" as High.
//
// This guard is a source test rather than a behavioural one because the thing
// being forbidden is a SHAPE OF ACCESS, not an output. A component reading
// `battle.scoreState.currentScore` renders exactly the same pixels as one
// reading `sync.score.current`; only the source text tells them apart.
//
// It has already earned its place: it was written after the Desk was built and
// immediately caught `<AgentDesk statusFeed={liveBattle?.statusFeed} />` — a
// raw document array handed straight to a new component. The fix was to carry
// the feed through the adapter, which is what the rule is for.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', '..');

const read = (p) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

// Components this pass introduced. Pre-existing files are out of scope: they
// read documents directly today and un-picking that is not this pass's job.
const NEW_COMPONENTS = [
  path.join(HERE, 'AgentDesk.jsx'),
  path.join(HERE, 'deskCopy.js'),
];

// Document-shape identifiers that only ever appear on a raw agentBattles /
// voiceLayerCache / agents doc. Seeing one inside a new Dashboard component
// means the adapter was bypassed.
const DOCUMENT_FIELDS = [
  'scoreState',
  'portfolioBriefs',
  'thresholdProximity',
  'agentContext',
  'startingPrices',
  'activeBattleId',
  'swappedInAt',
  'voiceLayerCache',
  'dailyReviews',
  'evaluationCount',
  'lastScoredAt',
];

describe('new Dashboard components read the adapter, never a document', () => {
  for (const file of NEW_COMPONENTS) {
    const rel = path.relative(SRC, file);
    for (const field of DOCUMENT_FIELDS) {
      it(`${rel} does not touch "${field}"`, () => {
        const re = new RegExp(`\\b${field}\\b`);
        expect(
          re.test(read(file)),
          `${rel} references the raw document field "${field}". Add it to the `
          + 'adapter (src/adapters/baggerbombAdapter.js) and read it from '
          + '`sync` instead — see this file\'s header for why.',
        ).toBe(false);
      });
    }
  }
});

describe('the shells hand the Desk the adapter and nothing else', () => {
  const SHELLS = [
    path.join(SRC, 'components', 'Dashboard', 'CommandDashboardDesktop.jsx'),
    path.join(SRC, 'components', 'Dashboard', 'CommandDashboard.jsx'),
  ];

  for (const shell of SHELLS) {
    const rel = path.relative(SRC, shell);

    it(`${rel} passes AgentDesk no raw battle field`, () => {
      const source = read(shell);
      const tag = source.match(/<AgentDesk\b[^>]*\/>/);
      expect(tag, `${rel} must render AgentDesk`).not.toBeNull();
      // The regression this pins: `statusFeed={liveBattle?.statusFeed}`.
      expect(tag[0]).not.toMatch(/\bliveBattle\b/);
      expect(tag[0]).not.toMatch(/\bbattle\./);
    });

    it(`${rel} reaches battle state only through the hook`, () => {
      const source = read(shell);
      expect(source).toContain('useCommandCenterSync(');
    });
  }
});

describe('the adapter is the only thing that names document fields', () => {
  it('carries statusFeed itself, so no shell has to reach for it', async () => {
    const { buildBaggerbombAdapter } = await import('../../../adapters/baggerbombAdapter.js');
    const feed = [{ timestamp: '2026-09-01T16:00:00.000Z', message: 'm', action: 'gameplan_meeting' }];
    const out = buildBaggerbombAdapter(
      { id: 'b1', status: 'active', statusFeed: feed, scoreState: { evaluationCount: 1 } },
      null, null, '2026-09-01T17:00:00Z', { state: 'OPEN' },
    );
    expect(out.statusFeed).toEqual(feed);
  });

  it('returns an empty array, never undefined, when the battle has no feed', async () => {
    const { buildBaggerbombAdapter } = await import('../../../adapters/baggerbombAdapter.js');
    const out = buildBaggerbombAdapter(
      { id: 'b1', status: 'active' }, null, null, '2026-09-01T17:00:00Z', { state: 'OPEN' },
    );
    expect(out.statusFeed).toEqual([]);
  });
});
