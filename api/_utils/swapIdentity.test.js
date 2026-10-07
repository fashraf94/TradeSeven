// api/_utils/swapIdentity.test.js
//
// Pilot P6 — the caller side of the swap identity check: the options the cron
// hands the executor, the beliefs, the refusal records, and table F
// (docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md, V1.1) — shipped VERBATIM (read
// from the spec file, compared byte for byte), filled only from the record,
// and free of table E's forbidden vocabulary.
//
// Dependency-surface guard (BUILD_RULES §4): this import of the module the
// cron uses (and, through it, the fenced executor and src/config/featureFlags.js)
// is never mocked.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  SWAP_IDENTITY_OFF, currentSwapIdentityMode, swapIdentityActive, swapIdentityOptions,
  expectedOutOfPosition, expectedOutOfStored, storedIdentityOf, isSwapRefusal,
  REFUSAL_LINES, REFUSAL_KINDS, refusalLine, refusalRecord, departedLegRecord, refusalFeedFields,
} from './swapIdentity.js';
import { SwapRefusalError, SWAP_REFUSAL_REASONS } from './agentSwapExecution.js';
import { SWAP_IDENTITY_MODE } from '../../src/config/featureFlags.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLES = readFileSync(resolve(HERE, '../../docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md'), 'utf8').replace(/\r\n/g, '\n');

/** Table F's rows: { wire-value cell → the quoted player line }. */
function tableF() {
  const start = TABLES.indexOf('## F. Execution refusals');
  expect(start).toBeGreaterThan(0);
  const section = TABLES.slice(start);
  const rows = {};
  for (const line of section.split('\n')) {
    const m = /^\| (.+?) \| "(.+)" \|$/.exec(line);
    if (m) rows[m[1]] = m[2];
  }
  return rows;
}

const VERIFICATION = Object.freeze({
  verificationId: 'b1:eval_7:verify', mode: 'enforce', verdict: 'mismatch', basis: 'symbol_and_entry',
  expected: { symbol: 'KO', swappedInAt: null }, found: { symbol: 'XOM', swappedInAt: '2026-10-07T14:50:00.000Z' },
  battleStatus: 'active', slot: { tier: 'support', slotIndex: 0 }, tradeSeq: 3, checkedAt: '2026-10-07T15:00:01.000Z',
});
const refusal = (reason = 'outgoing_identity_mismatch', verification = VERIFICATION) =>
  new SwapRefusalError(reason, verification, `Swap refused (${reason}): …`);

