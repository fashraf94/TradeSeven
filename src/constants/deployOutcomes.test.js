// src/constants/deployOutcomes.test.js
//
// Command Center repair R1 (ruling R-R1-1) — the service's six typed outcomes
// equal the hub's SERVICE_OUTCOMES, key by key, so the vocabulary the deploy
// service writes is the one the hub's translator reads (spec V1.2 §5.2). The
// service imports src/constants/deployOutcomes.js, never the hub directory:
// the main graph may not reach into it (commandCenterHub.mount.guard.test.js).
// This test file may; the mount guard's walk skips tests.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPLOY_OUTCOMES } from './deployOutcomes';
import { SERVICE_OUTCOMES } from '../components/CommandCenter/hub/selectors/attemptVocabulary';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('the deploy outcomes are the hub\'s service outcomes (R-R1-1)', () => {
  it('the same six keys and the same six strings', () => {
    expect(DEPLOY_OUTCOMES).toEqual(SERVICE_OUTCOMES);
    expect(Object.values(DEPLOY_OUTCOMES).sort()).toEqual(
      ['created', 'existing_battle', 'handoff_failed', 'orphaned', 'refused', 'uncertain'],
    );
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEPLOY_OUTCOMES)).toBe(true);
  });

  it('the service takes them from src/constants, and nothing from the hub directory', () => {
    const src = readFileSync(path.join(HERE, '../services/agentDeploy.js'), 'utf8');
    expect(src).toContain("import { DEPLOY_OUTCOMES } from '../constants/deployOutcomes';");
    const specifiers = [...src.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(5);
    expect(specifiers.filter((s) => s.includes('CommandCenter'))).toEqual([]);
  });
});
