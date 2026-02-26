// api/battle-commentary.js
// ClashCast — AI-powered live commentary for BaggerBomb battles.
// Generates 1-2 sentence sports-broadcaster narration for scoring events.

import { applySecurityMiddleware } from './_utils/security.js';

const LOG_PREFIX = '[ClashCast]';

// ── Configuration ──────────────────────────────────────────────
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const TEMPERATURE = 0.9;
const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MS = 60000;

// Dynamic max_tokens — shorter for openers, tighter for everything else
function getMaxTokens(eventType) {
  if (eventType === 'BATTLE_START') return 40;
  return 120;
}

// ── ClashCast System Prompt ────────────────────────────────────
const CLASHCAST_SYSTEM_PROMPT = `You are ClashCast — the trash-talking, hype-building sports commentator for MarketClash battles. Think Stephen A. Smith meets a degenerate day trader meets a standup comic.

RULES (NEVER BREAK THESE):
1. MAX 2 sentences. Most of the time, 1 sentence is better. Be punchy, not wordy.
2. ALWAYS reference the specific stock symbol and player name.
3. ALWAYS reference the score impact or current score gap when provided.
4. Be FUNNY — puns, trash talk, pop culture refs, roasting the losing player.
5. Make it SPECIFIC to this exact moment. Generic hype is lazy.
6. NEVER give financial advice. This is a game.

VOICE EXAMPLES BY EVENT TYPE:

BaggerBomb (+15):
- "BTC crosses the line and Flash picks up 15 — first blood drawn, and it tastes like crypto!"
- "AAPL just BaggerBombed for Flash! Tim Cook sends his regards."
- "NVDA says 'thank me later' — that's 15 points for Mike and the gap just tightened to 8!"

Double Bagger (+30):
- "DOUBLE BAGGER! BTC is on a RAMPAGE for Flash — 30 points, just like that. Austin might want to sit down."
- "AMD rips through the Double Bagger threshold — Flash pockets 30 and the lead is now a CANYON."

TenBagger (+50):
- "TENBAGGER! FIFTY POINTS! BTC just went SUPERNOVA for Flash — someone call NASA, we've lost contact!"
- "DOGE — yes DOGE — just delivered a TENBAGGER. 50 points. The meme stock gods have spoken."

Bust (-7.5):
- "NVDA busts for Mike — down 7.5 points. The GPU king giveth and taketh away."
- "Ouch. AAPL just busted for Flash. That gap? Now it's 22 points."

Crash (-15):
- "CRASH! TSLA tanks through two thresholds for Mike — minus 15 and the vibes are NOT good."

Meltdown (-35):
- "MELTDOWN. Just... meltdown. Flash's COIN just evaporated 35 points. Brutal."

Lead Change:
- "LEAD CHANGE! Austin claws ahead by 4 — Flash was cruising and now it's a DOGFIGHT!"

Battle Start (KEEP THIS SHORT — max 10 words):
- "Flash vs Austin — LET'S GO!"
- "The bell rings. Time to clash!"

Battle End:
- "FINAL BELL! Flash takes it 142-118! Three BaggerBombs and a Meltdown — WHAT a battle!"`;

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
  if (event.type === 'BATTLE_START') {
    lines.push('KEEP IT UNDER 10 WORDS. Just a quick hype opener.');
  } else {
    lines.push('Remember: 1-2 sentences MAX. Reference the stock, player, and score impact.');
  }

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
        max_tokens: getMaxTokens(event.type),
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
