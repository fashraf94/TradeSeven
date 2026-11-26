// api/_utils/practiceField/__testsupport__/agentEndToEndRun.js
//
// Practice Field build B2's THIRTEEN-SESSION RUN of the founder's own book with the agent on, on the in-memory harness with a
// fake transport (agentEndToEnd.test.js — its rows and its pinned dump). Moved here UNCHANGED by build B4 (only exported,
// the agent switches' restore handed back, its one expect a throw, and its saved-thesis fixture in
// ../__fixtures__/savedThesis.js), so the founder's-live-book proof
// (foundersLiveBook.test.js, rule 5) runs exactly the run that agentEndToEnd.test.js pins. Test support only: never imported
// by a production path.

import { setPracticeFieldAgentForTests } from '../mode.js';
import { admitIdea } from '../admission.js';
import { assertReconciled } from '../reconcile.js';
import { nextSessionDate } from '../windows.js';
import { seedBook, getBook, getIdea, etIso, DAYS } from './fixtures.js';
// The saved-thesis fixture (it spells the Shared Research card's field, so it lives under __fixtures__).
import { seedSavedThesis } from '../__fixtures__/savedThesis.js';
import {
  quotesOn, foundersMediumIdea, fakeTransport, toolResponse, transportError, holdAll, draft, runSession,
} from './agentFixtures.js';

/** Thirteen sessions from Monday 16 Nov 2026; Thanksgiving is closed and 27 Nov closes early. */
export function sessions(n = 13) {
  const out = [DAYS.d1];
  while (out.length < n) out.push(nextSessionDate(out[out.length - 1]));
  return out;
}
export const EARLY_CLOSE = '2026-11-27';
export const EXIT_SESSION = '2026-11-20';
export const FAIL_SESSION = '2026-11-24';

/** The scripted desks: hold every idea; draft each empty slot; the archetype desk exits its short idea on EXIT_SESSION. */
export function scriptedDesks(date) {
  const shortNames = [['XOM'], ['CVX'], ['KO']];
  let shortDrafts = 0;
  return ({ desk, request, emptySlots, openIdeaIds }) => {
    const d = date();
    if (desk === 'shadow') {
      if (d === FAIL_SESSION) return transportError(); // both attempts time out: the code fallback
      const theses = /<saved_thesis label="T1"/.test(request.content.messages[0].content);
      const drafts = emptySlots.includes('long')
        ? [theses ? draft({ slot: 'long', names: ['AAPL', 'MSFT'], source: { kind: 'saved_thesis', thesisRef: 'T1' }, thesis: 'The saved thesis: Apple and Microsoft keep compounding.' }) : draft({ slot: 'long', names: ['MSFT', 'NVDA'] })]
        : [];
      return toolResponse(holdAll(request, { note: `Shadow desk, ${d}: the banks hold their line against XLF.`, drafts }), { inputTokens: 6200, outputTokens: 1900 });
    }
    const actions = openIdeaIds.map((ideaId) => (d === EXIT_SESSION
      ? { ideaId, action: 'exit', reason: 'The breakout failed; the setup no longer holds.' }
      : { ideaId, action: 'hold', reason: 'Still inside its ten-session window.' }));
    // Day 1: a first draft outside the rails (a 20% short line; B5 allows 3%–8%), then one inside them.
    const outside = d === DAYS.d1 ? [draft({ slot: 'short', names: ['XOM'], distance: 0.2 })] : [];
    const drafts = emptySlots.includes('short') ? [...outside, draft({ slot: 'short', names: shortNames[shortDrafts++ % 3] })] : [];
    return toolResponse({ bookNote: `Archetype desk, ${d}: short-term only.`, actions, drafts }, { inputTokens: 4800, outputTokens: 1500 });
  };
}

/**
 * The whole run: the founder's book through thirteen sessions with the agent on. `onRestore` is handed the agent switches' restore
 * BEFORE anything runs (the caller's afterEach restores them even when the run throws).
 */
export async function runFoundersBook({ theses, onRestore = () => {} } = {}) {
  onRestore(setPracticeFieldAgentForTests({ agent: true, theses }));
  const ctx = await seedBook({ nowIso: etIso(DAYS.admit, 9, 0) });
  const listId = seedSavedThesis(ctx.db, ctx.uid);
  const admitted = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: foundersMediumIdea(), opId: 'founder-medium', nowIso: etIso(DAYS.admit, 11, 0) });
  if (!admitted.ok) throw new Error(`runFoundersBook: the founder's medium idea was refused: ${JSON.stringify(admitted.refusals)}`);
  let current = null;
  const fake = fakeTransport(scriptedDesks(() => current));
  const days = sessions();
  const results = [];
  for (const [i, date] of days.entries()) {
    current = date;
    const quotes = quotesOn({ drift: i * 0.002, moves: date >= '2026-11-19' && date <= EXIT_SESSION ? { XOM: -0.02 } : {} });
    const out = await runSession(ctx.db, ctx.bookId, date, { quotes, transport: fake.transport });
    results.push({ date, ...out });
    const book = getBook(ctx.db, ctx.bookId);
    assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id)));
  }
  return { ctx, fake, days, results, listId, mediumId: admitted.ideaId };
}
