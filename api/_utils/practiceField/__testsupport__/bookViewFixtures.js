// api/_utils/practiceField/__testsupport__/bookViewFixtures.js
//
// Practice Field build B3 — TEST SUPPORT for the idea book screen's view (never imported by a production path). The B2
// end-to-end history (agentEndToEnd.test.js), COPIED rather than shared so that file's pinned dump never moves: the
// founder's book, his medium idea (JPM, BAC, GS against XLF), both desks checking at every close on a fake transport,
// the archetype desk drafting the short slot and exiting it on 20 Nov, the Shadow desk drafting the long slot, its call
// failing on 24 Nov, and the 27 Nov early close. `runBookHistory` runs it through any number of sessions and returns the
// store, so a view test can read the view at any close.

import { setPracticeFieldAgentForTests } from '../mode.js';
import { admitIdea } from '../admission.js';
import { nextSessionDate } from '../windows.js';
import { seedBook, etIso, DAYS } from './fixtures.js';
import { quotesOn, foundersMediumIdea, fakeTransport, toolResponse, transportError, holdAll, draft, runSession } from './agentFixtures.js';

export const EARLY_CLOSE = '2026-11-27';
export const EXIT_SESSION = '2026-11-20';
export const FAIL_SESSION = '2026-11-24';

/** The first `n` sessions from Monday 16 Nov 2026. */
export function historySessions(n = 13) {
  const out = [DAYS.d1];
  while (out.length < n) out.push(nextSessionDate(out[out.length - 1]));
  return out;
}

/**
 * The scripted desks of the B2 run (agentEndToEnd.test.js scriptedDesks), the same calls and actions — and, since build B6,
 * the words a desk could have written before B6 (its prompt named the desks and gave it its ideas' ids): the notes name
 * the old desks, the archetype desk's reasons quote its idea's own id, and the shadow desk's note the ids it holds. The view
 * shows none of it (ruling B6-3: bookView.e2e.test.js scans every close). Nothing here is pinned as a dump.
 */
export function scriptedDesks(date) {
  const shortNames = [['XOM'], ['CVX'], ['KO']];
  let shortDrafts = 0;
  return ({ desk, request, emptySlots, openIdeaIds }) => {
    const d = date();
    if (desk === 'shadow') {
      if (d === FAIL_SESSION) return transportError();
      const drafts = emptySlots.includes('long') ? [draft({ slot: 'long', names: ['MSFT', 'NVDA'] })] : [];
      const holding = openIdeaIds.length > 0 ? ` I hold ${openIdeaIds.join(' and ')}.` : '';
      return toolResponse(holdAll(request, { note: `Shadow desk, ${d}: the banks hold their line against XLF.${holding}`, drafts }), { inputTokens: 6200, outputTokens: 1900 });
    }
    const actions = openIdeaIds.map((ideaId) => (d === EXIT_SESSION
      ? { ideaId, action: 'exit', reason: `The breakout failed on ${ideaId}; the setup no longer holds.` }
      : { ideaId, action: 'hold', reason: `${ideaId} is still inside its ten-session window.` }));
    const outside = d === DAYS.d1 ? [draft({ slot: 'short', names: ['XOM'], distance: 0.2 })] : [];
    const drafts = emptySlots.includes('short') ? [...outside, draft({ slot: 'short', names: shortNames[shortDrafts++ % 3] })] : [];
    return toolResponse({ bookNote: `Archetype desk, ${d}: short-term only; the Shadow desk keeps the banks.`, actions, drafts }, { inputTokens: 4800, outputTokens: 1500 });
  };
}

/**
 * Run the founder's book through `n` sessions with the agent on (the caller restores the mode). Returns the store and
 * what each session did. `onSession(date, i, ctx)` runs after each close.
 */
export async function runBookHistory({ n = 13, onSession = null } = {}) {
  const restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
  try {
    const ctx = await seedBook({ nowIso: etIso(DAYS.admit, 9, 0) });
    const admitted = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: foundersMediumIdea(), opId: 'founder-medium', nowIso: etIso(DAYS.admit, 11, 0) });
    if (!admitted.ok) throw new Error(`the founder's medium idea was not admitted: ${JSON.stringify(admitted)}`);
    let current = null;
    const fake = fakeTransport(scriptedDesks(() => current));
    const days = historySessions(n);
    for (const [i, date] of days.entries()) {
      current = date;
      const quotes = quotesOn({ drift: i * 0.002, moves: date >= '2026-11-19' && date <= EXIT_SESSION ? { XOM: -0.02 } : {} });
      await runSession(ctx.db, ctx.bookId, date, { quotes, transport: fake.transport });
      if (onSession) await onSession(date, i, ctx);
    }
    return { ctx, days, mediumId: admitted.ideaId };
  } finally {
    restoreAgent();
  }
}
