// api/economic-calendar-refresh.js
// Cron endpoint: Claude + web search → Firebase Firestore
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

const WEEKLY_PROMPT = (fromDate, toDate) => `Search for this week's US economic calendar (${fromDate} to ${toDate}). Include: NFP, CPI, FOMC, Retail Sales, GDP, Jobless Claims, ISM PMI, PPI, UMich Sentiment, Durable Goods, PCE, Housing Starts, ADP, Consumer Confidence, and any other scheduled releases.

Tier each event: 1 (market-moving), 2 (significant), 3 (notable). Grade volatility: A (1%+ swings), B (0.3-1%), C (<0.3%).

Return ONLY JSON:
{"events":[{"name":"Full name","shortName":"NFP","date":"YYYY-MM-DD","time":"HH:MM ET or null","estimate":"string or null","previous":"string or null","actual":null,"tier":1,"volatilityGrade":"A","context":"Why it matters now","agency":"BLS"}],"weekSummary":"2-3 sentences"}

Sort by date then tier.`;

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

  const prompt = WEEKLY_PROMPT(fromDate, toDate);

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2000,
    tools: [{
      type: 'web_search_20250305',
      name: 'web_search',
    }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text from response
  let responseText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      responseText += block.text;
    }
  }

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[EconomicCalendarRefresh] No JSON found in response');
    return res.status(200).json({ success: false, error: 'No structured response from AI' });
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[EconomicCalendarRefresh] JSON parse error:', e.message);
    return res.status(200).json({ success: false, error: 'Failed to parse AI response' });
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
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2000,
    tools: [{
      type: 'web_search_20250305',
      name: 'web_search',
    }],
    messages: [{ role: 'user', content: prompt }],
  });

  let responseText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      responseText += block.text;
    }
  }

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return res.status(200).json({ success: false, error: 'No structured response from AI' });
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return res.status(200).json({ success: false, error: 'Failed to parse AI response' });
  }

  const updates = parsed.updates || [];

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
