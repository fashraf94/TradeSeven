// src/components/League/battleArena/finishedRivalRead.test.js
//
// Agent form build S2, founder ruling 4 of Oct 30, 2026 — the one read of a finished group's rival armor. One endpoint call
// per group however many forms ask, never a poll, and a failure that stays an answer. The form's side is
// LeagueAgentForm.jsdom.test.jsx.

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: http.fetchWithAuth }));

let finishedRivalArchetypes;
beforeEach(async () => {
  vi.resetModules();
  http.fetchWithAuth.mockReset();
  ({ finishedRivalArchetypes } = await import('./finishedRivalRead'));
});

const ok = (battles) => ({ ok: true, json: async () => ({ battles }) });

// The group's seat order (the group document's `players`): the endpoint keys battles by seat (founder ruling R-F).
const PLAYERS = [{ odUserId: 'rae' }, { odUserId: 'sam' }, { odUserId: 'cpu-3', isCpu: true }];

describe('the after-bell read', () => {
  it('asks the spectator endpoint once for the group, and maps each seat back to its player and its archetype', async () => {
    http.fetchWithAuth.mockResolvedValue(ok({ 0: { agentContext: { archetype: 'guardian' } }, 1: { agentContext: {} } }));
    await expect(finishedRivalArchetypes('g/1', PLAYERS)).resolves.toEqual({ rae: 'guardian', sam: null });
    expect(http.fetchWithAuth.mock.calls).toEqual([['/api/tournament/battle-view?groupId=g%2F1']]);
  });

  it('R-F: the reply is seat-keyed — an owner-keyed reply (the old shape) places no armor, and with no players nothing is placed', async () => {
    http.fetchWithAuth.mockResolvedValue(ok({ rae: { agentContext: { archetype: 'guardian' } } }));
    await expect(finishedRivalArchetypes('g1', PLAYERS)).resolves.toEqual({});
    http.fetchWithAuth.mockResolvedValue(ok({ 0: { agentContext: { archetype: 'guardian' } } }));
    await expect(finishedRivalArchetypes('g2')).resolves.toEqual({});
  });

  it('every form that asks shares the one read and the one promise', async () => {
    http.fetchWithAuth.mockResolvedValue(ok({}));
    const first = finishedRivalArchetypes('g1');
    expect(finishedRivalArchetypes('g1')).toBe(first);
    expect(finishedRivalArchetypes('g1')).toBe(first);
    await first;
    expect(finishedRivalArchetypes('g1')).toBe(first);
    expect(http.fetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it('another group is another read', async () => {
    http.fetchWithAuth.mockResolvedValue(ok({}));
    await finishedRivalArchetypes('g1');
    await finishedRivalArchetypes('g2');
    expect(http.fetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it('a failed read answers no armor and stays answered: a form rendering from it can never loop', async () => {
    http.fetchWithAuth.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'server_error' }) });
    await expect(finishedRivalArchetypes('g1')).resolves.toEqual({});
    http.fetchWithAuth.mockRejectedValue(new Error('offline'));
    await expect(finishedRivalArchetypes('g2')).resolves.toEqual({});
    await finishedRivalArchetypes('g1');
    await finishedRivalArchetypes('g2');
    expect(http.fetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it('no timer of any kind: this is a read, not a poll', () => {
    const src = readFileSync(new URL('./finishedRivalRead.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
  });
});
