// src/components/League/battleArena/DockClaimLabel.smoke.test.jsx
//
// /code-review reconciliation — the close-only claim label must be gated on the
// round being live (review #6), and the pending-marker header must nest validly
// (review #7: the wrapper is a <div>, since Eyebrow renders a block <div>). No
// jsdom: react-dom/server renders DockYourThree without a DOM.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DockYourThree } from './CommandDock';

const star = (over) => ({ tk: 'GE', tier: 'support', dir: 'long', mult: 0, banked: 0, points: 0, badge: null, state: 'quiet', settleState: null, justIn: false, ...over });
const wireMktHours = { canonical: true, reason: 'market_hours', open: false, claimsUsed: 0, claimsTotal: 3, closes: null };

describe('DockYourThree — close-only claim label gated on live (review #6)', () => {
  it('a LIVE canonical round in market hours reads "CLAIMS OPEN AFTER CLOSE"', () => {
    const html = renderToString(<DockYourThree stars={[]} state="live" wire={wireMktHours} onClaim={() => {}} />);
    expect(html).toContain('CLAIMS OPEN AFTER CLOSE');
    expect(html).not.toContain('WIRE CLOSED');
  });

  it('a COMPLETED round reads the neutral "WIRE CLOSED" (no false reopen promise)', () => {
    const html = renderToString(<DockYourThree stars={[]} state="complete" wire={wireMktHours} onClaim={() => {}} />);
    expect(html).toContain('WIRE CLOSED');
    expect(html).not.toContain('CLAIMS OPEN AFTER CLOSE');
  });

  it('renders the "N pick(s) pending" marker (div wrapper — review #7) without throwing', () => {
    // Strip react-dom/server's inter-text-node <!-- --> markers so the phrase matches.
    const html = renderToString(<DockYourThree stars={[star({ settleState: 'pending' })]} state="live" wire={wireMktHours} onClaim={() => {}} />).replace(/<!-- -->/g, '');
    expect(html).toContain('1 pick pending');
  });
});
