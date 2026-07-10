// api/_utils/controlPromptRenderer.test.js
//
// Release 2 PR-c foundations — the shared control renderer's contract tests.
// The BYTE-EXACT golden below is hand-copied from the fenced
// agentEvalPromptAssembly.js directive block (lines 938-943 @ 4a0f43e): when
// PR-c (Phase 2) swaps the fenced call site onto renderDirectiveBlock, the
// enforce-state output must not move by a single byte. The golden passing
// here IS that proof's module half (the assembly half lands with PR-c).
//
// This module is zero-import pure — nothing here may be mocked.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import resolveControlsDefault, {
  SUPPRESSION_REASONS,
  deriveKilledDirectiveIds,
  resolveControls,
  renderDirectiveBlock,
  renderLeansBlock,
  renderControlBlocks,
} from './controlPromptRenderer.js';
import {
  computeEpochKey,
  shouldLogControlEpoch,
  buildControlEpochEvent,
  buildControlEpochLogEntry,
} from './controlSuppressionTelemetry.js';

const DIRECTIVE = Object.freeze({
  text: 'Require stronger confirmation before entering',
  directiveThreadId: 'thread-123',
});

const LEAN_A = Object.freeze({ adjustmentId: 'TF-02', version: 1, text: 'Require stronger confirmation before entering' });
const LEAN_B = Object.freeze({ adjustmentId: 'TF-05', version: 1, text: 'Reduce position size on new entries' });

const ENFORCE = Object.freeze({ archetypeIntegrityMode: 'enforce', standingLeansEnabled: true });
const OBSERVE = Object.freeze({ archetypeIntegrityMode: 'observe', standingLeansEnabled: true });

describe('renderDirectiveBlock — byte-exact legacy golden', () => {
  // The fenced template's literal source lines (agentEvalPromptAssembly.js
  // 938-943 @ 4a0f43e), with the ${} placeholders verbatim.
  const FENCED_TEMPLATE =
    'ACTIVE DIRECTIVE (from your Coach):\n' +
    '"${d.text}"\n' +
    'threadId: ${d.directiveThreadId}\n' +
    'If your next trade is influenced by this directive, include directiveThreadId: "${d.directiveThreadId}" in your submit_trade_decision response.';

  it('reproduces the fenced eval assembly directive block byte-for-byte', () => {
    // Hand-specified from agentEvalPromptAssembly.js:938-943 @ 4a0f43e. Do NOT
    // derive this string from the module under test.
    const golden =
      'ACTIVE DIRECTIVE (from your Coach):\n' +
      '"Require stronger confirmation before entering"\n' +
      'threadId: thread-123\n' +
      'If your next trade is influenced by this directive, include directiveThreadId: "thread-123" in your submit_trade_decision response.';
    expect(renderDirectiveBlock(DIRECTIVE)).toBe(golden);
    // …and the golden IS the fenced template instantiated (ties the two).
    expect(
      FENCED_TEMPLATE
        .replace('${d.text}', DIRECTIVE.text)
        .replaceAll('${d.directiveThreadId}', DIRECTIVE.directiveThreadId),
    ).toBe(golden);
  });

  it('the FENCED SOURCE still contains the exact template this golden was copied from (drift tripwire)', () => {
    // BUILD_RULES §3 "re-verify inherited anchors — they drift": if the
    // fenced block is ever edited via the sanctioned P4 entry, THIS fails,
    // forcing the renderer + golden to be re-synced before PR-c swaps the
    // fenced call site onto renderDirectiveBlock. (The ruleCompatGuard.test.js
    // readFileSync idiom.)
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const fencedSource = readFileSync(resolve(__dirname, 'agentEvalPromptAssembly.js'), 'utf-8');
    expect(fencedSource).toContain(FENCED_TEMPLATE);
  });

  it('returns null for a missing/malformed directive', () => {
    expect(renderDirectiveBlock(null)).toBeNull();
    expect(renderDirectiveBlock({ text: 'x' })).toBeNull();
    expect(renderDirectiveBlock({ directiveThreadId: 't' })).toBeNull();
  });

  it('has no leading or trailing blank lines (assemblies join with \\n\\n)', () => {
    const block = renderDirectiveBlock(DIRECTIVE);
    expect(block.startsWith('\n')).toBe(false);
    expect(block.endsWith('\n')).toBe(false);
  });
});

