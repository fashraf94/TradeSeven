// src/components/Agent/AgentChat.receipts.render.test.jsx
//
// Phase A (A3, D-60) — under the controller flag the directive card carries a
// RECEIPT (`Filed {t}` / `Replaced {t}` / `Expired`) and nothing that pulses or
// promises; flag-off (no receipts map) the card is the shipped one, byte for
// byte — `Executing on next evaluation window` and the pulse stay until their
// own PR after Phase A (bug 2).
//
// renderToString (effects do not run): the card's markup is the whole claim.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { deriveReceipts } from '../../screens/battleView/deriveReceipts';

const T1 = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET
const T2 = '2026-09-01T16:58:00.000Z'; // 12:58 PM ET
const EXCHANGES = [
  {
    userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
    directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
    directiveThreadId: 't-1', timestamp: T1,
  },
  {
    userMessage: 'actually lean into tech', agentResponse: 'Understood.', hasDirective: true,
    directive: { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2' },
    directiveThreadId: 't-2', timestamp: T2,
  },
];
const DIRECTIVE = { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2', createdAt: T2 };

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Aurora',
  chatExchanges: EXCHANGES, battleStatus: 'active', statusFeed: [], trades: [], knownTickers: new Set(),
};
const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (props) => strip(renderToString(<AgentChat {...BASE} {...props} />));

describe('under the flag — receipts on the directive cards', () => {
  it('the first card reads `Replaced 12:58 PM`, the second `Filed 12:58 PM`; the promise and the pulse are gone', () => {
    const html = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active') });
    expect(html).toContain('Replaced 12:58 PM');
    expect(html).toContain('Filed 12:58 PM');
    expect(html).toContain('data-receipt="replaced"');
    expect(html).toContain('data-receipt="filed"');
    expect(html).not.toContain('Executing on next evaluation window');
    // The shipped pulse is three 4px dots; none render under the flag.
    expect(html).not.toContain('width:4px;height:4px');
    // The eyebrow names the thing, not a state (D-68): `Directive` above the
    // receipt line; the shipped `DIRECTIVE LOCKED IN` is flag-off only.
    expect(html).not.toContain('DIRECTIVE LOCKED IN');
    expect((html.match(/>Directive</g) || []).length).toBe(2);
    expect(html).toContain('Protect the lead into the close');
  });

  it('battle complete → the current card reads `Expired`; the replaced one keeps `Replaced {t}` (F11)', () => {
    const html = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'completed'), battleStatus: 'completed' });
    expect((html.match(/data-receipt="expired"/g) || []).length).toBe(1);
    expect(html).toContain('>Expired<');
    expect(html).toContain('Replaced 12:58 PM');
    expect(html).not.toContain('Filed');
  });

  it('a directive card whose exchange carries no thread id gets no line at all — never the promise', () => {
    const legacy = [{ userMessage: 'x', agentResponse: 'y', hasDirective: true, directive: { text: 'Old-style directive', expiry: 'end_of_battle' }, timestamp: T1 }];
    const html = render({ chatExchanges: legacy, receipts: deriveReceipts(legacy, null, 'active') });
    expect(html).toContain('Old-style directive');
    expect(html).not.toContain('data-receipt');
    expect(html).not.toContain('Executing on next evaluation window');
    // The eyebrow is keyed on the FLAG path, not on the receipt object: a
    // flag-on card with no receipt still reads `Directive` (review L1-F7).
    expect(html).toContain('>Directive<');
    expect(html).not.toContain('DIRECTIVE LOCKED IN');
  });

  // AMENDED IN PHASE B (B1 client half, seed §1). `Heard` left this list
  // because the record now PROVES it: the cron stamps the entry with the
  // thread that was in the decider's prompt at that check (D-110), from its
  // own resolveControls call. The other four are still unproven and still out.
  //
  // The amendment is narrow on purpose. Heard renders ONLY from a stamp, so a
  // receipt with no stamp — every battle before the flag flips, and every
  // mid-tick filing — still shows no Heard line at all, which is what this row
  // now pins: the vocabulary did not open, it gained one proven word whose
  // absence is still the default.
  it('the vocabulary is D-51 + Phase B — the four unproven words stay out, and Heard needs a stamp', () => {
    const html = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active') });
    for (const word of ['Holding', 'Declined', 'Honored', 'Superseded']) {
      expect(html).not.toContain(word);
    }
    // No `heard` key on these receipts (deriveReceipts alone, no stamped
    // entries) → no Heard line and no negative line either.
    expect(html).not.toContain('Heard');
    expect(html).not.toContain('Not heard');
    expect(html).not.toContain('data-heard');
  });
});

