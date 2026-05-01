// api/cron/promote-discover-themes.js
// Weekly cron: rotates the 3 "live this week" themes on the Discover page.
//
// Schedule: "0 10,11 * * 1" (dual UTC hours for DST coverage — Monday 06:00 ET).
// Idempotent by design — read-aggregate-write. Re-running within the same
// window simply re-selects 3 random active themes and overwrites the flags;
// harmless if it picks a different trio than the prior run.
//
// Selection: random 3 from { discoverThemes where status === 'active' }.
// Writes: isLiveThisWeek on every active theme (3 selected → true, the rest
// → false). liveSignalReason is always written as null — the field is
// reserved for a future real signal source (engagement-ranked, Sonnet-
// curated, etc.) and we don't want to burn it on `type: 'random'` noise.
// Themes with status !== 'active' are left untouched.

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const LOG_PREFIX = '[promote-discover-themes]';

// Returns the Monday of the current week in America/New_York as YYYY-MM-DD.
// Uses Intl.DateTimeFormat to get correct ET wall-clock parts (handles
// EST/EDT automatically), then walks back to the most recent Monday.
function getMondayOfWeekET(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const weekdayIdx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  // Build a UTC-anchored date from the ET wall-clock parts so date arithmetic
  // is unaffected by the host TZ, then subtract days to reach Monday.
  const etMidnight = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const daysSinceMonday = (weekdayIdx + 6) % 7;
  etMidnight.setUTCDate(etMidnight.getUTCDate() - daysSinceMonday);
  const yyyy = etMidnight.getUTCFullYear();
  const mm = String(etMidnight.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(etMidnight.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Fisher-Yates in-place shuffle. Returns the mutated array for chaining.
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default async function handler(req, res) {
  // ── Auth ──
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers['authorization'];
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getFirebaseAdmin();

    // ── Fetch active themes (sorted by displayOrder for deterministic input) ──
    const snap = await db
      .collection('discoverThemes')
      .where('status', '==', 'active')
      .orderBy('displayOrder', 'asc')
      .get();

    const activeThemes = snap.docs.map(d => ({ id: d.id, ref: d.ref }));
    const totalActive = activeThemes.length;

    // ── Select up to 3 at random ──
    const pool = activeThemes.slice();
    shuffle(pool);
    const selected = pool.slice(0, 3);
    const selectedIds = new Set(selected.map(t => t.id));

    const weekOf = getMondayOfWeekET();
    const selectedAt = new Date().toISOString();

    // liveSignalReason is intentionally left null until a real signal source
    // (e.g. engagement-ranked, Sonnet-curated) populates it. Writing
    // { type: 'random', ... } now would burn the field on noise.
    const batch = db.batch();
    for (const theme of activeThemes) {
      const isLive = selectedIds.has(theme.id);
      batch.update(theme.ref, {
        isLiveThisWeek: isLive,
        liveSignalReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    const selectedIdList = selected.map(t => t.id);
    console.log(
      `${LOG_PREFIX} Selected ${selectedIdList.join(', ')} for week of ${weekOf} at ${selectedAt}`
    );

    return res.status(200).json({
      ok: true,
      selected: selectedIdList,
      weekOf,
      totalActive,
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} Error:`, err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export const config = {
  maxDuration: 30,
};
