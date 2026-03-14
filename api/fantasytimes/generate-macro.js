console.log('generate-macro loaded');
// api/fantasytimes/generate-macro.js
// Kai's Macro Alert — triggered when 5+ stocks fire within 2 minutes.
// Single story covering a broad market event.

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  KAI_MACRO_SYSTEM_PROMPT,
  PUBLISH_MACRO_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';

export const config = { maxDuration: 30 };

const LOG_PREFIX = '[FantasyTimes:Kai:Macro]';

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  const { triggers, marketContext } = req.body || {};

  if (!Array.isArray(triggers) || triggers.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'triggers array required with at least 2 entries',
    });
  }

  try {
    const db = getFirebaseAdmin();

    // ── Fetch general market news (not per-ticker) ──────────────────
    let marketHeadlines = [];
    try {
      const newsUrl = `https://eodhd.com/api/news?limit=3&api_token=${process.env.EODHD_API_KEY}&fmt=json`;
      const newsRes = await fetch(newsUrl);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        marketHeadlines = (newsData || [])
          .slice(0, 3)
          .map((n) => n.title || n.headline)
          .filter(Boolean);
      }
    } catch (e) {
      logError('Failed to fetch market news', { error: e.message });
    }

    // ── Build user message ──────────────────────────────────────────
    const triggerLines = triggers.map(
      (t) =>
        `- **${t.symbol}**: ${t.percentChange >= 0 ? '+' : ''}${Number(t.percentChange).toFixed(2)}% (${t.direction || 'unknown'})`
    );

    const ctx = marketContext || {};
    const userMessage = [
      `MACRO ALERT: ${triggers.length} stocks triggered simultaneously.`,
      '',
      'TRIGGERED STOCKS:',
      ...triggerLines,
      '',
      `MARKET CONTEXT:`,
      `- Dominant direction: ${ctx.dominantDirection || 'mixed'}`,
      `- Average move: ${ctx.avgChange != null ? Number(ctx.avgChange).toFixed(2) + '%' : 'unknown'}`,
      ctx.sectorBreakdown
        ? `- Sector breakdown: ${JSON.stringify(ctx.sectorBreakdown)}`
        : '',
      '',
      'MARKET HEADLINES:',
      marketHeadlines.length > 0
        ? marketHeadlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
        : 'No recent headlines available.',
      '',
      'Write a Macro Alert story covering this broad market move. Use the publish_macro tool.',
    ]
      .filter(Boolean)
      .join('\n');

    // ── Call Claude Haiku ────────────────────────────────────────────
    logInfo(`Generating macro alert for ${triggers.length} stocks`);
    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: REPORTER_PROFILES.kai.model,
      max_tokens: 700,
      temperature: 0.8,
      system: KAI_MACRO_SYSTEM_PROMPT,
      tools: [PUBLISH_MACRO_TOOL],
      tool_choice: { type: 'tool', name: 'publish_macro' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      logError('No tool_use block in macro response');
      return res.status(500).json({ success: false, error: 'AI did not return structured story' });
    }

    const storyData = toolBlock.input;
    const allTickers = triggers.map((t) => String(t.symbol).toUpperCase());

    // ── Write to Firestore ──────────────────────────────────────────
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.kai.expiryHours * 60 * 60 * 1000);

    const storyDoc = {
      reporter: 'kai',
      reporterName: REPORTER_PROFILES.kai.name,
      reporterBeat: REPORTER_PROFILES.kai.beat,
      type: 'macro_alert',
      headline: String(storyData.headline || '').slice(0, 120),
      subheadline: String(storyData.subheadline || '').slice(0, 200),
      body: String(storyData.body || ''),
      tickers: allTickers,
      primaryTicker: null,
      sector: ctx.sectorBreakdown ? Object.keys(ctx.sectorBreakdown)[0] || 'Market' : 'Market',
      themes: Array.isArray(storyData.themes) ? storyData.themes : [],
      sentiment: storyData.sentiment || 'mixed',
      urgency: 'breaking',
      recommended_action: storyData.recommended_action || 'RESEARCH',
      dataSnapshot: {
        triggerCount: triggers.length,
        dominantDirection: ctx.dominantDirection || 'mixed',
        avgChange: ctx.avgChange || 0,
      },
      newsContext: marketHeadlines,
      generatedBy: REPORTER_PROFILES.kai.model,
      batchId: null,
      publishedAt: now,
      expiresAt: expiresAt,
      status: 'published',
    };

    const docRef = await db.collection('fantasyTimesStories').add(storyDoc);

    logInfo(`Published macro alert ${docRef.id}`, {
      headline: storyDoc.headline,
      tickers: allTickers,
    });

    return res.status(200).json({
      success: true,
      storyId: docRef.id,
      headline: storyDoc.headline,
    });
  } catch (error) {
    logError('Macro generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Macro alert generation failed' });
  }
}