// ── Phase B (B1 client half, seed §1): the Heard line ───────────────────────
// The receipt's SECOND line. Presence-gated: the stamp comes from the record,
// so a receipt without one renders nothing — which is also the mid-tick case.
describe('Phase B — the Heard line beneath Filed', () => {
  const withHeard = (stamp, threadId = 't-2') => {
    const receipts = deriveReceipts(EXCHANGES, DIRECTIVE, 'active');
    for (const id of Object.keys(receipts)) {
      receipts[id] = { ...receipts[id], heard: id === threadId ? stamp : null };
    }
    return receipts;
  };

  it('a heard thread reads `Heard at the {slot} check` — the SLOT, never the exact minute', () => {
    // T1 is 11:31 AM ET; the slot floor makes the check 11:30 AM (D-83).
    const html = render({ receipts: withHeard({ at: T1, heard: true }) });
    expect(html).toContain('Heard at the 11:30 AM check');
    expect(html).toContain('data-heard="heard"');
    // The filing keeps its own exact minute — Filed names an exchange.
    expect(html).toContain('Filed 12:58 PM');
    expect(html).not.toContain('Heard at the 11:31 AM check');
  });

  it('a withheld directive reads the flat system line, with NO reason word (Sol M-1)', () => {
    for (const reason of ['malformed', 'mode_not_enforce', 'epoch_killed', 'unknown']) {
      const html = render({ receipts: withHeard({ at: T1, heard: false, reason }) });
      expect(html).toContain('Not heard at this check');
      expect(html).toContain('data-heard="not-heard"');
      expect(html).not.toContain(reason);
      // And never the positive claim on a withheld directive.
      expect(html).not.toContain('Heard at the');
    }
  });

  it('NO STAMP, NO LINE — the mid-tick filing and every pre-flip battle', () => {
    const html = render({ receipts: withHeard(null, 'none') });
    expect(html).not.toContain('data-heard');
    expect(html).not.toContain('Heard at the');
    expect(html).not.toContain('Not heard');
    // The Phase A receipt is untouched by the absence.
    expect(html).toContain('Filed 12:58 PM');
    expect(html).toContain('Replaced 12:58 PM');
  });

  it('AND NO WRAPPER EITHER — an unstamped card is BYTE-IDENTICAL to Phase A (D-113)', () => {
    // The first build stacked the two rows in a column wrapper that rendered
    // unconditionally, so a pre-flip battle got a div it never had. The A2
    // first-paint golden caught it; this row is the local guard, so the next
    // person sees the failure here rather than in a screen-level photograph.
    const phaseA = render({ receipts: deriveReceipts(EXCHANGES, DIRECTIVE, 'active') });
    expect(render({ receipts: withHeard(null, 'none') })).toBe(phaseA);
  });

  it('the verb is never upgraded — no considered, used, noticed, understood, because', () => {
    // Scoped to the RENDERED HEARD LINE, not the whole chat: the fixture's own
    // agent reply is "Understood." and that is dialogue, not copy. The
    // source-level ban across every copy module is §5's guard
    // (deskHonesty.test.js); this row pins what this line itself says.
    const html = render({ receipts: withHeard({ at: T1, heard: true }) });
    const line = (html.match(/data-heard="[^"]*"[^>]*>([^<]*)</) || [])[1];
    expect(line).toBe('Heard at the 11:30 AM check');
    for (const phrase of ['considered', 'used your directive', 'noticed', 'understood', 'decided because', 'caused']) {
      expect(line.toLowerCase()).not.toContain(phrase);
    }
  });
});

describe('flag-off — the shipped card, unchanged', () => {
  it('with no receipts map the promise and the pulse render exactly as shipped', () => {
    const html = render({});
    expect((html.match(/Executing on next evaluation window/g) || []).length).toBe(2);
    expect(html).not.toContain('data-receipt');
    expect(html).not.toContain('Replaced');
    expect(html).not.toContain('Filed');
    // The shipped eyebrow, byte for byte (D-68 is flag-only; bug 2's PR later).
    expect((html.match(/<span>DIRECTIVE LOCKED IN<\/span>/g) || []).length).toBe(2);
    expect(html).not.toContain('>Directive<');
  });
});
