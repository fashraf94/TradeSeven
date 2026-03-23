// api/academy/generate-script.js
// Admin endpoint to generate a video script from a v2 KB entry using Claude Sonnet.
// The output maps directly to Remotion ConceptExplainer composition props.
//
// Usage:
//   POST /api/academy/generate-script
//   Auth: Authorization: Bearer {CRON_SECRET} or X-Admin-Secret header or ?secret= query param
//
//   Body: {
//     "entry": { ... complete v2 KB entry JSON ... },
//     "options": { "compositionId": "ConceptExplainer", "targetDuration": 100 }
//   }

import Anthropic from '@anthropic-ai/sdk';
import { validateKbEntry } from '../_utils/validateKbEntry.js';

export const config = { maxDuration: 300 };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SONNET_MODEL = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[AcademyScript]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a video script writer for FantasyTrades Academy. You receive a structured knowledge base entry and produce a scene-by-scene video script as structured JSON via the generate_video_script tool.

RULES:
1. ONLY use content from the provided KB entry. Do NOT hallucinate facts, numbers, or examples.
2. Every scene must respect its word budget from the sceneMap. Count carefully — roughly 2.5 words per second for natural speech.
3. Pick the BEST hook (usually #1) unless #2 or #3 is more dramatic for this topic.
4. Pick the BEST analogy (quality: 1) for the main context scene.
5. The surprise moment MUST appear in its designated scene.
6. Game connections should use the FIRST (highest relevance) game connection.
7. All numbers, prices, dates, and percentages must come DIRECTLY from the KB entry — never approximate or round.
8. The outro must reference the next concept from the entry's relationships.
9. Tone: Confident, fast-paced, slightly irreverent. Write for a smart 22-year-old who plays video games and uses TikTok. No jargon without immediate explanation. No hedging language ("it might be", "perhaps"). Be direct.
10. Each scene's narration text should be readable aloud in the time allocated (roughly 2.5 words per second for natural speech).

ANTI-SLOP RULES:
BANNED WORDS — NEVER use these under any circumstance:
'delve', 'testament', 'tapestry', 'crucial', 'underscore', 'robust',
'landscape', 'paradigm', 'synergy', 'leverage' (as verb), 'game-changer',
'navigate' (metaphorical), 'unpack', 'at the end of the day',
'it's worth noting', 'it remains to be seen', 'only time will tell',
'in conclusion', 'in summary', 'without further ado'

BANNED PATTERNS:
- Do not start with 'In the ever-evolving...' or 'In today's fast-paced...'
- Do not end with generic wrap-ups like 'Only time will tell' or 'Stay tuned'
- Do not use rhetorical questions as transitions ('But what does this mean?')
- Do not hedge with 'It should be noted that...' or 'Interestingly,...'
- Do not use 'double-edged sword' or 'tightrope walk' metaphors

SCENE-BY-SCENE INSTRUCTIONS:

HOOK SCENE:
- Select the best hook from the hooks array. Prefer hook #1 unless another is clearly more dramatic.
- The narration should grab attention immediately. No preamble.
- Use the hookText, textAnimation, and mood from the KB entry's visualDirections.hook.

CONTEXT SCENE:
- Explain the concept using the definition and expandedDefinition from the KB entry.
- Select the best analogy (quality: 1) and include it with its visual hint.
- Highlight the key term for on-screen emphasis.

CHART REPLAY SCENE:
- Narrate each historical example from the KB entry.
- Classify examples by strength: "primary" for the main example, "supporting" for secondary, "condensed" for brief mentions.
- Pass through chartDescription objects exactly as they appear in the KB entry.
- If surprise.scene === "chartReplay", include the surprise moment here.

MECHANISM SCENE:
- Explain HOW the concept works using the mechanism section.
- Include the metric (value, label, context) from the KB entry.
- If surprise.scene === "mechanism", include the surprise moment here.

GAME CONNECTION SCENE:
- Use the FIRST game connection (highest relevance).
- Create a fauxUICard that represents the concept in FantasyTrades gameplay.
- The narration should make the player think "oh, I can use this knowledge in the game."

OUTRO SCENE:
- Summarize the key takeaway in one sentence.
- Tease the next concept using the relationships field from the KB entry.
- Keep it short and punchy.`;

// ---------------------------------------------------------------------------
// Tool Schema — defines the VideoScript output shape
// ---------------------------------------------------------------------------

const GENERATE_VIDEO_SCRIPT_TOOL = {
  name: 'generate_video_script',
  description: 'Generate a complete scene-by-scene video script for a FantasyTrades Academy concept explainer video',
  input_schema: {
    type: 'object',
    properties: {
      scenes: {
        type: 'object',
        properties: {
          hook: {
            type: 'object',
            properties: {
              narration: { type: 'string', description: 'Spoken text for the hook (~25 words)' },
              hookText: { type: 'string', description: 'On-screen hook text from the hooks array' },
              textAnimation: { type: 'string', description: 'Animation style from visualDirections.hook' },
              mood: { type: 'string', description: 'Mood from visualDirections.hook' },
            },
            required: ['narration', 'hookText', 'textAnimation', 'mood'],
          },
          context: {
            type: 'object',
            properties: {
              narration: { type: 'string', description: 'Spoken text explaining the concept (~80 words)' },
              definition: { type: 'string', description: 'Plain English definition from KB entry' },
              definitionExpanded: { type: 'string', description: 'Expanded definition from KB entry' },
              keyTerm: { type: 'string', description: 'Key term to highlight on screen' },
              analogy: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'The chosen analogy text' },
                  visualHint: { type: 'string', description: 'Visual hint for animation' },
                },
                required: ['text', 'visualHint'],
              },
              textAnimation: { type: 'string', description: 'Animation style for text reveals' },
            },
            required: ['narration', 'definition', 'definitionExpanded', 'keyTerm', 'analogy', 'textAnimation'],
          },
          chartReplay: {
            type: 'object',
            properties: {
              narration: { type: 'string', description: 'Spoken text narrating the chart (~60 words)' },
              examples: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Example title from KB entry' },
                    ticker: { type: 'string', description: 'Stock ticker' },
                    date: { type: 'string', description: 'Date or date range' },
                    narration: { type: 'string', description: 'Spoken narrative for this example' },
                    strength: { type: 'string', enum: ['primary', 'supporting', 'condensed'], description: 'Example prominence' },
                    chartDescription: { type: 'object', description: 'Pass through from KB entry chartDescription' },
                  },
                  required: ['title', 'ticker', 'date', 'narration', 'strength'],
                },
              },
              surpriseMoment: {
                type: 'object',
                properties: {
                  statement: { type: 'string', description: 'Surprise statement from KB entry' },
                  visualCue: { type: 'string', description: 'Visual cue for the surprise reveal' },
                },
              },
            },
            required: ['narration', 'examples'],
          },
          mechanism: {
            type: 'object',
            properties: {
              narration: { type: 'string', description: 'Spoken text explaining the mechanism (~70 words)' },
              metricValue: { type: 'string', description: 'Metric value from mechanism section' },
              metricLabel: { type: 'string', description: 'Metric label' },
              metricContext: { type: 'string', description: 'Context for the metric' },
              surpriseMoment: {
                type: 'object',
                properties: {
                  statement: { type: 'string', description: 'Surprise statement from KB entry' },
                  visualCue: { type: 'string', description: 'Visual cue for the surprise reveal' },
                },
              },
              textAnimation: { type: 'string', description: 'Animation style for mechanism text' },
            },
            required: ['narration', 'metricValue', 'metricLabel', 'metricContext', 'textAnimation'],
          },
          gameConnection: {
            type: 'object',
            properties: {
              narration: { type: 'string', description: 'Spoken text connecting to FantasyTrades (~50 words)' },
              gameMode: { type: 'string', description: 'Primary game mode from gameConnections' },
              explanation: { type: 'string', description: 'How concept applies in game' },
              example: { type: 'string', description: 'Concrete game scenario example' },
              fauxUICard: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  ticker: { type: 'string' },
                  value: { type: 'string' },
                  valueColor: { type: 'string', description: 'Color for the value display (e.g., #00FF00, #FF0000)' },
                },
                required: ['title', 'ticker', 'value', 'valueColor'],
              },
            },
            required: ['narration', 'gameMode', 'explanation', 'example', 'fauxUICard'],
          },
          outro: {
            type: 'object',
            properties: {
              narration: { type: 'string', description: 'Spoken takeaway + tease (~25 words)' },
              takeaway: { type: 'string', description: 'One sentence summary' },
              nextConceptId: { type: 'string', description: 'ID of the next concept from relationships' },
              nextConceptHint: { type: 'string', description: 'Teaser text for the next video' },
            },
            required: ['narration', 'takeaway', 'nextConceptId', 'nextConceptHint'],
          },
        },
        required: ['hook', 'context', 'chartReplay', 'mechanism', 'gameConnection', 'outro'],
      },
    },
    required: ['scenes'],
  },
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth: Bearer token, x-admin-secret header, or ?secret= query param
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!adminSecret) {
    logError('No ADMIN_SECRET or CRON_SECRET configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const authHeader = req.headers.authorization;
  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;
  const bearerMatch = authHeader === `Bearer ${adminSecret}`;
  const secretMatch = providedSecret === adminSecret;

  if (!bearerMatch && !secretMatch) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check API key early
  if (!process.env.CLAUDE_API_KEY) {
    logError('CLAUDE_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  try {
    const body = req.body || {};
    const { entry, options = {} } = body;

    if (!entry) {
      return res.status(400).json({ error: 'Missing entry in request body' });
    }

    // Validate KB entry
    const validation = validateKbEntry(entry);
    if (!validation.valid) {
      logInfo('KB entry validation failed', { errors: validation.errors });
      return res.status(400).json({
        error: 'Invalid KB entry',
        missing: validation.errors,
      });
    }

    const compositionId = options.compositionId || 'ConceptExplainer';
    const targetDuration = options.targetDuration || 100;

    logInfo(`Generating script for "${entry.id || entry.title || 'unknown'}"`, {
      compositionId,
      targetDuration,
    });

    // Build user message with full KB entry
    const userMessage = [
      `Generate a video script for this Academy entry.`,
      `Target duration: ${targetDuration} seconds.`,
      `Composition: ${compositionId}.`,
      ``,
      `KB Entry:`,
      JSON.stringify(entry, null, 2),
    ].join('\n');

    // Call Sonnet via SDK with tool_use for guaranteed structured output
    const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 8192,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      tools: [GENERATE_VIDEO_SCRIPT_TOOL],
      tool_choice: { type: 'tool', name: 'generate_video_script' },
      messages: [{ role: 'user', content: userMessage }],
    });

    logInfo('Sonnet response received', { stopReason: response.stop_reason });

    // Extract structured output from tool_use block
    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      logError('No tool_use block in Sonnet response', {
        contentTypes: response.content.map((b) => b.type),
      });
      return res.status(502).json({ error: 'Failed to generate structured script' });
    }

    const script = toolBlock.input;

    // Assemble the complete VideoScript with metadata
    const videoScript = {
      id: entry.id || entry.title?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
      topic: entry.title || entry.id || 'Unknown Topic',
      compositionId,
      fps: entry.videoConfig?.fps || 30,
      durationFrames: entry.videoConfig?.durationFrames || targetDuration * 30,
      accentColor: entry.feedMeta?.accentColor || '#00D9FF',
      scenes: script.scenes,
      generatedAt: new Date().toISOString(),
      model: SONNET_MODEL,
      kbVersion: entry.version || entry.kbVersion || 1,
    };

    logInfo(`Script generated successfully for "${videoScript.id}"`, {
      sceneCount: Object.keys(videoScript.scenes).length,
      model: SONNET_MODEL,
    });

    return res.status(200).json(videoScript);
  } catch (err) {
    logError('Script generation failed', { error: err.message, stack: err.stack });

    // Distinguish Anthropic API errors from other errors
    if (err.status) {
      return res.status(502).json({
        error: 'Anthropic API error',
        detail: err.message,
        status: err.status,
      });
    }

    return res.status(500).json({ error: err.message });
  }
}