describe('resolveControls — directive mode semantics', () => {
  it('renders the directive only under enforce', () => {
    const r = resolveControls({ modes: ENFORCE, directive: DIRECTIVE });
    expect(r.directive.effective).toBe(DIRECTIVE);
    expect(r.suppressionDescriptors).toEqual([]);
  });

  it.each(['off', 'observe'])('suppresses the directive under %s (data kept, descriptor emitted)', (mode) => {
    const r = resolveControls({ modes: { archetypeIntegrityMode: mode }, directive: DIRECTIVE });
    expect(r.directive.effective).toBeNull();
    expect(r.suppressionDescriptors).toEqual([
      { target: 'directive', id: 'thread-123', reason: SUPPRESSION_REASONS.MODE_NOT_ENFORCE },
    ]);
  });

  it('missing modes fail closed (default off → suppressed)', () => {
    const r = resolveControls({ directive: DIRECTIVE });
    expect(r.directive.effective).toBeNull();
    expect(r.suppressionDescriptors[0].reason).toBe(SUPPRESSION_REASONS.MODE_NOT_ENFORCE);
  });

  it('keeps an epoch-killed directive dead even under enforce (no resurrection)', () => {
    const r = resolveControls({
      modes: ENFORCE,
      directive: DIRECTIVE,
      killedDirectiveIds: ['thread-123'],
    });
    expect(r.directive.effective).toBeNull();
    expect(r.suppressionDescriptors).toEqual([
      { target: 'directive', id: 'thread-123', reason: SUPPRESSION_REASONS.EPOCH_KILLED },
    ]);
  });

  it('a NEW directive instance renders under enforce despite a prior kill', () => {
    const fresh = { ...DIRECTIVE, directiveThreadId: 'thread-456' };
    const r = resolveControls({ modes: ENFORCE, directive: fresh, killedDirectiveIds: ['thread-123'] });
    expect(r.directive.effective).toBe(fresh);
  });

  it('flags a malformed directive instead of silently dropping it', () => {
    const r = resolveControls({ modes: ENFORCE, directive: { text: '' } });
    expect(r.directive.effective).toBeNull();
    expect(r.suppressionDescriptors[0]).toMatchObject({ target: 'directive', reason: SUPPRESSION_REASONS.MALFORMED });
  });
});

