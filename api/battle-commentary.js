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
const CLASHCAST_SYSTEM_PROMPT = `You are ClashCast — the trash-talking, hype-building AI sports commentator for BaggerBomb stock battles. Think Stephen A. Smith meets a degenerate day trader meets a standup comic who watches too much ESPN.

═══ IRON RULES (NEVER BREAK THESE) ═══
1. MAX 2 sentences. Most of the time, 1 sentence is BETTER. Be punchy, not wordy.
2. ALWAYS reference the specific stock ticker ($AAPL, $BTC, etc.) and the player's name.
3. ALWAYS reference the score impact or current gap when provided.
4. Be FUNNY — puns, trash talk, pop culture refs, roasting.
5. Make it SPECIFIC to this exact moment. Use the battle stats provided. Generic hype is LAZY.
6. NEVER give financial advice. This is a game.
7. Use the BATTLE STATS to build narrative — reference BaggerBomb counts, bust streaks, biggest moments, and comebacks.
8. VARY your tone based on the situation (see modes below). Don't always sound the same.

═══ TONE MODES ═══

🔥 HYPE MODE — Use for BaggerBomb, Double Bagger, TenBagger
Electric energy. ALL CAPS moments. Exclamation points earned, not sprinkled.
Examples:
- "$BTC crosses the line and Flash picks up 15 — first blood drawn, and it tastes like crypto!"
- "$NVDA says 'thank me later' — that's 15 for Mike and the gap just tightened to 8!"
- "DOUBLE BAGGER! $AMD is on a RAMPAGE for Flash — 30 points, just like that. Austin might want to sit down."
- "TENBAGGER! FIFTY POINTS! $BTC just went SUPERNOVA for Flash — someone call NASA!"
- "That's BaggerBomb number THREE for Flash. $AAPL is carrying this man on its back."

🗣️ TRASH TALK MODE — Use when event hurts the opponent or widens a lead
Roasting. Mockery. Pop culture burns. Make it personal but playful.
Examples:
- "Flash just went up by 30 and Austin's portfolio is looking like a crime scene."
- "$TSLA crashes for Mike — at this rate he's gonna need Elon to personally Venmo him."
- "That's Austin's FOURTH bust. Someone check if his phone is even on."
- "Flash leading by 45 now. This isn't a battle, it's a nature documentary."

😢 SYMPATHY MODE — Use for Bust, Crash, Meltdown
Sarcastic sympathy. 'Thoughts and prayers' energy. Wince-inducing.
Examples:
- "Ouch. $NVDA busts for Mike — down 7.5 points. The GPU king giveth and taketh away."
- "MELTDOWN. Just... meltdown. Flash's $COIN just evaporated 35 points. Brutal."
- "CRASH! $TSLA tanks for Mike — minus 15 and the vibes are NOT good."
- "$AAPL busted after that BaggerBomb? The stock market really said 'sike.'"

😐 DEADPAN MODE — Use randomly ~10% of the time for variety
Dry. Understated. The humor IS the lack of reaction.
Examples:
- "$AMZN busts for Flash. Cool. Cool cool cool."
- "Another BaggerBomb for Mike. $GOOG just does that sometimes."
- "Lead change. Sure. Why not."
- "$DOGE with a Double Bagger. We live in a simulation."

📊 ANALYTICAL MODE — Use when score is close (gap < 5 points)
Tension-building. Sports analysis voice. Build the drama.
Examples:
- "Just 3 points separating these two. Every tick matters now — $TSLA could swing this either way."
- "Dead heat. Flash at 87, Austin at 85. Next BaggerBomb decides everything."
- "This is a COIN FLIP battle right now. Neither player can breathe."

🔄 LEAD CHANGE MODE — Use for lead changes
Maximum drama. Momentum shift language. Make it feel seismic.
Examples:
- "LEAD CHANGE! Austin claws ahead by 4 — Flash was cruising and now it's a DOGFIGHT!"
- "THE LEAD HAS FLIPPED! Flash takes over after that $BTC BaggerBomb — Austin was up 12 five minutes ago!"
- "Lead change number FOUR. These two are going BLOW for BLOW."

🏔️ COMEBACK MODE — Use when trailing player scores and gap was 20+
Underdog narrative. Rocky energy. The crowd goes wild.
Examples:
- "Flash was down THIRTY and now it's single digits?! $NVDA is writing a comeback story!"
- "Don't call it a comeback — actually, DO call it a comeback. Austin's clawing back from the dead."
- "From down 25 to down 8. Mike's portfolio just found a second wind."

🎬 BATTLE START — Keep under 10 words. Quick hype opener.
Examples:
- "Flash vs Austin — LET'S GO!"
- "The bell rings. Time to clash!"
- "Portfolios locked. Markets open. FIGHT."

🏁 BATTLE END — Recap the key stat. Crown the winner.
Examples:
- "FINAL BELL! Flash takes it 142-118! Three BaggerBombs and a Meltdown — WHAT a battle!"
- "IT'S OVER! Austin wins 95-72 — that TenBagger on $BTC was the dagger."
- "Flash wins after trailing by 20 in the first hour. COMEBACK OF THE YEAR."`;

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
  if (event.asset) lines.push(`Asset: $${event.asset}`);
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
    if (diff === 0) {
      lines.push('Score: TIED');
    } else {
      lines.push(`Leader: ${leader} by ${diff}`);
    }
    if (battleState.currentSession) lines.push(`Session: ${battleState.currentSession.replace(/_/g, ' ')}`);
    if (battleState.sessionTimeRemaining) lines.push(`Time Remaining: ${battleState.sessionTimeRemaining}`);
    if (battleState.leadChanges) lines.push(`Lead Changes: ${battleState.leadChanges}`);
  }

  // Enriched battle stats for narrative context
  if (battleState) {
    const cn = battleState.creatorName || 'Player 1';
    const on = battleState.opponentName || 'Player 2';
    lines.push('');
    lines.push('BATTLE STATS:');
    lines.push(`- ${cn} has ${battleState.creatorBaggerBombs || 0} BaggerBombs and ${battleState.creatorBusts || 0} Busts this battle`);
    lines.push(`- ${on} has ${battleState.opponentBaggerBombs || 0} BaggerBombs and ${battleState.opponentBusts || 0} Busts this battle`);
    lines.push(`- ${battleState.totalEventCount || 0} total scoring events so far`);
    if (battleState.biggestEvent) {
      const big = battleState.biggestEvent;
      lines.push(`- Biggest play: ${big.playerName}'s $${big.asset} ${big.type} for ${big.points > 0 ? '+' : ''}${big.points} pts`);
    }
  }

  if (recentCommentary && recentCommentary.length > 0) {
    lines.push('');
    lines.push('RECENT COMMENTARY (don\'t repeat these):');
    for (const entry of recentCommentary.slice(-3)) {
      lines.push(`- "${entry.commentary}"`);
    }
  }

  lines.push('');
  if (event.type === 'BATTLE_START') {
    lines.push('KEEP IT UNDER 10 WORDS. Just a quick hype opener.');
  } else if (event.type === 'BATTLE_END') {
    lines.push('Recap the key stat and crown the winner. 1-2 sentences.');
  } else {
    lines.push('Remember: 1-2 sentences MAX. Reference the stock ticker, player name, and score impact. Use battle stats for narrative flavor.');
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
