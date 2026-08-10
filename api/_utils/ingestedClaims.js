// api/_utils/ingestedClaims.js
// Manages the ingestedClaims Firestore collection — storing, querying,
// formatting, and cleaning up extracted knowledge claims for FantasyTimes reporters.

import { getFirebaseAdmin } from './firebaseAdmin.js';

const LOG_PREFIX = '[IngestedClaims]';
const COLLECTION = 'ingestedClaims';
const MAX_BATCH_SIZE = 500;

// Expiry durations by source type (in milliseconds)
const EXPIRY_MS = {
  earnings_call: 30 * 24 * 60 * 60 * 1000,
  fed_event: 14 * 24 * 60 * 60 * 1000,
  analyst_commentary: 7 * 24 * 60 * 60 * 1000,
};

// Max character length for formatted prompt output (~800 tokens)
const MAX_PROMPT_CHARS = 3200;

/**
 * Store an array of claim objects in Firestore.
 * Auto-generates claimId and timestamps if not provided.
 *
 * @param {Object[]} claims - Array of claim objects
 * @returns {{ stored: number, errors: string[] }}
 */
export async function storeClaims(claims) {
  try {
    if (!claims || claims.length === 0) {
      return { stored: 0, errors: [] };
    }

    const db = getFirebaseAdmin();
    const now = new Date();
    const errors = [];
    let stored = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      try {
        const ticker = claim.ticker || 'macro';
        const dateStr = (claim.sourceDate || now.toISOString().split('T')[0]).replace(/-/g, '');
        const claimId = claim.claimId || `${claim.source}_${ticker}_${dateStr}_${String(i).padStart(3, '0')}`;

        const expiryMs = EXPIRY_MS[claim.source] || EXPIRY_MS.analyst_commentary;
        const expiresAt = new Date(now.getTime() + expiryMs);

        const doc = {
          claimId,
          claim: claim.claim,
          source: claim.source,
          sourceEvent: claim.sourceEvent || '',
          sourceDate: claim.sourceDate || now.toISOString().split('T')[0],
          ticker: claim.ticker || null,
          linkedTickers: claim.linkedTickers || [],
          category: claim.category || 'sentiment',
          sentiment: claim.sentiment || 'neutral',
          confidence: claim.confidence || 'medium',
          relevantReporters: claim.relevantReporters || [],
          createdAt: now,
          expiresAt,
        };

        const ref = db.collection(COLLECTION).doc(claimId);
        batch.set(ref, doc);
        batchCount++;
        stored++;

        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } catch (err) {
        errors.push(`Claim ${i}: ${err.message}`);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`${LOG_PREFIX} Stored ${stored} claims (${errors.length} errors)`);
    return { stored, errors };
  } catch (err) {
    console.error(`${LOG_PREFIX} storeClaims failed:`, err.message);
    return { stored: 0, errors: [err.message] };
  }
}

/**
 * Fetch claims relevant to a specific reporter.
 *
 * @param {string} reporter - Reporter key (e.g., 'doug', 'neta')
 * @param {Object} [options]
 * @param {string} [options.ticker] - Filter by primary or linked ticker
 * @param {string} [options.source] - Filter by source type
 * @param {number} [options.limit=10] - Max claims to return
 * @param {number} [options.maxAgeDays] - Max age in days (null = no filter)
 * @returns {Object[]} Array of claim objects
 */
export async function getClaimsForReporter(reporter, options = {}) {
  try {
    const { ticker, source, limit = 10, maxAgeDays = null } = options;
    const db = getFirebaseAdmin();

    let baseQuery = db.collection(COLLECTION)
      .where('relevantReporters', 'array-contains', reporter);

    if (source) {
      baseQuery = baseQuery.where('source', '==', source);
    }

    if (maxAgeDays) {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
      baseQuery = baseQuery.where('sourceDate', '>=', cutoff.toISOString().split('T')[0]);
    }

    if (!ticker) {
      const snapshot = await baseQuery.orderBy('sourceDate', 'desc').limit(limit).get();
      return snapshot.docs.map(doc => doc.data());
    }

    // Ticker path: primary (ticker ==) + linked (linkedTickers array-contains),
    // then merge. The reporter is scoped in memory rather than on the query
    // because Firestore forbids >1 array-contains per query (which killed the
    // old linkedQuery outright) AND no (relevantReporters, ticker, sourceDate)
    // composite index exists (which would have killed the old primaryQuery on a
    // missing-index error even after removing the second array-contains). Both
    // queries below use committed single-array-contains/equality indexes:
    // (ticker, sourceDate), (ticker, source, sourceDate), (linkedTickers,
    // sourceDate). Tradeoff: the in-memory reporter filter runs after limit(N),
    // so a linked-ticker claim outside that ticker's freshest N can be missed —
    // the ideal reporter∧ticker indexed query needs a composite this fix does
    // not add. Direct (ticker ==) matches are unaffected in practice.
    const cutoff = maxAgeDays
      ? new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    let primaryQuery = db.collection(COLLECTION).where('ticker', '==', ticker);
    if (source) primaryQuery = primaryQuery.where('source', '==', source);
    if (cutoff) primaryQuery = primaryQuery.where('sourceDate', '>=', cutoff);
    primaryQuery = primaryQuery.orderBy('sourceDate', 'desc').limit(limit);

    let linkedQuery = db.collection(COLLECTION).where('linkedTickers', 'array-contains', ticker);
    if (cutoff) linkedQuery = linkedQuery.where('sourceDate', '>=', cutoff);
    linkedQuery = linkedQuery.orderBy('sourceDate', 'desc').limit(limit);

    const [primarySnap, linkedSnap] = await Promise.all([
      primaryQuery.get(),
      linkedQuery.get(),
    ]);

    const relevantToReporter = (d) =>
      Array.isArray(d.relevantReporters) && d.relevantReporters.includes(reporter);

    // Merge and deduplicate by claimId, scoping to the reporter in memory.
    const claimsMap = new Map();
    for (const doc of primarySnap.docs) {
      const data = doc.data();
      if (relevantToReporter(data)) claimsMap.set(data.claimId, data);
    }
    for (const doc of linkedSnap.docs) {
      const data = doc.data();
      if (!relevantToReporter(data)) continue;
      // Apply source in memory on the linked path (no linkedTickers+source
      // composite index) so the option is honored consistently with primary.
      if (source && data.source !== source) continue;
      if (!claimsMap.has(data.claimId)) {
        claimsMap.set(data.claimId, data);
      }
    }

    // Sort by sourceDate desc, apply limit
    return Array.from(claimsMap.values())
      .sort((a, b) => (b.sourceDate || '').localeCompare(a.sourceDate || ''))
      .slice(0, limit);
  } catch (err) {
    console.error(`${LOG_PREFIX} getClaimsForReporter(${reporter}) failed:`, err.message);
    return [];
  }
}

