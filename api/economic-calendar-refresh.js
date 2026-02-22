// api/economic-calendar-refresh.js
// Cron endpoint: Claude → Firebase Firestore (weekly uses knowledge-based, update uses web search)
// Modes: ?mode=weekly (full 14-day calendar) | ?mode=update (fill in actuals)
// Schedule: Mon 4AM UTC (weekly), Wed/Fri 3PM UTC (update)

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from './_utils/security.js';

// Initialize Anthropic client lazily
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }
  return anthropicClient;
}

// Firebase Admin lazy init
let firestoreInstance = null;
async function getFirestore() {
  if (firestoreInstance) return firestoreInstance;

  const { getFirestore: getFs } = await import('firebase-admin/firestore');
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  firestoreInstance = getFs();
  return firestoreInstance;
}

// Get Monday of the current week as YYYY-MM-DD
function getWeekOf() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - diff);
  return monday.toISOString().split('T')[0];
}

const WEEKLY_PROMPT = (fromDate, toDate, weekOf) => `You are an economic calendar assistant. Today's date is ${fromDate}.

List ALL major US economic data releases scheduled for the next 14 days (${fromDate} through ${toDate}).

Use your knowledge of the standard US economic calendar release schedule. The major monthly releases follow consistent patterns:
- NFP/Jobs Report: First Friday of month, 8:30 AM ET
- CPI: ~12th-15th of month, 8:30 AM ET
- PPI: day after or near CPI, 8:30 AM ET
- Retail Sales: ~15th-17th of month, 8:30 AM ET
- FOMC: scheduled meeting dates (check if one falls in this window)
- Initial Jobless Claims: every Thursday, 8:30 AM ET
- ISM Manufacturing PMI: first business day of month, 10:00 AM ET
- ISM Services PMI: third business day of month, 10:00 AM ET
- Consumer Sentiment (U-Mich): two Fridays per month, 10:00 AM ET
- PCE/Core PCE: last week of month, 8:30 AM ET
- GDP: quarterly, ~30 days after quarter end
- Durable Goods: ~4th week of month, 8:30 AM ET
- Housing Starts: ~3rd week of month, 8:30 AM ET
- Consumer Confidence: last Tuesday of month, 10:00 AM ET
- ADP Employment: first Wednesday of month (2 days before NFP)
- JOLTS: ~first week of month (for data 2 months prior)

For each event provide your best estimate of the scheduled date based on historical patterns.

Return ONLY valid JSON (no backticks, no explanation):
{
  "weekOf": "${weekOf}",
  "events": [
    {
      "name": "Consumer Price Index",
      "shortName": "CPI",
      "date": "YYYY-MM-DD",
      "time": "8:30 AM ET",
      "estimate": null,
      "previous": null,
      "actual": null,
      "tier": 1,
      "volatilityGrade": "Very High",
      "context": "Brief 1-sentence context",
      "agency": "Bureau of Labor Statistics"
    }
  ],
  "weekSummary": "One sentence summary of the week"
}`;

