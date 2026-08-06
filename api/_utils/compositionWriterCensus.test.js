// api/_utils/compositionWriterCensus.test.js
//
// Composition PR 2 — test A46: an identity-affecting writer absent from the
// epoch census FAILS CI. The census (compositionWriterCensus.json) is the
// human-readable side; this test derives the writer set MECHANICALLY from the
// code (importers of the two server chokepoints + the rules-layer clauses) and
// asserts census coverage — so a new endpoint scaffolded tomorrow cannot ship
// unfenced and uncensused. It also proves each censused writer actually
// carries its declared guard (wiring proof, not just a list).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const CENSUS = JSON.parse(readFileSync(resolve(HERE, 'compositionWriterCensus.json'), 'utf8'));
const read = (p) => readFileSync(resolve(REPO, p), 'utf8');

describe('A46 — the writer census is complete and mechanically derived', () => {
  it('every api/agent module that writes agent settings (txUpdateAgentSettings) is a censused fenced endpoint', () => {
    const agentFiles = readdirSync(resolve(REPO, 'api/agent'))
      .filter((f) => f.endsWith('.js') && !f.includes('.test.'))
      .map((f) => `api/agent/${f}`);
    const settingsWriters = agentFiles.filter((f) => read(f).includes('txUpdateAgentSettings('));
    for (const f of settingsWriters) {
      expect(CENSUS.fencedEndpoints, `${f} writes agent settings but is not in the census`).toContain(f);
    }
    // decide.js is fenced-file-classified, never silently missing:
    expect(CENSUS.derivedClassified.some((d) => d.file === 'api/agent/decide.js')).toBe(true);
  });

  it('every censused fenced endpoint actually validates the epoch in its transaction (wiring proof)', () => {
    for (const f of CENSUS.fencedEndpoints) {
      const src = read(f);
      expect(src, `${f} missing compositionWriteEpoch import`).toContain("from '../_utils/compositionWriteEpoch.js'");
      expect(src, `${f} missing validateWriteEpochInTx call`).toContain('await validateWriteEpochInTx(tx, db');
      expect(src, `${f} missing epoch_closed sentinel row`).toContain('epoch_closed');
    }
  });

  it('every writeCompiledBuildsInTx caller is either a censused endpoint or a censused transactional util', () => {
    const covered = new Set([...CENSUS.fencedEndpoints, ...CENSUS.fencedTransactionalUtils, 'api/_utils/compileOnSettingsChange.js']);
    const candidates = [
      ...readdirSync(resolve(REPO, 'api/agent')).filter((f) => f.endsWith('.js') && !f.includes('.test.')).map((f) => `api/agent/${f}`),
      ...readdirSync(resolve(REPO, 'api/_utils')).filter((f) => f.endsWith('.js') && !f.includes('.test.')).map((f) => `api/_utils/${f}`),
    ];
    for (const f of candidates) {
      if (read(f).includes('writeCompiledBuildsInTx(')) {
        expect(covered.has(f), `${f} writes compiled builds outside the censused set`).toBe(true);
      }
    }
  });

  it('the deploy gate and background/CLI writers carry their declared guards', () => {
    expect(read('api/_utils/deployBuildValidation.js')).toContain('validateWriteEpochInTx');
    for (const loop of CENSUS.backgroundLoops) {
      expect(read(loop.file), `${loop.file} missing loop guard`).toContain('assertWriteEpochOpen');
    }
    for (const cli of CENSUS.adminCliScripts) {
      expect(read(cli.file), `${cli.file} missing CLI guard`).toContain('assertWriteEpochOpen');
    }
  });

  it('the rules layer gates every censused client-SDK clause with epochWriteOpen()', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain('function epochWriteOpen()');
    // 1 definition + 4 gated clauses (agents create; rules create/update; bundles create; bundles update)
    expect((rules.match(/epochWriteOpen\(\)/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(rules).toContain("composition/writeEpoch");
  });
});
