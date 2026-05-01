// api/discover/current-events.js
// Discover tab — Current Events rail data source.
//
// Reads indexIntelligence/dailyRegimeBrief, normalizes the keyEvents array
// (handling both pre-Path-C string-shape and post-Path-C object-shape during
// the schema transition window), filters past events using end-of-day ET
// (20:00) drop semantics, and returns a stable response the rail UI can
// render directly.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFromCache, setInCache } from '../_utils/serverCache.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { getETDate, formatDateString } from '../_utils/marketSchedule.js';

const LOG_PREFIX = '[DiscoverCurrentEvents]';
const CACHE_KEY = 'discover_current_events';
const CACHE_TTL = 300; // 5 minutes — DRB writes daily; bounded staleness on the seam is fine.
const MAX_EVENTS = 6;
const VALID_KINDS = new Set(['macro', 'earnings', 'fed', 'speech', 'auction']);

// Module-level stale fallback (survives across warm container invocations).
let lastSuccessfulResponse = null;

// duplicated from api/cron/promote-discover-themes.js — small enough to
// inline rather than refactor into _utils in this phase.
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
  const etMidnight = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const daysSinceMonday = (weekdayIdx + 6) % 7;
  etMidnight.setUTCDate(etMidnight.getUTCDate() - daysSinceMonday);
  const yyyy = etMidnight.getUTCFullYear();
  const mm = String(etMidnight.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(etMidnight.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatWeekOf(mondayStr) {
  const monday = new Date(`${mondayStr}T00:00:00Z`);
  const formatted = monday.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `Week of ${formatted}`;
}

// TODO: remove after Monday May 4 2026 cron transition writes structured
// keyEvents objects. The string branch handles the legacy free-form shape;
// once the new schema is producing reliably it becomes dead code.
function normalizeEvent(item) {
  if (typeof item === 'string') {
    return {
      label: item,
      eventDate: null,
      eventTime: '',
      kind: 'macro',
      whyItMatters: '',
      tickers: [],
    };
  }
  if (item && typeof item === 'object') {
    const kind = typeof item.kind === 'string' && VALID_KINDS.has(item.kind) ? item.kind : 'macro';
    return {
      label: typeof item.label === 'string' ? item.label : '',
      eventDate: typeof item.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate)
        ? item.eventDate
        : null,
      eventTime: typeof item.eventTime === 'string' ? item.eventTime : '',
      kind,
      whyItMatters: typeof item.whyItMatters === 'string' ? item.whyItMatters : '',
      tickers: Array.isArray(item.tickers)
        ? item.tickers.filter(t => typeof t === 'string')
        : [],
    };
  }
  return null;
}

// End-of-day ET (20:00) drop semantics: an event drops from the rail after
// 8 PM ET on its eventDate. Keeps Fed afternoon press conf and AMC earnings
// in the rail through end-of-day.
function isUpcoming(event, todayET, currentETHour) {
  if (!event.eventDate) return false;
  if (event.eventDate > todayET) return true;
  if (event.eventDate < todayET) return false;
  return currentETHour < 20;
}

function emptyDataPayload(weekOf, briefForDate, status) {
  return {
    events: [],
    weekOf,
    briefForDate,
    status,
  };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cached = getFromCache(CACHE_KEY);
  if (cached) {
    return res.status(200).json(cached);
  }

  const nowET = getETDate();
  const todayET = formatDateString(nowET);
  const currentETHour = nowET.getHours();
  const weekOf = formatWeekOf(getMondayOfWeekET());

  try {
    const db = getFirebaseAdmin();
    const snap = await db.collection('indexIntelligence').doc('dailyRegimeBrief').get();

    if (!snap.exists) {
      console.warn(`${LOG_PREFIX} dailyRegimeBrief doc missing`);
      const responseData = {
        success: true,
        data: emptyDataPayload(weekOf, null, 'empty'),
      };
      setInCache(CACHE_KEY, responseData, CACHE_TTL);
      lastSuccessfulResponse = responseData;
      return res.status(200).json(responseData);
    }

    const docData = snap.data() || {};
    const forDate = typeof docData.forDate === 'string' ? docData.forDate : null;
    const rawKeyEvents = Array.isArray(docData.keyEvents) ? docData.keyEvents : null;

    if (!rawKeyEvents) {
      console.warn(`${LOG_PREFIX} keyEvents missing or non-array; returning empty`);
      const responseData = {
        success: true,
        data: emptyDataPayload(weekOf, forDate, 'empty'),
      };
      setInCache(CACHE_KEY, responseData, CACHE_TTL);
      lastSuccessfulResponse = responseData;
      return res.status(200).json(responseData);
    }

    const events = rawKeyEvents
      .map(normalizeEvent)
      .filter(e => e !== null)
      .filter(e => isUpcoming(e, todayET, currentETHour))
      .slice(0, MAX_EVENTS);

    const status = forDate === todayET ? 'fresh' : 'stale';

    const responseData = {
      success: true,
      data: {
        events,
        weekOf,
        briefForDate: forDate,
        status,
      },
    };

    setInCache(CACHE_KEY, responseData, CACHE_TTL);
    lastSuccessfulResponse = responseData;
    console.log(`${LOG_PREFIX} returned ${events.length} events, status=${status}, forDate=${forDate}`);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message, error.stack);

    if (lastSuccessfulResponse) {
      console.log(`${LOG_PREFIX} returning stale fallback`);
      return res.status(200).json({
        ...lastSuccessfulResponse,
        stale: true,
      });
    }

    return res.status(200).json({
      success: true,
      data: emptyDataPayload(weekOf, null, 'empty'),
    });
  }
}
