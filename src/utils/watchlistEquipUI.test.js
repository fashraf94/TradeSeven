// src/utils/watchlistEquipUI.test.js
//
// Phase 5B2 — unit tests for the pure equip-UI helpers. Plain vitest, no
// rendering — matches the pure-function unit-test convention used across the repo.

import { describe, it, expect } from 'vitest';
import {
  isWatchlistEquipped,
  getCardEquipState,
  resolveEquippedName,
  getEquippedWatchlistLabel,
  getEquipErrorMessage,
} from './watchlistEquipUI.js';

describe('isWatchlistEquipped', () => {
  it('true when the agent equippedWatchlistId matches', () => {
    expect(isWatchlistEquipped({ equippedWatchlistId: 'wl1' }, 'wl1')).toBe(true);
  });
  it('false when the ids differ', () => {
    expect(isWatchlistEquipped({ equippedWatchlistId: 'wl1' }, 'wl2')).toBe(false);
  });
  it('false when the agent is null', () => {
    expect(isWatchlistEquipped(null, 'wl1')).toBe(false);
  });
  it('false when the agent has no equipped watchlist', () => {
    expect(isWatchlistEquipped({ equippedWatchlistId: null }, 'wl1')).toBe(false);
  });
  it('false when watchlistId is missing', () => {
    expect(isWatchlistEquipped({ equippedWatchlistId: 'wl1' }, undefined)).toBe(false);
  });
});

describe('getCardEquipState', () => {
  const committed = { watchlistId: 'wl1', status: 'committed' };
  const draft = { watchlistId: 'wl2', status: 'draft' };
  const agentReady = { id: 'a1', name: 'Viper', equippedWatchlistId: null, activeBattleId: null };

  it('hides the footer for draft watchlists', () => {
    expect(getCardEquipState({ agent: agentReady, watchlist: draft, working: false }))
      .toEqual({ visible: false });
  });

  it('enabled "Equip to agent" when committed, not equipped, agent ready', () => {
    expect(getCardEquipState({ agent: agentReady, watchlist: committed, working: false }))
      .toMatchObject({ visible: true, isEquipped: false, mode: 'equip', disabled: false, label: 'Equip to agent' });
  });

  it('enabled "Unequip" when this watchlist is the equipped one', () => {
    const agent = { ...agentReady, equippedWatchlistId: 'wl1' };
    expect(getCardEquipState({ agent, watchlist: committed, working: false }))
      .toMatchObject({ visible: true, isEquipped: true, mode: 'unequip', disabled: false, label: 'Unequip' });
  });

  // --- disabled-reason copy paths ---

  it('disabled with "Create an agent to equip" when there is no agent', () => {
    const s = getCardEquipState({ agent: null, watchlist: committed, working: false });
    expect(s.disabled).toBe(true);
    expect(s.label).toBe('Create an agent to equip');
  });

  it('disabled with "Equip locked during battle" during an active battle (equip mode)', () => {
    const agent = { ...agentReady, activeBattleId: 'b1' };
    const s = getCardEquipState({ agent, watchlist: committed, working: false });
    expect(s.disabled).toBe(true);
    expect(s.label).toBe('Equip locked during battle');
  });

  it('disabled with "Unequip locked during battle" during an active battle (unequip mode)', () => {
    const agent = { ...agentReady, equippedWatchlistId: 'wl1', activeBattleId: 'b1' };
    const s = getCardEquipState({ agent, watchlist: committed, working: false });
    expect(s.disabled).toBe(true);
    expect(s.label).toBe('Unequip locked during battle');
  });

  it('disabled but keeps the normal label while a request is in flight', () => {
    const s = getCardEquipState({ agent: agentReady, watchlist: committed, working: true });
    expect(s.disabled).toBe(true);
    expect(s.label).toBe('Equip to agent');
  });
});

describe('resolveEquippedName', () => {
  it('returns a null name when nothing is equipped', () => {
    expect(resolveEquippedName({ equippedWatchlistId: null, cachedName: null, fetchStatus: 'pending' }))
      .toEqual({ name: null, unavailable: false });
  });
  it('uses the fresh name on a successful probe', () => {
    expect(resolveEquippedName({
      equippedWatchlistId: 'wl1', cachedName: 'Old Name',
      freshWatchlist: { name: 'Fresh Name' }, fetchStatus: 'ok',
    })).toEqual({ name: 'Fresh Name', unavailable: false });
  });
  it('marks unavailable on a 404 probe, keeping the cached name', () => {
    expect(resolveEquippedName({
      equippedWatchlistId: 'wl1', cachedName: 'Deleted List', fetchStatus: 'not_found',
    })).toEqual({ name: 'Deleted List', unavailable: true });
  });
  it('falls back to the cached name on a network error', () => {
    expect(resolveEquippedName({
      equippedWatchlistId: 'wl1', cachedName: 'Cached List', fetchStatus: 'error',
    })).toEqual({ name: 'Cached List', unavailable: false });
  });
  it('shows the cached name while the probe is pending', () => {
    expect(resolveEquippedName({
      equippedWatchlistId: 'wl1', cachedName: 'Cached List', fetchStatus: 'pending',
    })).toEqual({ name: 'Cached List', unavailable: false });
  });
  it('falls back to "Watchlist" when no cached name exists', () => {
    expect(resolveEquippedName({
      equippedWatchlistId: 'wl1', cachedName: null, fetchStatus: 'pending',
    })).toEqual({ name: 'Watchlist', unavailable: false });
  });
  it('falls back to "Untitled watchlist" when the fresh doc has no name', () => {
    expect(resolveEquippedName({
      equippedWatchlistId: 'wl1', cachedName: 'Old', freshWatchlist: { name: '' }, fetchStatus: 'ok',
    })).toEqual({ name: 'Untitled watchlist', unavailable: false });
  });
});

describe('getEquippedWatchlistLabel', () => {
  it('builds the label from a snapshot', () => {
    expect(getEquippedWatchlistLabel({ name: 'Momentum Picks' })).toBe('Watchlist: Momentum Picks');
  });
  it('returns null for a null snapshot', () => {
    expect(getEquippedWatchlistLabel(null)).toBeNull();
  });
  it('returns null for a snapshot with no name', () => {
    expect(getEquippedWatchlistLabel({ tickers: [] })).toBeNull();
  });
});

describe('getEquipErrorMessage', () => {
  it('409 maps to active-battle copy (equip)', () => {
    expect(getEquipErrorMessage({ status: 409 }, 'equip'))
      .toBe('Cannot equip — the agent is in an active battle.');
  });
  it('409 maps to active-battle copy (unequip)', () => {
    expect(getEquipErrorMessage({ status: 409 }, 'unequip'))
      .toBe('Cannot unequip — the agent is in an active battle.');
  });
  it('404 maps to the no-longer-available copy', () => {
    expect(getEquipErrorMessage({ status: 404 }, 'equip'))
      .toBe('That watchlist is no longer available. Refresh to see your current list.');
  });
  it('other errors map to generic copy', () => {
    expect(getEquipErrorMessage({ status: 500 }, 'equip'))
      .toBe('Could not equip the watchlist. Try again.');
    expect(getEquipErrorMessage(undefined, 'unequip'))
      .toBe('Could not unequip the watchlist. Try again.');
  });
});
