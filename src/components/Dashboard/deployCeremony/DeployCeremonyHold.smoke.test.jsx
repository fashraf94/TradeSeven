// src/components/Dashboard/deployCeremony/DeployCeremonyHold.smoke.test.jsx
//
// Deploy Ceremony · Act 1 render smoke (spec §11). Verifies the flag gate at the
// button sites: flag-OFF renders the existing tap CTA (byte-identical path — no
// hold affordance), flag-ON renders the hold-to-arm button. renderToString per
// the repo convention. The maturity-derived deployText is preserved either way
// (the hold never replaces the copy — spec §4).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeployCeremonyOn: vi.fn(),
}));

import { isDeployCeremonyOn } from '../../../config/featureFlags';
import DeployStation from '../DeployStation';
import DeployCard from '../desktop/DeployCard';

const HOLD_MARKER = 'Hold to deploy'; // present only in the hold button's aria-label
const agent = { id: 'a1', name: 'Nova', archetype: 'contrarian', primaryColor: '#5EEAD4', equippedWatchlistName: 'Grid' };
const deployText = 'Deploy to BaggerBomb';
const baseProps = { agent, accent: '#5EEAD4', deploying: false, onDeploy: () => {}, deployText, agentName: 'Nova' };

beforeEach(() => { isDeployCeremonyOn.mockReset(); });

describe('DeployStation — Act 1 flag gate', () => {
  it('flag OFF: renders the tap CTA with deployText and NO hold affordance', () => {
    isDeployCeremonyOn.mockReturnValue(false);
    const html = renderToString(<DeployStation {...baseProps} />);
    expect(html).toContain(deployText);
    expect(html).not.toContain(HOLD_MARKER);
    expect(html).toContain('Binds'); // the binding line is unchanged
  });

  it('flag ON: renders the hold-to-arm button, deployText still preserved', () => {
    isDeployCeremonyOn.mockReturnValue(true);
    const html = renderToString(<DeployStation {...baseProps} />);
    expect(html).toContain(HOLD_MARKER);
    expect(html).toContain(deployText); // copy preserved (spec §4)
    expect(html).toContain('touch-action:none'); // hold never scrolls on mobile
  });
});

describe('DeployCard (desktop) — Act 1 flag gate', () => {
  it('flag OFF: tap CTA, no hold affordance', () => {
    isDeployCeremonyOn.mockReturnValue(false);
    const html = renderToString(<DeployCard {...baseProps} />);
    expect(html).toContain(deployText);
    expect(html).not.toContain(HOLD_MARKER);
  });

  it('flag ON: hold-to-arm button', () => {
    isDeployCeremonyOn.mockReturnValue(true);
    const html = renderToString(<DeployCard {...baseProps} />);
    expect(html).toContain(HOLD_MARKER);
    expect(html).toContain(deployText);
  });
});