const UPDATE_PROMPT = (events) => `Search the web for the actual released values of these US economic events. Check BLS.gov, Bureau of Economic Analysis, Federal Reserve, MarketWatch, CNBC, or Investing.com for the released data.

Events to check:
${events.map(e => `- ${e.name} (${e.shortName}) scheduled ${e.date}`).join('\n')}

For each event that has been released, provide:
- The actual value
- Whether it beat, missed, or met the estimate
- Brief market reaction (1 sentence)

Return ONLY a JSON object:
{
  "updates": [
    {
      "shortName": "NFP",
      "actual": "the actual released value as string",
      "beatMiss": "beat" | "miss" | "inline",
      "marketReaction": "Brief 1-sentence market reaction"
    }
  ]
}

Only include events that have actually been released. Skip any that haven't happened yet.`;

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check for cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isTestMode = req.query.testMode === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!isVercelCron && !isTestMode) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });
  }

  const mode = req.query.mode || 'weekly';
  const weekOf = getWeekOf();

  try {
    if (mode === 'weekly') {
      return await handleWeekly(req, res, weekOf);
    } else if (mode === 'update') {
      return await handleUpdate(req, res, weekOf);
    } else {
      return res.status(400).json({ error: `Invalid mode: ${mode}. Use "weekly" or "update".` });
    }
  } catch (error) {
    console.error(`[EconomicCalendarRefresh] Error (${mode}):`, error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}

async function handleWeekly(req, res, weekOf) {
  const anthropic = getAnthropicClient();
  const db = await getFirestore();

  // Compute 14-day window
  const today = new Date();
  const fromDate = today.toISOString().split('T')[0];
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 14);
  const toDate = futureDate.toISOString().split('T')[0];

  const prompt = WEEKLY_PROMPT(fromDate, toDate, weekOf);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract ALL text from response content blocks
  const textBlocks = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text);
  const fullText = textBlocks.join('\n');

  console.log('[EconomicCalendar] Raw text length:', fullText.length);
  console.log('[EconomicCalendar] Raw text preview:', fullText.substring(0, 500));

  // Try multiple parsing strategies
  let parsed = null;

  // Strategy 1: Direct JSON parse (entire text is JSON)
  try {
    parsed = JSON.parse(fullText.trim());
  } catch (e) { /* not pure JSON */ }

  // Strategy 2: Extract JSON object from text (handles markdown backticks, preamble, etc.)
  if (!parsed) {
    const cleaned = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* malformed JSON */ }
    }
  }

  // Strategy 3: Extract JSON array (Claude might return events as array directly)
  if (!parsed) {
    const cleaned = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const eventsArr = JSON.parse(arrayMatch[0]);
        parsed = { events: eventsArr, weekSummary: '' };
      } catch (e) { /* malformed array */ }
    }
  }

  if (!parsed) {
    console.error('[EconomicCalendar] Failed to parse. Full text:', fullText);
    return res.status(200).json({
      success: false,
      error: 'No structured response from AI',
      debug: fullText.substring(0, 1000),
    });
  }

  const events = parsed.events || [];
  const weekSummary = parsed.weekSummary || '';

  const docData = {
    weekOf,
    events,
    weekSummary,
    updatedAt: new Date().toISOString(),
    mode: 'weekly',
  };

  // Write to both {weekOf} doc and "latest" doc
  const batch = db.batch();
  batch.set(db.collection('economicCalendar').doc(weekOf), docData);
  batch.set(db.collection('economicCalendar').doc('latest'), docData);
  await batch.commit();

  console.log(`[EconomicCalendarRefresh] Weekly refresh: ${events.length} events for week of ${weekOf}`);

  return res.status(200).json({
    success: true,
    mode: 'weekly',
    weekOf,
    eventsCount: events.length,
  });
}

async function handleUpdate(req, res, weekOf) {
  const db = await getFirestore();

  // Read latest calendar from Firestore
  const latestDoc = await db.collection('economicCalendar').doc('latest').get();
  if (!latestDoc.exists) {
    return res.status(200).json({ success: true, mode: 'update', message: 'No calendar data to update' });
  }

  const calendarData = latestDoc.data();
  const todayStr = new Date().toISOString().split('T')[0];

  // Find events with no actual value that should have been released
  const pendingEvents = (calendarData.events || []).filter(
    e => e.actual === null && e.date <= todayStr
  );

  if (pendingEvents.length === 0) {
    return res.status(200).json({ success: true, mode: 'update', message: 'No pending events to update', weekOf });
  }

  const anthropic = getAnthropicClient();
  const prompt = UPDATE_PROMPT(pendingEvents);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    tools: [{
      type: 'web_search_20250305',
      name: 'web_search',
    }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract ALL text from response content blocks
  const updateTextBlocks = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text);
  const updateFullText = updateTextBlocks.join('\n');

  console.log('[EconomicCalendar] Update raw text length:', updateFullText.length);

  let updateParsed = null;

  try {
    updateParsed = JSON.parse(updateFullText.trim());
  } catch (e) { /* not pure JSON */ }

  if (!updateParsed) {
    const cleaned = updateFullText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        updateParsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* malformed JSON */ }
    }
  }

  if (!updateParsed) {
    console.error('[EconomicCalendar] Update parse failed. Full text:', updateFullText);
    return res.status(200).json({
      success: false,
      error: 'No structured response from AI',
      debug: updateFullText.substring(0, 1000),
    });
  }

  const updates = updateParsed.updates || [];

  // Merge updates into events array
  const updatedEvents = calendarData.events.map(event => {
    const update = updates.find(u => u.shortName === event.shortName);
    if (update) {
      return {
        ...event,
        actual: update.actual,
        beatMiss: update.beatMiss,
        marketReaction: update.marketReaction,
      };
    }
    return event;
  });

  const docData = {
    ...calendarData,
    events: updatedEvents,
    updatedAt: new Date().toISOString(),
    mode: 'update',
  };

  // Update both docs
  const batch = db.batch();
  batch.set(db.collection('economicCalendar').doc(calendarData.weekOf), docData);
  batch.set(db.collection('economicCalendar').doc('latest'), docData);
  await batch.commit();

  console.log(`[EconomicCalendarRefresh] Update: ${updates.length} events updated for week of ${calendarData.weekOf}`);

  return res.status(200).json({
    success: true,
    mode: 'update',
    weekOf: calendarData.weekOf,
    eventsUpdated: updates.length,
  });
}