describe('resolveControls — lean semantics (leans resume; overrides expire with their directive)', () => {
  it('suppresses every lean while STANDING_LEANS_ENABLED is false', () => {
    const r = resolveControls({
      modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: false },
      standingLeans: [LEAN_A, LEAN_B],
    });
    expect(r.leans.effective).toEqual([]);
    expect(r.suppressionDescriptors).toEqual([
      { target: 'lean', id: 'TF-02', version: 1, reason: SUPPRESSION_REASONS.LEANS_DISABLED },
      { target: 'lean', id: 'TF-05', version: 1, reason: SUPPRESSION_REASONS.LEANS_DISABLED },
    ]);
  });

  it('renders leans when enabled and unopposed', () => {
    const r = resolveControls({ modes: ENFORCE, standingLeans: [LEAN_A, LEAN_B] });
    expect(r.leans.effective).toEqual([LEAN_A, LEAN_B]);
    expect(r.suppressionDescriptors).toEqual([]);
  });

  it('suppresses an overridden lean beside its RENDERING directive — never both sides of a contradiction', () => {
    const r = resolveControls({
      modes: ENFORCE,
      directive: DIRECTIVE,
      standingLeans: [LEAN_A, LEAN_B],
      leanOverrides: [{ directiveInstanceId: 'thread-123', leanId: 'TF-05', leanVersion: 1, confirmedAt: 't' }],
    });
    expect(r.directive.effective).toBe(DIRECTIVE);
    expect(r.leans.effective).toEqual([LEAN_A]);
    expect(r.suppressionDescriptors).toEqual([
      { target: 'lean', id: 'TF-05', version: 1, reason: SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE },
    ]);
  });

  it('one directive can suppress BOTH equipped leans off one confirmation (two override records, one instance)', () => {
    const r = resolveControls({
      modes: ENFORCE,
      directive: DIRECTIVE,
      standingLeans: [LEAN_A, LEAN_B],
      leanOverrides: [
        { directiveInstanceId: 'thread-123', leanId: 'TF-02' },
        { directiveInstanceId: 'thread-123', leanId: 'TF-05' },
      ],
    });
    expect(r.leans.effective).toEqual([]);
    expect(r.suppressionDescriptors.map((d) => d.reason)).toEqual([
      SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE,
      SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE,
    ]);
  });

  it('a lean RESUMES when its overriding directive is suppressed by mode (override inert)', () => {
    const r = resolveControls({
      modes: OBSERVE,
      directive: DIRECTIVE,
      standingLeans: [LEAN_B],
      leanOverrides: [{ directiveInstanceId: 'thread-123', leanId: 'TF-05' }],
    });
    expect(r.directive.effective).toBeNull();
    expect(r.leans.effective).toEqual([LEAN_B]);
  });

  it('a lean RESUMES when its overriding directive was epoch-killed', () => {
    const r = resolveControls({
      modes: ENFORCE,
      directive: DIRECTIVE,
      standingLeans: [LEAN_B],
      leanOverrides: [{ directiveInstanceId: 'thread-123', leanId: 'TF-05' }],
      killedDirectiveIds: ['thread-123'],
    });
    expect(r.directive.effective).toBeNull();
    expect(r.leans.effective).toEqual([LEAN_B]);
  });

  it('an override bound to a SUPERSEDED directive instance is inert (expires with its directive)', () => {
    const successor = { ...DIRECTIVE, directiveThreadId: 'thread-456' };
    const r = resolveControls({
      modes: ENFORCE,
      directive: successor,
      standingLeans: [LEAN_B],
      leanOverrides: [{ directiveInstanceId: 'thread-123', leanId: 'TF-05' }],
    });
    expect(r.directive.effective).toBe(successor);
    expect(r.leans.effective).toEqual([LEAN_B]);
  });

  it('deduplicates a lean whose OWN id the active directive was minted from (identical sentence never renders twice)', () => {
    const sameIdDirective = { ...DIRECTIVE, adjustmentId: 'TF-02' };
    const r = resolveControls({
      modes: ENFORCE,
      directive: sameIdDirective,
      standingLeans: [LEAN_A, LEAN_B], // LEAN_A is TF-02 — the directive's own id
    });
    expect(r.directive.effective).toBe(sameIdDirective);
    expect(r.leans.effective).toEqual([LEAN_B]);
    expect(r.suppressionDescriptors).toEqual([
      { target: 'lean', id: 'TF-02', version: 1, reason: SUPPRESSION_REASONS.DUPLICATE_OF_DIRECTIVE },
    ]);
    // …and the dedup releases with the directive (lean resumes under observe).
    const observed = resolveControls({ modes: OBSERVE, directive: sameIdDirective, standingLeans: [LEAN_A] });
    expect(observed.leans.effective).toEqual([LEAN_A]);
  });

  it('derives the kill set from controlEpochLog directly (callers cannot forget the derivation)', () => {
    const log = [{ epochKey: 'integrity=observe|leans=on|dial=off', suppressedDirectiveIds: ['thread-123'] }];
    const r = resolveControls({ modes: ENFORCE, directive: DIRECTIVE, controlEpochLog: log });
    expect(r.directive.effective).toBeNull();
    expect(r.suppressionDescriptors[0].reason).toBe(SUPPRESSION_REASONS.EPOCH_KILLED);
    // An explicit killedDirectiveIds override wins over the log when provided.
    const overridden = resolveControls({ modes: ENFORCE, directive: DIRECTIVE, controlEpochLog: log, killedDirectiveIds: [] });
    expect(overridden.directive.effective).toBe(DIRECTIVE);
  });

  it('flags a malformed lean instead of silently dropping it', () => {
    const r = resolveControls({ modes: ENFORCE, standingLeans: [{ adjustmentId: 'TF-02' }] });
    expect(r.leans.effective).toEqual([]);
    expect(r.suppressionDescriptors[0]).toMatchObject({ target: 'lean', id: 'TF-02', reason: SUPPRESSION_REASONS.MALFORMED });
  });

  it('control-free battle resolves to nothing rendered and nothing suppressed', () => {
    const r = resolveControls({ modes: ENFORCE });
    expect(r.directive.effective).toBeNull();
    expect(r.leans.effective).toEqual([]);
    expect(r.suppressionDescriptors).toEqual([]);
  });

  it('default export is resolveControls', () => {
    expect(resolveControlsDefault).toBe(resolveControls);
  });
});

