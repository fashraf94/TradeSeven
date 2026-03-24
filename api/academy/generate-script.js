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
//     "options": { "compositionId": "ConceptExplainer", "targetDuration": 150 }
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

const SYSTEM_PROMPT = `<persona_and_tone>
You are an elite documentary filmmaker in the style of ColdFusion and Casgains Academy. You write high-stakes financial thrillers backed by real market data — not educational explainer videos. You never sound like a textbook, a Wikipedia article, or an AI assistant. You speak in short, punchy, dramatic sentences with drastically varied sentence lengths. A flowing thirty-word sentence building tension across a chart. Followed by a three-word gut punch. Like that.
</persona_and_tone>

<chain_of_thought>
Before generating the final JSON script, you MUST reason through a narrative_spine plan:
1. THE CORE TENSION: What is the ticking clock, trap, or anomaly in this story? Who is about to lose everything and why?
2. THE INTEGRATION: How exactly will the Analogy be woven into the Historical Example — not as a separate section, but as part of the same scene?
3. THE CAUSAL CHAIN: How does Act 1 CAUSE Act 2? How does Act 2 lead to Act 3? Use "But" (complication) or "Therefore" (consequence) logic — never "Next, let's look at..."
4. THE CALLBACK: What specific detail from Act 1 will you reference in Act 5 to create narrative closure?
Think through this plan internally before generating any output.
</chain_of_thought>

<storytelling_rules>
1. THE HISTORICAL PRESENT: Acts 1 and 2 MUST be written in active present tense. "It's January 2021. GameStop is trading at $17." Present tense creates temporal transportation — the viewer is IN the moment. Past tense creates academic distance. Never start with past tense.

2. THE "BUT/THEREFORE" RULE: Every act must connect to the next via cause-and-effect. You are BANNED from using transition phrases like "Next let's look at", "Another example is", "Moving on to", "Now let's examine". Acts connect because of "But" (a complication) or "Therefore" (a consequence). Example: "But the data hid a fatal flaw..." / "Therefore, when retail traders noticed the 140% short interest..."

3. THE "HOST AND PARASITE" FRAMEWORK: The Historical Story is the "Host." The Definition, Analogy, and Mechanism are "Parasites" that live INSIDE the story — never as standalone sections. Do NOT say "An analogy for this is musical chairs." DO say "Melvin Capital suddenly finds themselves in a billion-dollar game of musical chairs — a hundred players, five chairs, and the price of sitting down doubles every second."

4. SPLIT THE COGNITIVE LOAD: The narrator speaks the EMOTIONAL IMPACT. The screen shows the EXACT RECEIPTS. The narrator NEVER reads lists of raw numbers aloud. Instead: narrator says "the stock practically exploded overnight" while visual_directions specify [Text Punch: $17.25 → $483 (+2,700%)]. When you must reference a specific number in narration for dramatic impact, do it in isolation with a pause: "One hundred and forty percent. That's how many shares were shorted."

5. THE CURIOSITY GAP: The concept name (e.g., "short squeeze") must NOT appear in Act 1. The viewer is hooked by the STORY before they learn the concept name. Reveal the concept name in Act 2 as the answer to the mystery: "To understand how this happened, you need to understand a market trap called a short squeeze."

6. VISUAL PACING: The visual_directions must describe a new visual element or transition every 15-20 words of narration (~3-4 seconds). The screen is never static for more than 4 seconds. If a viewer watches with sound OFF, the visuals alone should tell a rough version of the story.

7. SENTENCE RHYTHM: Violently vary sentence lengths. Never write three sentences of the same length in a row. Use long sentences to build tension. Short ones to punch. Fragments for impact. Then a longer sentence that pulls the viewer forward into the next beat of the story before they can look away.

8. DRAMATIC PAUSES: Include [PAUSE 1.0s] or [PAUSE 1.5s] tags in the narration at moments where the visuals need to breathe — after the cold open hook, before the surprise moment, after the key metric reveal. These pauses let the chart draw, the counter tick, the animation play.
</storytelling_rules>

<anti_slop_rules>
BANNED WORDS AND PHRASES — using any of these will fail the generation:
- "delve", "explore", "bustling", "a testament to", "landscape", "symphony"
- "buckle up", "dive in", "picture this", "imagine this", "fast forward"
- "crucial", "vital", "essential" (use "the" or nothing instead)
- "in today's video", "welcome back", "don't forget to subscribe"
- "let me explain", "here's the thing", "at the end of the day", "it's worth noting"
- "interestingly", "importantly", "notably", "remarkably", "significantly"
- Any sentence starting with "So," or "Now,"
- Any rhetorical question that sounds like a YouTube title

BANNED STRUCTURES:
- Never start consecutive sentences with the same word
- Never write a paragraph where every sentence is the same length
- Never use a colon followed by a list in narration (lists are for screens, not voices)
- Never use parenthetical asides in narration — they break vocal flow
</anti_slop_rules>

<data_fidelity_rules>
- Every price, date, percentage, ticker, and dollar amount MUST come directly from the provided KB entry
- NEVER approximate: if the KB says "$483", you write "$483" — not "nearly $500"
- NEVER invent examples, dates, names, or statistics not present in the KB entry
- NEVER add hedge fund names, CEO names, or other proper nouns not in the KB entry
- The KB entry is your research dossier from the producer. It is your ONLY source of truth.
- You have ABSOLUTE creative freedom over pacing, metaphor, narrative tone, and structure
- You have ZERO creative freedom over facts, dates, prices, or math. Be mathematically perfect.
</data_fidelity_rules>

<narrative_structure>
You will generate a 5-act script for a 150-second (2.5 minute) narrated video.

ACT 1 — THE COLD OPEN (0-20 seconds, 35-50 words of narration)
Drop the viewer into the middle of a SPECIFIC dramatic moment from the KB entry's primary historical example.
- Written in HISTORICAL PRESENT tense
- Start with a date, a ticker, and a number that creates immediate tension
- The concept name does NOT appear yet
- End with a line that creates an information gap — the viewer MUST keep watching to understand what happens
- Include [PAUSE 1.5s] after the opening hook line to let the chart visual establish
- VISUAL: The chart for this moment begins drawing. Date stamp appears. Ticker badge. Price counter starts ticking.

ACT 2 — THE SETUP (20-50 seconds, 60-80 words of narration)
Pull back and explain WHAT is happening and WHY — through the story, not as a dictionary.
- The concept name is revealed here as the answer to Act 1's mystery
- The analogy is woven INTO the story as a metaphor, not presented separately
- The key term appears as a phrase the narrator emphasizes naturally
- Transition from Act 1 uses "But" or "Therefore" — never "Now let me explain"
- VISUAL: KeyPhrasePunch for the concept name reveal. VisualHintAnimation plays. Chart pauses during explanation.

ACT 3 — THE EVIDENCE (50-95 seconds, 90-115 words of narration)
This is the Casgains Academy element — the chart tells the story.
- Return to the primary example and walk through the price action
- The narrator describes the ACTION ("watch what happens when the buying starts...") while visual_directions specify the exact numbers on screen
- Use the "Escalation" technique for building sequences: slow at first, then accelerating
- Supporting examples get 10-15 seconds each as quick montage transitions: "This wasn't a one-time event. October 2008. Volkswagen..."
- Include [PAUSE 1.0s] when the highlight move fires — let the big percentage breathe
- VISUAL: ChartReplay as hero. Candles draw progressively. Annotations pop. Highlight move fires with dramatic percentage. Supporting examples as rapid montage.

ACT 4 — THE REVELATION (95-120 seconds, 50-65 words of narration)
The mechanism explained as the story's climax, followed by the surprise moment.
- The metric is the mathematical proof of WHY this happened
- Build to the surprise moment as a gut punch — the narrator's tone shifts
- The surprise statement gets its own beat with [PAUSE 1.0s] before and after
- This is the "Retention Defibrillator" — recaptures attention at the 70% mark
- VISUAL: Big AnimatedCounter for the metric. Then surprise statement SLAMS on screen with visual cue.

ACT 5 — THE CONNECTION (120-150 seconds, 55-70 words of narration)
Connect to FantasyTrades gameplay, deliver the takeaway, tease the next concept.
- The game connection must feel like a NATURAL EXTENSION of the story — not an ad read
- Reference the specific scoring example from the KB entry
- The takeaway MUST callback to Act 1's opening moment for narrative closure
- End with a forward-looking tease that creates curiosity for the next concept
- VISUAL: FauxUICard slides in. Scoring counter animates. Takeaway as KeyPhrasePunch. Logo. Fade.

TOTAL WORD BUDGET: 320-340 words of narration (NOT including [PAUSE] tags or visual directions). At 2.5 words/second, this produces ~130-136 seconds of speech, leaving ~15-20 seconds for pauses, chart animations, and the logo outro. This breathing room is CRITICAL — do not exceed 340 words.
</narrative_structure>`;

