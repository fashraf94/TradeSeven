// src/components/CommandCenter/Armory.test.js
//
// Agent form build A1 — the armory's pure parts: the ring's geometry (board 6 on the wide compositions; FD-8's phone
// ring at 320, 360 and 390 px: no overlap, no overflow, every tap target ≥ 44 px), the set order, the status line
// (FD-6), the equip's error words, and the hero's read on the phone.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/agentService', () => ({ changeArchetype: vi.fn() }));

import { ARCHETYPE_ORDER } from '../Dashboard/ArchetypePicker';
import { ARMORY_COPY, HUB_COPY } from './hub/hubCopy';
import { PHONE_TARGET } from './hub/hubStyle';
import { armoryLines } from './hub/archetypeLines';
import {
  ARMORY_SETS, COMPACT_RING, DESKTOP_RING, PHONE_ARMORY, armoryHeroRead, armoryStatus, equipErrorOf, firstPreview, isBattleLock, ringPoints,
} from './Armory';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8').replace(/\r\n/g, '\n');

/** A box centred at (x, y) with side s. */
const box = (x, y, s) => ({ left: x - s / 2, right: x + s / 2, top: y - s / 2, bottom: y + s / 2 });
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('the sets', () => {
  it('are the six archetypes in the locked Identity Contract order, the picker\'s', () => {
    expect(ARMORY_SETS).toBe(ARCHETYPE_ORDER);
    expect([...ARMORY_SETS]).toEqual(['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian']);
  });

  it('a fresh armory previews the equipped set, or the first set for an archetype that is none of the six', () => {
    expect(firstPreview('analyst')).toBe('analyst');
    for (const other of [undefined, null, 'unknown', 'momentum', '']) expect(firstPreview(other)).toBe('momentum_chaser');
  });

  it('ringPoints: six points clockwise from the top, a radius out', () => {
    const p = ringPoints(100, 0, 0);
    expect(p).toHaveLength(6);
    expect(p[0].x).toBeCloseTo(0); expect(p[0].y).toBeCloseTo(-100);
    expect(p[1].x).toBeCloseTo(86.6, 1); expect(p[1].y).toBeCloseTo(-50);
    expect(p[3].y).toBeCloseTo(100);
    for (const q of p) expect(Math.hypot(q.x, q.y)).toBeCloseTo(100);
  });
});

describe('the wide ring (board 6)', () => {
  it('desktop is board 6\'s numbers: 690 × 700, Shadow at 300, cards of 150 holding the set at 112, a ring of 252, a 1040 dialog', () => {
    expect(DESKTOP_RING).toMatchObject({ width: 690, height: 700, centre: 300, slot: 112, card: 150, radius: 252, dialog: 1040 });
  });

  it.each([['desktop', DESKTOP_RING], ['compact', COMPACT_RING]])('%s: every card sits inside the listbox\'s box', (_name, ring) => {
    const cardHeight = ring.cardTop * 2;
    for (const { x, y } of ringPoints(ring.radius, ring.width / 2, ring.width / 2)) {
      expect(x - ring.card / 2).toBeGreaterThanOrEqual(0);
      expect(x + ring.card / 2).toBeLessThanOrEqual(ring.width);
      expect(y - ring.cardTop).toBeGreaterThanOrEqual(0);
      expect(y - ring.cardTop + cardHeight).toBeLessThanOrEqual(ring.height);
    }
    expect(ring.slot).toBeLessThan(ring.card);
  });
});

