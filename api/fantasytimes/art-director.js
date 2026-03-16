// api/fantasytimes/art-director.js
// Art Director Haiku endpoint — AI fallback for edge-case visual assignment.
// Called for stories where deterministic rules don't produce a good match.

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { ART_DIRECTOR_PROMPT } from '../_utils/fantasyTimesVisuals.js';

export const config = { maxDuration: 15 };

const VALID_VISUAL_TYPES = [
  'price_chart', 'market_bar', 'comparison_bar',
  'stat_card', 'eps_gauge', 'sector_heatmap', 'none',
];

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

/**
 * Core Art Director logic — call Haiku to assign a visual type.
 * Exported for direct import by generation endpoints and test endpoint.
 *
 * @param {object} storyData - { headline, body, reporter, type, primaryTicker, sentiment, dataSnapshot }
 * @returns {{ visualType: string, visualConfig: object }}
 */
export async function runArtDirector(storyData) {
  const anthropic = getAnthropicClient();

  const userMessage = `Analyze this story and assign a visual type.

Reporter: ${storyData.reporter}
Story type: ${storyData.type}
Headline: ${storyData.headline}
Primary ticker: ${storyData.primaryTicker || 'none'}
Sentiment: ${storyData.sentiment || 'neutral'}

Story body:
${storyData.body || ''}

Available data snapshot:
${JSON.stringify(storyData.dataSnapshot || {}, null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    temperature: 0,
    system: ART_DIRECTOR_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    return { visualType: 'none', visualConfig: {} };
  }

  // Strip markdown code fences if present
  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(raw);

  if (!parsed.visualType || !VALID_VISUAL_TYPES.includes(parsed.visualType)) {
    return { visualType: 'none', visualConfig: {} };
  }

  return {
    visualType: parsed.visualType,
    visualConfig: parsed.visualConfig || {},
  };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Cron / admin auth — no legitimate consumer calls this via HTTP
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { storyId, headline, body, reporter, type, primaryTicker, sentiment, dataSnapshot } = req.body || {};

  if (!headline || !reporter || !type) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: headline, reporter, type',
    });
  }

  try {
    const result = await runArtDirector({
      headline,
      body,
      reporter,
      type,
      primaryTicker,
      sentiment,
      dataSnapshot,
    });

    // Persist to Firestore if storyId provided and result is valid
    if (storyId && result.visualType !== 'none') {
      try {
        const db = getFirebaseAdmin();
        await db.collection('fantasyTimesStories').doc(storyId).update({
          visualType: result.visualType,
          visualConfig: result.visualConfig,
        });
      } catch (dbErr) {
        console.warn('[ArtDirector] Firestore update failed:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      visualType: result.visualType,
      visualConfig: result.visualConfig,
    });
  } catch (error) {
    console.error('[ArtDirector] Failed:', error.message);
    return res.status(200).json({
      success: true,
      visualType: 'none',
      visualConfig: {},
    });
  }
}