describe('renderLeansBlock / renderControlBlocks', () => {
  it('renders a leans block with one quoted line per lean', () => {
    const block = renderLeansBlock([LEAN_A, LEAN_B]);
    expect(block).toContain('STANDING LEANS (user-equipped persistent adjustments):');
    expect(block).toContain('- "Require stronger confirmation before entering"');
    expect(block).toContain('- "Reduce position size on new entries"');
    expect(block.startsWith('\n')).toBe(false);
    expect(block.endsWith('\n')).toBe(false);
  });

  it('returns null for empty/absent leans', () => {
    expect(renderLeansBlock([])).toBeNull();
    expect(renderLeansBlock(undefined)).toBeNull();
  });

  it('composes blocks straight from a resolution (single-source)', () => {
    const resolution = resolveControls({ modes: ENFORCE, directive: DIRECTIVE, standingLeans: [LEAN_A] });
    const { directiveBlock, leansBlock, suppressionDescriptors } = renderControlBlocks(resolution);
    expect(directiveBlock).toBe(renderDirectiveBlock(DIRECTIVE));
    expect(leansBlock).toBe(renderLeansBlock([LEAN_A]));
    expect(suppressionDescriptors).toEqual([]);
  });

  it('renders no blocks when everything is suppressed', () => {
    const resolution = resolveControls({
      modes: { archetypeIntegrityMode: 'observe', standingLeansEnabled: false },
      directive: DIRECTIVE,
      standingLeans: [LEAN_A],
    });
    const { directiveBlock, leansBlock, suppressionDescriptors } = renderControlBlocks(resolution);
    expect(directiveBlock).toBeNull();
    expect(leansBlock).toBeNull();
    expect(suppressionDescriptors).toHaveLength(2);
  });
});

