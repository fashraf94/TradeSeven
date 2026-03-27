import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { VALID_ARCHETYPES, getArchetypeConfig } from '../_utils/agentArchetypeConfig.js';

export const config = { maxDuration: 30 };

// Lazy singleton Anthropic client
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return anthropicClient;
}

const AGENT_PROFILE_TOOL = {
  name: 'submit_agent_profile',
  description: 'Submit the derived agent profile based on the user\'s questionnaire answers.',
  input_schema: {
    type: 'object',
    required: ['archetype', 'config', 'personality', 'avatarColors', 'greeting'],
    properties: {
      archetype: {
        type: 'string',
        enum: VALID_ARCHETYPES,
        description: 'The primary archetype derived from the user\'s answers',
      },
      config: {
        type: 'object',
        required: ['risk', 'concentration', 'momentum'],
        properties: {
          risk: { type: 'number', minimum: 0, maximum: 100, description: 'Risk tolerance (0=ultra conservative, 100=maximum risk)' },
          concentration: { type: 'number', minimum: 0, maximum: 100, description: 'Portfolio concentration (0=max diversification, 100=concentrated bets)' },
          momentum: { type: 'number', minimum: 0, maximum: 100, description: 'Momentum sensitivity (0=contrarian, 100=pure momentum chaser)' },
        },
      },
      personality: {
        type: 'object',
        required: ['traits', 'riskPhilosophy', 'coachingStyle'],
        properties: {
          traits: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5, description: '2-5 personality trait phrases (e.g., \'aggressive on momentum\', \'cautious during rotations\')' },
          sectorAffinity: { type: 'array', items: { type: 'string' }, description: 'Sectors the user selected or implied' },
          riskPhilosophy: { type: 'string', description: 'One-sentence summary of risk approach' },
          coachingStyle: { type: 'string', description: 'How the user wants to interact: hands-on, data-driven, trust-the-agent, etc.' },
        },
      },
      avatarColors: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 2,
        description: 'Two hex color codes for the agent avatar gradient. Match the archetype energy.',
      },
      greeting: {
        type: 'string',
        description: 'The agent\'s first words to the user. 1-2 sentences, in character for the derived archetype. Confident but not arrogant.',
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a personality analyst for a competitive stock trading game called BaggerBomb.
A user just answered 5 questions about their trading style. Your job: derive their agent's archetype, personality, and configuration.

ARCHETYPES:
- momentum_chaser: Aggressive, chases trends, high trading frequency, loves breakouts
- analyst: Data-driven, methodical, waits for high-conviction setups, moderate frequency
- diversifier: Balanced across sectors, steady approach, avoids concentration risk
- contrarian: Goes against the crowd, buys dips, inverted momentum signals
- degen: Maximum aggression, concentrated bets, highest frequency, embraces volatility
- guardian: Defensive, capital preservation, lowest frequency, avoids risky setups

Match the archetype to the overall pattern of answers, not just one question.
The config sliders (0-100) should reflect the user's specific intensity within the archetype.
Personality traits should be specific and memorable, not generic.
The greeting should feel natural for the archetype — a momentum_chaser is eager,
a guardian is measured, a degen is cocky, an analyst is precise.
Avatar colors should be two hex codes that match the archetype energy — bold for aggressive types, cool for analytical ones.`;

function sanitize(str, maxLen = 200) {
  if (!str) return '';
  if (typeof str === 'string') return str.slice(0, maxLen).replace(/[<>{}]/g, '');
  if (Array.isArray(str)) return str.map((s) => (typeof s === 'string' ? s.slice(0, 50) : String(s))).join(', ');
  return String(str).slice(0, maxLen);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function buildFallbackProfile(name) {
  const fallback = getArchetypeConfig('analyst');
  return {
    archetype: 'analyst',
    config: { ...fallback.defaultConfig },
    personality: {
      traits: ['methodical', 'data-driven'],
      sectorAffinity: [],
      riskPhilosophy: 'Balanced approach with a focus on high-conviction setups.',
      coachingStyle: 'data-driven',
    },
    avatarColors: [...fallback.avatarColors],
    greeting: `${name || 'Agent'} online. Let's study the market and find our edge.`,
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

  // 4. Validate body
  const { q1, q2, q3, q4, name } = req.body;

  if (!q1 && !q2 && !q4) {
    return res.status(400).json({ error: 'At least q1, q2, and q4 answers are required' });
  }

  const agentName = sanitize(name || 'Agent', 20);
  const answer1 = sanitize(q1);
  const answer2 = sanitize(q2);
  const answer3 = sanitize(q3);
  const answer4 = sanitize(q4);

  // 5. Call Haiku to derive profile
  try {
    const anthropic = getAnthropicClient();

    const userPrompt = `Here are the user's answers:

Q1 (Market drops 3% — gut reaction): ${answer1}
Q2 (Agent lost badly — what to learn): ${answer2}
Q3 (Sector focus): ${answer3}
Q4 (Risk approach): ${answer4}
Agent name: ${agentName}

Use the submit_agent_profile tool to submit the derived profile.`;

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
      return res.status(200).json({ success: true, profile: buildFallbackProfile(agentName), fallback: true });
    }

    const profile = toolUse.input;

    // 6. Validate and sanitize the derived profile
    if (!VALID_ARCHETYPES.includes(profile.archetype)) {
      profile.archetype = 'analyst';
    }

    profile.config = {
      risk: clamp(profile.config?.risk ?? 50, 0, 100),
      concentration: clamp(profile.config?.concentration ?? 50, 0, 100),
      momentum: clamp(profile.config?.momentum ?? 50, 0, 100),
    };

    if (!Array.isArray(profile.avatarColors) || profile.avatarColors.length !== 2) {
      const archetypeDefaults = getArchetypeConfig(profile.archetype);
      profile.avatarColors = [...archetypeDefaults.avatarColors];
    } else {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      if (!hexRegex.test(profile.avatarColors[0]) || !hexRegex.test(profile.avatarColors[1])) {
        const archetypeDefaults = getArchetypeConfig(profile.archetype);
        profile.avatarColors = [...archetypeDefaults.avatarColors];
      }
    }

    if (!profile.personality?.traits || !Array.isArray(profile.personality.traits)) {
      profile.personality = {
        ...profile.personality,
        traits: ['adaptable', 'strategic'],
      };
    }

    if (!profile.greeting || typeof profile.greeting !== 'string') {
      profile.greeting = `${agentName} reporting for duty. Let's make some moves.`;
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error('[create-profile] Error:', error.message);
    return res.status(200).json({ success: true, profile: buildFallbackProfile(agentName), fallback: true });
  }
}
