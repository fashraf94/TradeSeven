// api/_utils/agentSafeWireEntry.boundary.test.js
// Phase 2 N1.1 — the AgentSafeWireEntry structural boundary (F-M6/F-M7,
// Amendment H scope). Matrix rows:
//   P2-28 (scoped) — only agentSafeWireEntry.js may import the raw Wire
//     reader; the consumer set may not import it and may not read the story
//     collection. Fenced assemblies are OUT of scope (deferred §7-gated
//     Phase 3 row per Amendment H) — this suite deliberately does not scan
//     them.
//   P2-41 — inline-read tripwire: `fantasyTimesStories` SOURCE TEXT in a
//     consumer fails (an inline db.collection('fantasyTimesStories') read is
//     invisible to any import test — the ruleCompatInvariantR precedent).
//   P2-3 — DTO known-field exclusion (explicit copy, never spread).
//   P2-4 — selection independence: headline/sentiment mutations change
//     nothing downstream of the boundary.
//   P2-5 (newsLine half) — the fourth consumer's guard: unknown versions
//     never become DTOs.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import {
  toAgentSafeWireEntry,
  resolveAgentSafeEntries,
} from './agentSafeWireEntry.js';
import { WIRE_SCHEMA_VERSION, WIRE_DIGEST_RENDERER_VERSION } from './wireContracts.js';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SOLE_READER_IMPORTER = 'api/_utils/agentSafeWireEntry.js';