describe('epoch telemetry — one event per battle + mode-epoch, no directive resurrection', () => {
  const MODES_ENFORCE = { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true, tempoDialEnabled: false };
  const MODES_OBSERVE = { archetypeIntegrityMode: 'observe', standingLeansEnabled: true, tempoDialEnabled: false };

  it('computeEpochKey is deterministic over the modes tuple only', () => {
    expect(computeEpochKey(MODES_ENFORCE)).toBe('integrity=enforce|leans=on|dial=off');
    expect(computeEpochKey(MODES_ENFORCE)).toBe(computeEpochKey({ ...MODES_ENFORCE }));
    expect(computeEpochKey({})).toBe('integrity=off|leans=off|dial=off');
  });

  it('logs once per epoch, stays silent across repeat ticks, re-logs on round-trips', () => {
    const kEnforce = computeEpochKey(MODES_ENFORCE);
    const kObserve = computeEpochKey(MODES_OBSERVE);
    const log = [];
    // Tick 1 (enforce) — logs.
    expect(shouldLogControlEpoch(log, kEnforce)).toBe(true);
    log.push({ epochKey: kEnforce, suppressedDirectiveIds: [] });
    // Ticks 2..n (enforce) — silent.
    expect(shouldLogControlEpoch(log, kEnforce)).toBe(false);
    // Flip to observe — logs.
    expect(shouldLogControlEpoch(log, kObserve)).toBe(true);
    log.push({ epochKey: kObserve, suppressedDirectiveIds: ['thread-123'] });
    // Flip BACK to enforce — logs again (a distinct epoch, same signature).
    expect(shouldLogControlEpoch(log, kEnforce)).toBe(true);
  });

  it('the enforce→observe→enforce round-trip kills the directive via the logged entry (cross-module contract)', () => {
    // Epoch 2 (observe): the directive suppresses; build the REAL event + entry.
    const resolution = resolveControls({ modes: MODES_OBSERVE, directive: DIRECTIVE, standingLeans: [LEAN_A] });
    const event = buildControlEpochEvent({
      battleId: 'b1',
      epochKey: computeEpochKey(MODES_OBSERVE),
      modes: MODES_OBSERVE,
      resolution,
      directive: DIRECTIVE,
      standingLeans: [LEAN_A],
      at: '2026-07-10T00:00:00.000Z',
    });
    const entry = buildControlEpochLogEntry(event);
    expect(entry.suppressedDirectiveIds).toEqual(['thread-123']);
    expect(entry.suppressedLeanIds).toEqual([]); // leans render under observe+enabled — they are NOT epoch-bound

    // Epoch 3 (enforce again): the logged entry keeps the directive dead; the lean resumes untouched.
    const killed = deriveKilledDirectiveIds([entry]);
    expect(killed).toEqual(['thread-123']);
    const r3 = resolveControls({ modes: MODES_ENFORCE, directive: DIRECTIVE, standingLeans: [LEAN_A], killedDirectiveIds: killed });
    expect(r3.directive.effective).toBeNull();
    expect(r3.suppressionDescriptors).toContainEqual(
      { target: 'directive', id: 'thread-123', reason: SUPPRESSION_REASONS.EPOCH_KILLED },
    );
    expect(r3.leans.effective).toEqual([LEAN_A]);
  });

  it('buildControlEpochEvent carries the spec field set with desired-vs-effective per control', () => {
    const resolution = resolveControls({
      modes: MODES_OBSERVE,
      directive: DIRECTIVE,
      standingLeans: [LEAN_A],
    });
    const event = buildControlEpochEvent({
      battleId: 'b1',
      epochKey: computeEpochKey(MODES_OBSERVE),
      modes: MODES_OBSERVE,
      resolution,
      directive: { ...DIRECTIVE, adjustmentId: 'TF-02', canonicalTextVersion: 1 },
      standingLeans: [LEAN_A],
      dialProvenance: { tempoDesired: 'standard', tempoEffective: 'standard', selectionSource: 'default' },
      deploySha: 'sha-1',
      knobConfigVersion: 2,
      dialBandVersion: 2,
      at: '2026-07-10T00:00:00.000Z',
    });
    expect(event).toMatchObject({
      type: 'control_mode_epoch',
      battleId: 'b1',
      epochKey: 'integrity=observe|leans=on|dial=off',
      deploySha: 'sha-1',
      knobConfigVersion: 2,
      dialBandVersion: 2,
      at: '2026-07-10T00:00:00.000Z',
    });
    expect(event.controls).toEqual([
      {
        target: 'directive', id: 'thread-123', adjustmentId: 'TF-02', version: 1,
        desired: 'render', effective: 'suppressed', reason: SUPPRESSION_REASONS.MODE_NOT_ENFORCE,
      },
      { target: 'lean', id: 'TF-02', version: 1, desired: 'render', effective: 'rendered' },
    ]);
    expect(event.tempo).toEqual({ tempoDesired: 'standard', tempoEffective: 'standard', selectionSource: 'default' });
  });

  it('deriveKilledDirectiveIds unions across entries and ignores junk', () => {
    expect(deriveKilledDirectiveIds([
      { suppressedDirectiveIds: ['a'] },
      { suppressedDirectiveIds: ['a', 'b'] },
      { suppressedDirectiveIds: [] },
      {},
      null,
    ])).toEqual(['a', 'b']);
    expect(deriveKilledDirectiveIds(undefined)).toEqual([]);
  });
});

describe('telemetry ↔ renderer parity on malformed controls', () => {
  it('a malformed lean appears in the epoch event under the SAME fallback id the renderer suppressed it with', () => {
    const malformed = { version: 1, text: 'x' }; // adjustmentId lost
    const modes = { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true, tempoDialEnabled: false };
    const resolution = resolveControls({ modes, standingLeans: [malformed] });
    expect(resolution.suppressionDescriptors).toEqual([
      { target: 'lean', id: 'unknown', version: 1, reason: SUPPRESSION_REASONS.MALFORMED },
    ]);
    const event = buildControlEpochEvent({
      battleId: 'b1',
      epochKey: computeEpochKey(modes),
      modes,
      resolution,
      standingLeans: [malformed],
      at: '2026-07-10T00:00:00.000Z',
    });
    // The event can never claim "nothing suppressed" while the renderer suppressed one.
    expect(event.controls).toEqual([
      { target: 'lean', id: 'unknown', version: 1, desired: 'render', effective: 'suppressed', reason: SUPPRESSION_REASONS.MALFORMED },
    ]);
  });
});
