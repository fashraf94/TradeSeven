// api/_utils/practiceField/agentIsolation.imports.test.js
//
// Practice Field build B2, rule 5 — THE IMPORT GUARD, BOTH WAYS. Nothing from the idea book reaches the deployed trading
// agent's prompts, memory or consolidation, and nothing from them reaches the idea book's prompt beyond the frozen
// archetype identity. Walked as the TRANSITIVE LOCAL-IMPORT CLOSURE of each side (posix paths on every platform), not a
// filename list:
//   • the deployed agent's prompt, memory, reflection and consolidation entry points reach NO Practice Field module;
//   • the agent's own modules (the pass at agentRun.js, stopping at the model seam mandateModelCall.js, whose client
//     subtree is the engine's) reach NONE of the deployed agent's prompt, memory, lesson, reflection, consolidation, chat
//     or Huddle modules — the archetype registry (the frozen identity, read at the epoch's version) is the one archetype
//     source, and the walk must reach it (the guard is not vacuous).

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSpecifiersOf } from '../filmRoom/__fixtures__/jsSource.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * The local-import closure of `entry` (repo-relative, posix), stopping at (but including) `stops`. Imports are read by the
 * repo's own parser (filmRoom/__fixtures__/jsSource.js — every static, dynamic and re-export specifier), so no comment
 * can hide one (review C-3: a `//` line holding `/*` fooled a regex stripper).
 */
function closure(entry, stops = []) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (stops.includes(rel) || !rel.startsWith('api/')) continue;
    for (const spec of importSpecifiersOf(readFileSync(path.join(REPO, rel), 'utf8'), rel)) {
      if (typeof spec !== 'string' || !spec.startsWith('.')) continue;
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      if (!target.endsWith('.js') && !target.endsWith('.mjs')) target += '.js';
      if (existsSync(path.join(REPO, target)) && !target.includes('.test.')) stack.push(target);
    }
  }
  return [...seen].sort();
}

/** The deployed trading agent's prompt, memory, reflection and consolidation entry points (each exists — checked below). */
const DEPLOYED_ENTRIES = [
  'api/agent/decide.js', 'api/_utils/agentPromptAssembly.js', 'api/_utils/agentEvalPromptAssembly.js',
  'api/_utils/agentConsolidationApply.js', 'api/_utils/agentConsolidationPrompt.js', 'api/_utils/memoryLessons.js',
  'api/_utils/agentReflectionUtils.js', 'api/_utils/reflectionOutcome.js', 'api/agent/chat.js',
  // review C-1, C-2: the deployed agent's own crons (its eval, its batch review, its reflections) and the renderer of the
  // player's directive and leans into both fenced assemblies.
  'api/cron/agent-evaluate.js', 'api/cron/agent-batch-review.js', 'api/cron/process-pending-reflections.js',
  'api/_utils/controlPromptRenderer.js', 'api/_utils/leanOverrides.js',
];
/** What the idea book's agent may never reach: the deployed agent's prompt, memory, lessons, reflection, consolidation, chat, Huddle. */
const FORBIDDEN = /^api\/(agent\/|cron\/(agent-|process-pending-reflections)|_utils\/(agentPromptAssembly|agentEvalPromptAssembly|agentConsolidation[A-Za-z]*|memoryLessons|agentReflectionUtils|reflectionOutcome|agentMemory[A-Za-z]*|wire[A-Za-z]*|controlPromptRenderer|leanOverrides|voiceLayer[A-Za-z]*|huddle\/))/;

describe('rule 5 — the idea book\'s agent and the deployed trading agent never meet', () => {
  it('every deployed-agent entry point exists, and its closure reaches no Practice Field module', () => {
    for (const entry of DEPLOYED_ENTRIES) {
      expect(existsSync(path.join(REPO, entry)), entry).toBe(true);
      const reached = closure(entry).filter((r) => r.startsWith('api/_utils/practiceField/'));
      expect(reached, entry).toEqual([]);
    }
  });

  it('the agent\'s own closure reaches none of the deployed agent\'s prompt, memory, consolidation, chat or Huddle — only the frozen identity', () => {
    const reach = closure('api/_utils/practiceField/agentRun.js', ['api/_utils/mandateModelCall.js']);
    // Not vacuous: the walk read the agent's whole tree and reached the identity source and the model seam.
    for (const r of ['api/_utils/practiceField/agentPrompt.js', 'api/_utils/practiceField/agentSources.js', 'api/_utils/practiceField/managerExit.js', 'api/_utils/archetypeRegistry.js', 'api/_utils/mandateModelCall.js']) {
      expect(reach, r).toContain(r);
    }
    expect(reach.filter((r) => FORBIDDEN.test(r))).toEqual([]);
  });

  it('the prompt module reads the archetype registry and nothing of the deployed agent; its identity is read at the epoch\'s own version', () => {
    const src = readFileSync(path.join(REPO, 'api/_utils/practiceField/agentPrompt.js'), 'utf8');
    expect(src).toMatch(/getArchetypeDefinition\(codeId, \{ identityVersion: version \}\)/);
    expect(closure('api/_utils/practiceField/agentPrompt.js').filter((r) => FORBIDDEN.test(r))).toEqual([]);
  });
});
