// api/_utils/tickCapture/captureContext.test.js
//
// The request-local context: inert with the flag off, never throws, and the
// registry that lets the OUTER handler finalize a tick that threw (C-9).

import { describe, it, expect } from 'vitest';
import {
  NOOP_TICK_CAPTURE, claimTickCaptureContext, createTickCaptureContext, currentCaptureScope,
  currentTickCapture, markTickCaptureClaimed, newTickCaptureScope, runInTickCaptureScope,
  runWithTickCaptureScope, copyPlain,
} from './captureContext.js';

const live = (over = {}) => createTickCaptureContext({ battleId: 'battle-1', tickSeq: 7, enabled: true, ...over });


describe('flag off — the frozen inert NOOP', () => {
  it('returns the NOOP and binds NOTHING to a scope', () => runWithTickCaptureScope(() => {
    const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 7, enabled: false });
    expect(ctx).toBe(NOOP_TICK_CAPTURE);
    expect(ctx.enabled).toBe(false);
    expect(currentCaptureScope().ctx).toBeNull();
    expect(currentTickCapture()).toBe(NOOP_TICK_CAPTURE);
  }));

  it('every call site is a no-op that returns undefined and mutates nothing', () => {
    const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 7, enabled: false });
    expect(ctx.stage('finalized')).toBeUndefined();
    expect(ctx.exit('completed')).toBeUndefined();
    expect(ctx.action({ symbolOut: 'KO' })).toBeUndefined();
    expect(ctx.check('lock', { status: 'evaluated' })).toBeUndefined();
    expect(ctx.state).toBeUndefined();
    expect(Object.isFrozen(NOOP_TICK_CAPTURE)).toBe(true);
  });

  it('a missing or non-finite tickSeq also yields the NOOP — no record without a number', () => {
    expect(createTickCaptureContext({ battleId: 'battle-1', tickSeq: null, enabled: true })).toBe(NOOP_TICK_CAPTURE);
    expect(createTickCaptureContext({ battleId: '', tickSeq: 1, enabled: true })).toBe(NOOP_TICK_CAPTURE);
  });
});

describe('flag on — identity and the stage ladder', () => {
  it('tickId is `${battleId}:${tickSeq}` and the sequence is the committed one', () => {
    const ctx = live();
    expect(ctx.state.tickId).toBe('battle-1:7');
    expect(ctx.state.tickSeq).toBe(7);
  });

  it('the stage only ever ADVANCES — a later call with an earlier stage cannot walk it back', () => {
    const ctx = live();
    ctx.stage('prompt_built');
    ctx.stage('scores_marked');
    expect(ctx.state.stageReached).toBe('prompt_built');
    ctx.stage('finalized');
    expect(ctx.state.stageReached).toBe('finalized');
  });

  it('an unknown stage name is ignored rather than written', () => {
    const ctx = live();
    ctx.stage('made_up_stage');
    expect(ctx.state.stageReached).toBe('admitted');
  });
});

describe('actions — C-10 identity, inside the record only', () => {
  it('numbers actions from 1 in execution order as `${tickId}:${n}`', () => {
    const ctx = live();
    ctx.action({ symbolOut: 'KO', symbolIn: 'AMD', committed: true });
    ctx.action({ symbolOut: 'PG', symbolIn: 'JPM', committed: true });
    expect(ctx.state.actions.map((a) => a.actionId)).toEqual(['battle-1:7:1', 'battle-1:7:2']);
    expect(ctx.state.actions.map((a) => a.n)).toEqual([1, 2]);
    expect(ctx.state.actions[0].symbolOut).toBe('KO');
  });

  it('`committed` is only true when the caller says so — never defaulted true', () => {
    const ctx = live();
    ctx.action({ symbolOut: 'KO' });
    expect(ctx.state.actions[0].committed).toBe(false);
  });
});

describe('the original tool result is copied ONCE, before any replacement', () => {
  it('a later call cannot overwrite the original; the final result is its own field', () => {
    const ctx = live();
    const original = { decision: 'HOLD', rationale: 'holding the book' };
    ctx.originalToolResult(original);
    ctx.originalToolResult({ decision: 'SWAP' });      // a second call must not win
    ctx.finalToolResult({ decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD' });
    expect(ctx.state.originalTool).toEqual(original);
    expect(ctx.state.finalTool.decision).toBe('SWAP');
  });

  it('the copy is DEEP — mutating the tick\'s object afterwards cannot change the record', () => {
    const ctx = live();
    const result = { decision: 'SWAP', nested: { note: 'before' } };
    ctx.originalToolResult(result);
    result.nested.note = 'after';
    result.decision = 'HOLD';
    expect(ctx.state.originalTool).toEqual({ decision: 'SWAP', nested: { note: 'before' } });
  });
});

describe('nothing throws — a capture bug costs a RECORD, never a tick', () => {
  it('a mutator handed a hostile value records the fault instead of throwing', () => {
    const ctx = live();
    const hostile = { get adjustmentId() { throw new Error('boom'); } };
    expect(() => ctx.controls(hostile)).not.toThrow();
    // Object.assign reads the getter, so the fault is recorded rather than raised.
    expect(ctx.state.faulted).toBe('boom');
  });

  it('a cyclic object is copied to a bounded depth rather than blowing the stack', () => {
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    expect(() => copyPlain(cyclic)).not.toThrow();
  });
});

describe('the SCOPE — how a tick that THREW still gets finalized, without a shared key (F3)', () => {
  it('the in-tick lookup returns the calling chain\'s own context', () => runWithTickCaptureScope(() => {
    const ctx = live();
    expect(currentTickCapture()).toBe(ctx);
    expect(currentCaptureScope().ctx).toBe(ctx);
  }));

  it('two scopes on the SAME battle id never see each other', async () => {
    const a = await runWithTickCaptureScope(async () => {
      const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 1, enabled: true });
      await Promise.resolve();
      return { ctx, seen: currentTickCapture() };
    });
    const b = await runWithTickCaptureScope(async () => {
      const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 2, enabled: true });
      await Promise.resolve();
      return { ctx, seen: currentTickCapture() };
    });
    expect(a.seen).toBe(a.ctx);
    expect(b.seen).toBe(b.ctx);
    expect(a.ctx).not.toBe(b.ctx);
  });

  it('a scope is claimed ONCE, and only by whoever holds it', () => {
    const scope = newTickCaptureScope();
    const ctx = runInTickCaptureScope(scope, () => live());
    expect(claimTickCaptureContext(scope)).toBe(ctx);
    expect(claimTickCaptureContext(scope), 'a second claim gets nothing').toBeNull();
    // and a DIFFERENT scope's claim never reaches this one
    expect(claimTickCaptureContext(newTickCaptureScope())).toBeNull();
    expect(claimTickCaptureContext(null)).toBeNull();
  });

  it('a tick that finalized itself cannot be finalized again by the error path', () => {
    const scope = newTickCaptureScope();
    runInTickCaptureScope(scope, () => live());
    markTickCaptureClaimed(scope);
    expect(claimTickCaptureContext(scope)).toBeNull();
  });

  it('outside any scope the lookup is the inert NOOP, never someone else\'s context', async () => {
    await runWithTickCaptureScope(async () => { live(); });
    expect(currentTickCapture()).toBe(NOOP_TICK_CAPTURE);
  });
});
