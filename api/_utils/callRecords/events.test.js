// api/_utils/callRecords/events.test.js
//
// Cockpit Build 1a — CALL EVENTS and the dormant response-fork hook (spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §10, §11, §15.9; contract Amendment B §6,
// §11): deterministic ids; the event shape; created atomically with each
// transition (a failed transaction leaves no event — heard.test.js and
// sweep.test.js drive the transactions; here the create-once write); NONE in
// chatExchanges[]; `promptDirectiveThreadId` only from an unsuppressed heard
// (heard.test.js); no causal text anywhere; the attribution flag pinned false.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventIdOf, answerIdOf, buildCallEvent, createCallEvent, callEventRef, CALL_EVENT_KINDS, EVENTS_SUBCOLLECTION } from './events.js';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';
import { RESPONSE_FORK_ATTRIBUTION_ENABLED } from '../../../src/config/featureFlags.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

describe('deterministic ids (Amendment B §6)', () => {
  it('one id per transition, from the identity it commits', () => {
    expect(eventIdOf('declared', { evalId: 'eval_007' })).toBe('eval_007:declared');
    expect(eventIdOf('answered', { callId: 'c1', answerId: answerIdOf('c1', 'hold') })).toBe('c1:answered:c1:answer:hold:');
    expect(eventIdOf('answered', { callId: 'c1', answerId: answerIdOf('c1', 'pick', 'JPM') })).toBe('c1:answered:c1:answer:pick:JPM');
    expect(eventIdOf('heard', { callId: 'c1', evalId: 'eval_007' })).toBe('c1:heard:eval_007');
    expect(eventIdOf('acted', { callId: 'c1', evalId: 'eval_007' })).toBe('c1:acted:eval_007');
    expect(eventIdOf('no_matching_trade', { callId: 'c1', evalId: 'eval_007' })).toBe('c1:no_match:eval_007');
    expect(eventIdOf('expired', { callId: 'c1' })).toBe('c1:expired');
    expect(eventIdOf('ended_with_battle', { callId: 'c1' })).toBe('c1:ended');
    expect(eventIdOf('superseded', { directiveThreadId: 'thread-x' })).toBe('thread-x:superseded');
    expect(() => eventIdOf('heard', { callId: 'c1' })).toThrow(/needs evalId/);
    expect(() => eventIdOf('bogus', {})).toThrow(/unknown kind/);
    expect(CALL_EVENT_KINDS).toEqual(['declared', 'answered', 'heard', 'acted', 'no_matching_trade', 'expired', 'ended_with_battle', 'superseded']);
    expect(EVENTS_SUBCOLLECTION).toBe('callEvents');
  });
});

describe('the event shape (§10)', () => {
  it('kind, at, callIds, text, saidOk, evidence — nulls never undefined; promptDirectiveThreadId only when a string is given', () => {
    expect(buildCallEvent({ kind: 'heard', at: 5, callIds: ['c1', ''], text: 'Heard at the 10:15 check' })).toEqual({
      kind: 'heard', at: 5, callIds: ['c1'], text: 'Heard at the 10:15 check', saidOk: null, evidence: { evalId: null, promptBuiltAt: null, checkLabel: null },
    });
    const declared = buildCallEvent({ kind: 'declared', at: NaN, callIds: [], text: '', saidOk: true, evidence: { evalId: 'e', promptBuiltAt: 'p', checkLabel: 'the 10:15 check' }, promptDirectiveThreadId: 'thread-t' });
    expect(declared).toEqual({ kind: 'declared', at: null, callIds: [], text: null, saidOk: true, evidence: { evalId: 'e', promptBuiltAt: 'p', checkLabel: 'the 10:15 check' }, promptDirectiveThreadId: 'thread-t' });
    expect(buildCallEvent({ kind: 'declared', at: 1, callIds: [], text: 'x', promptDirectiveThreadId: null })).not.toHaveProperty('promptDirectiveThreadId');
    expect(buildCallEvent({ kind: 'declared', at: 1, callIds: [], text: 'x', promptDirectiveThreadId: undefined })).not.toHaveProperty('promptDirectiveThreadId');
    expect(() => buildCallEvent({ kind: 'held', at: 1 })).toThrow(/unknown kind/);
    expect(JSON.stringify(buildCallEvent({ kind: 'acted', at: 1, callIds: ['c'], text: 't' }))).not.toContain('undefined');
  });
});