/**
 * Fetch claims for a specific ticker (primary or linked).
 *
 * @param {string} ticker - Stock symbol
 * @param {Object} [options]
 * @param {string} [options.category] - Filter by category
 * @param {string} [options.source] - Filter by source type
 * @param {number} [options.limit=15] - Max claims to return
 * @returns {Object[]} Array of claim objects
 */
export async function getClaimsForTicker(ticker, options = {}) {
  try {
    const { category, source, limit = 15 } = options;
    const db = getFirebaseAdmin();

    const primaryQuery = db.collection(COLLECTION)
      .where('ticker', '==', ticker)
      .orderBy('sourceDate', 'desc')
      .limit(limit);

    const linkedQuery = db.collection(COLLECTION)
      .where('linkedTickers', 'array-contains', ticker)
      .orderBy('sourceDate', 'desc')
      .limit(limit);

    const [primarySnap, linkedSnap] = await Promise.all([
      primaryQuery.get(),
      linkedQuery.get(),
    ]);

    // Merge and deduplicate
    const claimsMap = new Map();
    for (const doc of primarySnap.docs) {
      const data = doc.data();
      claimsMap.set(data.claimId, data);
    }
    for (const doc of linkedSnap.docs) {
      const data = doc.data();
      if (!claimsMap.has(data.claimId)) {
        claimsMap.set(data.claimId, data);
      }
    }

    let results = Array.from(claimsMap.values());

    // Apply optional filters after merge
    if (category) {
      results = results.filter(c => c.category === category);
    }
    if (source) {
      results = results.filter(c => c.source === source);
    }

    return results
      .sort((a, b) => (b.sourceDate || '').localeCompare(a.sourceDate || ''))
      .slice(0, limit);
  } catch (err) {
    console.error(`${LOG_PREFIX} getClaimsForTicker(${ticker}) failed:`, err.message);
    return [];
  }
}

/**
 * Format claims into a string block for injection into a reporter's user message.
 * Groups by sourceEvent, caps at ~800 tokens (~3200 chars).
 * Returns '' if no claims.
 *
 * @param {Object[]} claims - Array of claim objects
 * @returns {string}
 */
export function formatClaimsForPrompt(claims) {
  if (!claims || claims.length === 0) return '';

  // Sort claims oldest-first so we can drop oldest when truncating
  const sorted = [...claims].sort((a, b) =>
    (a.sourceDate || '').localeCompare(b.sourceDate || '')
  );

  // Group by sourceEvent
  const groups = new Map();
  for (const c of sorted) {
    const key = c.sourceEvent || 'Unknown Event';
    if (!groups.has(key)) {
      groups.set(key, { event: key, date: c.sourceDate, claims: [] });
    }
    groups.get(key).claims.push(c);
  }

  // Build output newest-group-first, truncating oldest claims if over budget
  const groupList = Array.from(groups.values()).reverse();
  let output = '';

  for (const group of groupList) {
    const dateStr = group.date || '';
    const formattedDate = dateStr ? formatDate(dateStr) : '';
    const header = `[${group.event}${formattedDate ? ` — ${formattedDate}` : ''}]\n`;

    let groupBlock = header;
    for (const c of group.claims.reverse()) {
      const line = `• ${c.claim} (${c.sentiment}, ${c.confidence} confidence)\n`;
      groupBlock += line;
    }
    groupBlock += '\n';

    if ((output + groupBlock).length > MAX_PROMPT_CHARS) {
      // If we haven't added anything yet, add as much as fits
      if (output.length === 0) {
        output = groupBlock.substring(0, MAX_PROMPT_CHARS);
      }
      break;
    }
    output += groupBlock;
  }

  return output.trimEnd();
}

/**
 * Delete all claims where expiresAt is in the past.
 * @returns {{ deleted: number }}
 */
export async function cleanupExpiredClaims() {
  try {
    const db = getFirebaseAdmin();
    const now = new Date();

    const snapshot = await db.collection(COLLECTION)
      .where('expiresAt', '<', now)
      .get();

    if (snapshot.empty) {
      console.log(`${LOG_PREFIX} Cleanup: no expired claims found`);
      return { deleted: 0 };
    }

    let batch = db.batch();
    let batchCount = 0;
    let deleted = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      deleted++;

      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`${LOG_PREFIX} Cleanup: deleted ${deleted} expired claims`);
    return { deleted };
  } catch (err) {
    console.error(`${LOG_PREFIX} cleanupExpiredClaims failed:`, err.message);
    return { deleted: 0 };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(isoDate) {
  try {
    const d = new Date(isoDate + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return isoDate;
  }
}
