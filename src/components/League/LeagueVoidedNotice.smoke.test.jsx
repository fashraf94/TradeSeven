// src/components/League/LeagueVoidedNotice.smoke.test.jsx
//
// Render smoke for the member VOIDED-CARD (L-A follow-up B). Same react-dom/server
// pattern as the arena smokes (no jsdom/RTL; effects never run — the card has
// none). Asserts the card composes the muted VOIDED pill + the shared no-result
// headline + the one-line reason, that the reason is the §9 single-source
// projection of the group's voidedReason, and that a null group renders nothing.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LeagueVoidedNotice from './LeagueVoidedNotice';
import { VOIDED_NO_RESULT_COPY, voidReasonLabel } from '../../constants/leagueTournament';

describe('LeagueVoidedNotice render smoke', () => {
  it('renders the VOIDED pill + no-result headline + the mapped reason for a known code', () => {
    const group = { id: 'lds_wed-1900_2026-07-22', status: 'voided', voidedReason: 'poisoned_cohort_l_a' };
    const html = renderToString(<LeagueVoidedNotice group={group} />);
    expect(html).toContain('VOIDED');                 // the muted L-A pill
    expect(html).toContain(VOIDED_NO_RESULT_COPY);     // the shared headline (one source)
    expect(html).toContain('quarantined');             // the mapped one-line reason
    // §9: the reason shown IS the projection of the group's voidedReason datum
    expect(html).toContain(voidReasonLabel(group));
  });

  it('falls back to the generic reason when voidedReason is missing/unknown', () => {
    const html = renderToString(<LeagueVoidedNotice group={{ id: 'g', status: 'voided' }} />);
    expect(html).toContain(VOIDED_NO_RESULT_COPY);
    expect(html).toContain('voided by the League');    // the safe fallback line
    expect(html).not.toContain('quarantined');
  });

  it('renders nothing when there is no voided group (null-safe)', () => {
    expect(renderToString(<LeagueVoidedNotice group={null} />)).toBe('');
    expect(renderToString(<LeagueVoidedNotice />)).toBe('');
  });
});
