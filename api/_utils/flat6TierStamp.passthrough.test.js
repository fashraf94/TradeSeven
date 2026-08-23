// api/_utils/flat6TierStamp.passthrough.test.js
// Flat6 tier-multiplier stamp pass-through (C-2 remediation — Ask 1 build
// review §6①, founder ruling option (a)).
//
// THE DEFECT CLASS: the scorer honors an explicit per-asset flat stamp
// (`asset.tierMultiplier ?? CONVICTION_MULTIPLIERS[tier]`, agentScoring.js),
// and the P4 battery proves that MECHANISM — but nothing ever pinned that the
// CALLERS supply the stamp. Five rebuild sites (four cron, one executor)
// dropped it, so production flat6 scored 2.0x/1.5x by slot label against the
// D2 flat design. This file is the missing guard, in both halves:
//
//   1. THE STATIC CALLER-SUPPLY GUARD (primary — its absence is why the
//      defect survived): every calculateAssetScoreServer call site in the
//      live callers must either carry a tierMultiplier key in its rebuilt
//      object literal or pass the doc asset through whole (the stamp-carrying
//      shape). A sixth site added without the stamp fails HERE, not in prod.
//   2. THE BEHAVIORAL LOCK TEST: a flat6 star-tier swap-out locks FLAT points
//      through the real executor (in-memory Firestore mock — the same
//      harness shape agentSwapExecution.test.js uses).
//
// RED-FIRST: both halves were written before the fix and watched fail against
// the stamp-dropping callers.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative, resolve, sep } from 'path';

// Guard 3's day-2+ path pre-fetches a daily reference; inert for the
// swapPrice-path cases below, mocked so everything runs offline.
vi.mock('./marketDataCache.js', () => ({
  getStockAnalysisData: vi.fn(async () => ({
    daily: [{ date: '2020-01-01', rawClose: 100, close: 100, high: 101, low: 99 }],
  })),
}));

import { executeSwapServer } from './agentSwapExecution.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// ==================== 1. THE STATIC CALLER-SUPPLY GUARD ====================

describe('flat6 stamp pass-through — the caller-supply class guard (static)', () => {
  // REPO-LEVEL discovery, not a hardcoded caller list (a closed list is the
  // same blindness this guard exists to kill — a new caller in a NEW file
  // must register here too, the agent-evaluate census pattern). Every .js
  // under api/ is walked; excluded, with reasons:
  //   - *.test.js and __fixtures__/__mocks__ dirs: test infrastructure —
  //     mocks/regexes reference the name, and the one current fixture caller
  //     (ask1PromptFixtures.js) models the STAMPED doc shape deliberately
  //     (its literal carries `tierMultiplier: asset.tierMultiplier`).
  //   - the definition line itself (`function calculateAssetScoreServer(`,
  //     agentScoring.js) — matched by lookback, not by path, so a future
  //     in-module rebuild call would still be classified.
  const API_ROOT = resolve(HERE, '..');
  const isTestInfra = (relPath) =>
    relPath.endsWith('.test.js')
    || relPath.split('/').includes('__fixtures__')
    || relPath.split('/').includes('__mocks__');

  function discoverCallerFiles() {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        const relPath = 'api/' + relative(API_ROOT, full).split(sep).join('/');
        if (isTestInfra(relPath)) continue;
        if (readFileSync(full, 'utf8').includes('calculateAssetScoreServer(')) {
          files.push([relPath, full]);
        }
      }
    };
    walk(API_ROOT);
    return files.sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Every live call site, extracted with its first argument. An object-literal
  // first arg is a REBUILD (must carry tierMultiplier — mode-resolved or doc
  // field); a bare identifier must be the whole doc asset (stamp survives by
  // construction). Anything else is a new shape this guard refuses loudly.
  function extractCallSites(source) {
    const sites = [];
    const re = /calculateAssetScoreServer\(\s*/g;
    let m;
    while ((m = re.exec(source)) !== null) {
      // Skip the definition (`function calculateAssetScoreServer(`) and any
      // comment-line mention — call sites only.
      const lineStart = source.lastIndexOf('\n', m.index) + 1;
      const line = source.slice(lineStart, m.index).trimStart();
      if (line.startsWith('//') || line.startsWith('*')) continue;
      if (/function\s+$/.test(source.slice(lineStart, m.index))) continue;
      const after = source.slice(re.lastIndex, re.lastIndex + 400);
      sites.push(after);
    }
    return sites;
  }

  it('every live call site supplies the stamp: object-literal rebuilds carry tierMultiplier (directly or via the pinned mode-resolved spread); identifier args are the whole doc asset', () => {
    let total = 0;
    for (const [label, file] of discoverCallerFiles()) {
      const source = readFileSync(file, 'utf8');
      // The cron's sites share one named stamp — accept `...flat6Stamp` ONLY
      // when its definition in the same file is the pinned mode-resolved
      // shape (an empty-object alias must not satisfy this guard).
      const hasPinnedSharedStamp =
        /const flat6StampMultiplier = resolveModeConfig\(battle\.gameMode\)\.flatMultiplier;/.test(source)
        && /const flat6Stamp = flat6StampMultiplier != null \? \{ tierMultiplier: flat6StampMultiplier \} : \{\};/.test(source);
      for (const arg of extractCallSites(source)) {
        total += 1;
        if (arg.trimStart().startsWith('{')) {
          const literal = arg.slice(0, arg.indexOf('}') + 1);
          const stamped =
            /tierMultiplier/.test(literal)
            || (hasPinnedSharedStamp && /\.\.\.flat6Stamp/.test(literal));
          expect(
            stamped,
            `${label}: a calculateAssetScoreServer rebuild literal omits the tier stamp — the C-2 defect class:\n${literal}`,
          ).toBe(true);
        } else if (/^assetObj\s*,/.test(arg.trimStart())) {
          // The executor's rebuilt object — its DEFINITION must carry the
          // stamp (dropping it there is the original site-5 defect).
          const def = source.match(/const assetObj = \{[\s\S]*?\};/);
          expect(
            def !== null && /tierMultiplier/.test(def[0]),
            `${label}: the assetObj rebuild definition omits the tier stamp — the C-2 defect class:\n${def ? def[0] : '(definition not found)'}`,
          ).toBe(true);
        } else {
          expect(
            /^asset\s*,/.test(arg.trimStart()),
            `${label}: a calculateAssetScoreServer call passes an unrecognized first-arg shape (neither a stamped literal nor the whole doc asset):\n${arg.slice(0, 120)}`,
          ).toBe(true);
        }
      }
    }
    // Site count pinned so a NEW caller registers here and gets classified
    // deliberately: 4 cron rebuilds + 1 executor rebuild + 1 daily pass-through.
    expect(total).toBe(6);
  });
});