// ---------------------------------------------------------------------------
// Tool Schema — defines the VideoScript output shape
// ---------------------------------------------------------------------------

const GENERATE_VIDEO_SCRIPT_TOOL = {
  name: 'generate_video_script',
  description: 'Generate a complete 5-act documentary-style video script for a FantasyTrades Academy concept explainer video',
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Concept ID from the KB entry' },
      topic: { type: 'string', description: 'Human-readable topic name' },
      compositionId: { type: 'string', description: 'Remotion composition ID', default: 'ConceptExplainer' },
      fps: { type: 'number', description: 'Frames per second', default: 30 },
      durationFrames: { type: 'number', description: 'Total duration in frames (150s × 30fps = 4500)', default: 4500 },
      accentColor: { type: 'string', description: 'Hex accent color for the video' },
      narrativeSpine: {
        type: 'object',
        description: 'The story plan that Sonnet reasoned through before writing the script',
        properties: {
          coreTension: { type: 'string', description: 'What is the ticking clock or trap in this story?' },
          analogyIntegration: { type: 'string', description: 'How is the analogy woven into the historical example?' },
          causalChain: { type: 'string', description: 'Act 1 → Act 2 → Act 3 → Act 4 → Act 5 connected by But/Therefore' },
          callbackDetail: { type: 'string', description: 'What specific detail from Act 1 is referenced in Act 5?' },
        },
      },
      scenes: {
        type: 'object',
        required: ['coldOpen', 'setup', 'evidence', 'revelation', 'connection'],
        properties: {
          coldOpen: {
            type: 'object',
            description: 'Act 1: Drop into a specific dramatic moment (0-20s)',
            required: ['narration', 'visualDirections'],
            properties: {
              narration: { type: 'string', description: 'The spoken narration for the cold open. 35-50 words. Starts with a specific date/ticker/price. Written in historical present tense.' },
              openingDate: { type: 'string', description: 'The specific date the story starts: "January 27, 2021"' },
              openingTicker: { type: 'string', description: 'The ticker that anchors the story: "GME"' },
              openingPrice: { type: 'string', description: 'The specific price that creates tension: "$17.25"' },
              hookText: { type: 'string', description: 'A 5-8 word text overlay that appears on screen during the cold open. NOT the full narration — just the visual punch. Example: "GameStop. $17. Forty-eight hours."' },
              mood: { type: 'string', description: 'The emotional tone: urgent, mysterious, tense, dramatic' },
              visualDirections: { type: 'string', description: 'What appears on screen: chart beginning to draw, date stamp, ticker badge, price counter starting' },
              pauseMarkers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Explicit [PAUSE Xs] markers and their positions in the narration. E.g., ["after opening line: [PAUSE 1.5s]"]',
              },
            },
          },
          setup: {
            type: 'object',
            description: 'Act 2: Pull back and explain what led to this moment (20-50s)',
            required: ['narration', 'keyTerm', 'analogyText', 'visualDirections'],
            properties: {
              narration: { type: 'string', description: 'The spoken narration. 60-80 words. Introduces the concept THROUGH the story. Weaves in one analogy naturally. Uses But/Therefore transition from Act 1.' },
              keyTerm: { type: 'string', description: 'The 2-4 word key concept phrase to highlight on screen' },
              analogyText: { type: 'string', description: 'The single-sentence analogy woven into the narration — NOT as a separate callout' },
              visualHint: { type: 'string', description: 'The visualHint from the KB entry analogy — drives the VisualHintAnimation' },
              conceptRevealText: { type: 'string', description: '2-3 words that appear on screen when the concept name is first revealed. Example: "SHORT SQUEEZE"' },
              visualDirections: { type: 'string', description: 'What appears on screen: keyTerm as KeyPhrasePunch, VisualHintAnimation plays, concept name reveals' },
              pauseMarkers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Explicit [PAUSE Xs] markers and their positions in the narration.',
              },
            },
          },
          evidence: {
            type: 'object',
            description: 'Act 3: The chart tells the story — Casgains Academy style (50-95s)',
            required: ['narration', 'primaryExample', 'visualDirections'],
            properties: {
              narration: { type: 'string', description: 'The spoken narration walking through the chart evidence. 90-115 words. Narrator describes ACTION while visual_directions show exact numbers.' },
              primaryExample: {
                type: 'object',
                required: ['title', 'ticker', 'date', 'narration'],
                properties: {
                  title: { type: 'string' },
                  ticker: { type: 'string' },
                  date: { type: 'string' },
                  narration: { type: 'string', description: 'The spoken walkthrough of this specific chart' },
                  chartDescription: { type: 'object', description: 'Pass through from KB entry' },
                },
              },
              supportingExamples: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    ticker: { type: 'string' },
                    quickNarration: { type: 'string', description: '1-2 sentences for quick montage treatment' },
                  },
                },
                description: 'Brief supporting examples for montage (10-15 seconds each)',
              },
              visualDirections: { type: 'string', description: 'ChartReplay as hero. Candles draw progressively. Annotations pop in. Highlight move fires dramatically. Supporting examples as quick-cut montage.' },
              pauseMarkers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Explicit [PAUSE Xs] markers and their positions in the narration. E.g., ["after highlight move: [PAUSE 1.0s]"]',
              },
            },
          },
          revelation: {
            type: 'object',
            description: 'Act 4: The mechanism + surprise moment as the story climax (95-120s)',
            required: ['narration', 'metricValue', 'metricLabel', 'surpriseMoment', 'visualDirections'],
            properties: {
              narration: { type: 'string', description: 'The spoken narration. 50-65 words. Explains the mechanism through the story lens, builds to the surprise.' },
              metricValue: { type: 'string', description: 'The key number to animate as a counter: "140%", "$4.2 Trillion"' },
              metricLabel: { type: 'string', description: 'What the number means: "Short Interest as % of Float"' },
              metricContext: { type: 'string', description: 'Brief context for the number' },
              surpriseMoment: {
                type: 'object',
                required: ['statement', 'visualCue'],
                properties: {
                  statement: { type: 'string', description: 'The gut-punch revelation. Max 15 words.' },
                  visualCue: { type: 'string', enum: ['counter_spike', 'red_flash', 'glow_pulse', 'zoom_emphasis'] },
                },
              },
              visualDirections: { type: 'string', description: 'Big AnimatedCounter as hero. Then surprise statement SLAMS on screen. Visual cue fires.' },
              pauseMarkers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Explicit [PAUSE Xs] markers and their positions in the narration. E.g., ["before surprise: [PAUSE 1.0s]", "after surprise: [PAUSE 1.0s]"]',
              },
            },
          },
          connection: {
            type: 'object',
            description: 'Act 5: FantasyTrades gameplay connection + takeaway + tease (120-150s)',
            required: ['narration', 'fauxUICard', 'takeaway', 'visualDirections'],
            properties: {
              narration: { type: 'string', description: 'The spoken narration. 55-70 words. Connects to gameplay, delivers takeaway that CALLBACKS to Act 1, teases next concept.' },
              gameMode: { type: 'string', description: 'Primary game mode: "baggerbomb", "snake_draft", etc.' },
              scoringExample: { type: 'string', description: 'Specific scoring scenario from the KB entry game connections' },
              fauxUICard: {
                type: 'object',
                required: ['title', 'ticker', 'value', 'valueColor'],
                properties: {
                  title: { type: 'string' },
                  ticker: { type: 'string' },
                  value: { type: 'string' },
                  valueColor: { type: 'string' },
                },
              },
              takeaway: { type: 'string', description: 'One sentence that references the opening story for narrative closure' },
              nextConceptId: { type: 'string', description: 'ID of the next concept to tease' },
              nextConceptHint: { type: 'string', description: 'Curiosity-building tease for the next video' },
              visualDirections: { type: 'string', description: 'FauxUICard slides in. Takeaway as KeyPhrasePunch. Logo. Fade to black.' },
              pauseMarkers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Explicit [PAUSE Xs] markers and their positions in the narration.',
              },
            },
          },
        },
      },
    },
    required: ['id', 'topic', 'scenes'],
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
    const targetDuration = options.targetDuration || 150;

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
      narrativeSpine: script.narrativeSpine || null,
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