describe('createCallEvent — a CREATE on the committing transaction, never a set', () => {
  it('writes the event at its deterministic path; a second create of the same id fails ALREADY_EXISTS and applies nothing', async () => {
    const db = makeCallsFirestore({ docs: {} });
    const event = buildCallEvent({ kind: 'expired', at: 1, callIds: ['c1'], text: 'Expired' });
    await db.runTransaction(async (tx) => { createCallEvent(tx, db, 'b1', { kind: 'expired', idParams: { callId: 'c1' }, event }); });
    expect(stored(db, 'agentBattles/b1/callEvents/c1:expired')).toEqual(event);
    expect(callEventRef(db, 'b1', 'c1:expired').path).toBe('agentBattles/b1/callEvents/c1:expired');
    await expect(db.runTransaction(async (tx) => { createCallEvent(tx, db, 'b1', { kind: 'expired', idParams: { callId: 'c1' }, event: { ...event, text: 'rewritten' } }); })).rejects.toThrow(/ALREADY_EXISTS/);
    expect(stored(db, 'agentBattles/b1/callEvents/c1:expired')).toEqual(event);
  });

  it('a transaction that fails after buffering an event leaves none', async () => {
    const db = makeCallsFirestore({ docs: { 'agentBattles/b1': { status: 'active' } } });
    await expect(db.runTransaction(async (tx) => {
      await tx.get(db.doc('agentBattles/b1'));
      createCallEvent(tx, db, 'b1', { kind: 'heard', idParams: { callId: 'c1', evalId: 'e1' }, event: buildCallEvent({ kind: 'heard', at: 1, callIds: ['c1'], text: 'x' }) });
      throw new Error('the transition failed');
    })).rejects.toThrow('the transition failed');
    expect(stored(db, 'agentBattles/b1/callEvents/c1:heard:e1')).toBeNull();
  });
});

/** Every product source file under a directory (tests excluded). */
function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(js|mjs)$/.test(name) && !/\.test\.|__fixtures__|\.rules\./.test(p)) out.push(p);
  }
  return out;
}

describe('no event ever enters chatExchanges[]; no causal text anywhere; the attribution flag is dark (§10, §11)', () => {
  const files = [...sourceFiles(resolve(REPO, 'api')), ...sourceFiles(resolve(REPO, 'src/config'))];
  const read = (p) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the directive writers append chatExchanges ONLY through the shared slot writer; nothing under callRecords/ appends to chatExchanges; no event is ever appended there', () => {
    const appends = (src) => /chatExchanges:\s*(FieldValue\.)?arrayUnion/.test(src) || /chatExchanges\.push\(/.test(src);
    const rel = (p) => p.replace(/\\/g, '/').split('/api/')[1];
    const writers = files.filter((p) => appends(read(p))).map(rel).sort();
    expect(writers).toContain('_utils/directiveWriter.js');
    // chat.js and file-directive.js no longer carry their own append — the shared writer does (spec §6).
    expect(writers).not.toContain('agent/chat.js');
    expect(writers).not.toContain('agent/file-directive.js');
    expect(writers).not.toContain('agent/call-response.js');
    // Nothing under callRecords/ APPENDS to chatExchanges (reading a thread's record from it is fine).
    for (const p of files.filter((p) => p.includes('callRecords'))) expect(appends(read(p)), p).toBe(false);
    // The shared writer appends the EXCHANGE and creates the event in its own subcollection — never the event into the array.
    const writer = read(resolve(REPO, 'api/_utils/directiveWriter.js'));
    expect(writer).toMatch(/chatExchanges: arrayUnion\(stamped\)/);
    expect(writer).not.toMatch(/arrayUnion\(event/);
  });

  it('no product source writes "In response to" or a heldOff fact; the response-fork flag ships false and gates nothing live', () => {
    for (const p of files) {
      const src = read(p);
      expect(src, p).not.toMatch(/In response to/);
      expect(src, p).not.toMatch(/heldOff\s*[:=]\s*true/);
    }
    expect(RESPONSE_FORK_ATTRIBUTION_ENABLED).toBe(false);
    // The dormant hook: the declared event's prompt-inclusion field exists, and the only text is the inclusion line.
    const publish = read(resolve(HERE, 'publish.js'));
    expect(publish).toContain("Directive in this check's prompt:");
    expect(publish).toContain('promptDirectiveThreadId');
    expect(read(resolve(HERE, 'events.js'))).toContain('promptDirectiveThreadId');
  });
});