// ==================== 2. THE BEHAVIORAL FLAT6 LOCK TEST ====================

function makeFlat6BattleData() {
  return {
    gameMode: TOURNAMENT_GAME_MODE,
    portfolio: {
      // D2: flat6 doc assets carry the creation-time stamp.
      star: [{ symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false, swapPrice: 100, tierMultiplier: 1.0 }],
      core: [],
      support: [],
      bench: { stocks: [{ symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false }], crypto: null },
      startingPrices: { MU: 100 },
    },
    scoring: { thresholds: {} },
    thresholdHistory: { MU: { maxMultiplier: 0, minMultiplier: 0 } },
    trades: [],
    scoreState: { tradeCount: 0 },
  };
}

function makeMockDb(liveData) {
  let capturedUpdates = null;
  const battleRef = { __ref: 'battleRef' };
  const transaction = {
    get: vi.fn(async () => ({ exists: true, data: () => liveData })),
    update: vi.fn((ref, updates) => { capturedUpdates = updates; }),
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => battleRef) })),
    runTransaction: vi.fn(async (fn) => fn(transaction)),
  };
  return { db, getCapturedUpdates: () => capturedUpdates };
}

describe('flat6 stamp pass-through — the executor locks FLAT points (behavioral)', () => {
  it('a flat6 STAR-tier swap-out at +3% locks 45 (30 flat base + 15 bagger), never the 75 a slot-label 2.0x would produce', async () => {
    const liveData = makeFlat6BattleData();
    const { db, getCapturedUpdates } = makeMockDb(liveData);

    await executeSwapServer(
      db, 'battle-flat6', liveData,
      'star', 0,
      { symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false },
      2,
      { MU: { current: 103 }, AMD: { current: 150 } },
      { id: 'trade_001', action: 'SWAP' },
    );

    const updates = getCapturedUpdates();
    const trade = updates.trades[updates.trades.length - 1];
    expect(trade.symbolOut).toBe('MU');
    // +3% from entry: flat base = 3 × 10 × 1.0 = 30; threshold 3/2.5 = 1.2x →
    // bagger +15. Flat lock = 45. The slot-label fallback (star 2.0x) would
    // lock 75 — the C-2 defect this file exists to keep dead.
    expect(trade.lockedPoints).toBe(45);
    expect(trade.lockedGainPct).toBe(3);
  });

  it('tiered battles keep slot-label multipliers — the fix is flat6-only by construction (no gameMode, no stamp → star 2.0x)', async () => {
    const liveData = makeFlat6BattleData();
    delete liveData.gameMode;                              // tiered battle
    delete liveData.portfolio.star[0].tierMultiplier;      // tiered docs carry no stamp (D2 identity)
    const { db, getCapturedUpdates } = makeMockDb(liveData);

    await executeSwapServer(
      db, 'battle-tiered', liveData,
      'star', 0,
      { symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false },
      2,
      { MU: { current: 103 }, AMD: { current: 150 } },
      { id: 'trade_001', action: 'SWAP' },
    );

    const trade = getCapturedUpdates().trades.at(-1);
    // Tiered star: 3 × 10 × 2.0 = 60 base + 15 bagger = 75 — byte-identical
    // to pre-fix tiered behavior.
    expect(trade.lockedPoints).toBe(75);
  });
});