describe('table F, verbatim (V1.1, founder decision D5)', () => {
  const F = tableF();

  it('the spec\'s table F has exactly the three rows the server ships', () => {
    expect(Object.keys(F)).toEqual([
      '`outgoing_identity_mismatch` (agent, proposal or meeting)',
      '`outgoing_identity_mismatch` (protective)',
      '`battle_not_active`',
    ]);
  });

  it('each shipped line equals its table row byte for byte', () => {
    expect(REFUSAL_LINES.outgoing_identity_mismatch.agent).toBe(F['`outgoing_identity_mismatch` (agent, proposal or meeting)']);
    expect(REFUSAL_LINES.outgoing_identity_mismatch.protective).toBe(F['`outgoing_identity_mismatch` (protective)']);
    expect(REFUSAL_LINES.battle_not_active).toBe(F['`battle_not_active`']);
    expect(Object.isFrozen(REFUSAL_LINES)).toBe(true);
    expect(Object.isFrozen(REFUSAL_LINES.outgoing_identity_mismatch)).toBe(true);
  });

  it('the table names every reason the executor can raise, and nothing else', () => {
    expect(Object.keys(REFUSAL_LINES).sort()).toEqual([...SWAP_REFUSAL_REASONS].sort());
    expect(REFUSAL_KINDS).toEqual(['agent', 'protective']);
  });

  it('the V1.1 note is dated and tables A–E keep their places', () => {
    expect(TABLES).toContain('**V1.1 — 7 Oct 2026:**');
    const order = ['## A.', '## B.', '## C.', '## D.', '## E.', '## F.'].map((h) => TABLES.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('table E — no forbidden vocabulary in table F, filled or not', () => {
  const FORBIDDEN = [
    /\bhedge/i, /\btrim/i, /\bpartial/i, /\bscale (in|out)\b/i, /take some off/i, /cash position/i, /move to cash/i,
    /sit in cash/i, /wait for the market to/i, /probably|likely fine/i, /guaranteed/i, /can'?t lose/i, /chose to hold/i,
  ];
  it('the templates and every rendering', () => {
    const all = [
      REFUSAL_LINES.outgoing_identity_mismatch.agent, REFUSAL_LINES.outgoing_identity_mismatch.protective, REFUSAL_LINES.battle_not_active,
      refusalLine('outgoing_identity_mismatch', { kind: 'agent', symbol: 'KO', symbolIn: 'AMD' }),
      refusalLine('outgoing_identity_mismatch', { kind: 'protective', symbol: 'KO' }),
      refusalLine('battle_not_active'),
    ];
    const hits = all.flatMap((s) => FORBIDDEN.filter((re) => re.test(s)).map((re) => `${re} in "${s}"`));
    expect(hits).toEqual([]);
  });
});

describe('placeholders are filled from the record, never invented', () => {
  it('the agent line names the belief and the incoming stock; the protective line the belief', () => {
    expect(refusalLine('outgoing_identity_mismatch', { kind: 'agent', symbol: 'KO', symbolIn: 'AMD' }))
      .toBe('The agent tried to swap KO for AMD, but KO had already left that slot. No trade was made.');
    expect(refusalLine('outgoing_identity_mismatch', { kind: 'protective', symbol: 'KO', symbolIn: 'AMD' }))
      .toBe('Protection was set to sell KO, but KO had already left that slot. No trade was made.');
    expect(refusalLine('battle_not_active', { kind: 'protective' })).toBe('This trade arrived after the battle ended. No trade was made.');
  });

  it('a missing value → null (no line), never a blank or a guess', () => {
    expect(refusalLine('outgoing_identity_mismatch', { kind: 'agent', symbol: 'KO', symbolIn: null })).toBeNull();
    expect(refusalLine('outgoing_identity_mismatch', { kind: 'agent', symbol: '  ', symbolIn: 'AMD' })).toBeNull();
    expect(refusalLine('outgoing_identity_mismatch', { kind: 'protective', symbol: null })).toBeNull();
    expect(refusalLine('some_other_reason', { symbol: 'KO', symbolIn: 'AMD' })).toBeNull();
  });

  it('[SYM] is the BELIEF (verification.expected.symbol), never the occupant found in the slot', () => {
    const record = refusalRecord(refusal(), { kind: 'agent', symbolIn: 'AMD' });
    expect(record.line).toContain('swap KO for AMD');
    expect(record.line).not.toContain('XOM');
    expect(refusalFeedFields(refusal(), { kind: 'protective' }).message).toBe('Protection was set to sell KO, but KO had already left that slot. No trade was made.');
  });
});

describe('the refusal records', () => {
  it('refusalRecord: the reason, the id, the executor\'s verification, the line', () => {
    expect(refusalRecord(refusal(), { kind: 'agent', symbolIn: 'AMD' })).toEqual({
      reason: 'outgoing_identity_mismatch',
      verificationId: 'b1:eval_7:verify',
      verification: VERIFICATION,
      line: 'The agent tried to swap KO for AMD, but KO had already left that slot. No trade was made.',
    });
    expect(refusalRecord(refusal('battle_not_active'), { symbolIn: 'AMD' }).line).toBe(REFUSAL_LINES.battle_not_active);
  });

  it('departedLegRecord: no executor reached, so no verification; the leg\'s own belief fills the line', () => {
    expect(departedLegRecord({ symbolOut: 'INTC', symbolIn: 'JPM' })).toEqual({
      reason: 'outgoing_identity_mismatch', verificationId: null, verification: null,
      line: 'The agent tried to swap INTC for JPM, but INTC had already left that slot. No trade was made.',
    });
  });

  it('refusalFeedFields: the line as the message, the typed reason, the id — and no message key when the line cannot be filled', () => {
    expect(refusalFeedFields(refusal(), { kind: 'agent', symbolIn: 'AMD' })).toEqual({
      message: 'The agent tried to swap KO for AMD, but KO had already left that slot. No trade was made.',
      refusalReason: 'outgoing_identity_mismatch',
      verificationId: 'b1:eval_7:verify',
    });
    expect(refusalFeedFields(refusal(), { kind: 'agent', symbolIn: null })).toEqual({ refusalReason: 'outgoing_identity_mismatch', verificationId: 'b1:eval_7:verify' });
  });

  it('isSwapRefusal: only the executor\'s typed refusal (a reason it can raise, with its verification)', () => {
    expect(isSwapRefusal(refusal())).toBe(true);
    expect(isSwapRefusal(refusal('battle_not_active'))).toBe(true);
    expect(isSwapRefusal(new Error('Asset no longer available in slot'))).toBe(false);
    expect(isSwapRefusal(Object.assign(new Error('x'), { reason: 'outgoing_identity_mismatch' }))).toBe(false); // no verification
    expect(isSwapRefusal(Object.assign(new Error('x'), { reason: 'guardrail_error', verification: {} }))).toBe(false);
    expect(isSwapRefusal(null)).toBe(false);
  });
});

describe('the options the cron hands the executor', () => {
  it("'off' — and anything that is not a walked state — hands NOTHING (the call keeps its pre-P6 arguments)", () => {
    for (const mode of ['off', undefined, null, '', 'ENFORCE', 'on', true]) {
      expect(swapIdentityOptions(mode, { symbol: 'KO', swappedInAt: null })).toEqual([]);
      expect(swapIdentityOptions(mode, { symbol: 'KO' }, { padSnapshot: true })).toEqual([]);
      expect(swapIdentityActive(mode)).toBe(false);
    }
  });

  it('shadow / enforce hand one options object; a no-snapshot call pads the snapshot place with its default', () => {
    expect(swapIdentityOptions('shadow', { symbol: 'KO', swappedInAt: null })).toEqual([{ identityMode: 'shadow', expectedOut: { symbol: 'KO', swappedInAt: null } }]);
    expect(swapIdentityOptions('enforce', null)).toEqual([{ identityMode: 'enforce', expectedOut: null }]);
    expect(swapIdentityOptions('enforce', { symbol: 'KO' }, { padSnapshot: true })).toEqual([null, { identityMode: 'enforce', expectedOut: { symbol: 'KO' } }]);
    expect(swapIdentityActive('shadow')).toBe(true);
    expect(swapIdentityActive('enforce')).toBe(true);
  });

  it('the check\'s mode is the flag, resolved', () => {
    expect(currentSwapIdentityMode()).toBe(SWAP_IDENTITY_MODE);
    expect(SWAP_IDENTITY_OFF).toBe('off');
  });
});

describe('the beliefs', () => {
  it('a position in memory: its symbol and entry instant — null for a creation-time position', () => {
    expect(expectedOutOfPosition({ symbol: 'KO', swappedInAt: '2026-10-07T14:00:00.000Z', swapPrice: 61 })).toEqual({ symbol: 'KO', swappedInAt: '2026-10-07T14:00:00.000Z' });
    expect(expectedOutOfPosition({ symbol: 'NVDA' })).toEqual({ symbol: 'NVDA', swappedInAt: null });
    expect(expectedOutOfPosition(null)).toBeNull();
    expect(expectedOutOfPosition({ swappedInAt: 'x' })).toEqual({ symbol: null, swappedInAt: 'x' }); // a malformed position never matches
  });

  it('a stored belief: the instant when the record carries the key (null included); symbol-only when it does not', () => {
    expect(expectedOutOfStored('KO', { outgoingSwappedInAt: null }, 'outgoingSwappedInAt')).toEqual({ symbol: 'KO', swappedInAt: null });
    expect(expectedOutOfStored('KO', { outgoingSwappedInAt: '2026-10-07T14:00:00.000Z' }, 'outgoingSwappedInAt')).toEqual({ symbol: 'KO', swappedInAt: '2026-10-07T14:00:00.000Z' });
    expect(expectedOutOfStored('KO', {}, 'outgoingSwappedInAt')).toEqual({ symbol: 'KO' });
    expect(Object.hasOwn(expectedOutOfStored('KO', {}, 'swappedInAt'), 'swappedInAt')).toBe(false);
    expect(expectedOutOfStored(undefined, { swappedInAt: null }, 'swappedInAt')).toEqual({ symbol: null, swappedInAt: null }); // a malformed record never passes
  });

  it('what a creation site stores: the entry instant of the position it read, null for a creation-time one', () => {
    expect(storedIdentityOf({ symbol: 'KO', swappedInAt: '2026-10-07T14:00:00.000Z' })).toBe('2026-10-07T14:00:00.000Z');
    expect(storedIdentityOf({ symbol: 'NVDA' })).toBeNull();
    expect(storedIdentityOf(undefined)).toBeNull();
  });
});
