// api/battle-commentary.js
// ClashCast — AI-powered live commentary for BaggerBomb battles.
// Generates 1-2 sentence sports-broadcaster narration for scoring events.

import { applySecurityMiddleware } from './_utils/security.js';

const LOG_PREFIX = '[ClashCast]';

// ── Configuration ──────────────────────────────────────────────
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MAX_TOKENS = 150;
const TEMPERATURE = 0.9;
const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MS = 60000;

// ── ClashCast System Prompt ────────────────────────────────────
const CLASHCAST_SYSTEM_PROMPT = `You are ClashCast, the official live commentator for MarketClash BaggerBomb battles. You narrate battles like a high-energy sports broadcaster calling a championship game, but with stock market and trading language woven in.

VOICE RULES:
- Sound like an ESPN anchor who moonlights as a Wall Street trader
- Use dramatic sports language: "DETONATED", "SURGES", "DEVASTATING", "CLUTCH"
- Mix in market slang naturally: "bulls", "bears", "ripping", "tanking", "moonshot"
- Reference the battle context (session name, score gap, momentum)
- Build narrative tension — acknowledge what happened before and tease what's coming
- Be slightly partial to dramatic comebacks and underdog moments
- NEVER give financial advice or opinions on whether stocks are good/bad investments
- Keep it FUN — this is a game, not a trading floor

FORMAT RULES:
- Respond with ONLY 1-2 sentences of commentary. Never more.
- No preamble, no "Here's my commentary:", just the raw broadcast line
- Use ALL CAPS sparingly for emphasis on key moments (stock symbols, event names)
- Include the occasional exclamation for big moments
- Vary your sentence structure — don't start every line the same way

TONE BY EVENT TYPE:
- BaggerBomb/Double Bagger/TenBagger: EXPLOSIVE excitement, celebrate the player
- Bust/Crash/Meltdown: Dramatic tension, sympathize briefly then pivot to "what this means for the battle"
- Lead Change: Peak energy, this is THE moment
- Session Transition: Analytical/anticipatory, set the stage for what's next
- Comeback: Building excitement, underdog narrative
- Substitution: Strategic analysis tone, like a coaching decision
- Battle Start: Set the stage, build anticipation
- Battle End: Grand finale energy, crown the winner dramatically`;

// ── Fallback Templates ─────────────────────────────────────────
const FALLBACK_TEMPLATES = {
  BAGGERBOMB: (e) => `${e.playerName}'s ${e.asset} just detonated a BaggerBomb! +${e.pointsAwarded} points!`,
  DOUBLE_BAGGER: (e) => `DOUBLE BAGGER! ${e.playerName}'s ${e.asset} is absolutely ripping! +${e.pointsAwarded}!`,
  TENBAGGER: (e) => `TENBAGGER ALERT! ${e.playerName}'s ${e.asset} has gone NUCLEAR! +${e.pointsAwarded}!`,
  BUST: (e) => `${e.playerName}'s ${e.asset} just busted through the floor. -${Math.abs(e.pointsAwarded || 7.5)} points.`,
  CRASH: (e) => `CRASH! ${e.playerName}'s ${e.asset} is in freefall! -${Math.abs(e.pointsAwarded || 15)} points!`,
  MELTDOWN: (e) => `MELTDOWN on ${e.playerName}'s ${e.asset}! Devastating — -${Math.abs(e.pointsAwarded || 35)} points!`,
  LEAD_CHANGE: (e) => `LEAD CHANGE! ${e.playerName} takes the lead!`,
  SESSION_TRANSITION: (e) => `The ${(e.newSession || 'next').replace(/_/g, ' ')} session is now underway!`,
  COMEBACK: (e) => `${e.playerName} is mounting a comeback! The gap is closing!`,
  SUBSTITUTION: (e) => `Strategic move — ${e.playerName} swaps out ${e.removedAsset || 'a stock'} and brings ${e.asset || 'a new pick'} off the bench!`,
  BATTLE_START: () => `The battle is LIVE! Let's see who brought the better portfolio today!`,
  BATTLE_END: (e) => `THAT'S THE FINAL BELL! ${e.playerName ? `${e.playerName} takes the win!` : 'What a battle!'}`,
};

function getFallbackCommentary(event) {
  const templateFn = FALLBACK_TEMPLATES[event?.type];
  if (templateFn) return templateFn(event);
  return 'Something just happened in this battle!';
}

// ── Build User Message ─────────────────────────────────────────
function buildUserMessage(event, battleState, recentCommentary) {
  const lines = [];

  lines.push('=== BATTLE EVENT ===');
  lines.push(`Event: ${event.type}`);
  if (event.asset) lines.push(`Asset: ${event.asset}`);
  if (event.playerName) lines.push(`Player: ${event.playerName}`);
  if (event.opponentName) lines.push(`Opponent: ${event.opponentName}`);
  if (event.pointsAwarded != null) lines.push(`Points: ${event.pointsAwarded > 0 ? '+' : ''}${event.pointsAwarded}`);
  if (event.assetMove) lines.push(`Move: ${event.assetMove}`);
  if (event.threshold) lines.push(`Threshold: ${event.threshold}`);
  if (event.tier) lines.push(`Tier: ${event.tier}`);

  lines.push('');
  lines.push('=== BATTLE STATE ===');
  if (battleState) {
    const { creatorName, opponentName, creatorScore, opponentScore } = battleState;
    lines.push(`${creatorName || 'Player 1'}: ${creatorScore ?? 0} pts`);
    lines.push(`${opponentName || 'Player 2'}: ${opponentScore ?? 0} pts`);
    const diff = Math.abs((creatorScore || 0) - (opponentScore || 0));
    const leader = (creatorScore || 0) > (opponentScore || 0) ? creatorName : opponentName;
    lines.push(`Leader: ${leader || 'Tied'} by ${diff}`);
    if (battleState.currentSession) lines.push(`Session: ${battleState.currentSession.replace(/_/g, ' ')}`);
    if (battleState.sessionTimeRemaining) lines.push(`Time Remaining: ${battleState.sessionTimeRemaining}`);
    if (battleState.leadChanges) lines.push(`Lead Changes: ${battleState.leadChanges}`);
  }

  if (recentCommentary && recentCommentary.length > 0) {
    lines.push('');
    lines.push('=== RECENT COMMENTARY (for narrative continuity) ===');
    for (const entry of recentCommentary.slice(-3)) {
      lines.push(`- [${entry.type}${entry.asset ? ` ${entry.asset}` : ''}] "${entry.commentary}"`);
    }
  }

  lines.push('');
  lines.push('Generate your 1-2 sentence commentary for this event now.');

  return lines.join('\n');
}

// ── Handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const API_KEY = process.env.CLAUDE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  const { event, battleState, recentCommentary } = req.body || {};

  if (!event || !event.type) {
    return res.status(400).json({ success: false, error: 'Missing required field: event.type' });
  }

  try {
    const userMessage = buildUserMessage(event, battleState, recentCommentary);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: CLASHCAST_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error(`${LOG_PREFIX} API error:`, data.error);
      // Return fallback commentary so client always gets text
      return res.status(200).json({
        success: true,
        commentary: getFallbackCommentary(event),
        fallback: true,
        timestamp: new Date().toISOString(),
      });
    }

    const commentary = data.content?.[0]?.text?.trim() || getFallbackCommentary(event);

    return res.status(200).json({
      success: true,
      commentary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
    return res.status(200).json({
      success: true,
      commentary: getFallbackCommentary(event),
      fallback: true,
      timestamp: new Date().toISOString(),
    });
  }
}
