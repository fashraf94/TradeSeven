// api/_utils/evidence/fantasyTimesStories.js
//
// Huddle S1, evidence layer (c) — the app's own FantasyTimes stories as news items
// (Amendment C V1.2 §C1, sourceKind 'fantasytimes_story'): `newsId` is the
// `fantasyTimesStories` document id (the id `fantasyTimesWire/{etDate}.bySymbol` indexes
// and the agent's `seenStoryIds` holds); `publishedAt` is the story's own `publishedAt`
// (its write instant); `eventTime` is null; there is no url.
//
// THE READ. ONE single-field range per invocation — `publishedAt >= since`, newest first,
// at most STORY_SCAN_LIMIT documents — filtered by ticker in memory. It needs no composite
// index (huddle-s1-queries.md Q-E2). It does NOT copy fetchRecentNews's per-ticker
// `tickers array-contains` + `publishedAt` range (agentTriggerGate.js:235-240), which
// needs a composite the index manifest does not carry and whose error that function
// swallows (:256; build report RF-1). An error here is the source's `error` status,
// never "no stories". Vera deep dives are skipped, as fetchRecentNews skips them.

export const STORY_SCAN_LIMIT = 300;

const toIso = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return new Date(Date.parse(v)).toISOString();
  return null;
};

/**
 * The stories published since `since` (newest first). Never throws.
 * @returns {Promise<{ status: 'ok'|'error', stories: object[], truncated: boolean, reason?: string }>}
 */
export async function fetchStoriesSince(db, { since }) {
  try {
    const snap = await db.collection('fantasyTimesStories')
      .where('publishedAt', '>=', since)
      .orderBy('publishedAt', 'desc')
      .limit(STORY_SCAN_LIMIT)
      .get();
    const stories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { status: 'ok', stories, truncated: stories.length >= STORY_SCAN_LIMIT };
  } catch (err) {
    return { status: 'error', stories: [], truncated: false, reason: 'query_failed' };
  }
}

/** One symbol's stories as C1 news items, newest first. */
export function storiesForSymbol(stories, symbol, { limit = 5 } = {}) {
  const out = [];
  for (const s of Array.isArray(stories) ? stories : []) {
    if (!s || s.type === 'deepdive') continue;
    if (!Array.isArray(s.tickers) || !s.tickers.includes(symbol)) continue;
    const publishedAt = toIso(s.publishedAt);
    const title = typeof s.headline === 'string' && s.headline.trim() ? s.headline.trim() : null;
    if (!publishedAt || !title) continue;
    out.push({
      newsId: s.id,
      eventId: null,
      publishedAt,
      eventTime: null,
      sourceKind: 'fantasytimes_story',
      source: 'FantasyTimes',
      title,
      url: null,
      primaryReleaseUrl: null,
    });
    if (out.length >= limit) break;
  }
  return out;
}