// The N1.1 consumer set: every module that renders or transports
// agent-facing Wire content. Phase 3 prompt assemblies join when they land.
const CONSUMER_SET = [
  'api/_utils/voiceLayerPrompt.js',
  'api/cron/voice-layer-cache.js',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '__fixtures__') continue;
      walk(p, out);
    } else if (p.endsWith('.js') && !p.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const apiFiles = () => walk(resolve(REPO_ROOT, 'api')).map((p) => relative(REPO_ROOT, p)).sort();

describe('P2-28 (scoped): the raw Wire reader has exactly one importer', () => {
  const files = apiFiles();

  it('scan set is real (self-check against a vacuous pass)', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(SOLE_READER_IMPORTER);
    expect(files).toContain('api/cron/voice-layer-cache.js');
  });

  it("only agentSafeWireEntry.js imports './wireReader.js' (or any wireReader path)", () => {
    const offenders = files.filter((rel) => {
      if (rel === SOLE_READER_IMPORTER) return false;
      if (rel === 'api/_utils/wireReader.js') return false; // the module itself
      const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      return /from\s+['"][^'"]*wireReader(\.js)?['"]/.test(src);
    });
    expect(offenders, `raw Wire reader imported by: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the sole importer itself DOES import the reader (invariant is not vacuous)', () => {
    const src = readFileSync(resolve(REPO_ROOT, SOLE_READER_IMPORTER), 'utf-8');
    expect(src).toMatch(/from '\.\/wireReader\.js'/);
  });
});

describe('P2-41: consumer-set inline-read tripwire (source text, not imports)', () => {
  it.each(CONSUMER_SET)('%s contains no fantasyTimesStories source text', (rel) => {
    const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
    expect(src.includes('fantasyTimesStories'), `${rel} references the story collection`).toBe(false);
  });

  it('the boundary module itself never touches the story collection either', () => {
    const src = readFileSync(resolve(REPO_ROOT, SOLE_READER_IMPORTER), 'utf-8');
    expect(src.includes('fantasyTimesStories')).toBe(false);
  });
});

// ── DTO projection rows ────────────────────────────────────────────────────
const POISON = {
  headline: 'POISON_HEADLINE_MARKER',
  sentiment: 'POISON_SENTIMENT_MARKER',
  recommended_action: 'POISON_ACTION_MARKER',
  body: 'POISON_PROSE_MARKER',
};

const poisonedEntry = (storyId = 'p1') => ({
  storyId,
  reporter: 'doug',
  headline: POISON.headline,          // founder readability only — must never cross
  sentiment: POISON.sentiment,        // raw story field — must never cross
  recommended_action: POISON.recommended_action,
  body: POISON.body,
  publishedAt: '2026-07-24T20:00:00Z',
  validatorVersion: '1.6.0',
  quarantined: false,
  generationConfig: { generationVersion: 7, continuityEnabled: false },
  agentFacts: {
    eventType: 'earnings_recap',
    tickers: ['NVDA'],
    primaryTicker: 'NVDA',
    digest: 'NVDA earnings: EPS +8.2% vs consensus.',
    direction: 'up',
    magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
    keyLevel: null,
    figures: [{ label: 'EPS', value: 1.05 }],
    qualifiers: ['guidance_raised'],
    subjectRef: null,
    schemaVersion: WIRE_SCHEMA_VERSION,
    digestRendererVersion: WIRE_DIGEST_RENDERER_VERSION,
    validatorVersion: '1.6.0',
    chainId: storyId,
  },
});

const DTO_FIELDS = [
  'storyId', 'publishedAt', 'digest', 'eventType', 'primaryTicker',
  'direction', 'magnitude', 'keyLevel', 'figures', 'qualifiers', 'subjectRef',
];

describe('P2-3: DTO known-field exclusion (explicit copy, F-M7)', () => {
  it('the DTO carries EXACTLY the eleven spec fields — nothing else', () => {
    const dto = toAgentSafeWireEntry(poisonedEntry());
    expect(Object.keys(dto).sort()).toEqual([...DTO_FIELDS].sort());
  });

  it('no poison marker survives projection (headline/sentiment/action/prose)', () => {
    const json = JSON.stringify(toAgentSafeWireEntry(poisonedEntry()));
    for (const marker of Object.values(POISON)) {
      expect(json).not.toContain(marker);
    }
  });

  it('epoch/provenance metadata stays behind the boundary too (schemaVersion, rendererVersion, chainId, generationConfig)', () => {
    const dto = toAgentSafeWireEntry(poisonedEntry());
    expect(dto.schemaVersion).toBeUndefined();
    expect(dto.digestRendererVersion).toBeUndefined();
    expect(dto.chainId).toBeUndefined();
    expect(dto.generationConfig).toBeUndefined();
  });
});

// ── resolution rows (guard + independence) ────────────────────────────────
const dayDoc = (entries) => ({
  bySymbol: entries.reduce((m, e) => {
    for (const t of e.agentFacts.tickers) (m[t] ??= []).push(e.storyId);
    return m;
  }, {}),
  entries,
});

describe('P2-4: selection independence — prose mutations are invisible downstream', () => {
  it('mutating headline + sentiment only → resolved DTOs byte-identical', () => {
    const a = poisonedEntry('s1');
    const b = poisonedEntry('s1');
    b.headline = 'A COMPLETELY DIFFERENT HEADLINE';
    b.sentiment = 'bearish';

    const days1 = new Map([['2026-07-24', dayDoc([a])]]);
    const days2 = new Map([['2026-07-24', dayDoc([b])]]);
    const r1 = resolveAgentSafeEntries(days1, ['2026-07-24'], 'NVDA');
    const r2 = resolveAgentSafeEntries(days2, ['2026-07-24'], 'NVDA');
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    expect(r1).toHaveLength(1);
  });
});

describe('P2-5 (newsLine half): the fourth consumer fails closed on unknown versions', () => {
  it('an unknown-schemaVersion entry never becomes a DTO, and the skip is logged', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bad = poisonedEntry('u1');
      bad.agentFacts.schemaVersion = 'wire-9.9';
      const good = poisonedEntry('s2');
      const days = new Map([['2026-07-24', dayDoc([bad, good])]]);

      const resolved = resolveAgentSafeEntries(days, ['2026-07-24'], 'NVDA');
      expect(resolved.map((r) => r.dto.storyId)).toEqual(['s2']);
      const guardWarns = warnSpy.mock.calls.map((c) => c[0]).filter((m) => String(m).includes('N1.4 guard'));
      expect(guardWarns).toHaveLength(1);
      expect(guardWarns[0]).toContain('[WireNewsLine]');
      expect(guardWarns[0]).toContain('u1');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('legacy entries (no epoch fields) remain renderable through the boundary (Amendment J)', () => {
    const legacy = poisonedEntry('l1');
    delete legacy.agentFacts.schemaVersion;
    delete legacy.agentFacts.digestRendererVersion;
    const days = new Map([['2026-07-24', dayDoc([legacy])]]);
    const resolved = resolveAgentSafeEntries(days, ['2026-07-24'], 'NVDA');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].dto.digest).toBe('NVDA earnings: EPS +8.2% vs consensus.');
  });
});
