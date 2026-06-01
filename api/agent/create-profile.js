import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { VALID_ARCHETYPES, getArchetypeConfig } from '../_utils/agentArchetypeConfig.js';
import { deriveArchetypeFromAnswers } from '../_utils/archetypeDerivation.js';

export const config = { maxDuration: 30 };

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

// Derivation is QUESTION-ONLY (ARCHETYPE_IDENTITY_CONTRACT_V1.md §3): the
// archetype comes from the three temperament answers alone. The user's stock
// picks build the starter watchlist and supply personality.sectorAffinity, but
// they are intentionally NOT sent here and MUST NOT influence the archetype —
// two users with identical holdings can land on different archetypes. The
// avatar color is the user's explicit choice (the color step), so it is not
// derived here either.
const AGENT_PROFILE_TOOL = {
  name: 'submit_agent_profile',
  description: 'Submit the derived agent profile based on the user\'s three temperament answers.',
  input_schema: {
    type: 'object',
    required: ['archetype', 'config', 'personality', 'greeting'],
    properties: {
      archetype: {
        type: 'string',
        enum: VALID_ARCHETYPES,
        description: 'The archetype derived from the three temperament answers (Q1/Q2/Q3 only).',
      },
      config: {
        type: 'object',
        required: ['risk', 'concentration', 'momentum'],
        properties: {
          risk: { type: 'number', minimum: 0, maximum: 100, description: 'Risk tolerance (0=ultra conservative, 100=maximum risk). Reflect Q1.' },
          concentration: { type: 'number', minimum: 0, maximum: 100, description: 'Portfolio concentration (0=max diversification, 100=concentrated bets). Reflect Q3.' },
          momentum: { type: 'number', minimum: 0, maximum: 100, description: 'Momentum sensitivity (0=contrarian, 100=pure momentum chaser). Reflect Q2.' },
        },
      },
      personality: {
        type: 'object',
        required: ['traits', 'riskPhilosophy', 'coachingStyle'],
        properties: {
          traits: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5, description: '2-5 personality trait phrases (e.g., \'buys strength on volume\', \'cuts losers fast\').' },
          riskPhilosophy: { type: 'string', description: 'One-sentence summary of risk approach.' },
          coachingStyle: { type: 'string', description: 'How the user wants to interact: hands-on, data-driven, trust-the-agent, etc.' },
        },
      },
      greeting: {
        type: 'string',
        description: 'The agent\'s first words to the user. 1-2 sentences, in character for the derived archetype. Confident but not arrogant.',
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a personality analyst for a competitive stock trading game.
A user answered THREE temperament questions about how they want their trading agent to behave. Derive the agent's archetype, configuration, and personality FROM THESE THREE ANSWERS ONLY. The user also picked some stocks elsewhere, but those are deliberately NOT given to you and must not influence the archetype.

THE SIX ARCHETYPES:
- momentum_chaser (Trend Follower): Buys strength, not bargains. Piles into clear uptrends on real volume; cuts the moment the trend breaks. Concentrates in what's hot.
- contrarian (Contrarian): Moves against the crowd. Buys beaten-down, out-of-favor names; avoids the obvious winner. Patient.
- analyst (Fundamental Investor): Buys quality businesses — strong balance sheets, real earnings. Slow and deliberate.
- degen (Speculator): Here for the big moves. Chases the widest swings, mostly ignores fundamentals. Explosive upside, hard hits.
- diversifier (Diversifier): Spreads across many sectors so no single bet sinks them. Breadth over depth; rarely a single huge winner.
- guardian (Capital Preserver): First job is not losing money. Moves slowly, trades rarely, leans defensive.

THE THREE QUESTIONS:
- Q1 — Risk posture: aggressive (swing big) / balanced (steady, measured) / protect (avoid big losses).
- Q2 — Buy signal: trending (clearly trending up) / beaten_down (out of favor) / fundamentals (strong company health) / volatile (moves big) / broad_mix (rather own a broad mix).
- Q3 — Concentration: concentrate (go big on a few) / spread (spread wide).

DERIVATION PRECEDENCE (apply in order):
1. If Q1 = protect → guardian. (Protect-first dominates and overrides the buy signal — it's the anchor separating the defensive guardian from the merely-spread diversifier.)
2. Else if Q2 = broad_mix OR Q3 = spread → diversifier.
3. Else route by Q2 buy signal: trending → momentum_chaser, beaten_down → contrarian, fundamentals → analyst, volatile → degen.
4. Q1 (aggressive vs balanced) and Q3 are secondary — use them to set the config sliders' intensity and to resolve contradictory combinations. They do NOT by themselves change the archetype chosen above.

The config sliders (0-100) reflect intensity within the archetype (aggressive pushes risk up; protect pushes it down; concentrate raises concentration; spread lowers it). Personality traits should be specific and memorable, not generic. The greeting should feel natural for the archetype — a Trend Follower is eager, a Capital Preserver is measured, a Speculator is cocky, a Fundamental Investor is precise.`;

function sanitize(str, maxLen = 200) {
  if (!str) return '';
  if (typeof str === 'string') return str.slice(0, maxLen).replace(/[<>{}]/g, '');
  if (Array.isArray(str)) return str.map((s) => (typeof s === 'string' ? s.slice(0, 50) : String(s))).join(', ');
  return String(str).slice(0, maxLen);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

const FALLBACK_GREETINGS = {
  momentum_chaser: "Let's find what's running. Clean uptrend, real volume — that's where I want to be.",
  contrarian: "I'll be looking where the crowd isn't. The names everyone's given up on are where I start.",
  analyst: "Let's study the businesses, not the noise. I buy quality and let it work.",
  degen: "Buckle up. I'm going after the names that actually move.",
  diversifier: "I'll spread us across the board so no single miss can sink the day.",
  guardian: "First job: don't lose it. I'll protect what we've got before reaching for any win.",
};

function buildFallbackProfile(archetype, name) {
  const cfg = getArchetypeConfig(archetype);
  return {
    archetype,
    config: { ...cfg.defaultConfig },
    personality: {
      traits: ['adaptable', 'strategic'],
      riskPhilosophy: 'Trades to its temperament, sized to the moment.',
      coachingStyle: 'balanced',
    },
    greeting: FALLBACK_GREETINGS[archetype] || `${name || 'Agent'} reporting for duty. Let's make some moves.`,
  };
}

export default async function handler(req, res) {
  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Auth
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. Validate body — the three temperament answers are required.
  const { q1, q2, q3, name } = req.body;
  if (!q1 || !q2 || !q3) {
    return res.status(400).json({ error: 'q1 (risk posture), q2 (buy signal), and q3 (concentration) answers are required' });
  }

  const agentName = sanitize(name || 'Agent', 20);
  const answer1 = sanitize(q1);
  const answer2 = sanitize(q2);
  const answer3 = sanitize(q3);
  const fallbackArchetype = deriveArchetypeFromAnswers(answer1, answer2, answer3);

  // 5. Call Haiku to derive profile
  try {
    const anthropic = getAnthropicClient();

    const userPrompt = `Here are the user's three temperament answers:

Q1 (Risk posture): ${answer1}
Q2 (Buy signal): ${answer2}
Q3 (Concentration): ${answer3}
Agent name: ${agentName}

Apply the derivation precedence, then use the submit_agent_profile tool to submit the derived profile. Derive from these three answers only.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [AGENT_PROFILE_TOOL],
      tool_choice: { type: 'tool', name: 'submit_agent_profile' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');

    if (!toolUse?.input) {
      console.error('[create-profile] No tool_use in Haiku response');
      return res.status(200).json({ success: true, profile: buildFallbackProfile(fallbackArchetype, agentName), fallback: true });
    }

    const profile = toolUse.input;

    // 6. Validate and sanitize the derived profile. The archetype must be one
    // of the six; an invalid value falls back to the deterministic mapping
    // (not a blanket 'analyst') so the result still honors the answers.
    if (!VALID_ARCHETYPES.includes(profile.archetype)) {
      profile.archetype = fallbackArchetype;
    }

    profile.config = {
      risk: clamp(profile.config?.risk ?? 50, 0, 100),
      concentration: clamp(profile.config?.concentration ?? 50, 0, 100),
      momentum: clamp(profile.config?.momentum ?? 50, 0, 100),
    };

    if (!profile.personality?.traits || !Array.isArray(profile.personality.traits)) {
      profile.personality = {
        ...profile.personality,
        traits: ['adaptable', 'strategic'],
      };
    }

    if (!profile.greeting || typeof profile.greeting !== 'string') {
      profile.greeting = FALLBACK_GREETINGS[profile.archetype] || `${agentName} reporting for duty. Let's make some moves.`;
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error('[create-profile] Error:', error.message);
    return res.status(200).json({ success: true, profile: buildFallbackProfile(fallbackArchetype, agentName), fallback: true });
  }
}
