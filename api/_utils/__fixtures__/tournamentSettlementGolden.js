// Test-only comparison for the owner-approved settlement guard. The immutable
// legacy golden stays unchanged. Remove only the explicitly asserted bounded
// active-battle query events: the settlement snapshot before deferred
// projection, plus the legacy re-read at the original position (review K2-4),
// both of the one exact shape below. Keep EVERY
// document read, write, response, model
// request, timestamp, prescription, transaction and final document byte-exact.
export function tournamentSettlementGoldenPair(actual, baseline) {
  const strip = (capture, count) => {
    const queries = capture.store.queries.filter(q => q.collectionPath === 'agentBattles');
    if (queries.length !== count) throw Error('Unexpected tournament active-battle query count');
    for (const q of queries) {
      if (q.limit !== 1 || q.orders.length || q.startAfter !== null || q.endAt !== null ||
          q.filters.length !== 2 || q.filters[0].field !== 'agentId' || q.filters[0].op !== '==' ||
          q.filters[0].value !== 'agent-p1b-1' || q.filters[1].field !== 'status' || q.filters[1].op !== '==' || q.filters[1].value !== 'active') {
        throw Error('Unexpected tournament active-battle query shape');
      }
    }
    if (capture.store.sequence.filter(e => e.query === 'agentBattles').length !== count) throw Error('Unexpected tournament query sequence count');
    if (capture.store.reads.filter(p => p === 'indexIntelligence/stockRankings').length !== 1 ||
        capture.store.sequence.filter(e => e.read === 'indexIntelligence/stockRankings').length !== 1) throw Error('Unexpected tournament rankings read count');
    return { ...capture, store: { ...capture.store,
      queries: capture.store.queries.filter(q => q.collectionPath !== 'agentBattles'),
      sequence: capture.store.sequence.filter(e => e.query !== 'agentBattles'),
    } };
  };
  return [strip(actual, 2), strip(baseline, 1)];
}
