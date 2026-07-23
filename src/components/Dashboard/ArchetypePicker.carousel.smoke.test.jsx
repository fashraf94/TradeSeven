// src/components/Dashboard/ArchetypePicker.carousel.smoke.test.jsx
//
// Branch B — mobile archetype carousel. Verifies the CONTAINER gating (same card, different
// container): mobile + flag-on → horizontal scroll-snap carousel with a dot indicator; desktop
// keeps the vertical list; flag-off is the byte-identical plain list. renderToString per the
// repo convention (EquipSheet is stubbed inline so its portal children land in the string).
//
// Markers: the carousel track carries `scroll-snap-type` (never present in the vertical list);
// a hero head is the face-SVG viewBox "30 6 140 156" (the orb/plain card never has it).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: vi.fn(),
}));
vi.mock('../../services/agentService', () => ({ changeArchetype: vi.fn() }));
vi.mock('../../../api/_utils/masteryConfig.js', () => ({ MASTERY_SURFACE_ENABLED: false }));
// Render the sheet's children inline (renderToString drops real portals).
vi.mock('./EquipSheet', () => ({ default: ({ children }) => React.createElement('div', null, children) }));

import { isAgentPresenceOn } from '../../config/featureFlags';
import ArchetypePicker from './ArchetypePicker';

const SNAP = 'scroll-snap-type'; // present only in the carousel track
const HEAD = 'viewBox="30 6 140 156"'; // present only for a hero head
const countHeads = (html) => html.split(HEAD).length - 1;
const agent = { id: 'a1', name: 'Nova', archetype: 'diversifier', primaryColor: '#5EEAD4' };
const render = (props) => renderToString(<ArchetypePicker open onClose={() => {}} agent={agent} accent="#5EEAD4" {...props} />);

beforeEach(() => { vi.clearAllMocks(); });

describe('Branch B — mobile archetype carousel gating', () => {
  it('mobile + flag on → scroll-snap carousel with six hero heads', () => {
    isAgentPresenceOn.mockReturnValue(true);
    const html = render({ dock: 'bottom' });
    expect(html).toContain(SNAP);
    expect(countHeads(html)).toBe(6);
  });

  it('desktop + flag on → vertical list (NO carousel), still six hero heads', () => {
    isAgentPresenceOn.mockReturnValue(true);
    const html = render({ dock: 'center' });
    expect(html).not.toContain(SNAP);
    expect(countHeads(html)).toBe(6);
  });

  it('flag off (mobile) → plain vertical list: no carousel, no heads (byte-identical path)', () => {
    isAgentPresenceOn.mockReturnValue(false);
    const html = render({ dock: 'bottom' });
    expect(html).not.toContain(SNAP);
    expect(countHeads(html)).toBe(0);
  });
});
