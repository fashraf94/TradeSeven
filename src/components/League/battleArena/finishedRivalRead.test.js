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

describe('the after-bell read', () => {
  it('asks the spectator endpoint once for the group, and maps each seat to its archetype', async () => {
    http.fetchWithAuth.mockResolvedValue(ok({ rae: { agentContext: { archetype: 'guardian' } }, sam: { agentContext: {} } }));
    await expect(finishedRivalArchetypes('g/1')).resolves.toEqual({ rae: 'guardian', sam: null });
    expect(http.fetchWithAuth.mock.calls).toEqual([['/api/tournament/battle-view?groupId=g%2F1']]);
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
    http.fetchWithAuth.mockResolvedValue({ ok: false, status: 500 });
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
