// src/components/Dashboard/MobilePresenceIdentity.smoke.test.jsx
//
// Branch A — mobile presence mount fix. Verifies the presence HEAD lands on the IDENTITY
// cards on BOTH platforms — desktop `IdentityPanel` (already correct) and the mobile
// `EquipStation` identity panel (the fix) — and that flag-off both render the orb
// byte-identically (no head). renderToString per the repo convention (no DOM/effects).
//
// The head is detected by the presence face-SVG's unique viewBox "30 6 140 156"
// (faceEngine.jsx); AgentOrb never renders that, so its presence/absence == head/orb.
// (The READ-brief head removal is verified structurally — CommandDashboard no longer imports
// or mounts AgentPresence at all — plus lint; the identity placement is what's asserted here.)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Keep all real flags; stub only the gate so we can toggle it per test.
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: vi.fn(),
}));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
// EquipStation collaborators — stub so the identity panel renders in isolation (the sheets
// are closed under renderToString anyway; stubbing avoids their transitive Firestore graph).
vi.mock('../../hooks/useForge', () => ({
  useForge: () => ({ forgedBundles: [], equippedBundles: [], equipBundleFn: vi.fn(), unequipBundleFn: vi.fn(), equippingBundleId: null, loading: false }),
}));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: () => Promise.resolve([]) }));
vi.mock('../../services/agentService', () => ({ equipWatchlist: vi.fn(), unequipWatchlist: vi.fn(), changeArchetype: vi.fn() }));
vi.mock('./EquipSheet', () => ({ default: () => null }));
vi.mock('./RuleBundlePicker', () => ({ default: () => null }));
vi.mock('./TraitsSheet', () => ({ default: () => null }));
vi.mock('./ArchetypePicker', () => ({ default: () => null }));
// IdentityPanel collaborator.
vi.mock('./EvolutionPreviewCard', () => ({ default: () => null }));

import { isAgentPresenceOn } from '../../config/featureFlags';
import EquipStation from './EquipStation';
import IdentityPanel from './desktop/IdentityPanel';

const HEAD = 'viewBox="30 6 140 156"'; // unique to the presence face SVG; the orb never has it
const agent = { id: 'a1', name: 'Nova', archetype: 'degen', primaryColor: '#5EEAD4', stats: { wins: 2, losses: 1, gamesPlayed: 5 } };

beforeEach(() => { vi.clearAllMocks(); });

describe('Branch A — presence head on the identity cards, both platforms', () => {
  it('desktop IdentityPanel: head when flag on, orb (no head) when flag off', () => {
    isAgentPresenceOn.mockReturnValue(true);
    expect(renderToString(<IdentityPanel agent={agent} accent="#5EEAD4" />)).toContain(HEAD);
    isAgentPresenceOn.mockReturnValue(false);
    expect(renderToString(<IdentityPanel agent={agent} accent="#5EEAD4" />)).not.toContain(HEAD);
  });

  it('mobile EquipStation identity: head when flag on, orb (no head) when flag off — the fix', () => {
    const props = { agent, accent: '#5EEAD4', onOpenAgentRecord: () => {}, setShowForge: () => {} };
    isAgentPresenceOn.mockReturnValue(true);
    expect(renderToString(<EquipStation {...props} />)).toContain(HEAD);
    isAgentPresenceOn.mockReturnValue(false);
    expect(renderToString(<EquipStation {...props} />)).not.toContain(HEAD);
  });
});