describe('the phone ring (FD-8), at 320, 360 and 390 px', () => {
  const { centre, slot, radius, extent, padding } = PHONE_ARMORY;
  const half = extent / 2;
  const points = ringPoints(radius, half, half);
  const hero = box(half, half, centre);
  const sets = points.map((p) => box(p.x, p.y, slot));
  const close = { left: extent - PHONE_TARGET, right: extent, top: 0, bottom: PHONE_TARGET };

  it('the sizes are the ruling\'s ranges: the hero 150–160 live, the sets 44–48, the ring 112–118', () => {
    expect(centre).toBeGreaterThanOrEqual(150); expect(centre).toBeLessThanOrEqual(160);
    expect(slot).toBeGreaterThanOrEqual(44); expect(slot).toBeLessThanOrEqual(48);
    expect(radius).toBeGreaterThanOrEqual(112); expect(radius).toBeLessThanOrEqual(118);
  });

  it('every tap target is at least the phone\'s 44 px: each set\'s whole square, and Close', () => {
    expect(PHONE_TARGET).toBe(44);
    expect(slot).toBeGreaterThanOrEqual(PHONE_TARGET);
    expect(close.right - close.left).toBe(PHONE_TARGET);
  });

  it('nothing overlaps: no set meets the hero\'s box or another set, and Close meets no set', () => {
    for (const s of sets) expect(overlaps(s, hero)).toBe(false);
    for (let i = 0; i < sets.length; i += 1) for (let j = i + 1; j < sets.length; j += 1) expect(overlaps(sets[i], sets[j])).toBe(false);
    for (const s of sets) expect(overlaps(s, close)).toBe(false);
    // and everything stays inside the extent square
    for (const s of [...sets, hero, close]) {
      expect(s.left).toBeGreaterThanOrEqual(0); expect(s.top).toBeGreaterThanOrEqual(0);
      expect(s.right).toBeLessThanOrEqual(extent); expect(s.bottom).toBeLessThanOrEqual(extent);
    }
  });

  it.each([320, 360, 390])('at %i px the ring fits the stage: the hub\'s gutter, the stage\'s border and the armory\'s padding leave room for it', (width) => {
    // The hub's phone gutter (CommandCenterHub.jsx) and the stage's 1 px border (ShadowStage.jsx), read from the source.
    expect(read('CommandCenterHub.jsx')).toContain("<div style={{ padding: '10px 14px 12px' }}>");
    expect(read('ShadowStage.jsx')).toContain('border: `1px solid ${HAIR}`, padding: open ? padding : \'10px 14px 14px 6px\',');
    const [, side] = padding.split(' ').map((v) => Number.parseFloat(v));
    const inner = width - 2 * 14 - 2 * 1 - 2 * side;
    expect(inner).toBeGreaterThanOrEqual(extent);
  });
});

describe('the status line (FD-6): "Equipped" or "Previewing" only', () => {
  it('the equipped set reads Equipped; any other reads Previewing and names the equipped set', () => {
    expect(armoryStatus('analyst', 'analyst')).toBe(ARMORY_COPY.equipped);
    expect(armoryStatus('degen', 'analyst')).toBe(`Previewing · Equipped set is ${armoryLines('analyst').name}`);
  });

  it('carries no count, stage or growth, whatever the pair (D4)', () => {
    for (const a of ARMORY_SETS) for (const b of ARMORY_SETS) expect(armoryStatus(a, b)).not.toMatch(/\d|stage|battle|level|grow|worn/i);
  });
});

describe('the equip\'s error words', () => {
  it('a battle lock is a 409 battle_active, and only that', () => {
    expect(isBattleLock({ status: 409, code: 'battle_active' })).toBe(true);
    for (const e of [{ status: 409, code: 'epoch_closed' }, { status: 409, code: 'composition_blocked' }, { status: 500, code: 'battle_active' }, null, undefined]) expect(isBattleLock(e)).toBe(false);
  });

  it('the lock shows the hub\'s lock line; another failure its own message; none, the picker\'s words', () => {
    expect(equipErrorOf({ status: 409, code: 'battle_active', message: 'Cannot change archetype while the agent has an active battle.' })).toBe(HUB_COPY.loadout.nextDeployLocked);
    expect(equipErrorOf({ status: 409, code: 'epoch_closed', message: 'Try again in a few minutes.' })).toBe('Try again in a few minutes.');
    expect(equipErrorOf(new Error(''))).toBe(ARMORY_COPY.equipFailed);
    expect(equipErrorOf(undefined)).toBe(ARMORY_COPY.equipFailed);
  });
});

describe('the hero\'s read on the phone', () => {
  it('a ready read wears the shown set and carries `instant`; the read itself is not changed', () => {
    const read0 = { status: 'ready', agent: { id: 'a1', archetype: 'analyst', name: 'Nova' }, retry: () => {} };
    const r = armoryHeroRead(read0, 'degen', true);
    expect(r.agent).toEqual({ id: 'a1', archetype: 'degen', name: 'Nova' });
    expect(r.instant).toBe(true);
    expect(r.retry).toBe(read0.retry);
    expect(read0.agent.archetype).toBe('analyst');
    expect(armoryHeroRead(read0, 'degen', undefined).instant).toBe(false);
  });

  it('a read that is not ready, or has no agent, passes through unchanged', () => {
    for (const r of [null, { status: 'loading', agent: null }, { status: 'error', agent: null }, { status: 'ready', agent: null }]) expect(armoryHeroRead(r, 'degen', true)).toBe(r);
  });
});
