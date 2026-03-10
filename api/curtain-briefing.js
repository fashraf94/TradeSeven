// api/curtain-briefing.js
// Daily Story read endpoint — returns the latest chapter (or full timeline)
// with user personalization. Never returns 500 — always falls back gracefully.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from './_utils/security.js';
import { getETDate, formatDateString, isMarketHoliday } from './_utils/marketSchedule.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[CurtainBriefing]';
const CHAPTER_ORDER = ['premarket', 'open', 'midday', 'closing', 'afterhours'];

const CHAPTER_LABELS = {
  premarket:  'Pre-Market Preview',
  open:       'Opening Bell',
  midday:     'Midday Check-In',
  closing:    'Closing Bell',
  afterhours: 'After Hours Wrap',
};

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determineCurrentChapter(etNow) {
  const hours = etNow.getHours();
  const minutes = etNow.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes < 570) return 'premarket';
  if (totalMinutes < 750) return 'open';
  if (totalMinutes < 900) return 'midday';
  if (totalMinutes < 1080) return 'closing';
  return 'afterhours';
}

/**
 * Personalize a chapter brief for a specific user.
 */
function personalizeChapter(chapter, userContext) {
  if (!chapter?.brief) return chapter;

  const username = userContext?.username || 'there';
  let brief = chapter.brief.replace(/\{username\}/g, username);

  // Personalize paragraphs array if present
  let paragraphs = chapter.paragraphs || null;
  if (paragraphs && Array.isArray(paragraphs)) {
    paragraphs = paragraphs.map(p => ({
      ...p,
      text: p.text.replace(/\{username\}/g, username),
    }));
  }

  // Append battle context if relevant
  const battleInfo = userContext?.battleInfo || [];
  if (battleInfo.length > 0) {
    const battleStocks = userContext?.battleStocks || [];
    const hasOverlap = battleStocks.some(ticker =>
      brief.includes(ticker)
    );

    if (hasOverlap) {
      const battleLine = `You've got ${battleInfo.length} active ${battleInfo.length === 1 ? 'battle' : 'battles'} running — keep an eye on how today's moves affect your matchup.`;
      brief += `\n\n${battleLine}`;

      // Append to paragraphs too
      if (paragraphs && Array.isArray(paragraphs)) {
        paragraphs = [...paragraphs, { text: battleLine, tickers: battleStocks }];
      }
    }
  }

  // Normalize whitespace
  brief = brief.replace(/\n{3,}/g, '\n\n').trim();

  return { ...chapter, brief, paragraphs };
}

/**
 * Build a fallback briefing when no data is available.
 */
function buildFallbackBriefing(userContext, todayStr, currentChapter) {
  const username = userContext?.username || 'there';
  return {
    success: true,
    briefing: {
      latest: {
        id: 'fallback',
        label: 'Market Update',
        generatedAt: new Date().toISOString(),
        brief: `Hey ${username}, the market briefing is still being prepared. Check back soon, or head to the Research tab for live data.`,
      },
      today: todayStr,
      currentChapter,
      chapters: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // a. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 15, windowMs: 60000 } })) {
    return;
  }

  // b. POST only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const etNow = getETDate();
  const todayStr = formatDateString(etNow);
  const currentChapter = determineCurrentChapter(etNow);

  // c. Extract request body
  const { userContext, mode } = req.body || {};

  try {
    // d. Read today's story from Firestore
    const db = getFirebaseAdmin();
    const doc = await db.collection('dailyStory').doc(todayStr).get();

    // e. No document — return fallback
    if (!doc.exists) {
      console.log(`${LOG_PREFIX} No story document for ${todayStr} — returning fallback`);
      return res.status(200).json(buildFallbackBriefing(userContext, todayStr, currentChapter));
    }

    const storyData = doc.data();
    const chapters = storyData?.chapters || {};

    // f. Find latest generated chapter (iterate backwards through order)
    let latestChapter = null;
    for (let i = CHAPTER_ORDER.length - 1; i >= 0; i--) {
      const chId = CHAPTER_ORDER[i];
      if (chapters[chId]?.brief) {
        latestChapter = chapters[chId];
        break;
      }
    }

    if (!latestChapter) {
      console.log(`${LOG_PREFIX} Story document exists but no chapters generated yet`);
      return res.status(200).json(buildFallbackBriefing(userContext, todayStr, currentChapter));
    }

    // g. Personalize latest chapter
    const personalizedLatest = personalizeChapter(latestChapter, userContext);

    // h. Build response
    const response = {
      success: true,
      briefing: {
        latest: {
          id: personalizedLatest.id,
          label: personalizedLatest.label || CHAPTER_LABELS[personalizedLatest.id] || 'Market Update',
          generatedAt: personalizedLatest.generatedAt,
          brief: personalizedLatest.brief,
          paragraphs: personalizedLatest.paragraphs || null,
          indexes: latestChapter.indexes || null,
        },
        today: todayStr,
        currentChapter,
      },
    };

    // i. Timeline mode — include all chapters (personalized)
    if (mode === 'timeline') {
      response.briefing.chapters = CHAPTER_ORDER
        .filter(chId => chapters[chId]?.brief)
        .map(chId => {
          const personalized = personalizeChapter(chapters[chId], userContext);
          return {
            id: personalized.id,
            label: personalized.label || CHAPTER_LABELS[personalized.id] || 'Market Update',
            generatedAt: personalized.generatedAt,
            brief: personalized.brief,
            paragraphs: personalized.paragraphs || null,
            indexes: chapters[chId].indexes || null,
          };
        });
    }

    return res.status(200).json(response);
  } catch (error) {
    // k. Never 500 to the frontend — always fallback
    console.error(`${LOG_PREFIX} Error:`, error.message);
    return res.status(200).json(buildFallbackBriefing(userContext, todayStr, currentChapter));
  }
}
