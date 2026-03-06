/**
 * ClashBot Bug Report Classifier
 *
 * Uses Claude AI to classify and structure bug reports submitted
 * through the ClashBot widget. Returns structured JSON with category,
 * severity, affected component, reproduction steps, and possible cause.
 */

const CLASSIFICATION_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;

const SYSTEM_PROMPT = `You are ClashBot, a bug report classifier for FantasyTrades — a competitive portfolio battle game built with React 18, Firebase, and deployed on Vercel.

SCREENS (route names):
dashboard, builder, battle (classic), draftSetup, draftLobby, draftRoom, draftBattle, baggerBomb, baggerBombTraining, optionsArena, optionsArenaTraining, earningsGame, research, technicalResearch, moneyMap, thesis, profile, settings, tutorial

GAME MODES:
classic, draft, baggerBomb, optionsArena, earningsGame, training

CLASSIFICATION CATEGORIES:
- ui_bug: Visual glitches, layout issues, rendering problems
- data_error: Wrong data displayed, calculation errors, stale data
- crash: App crashes, white screens, unrecoverable errors
- performance: Slow loading, laggy interactions, memory issues
- feature_request: New functionality or improvement suggestions
- ux_confusion: Confusing flows, unclear UI, usability issues

SEVERITY LEVELS:
- critical: App unusable — crashes, data loss, cannot play at all
- major: Feature broken — core functionality fails but workaround exists
- minor: Cosmetic/annoying — feature works but something is off
- cosmetic: Visual only — typo, alignment, color issues

KEY COMPONENTS:
- Dashboard: market overview, portfolio summary, AI market summary
- Builder: portfolio construction for battles
- Battle: classic 1v1 stock battles with 24h scoring
- BaggerBomb: volatility-threshold battles (+15 BaggerBomb / -10 to -35 Bust)
- Draft: 4-player snake draft with multi-day daily scoring
- EarningsGame: tournament predictions on earnings magnitude bands
- OptionsArena: options-based tournament gameplay
- Research: AI-powered research advisor, stock/crypto analysis
- TechnicalResearch: charts, technical indicators, AI analysis
- MoneyMap: visual portfolio/market mapping
- Thesis: investment thesis builder
- Profile/Settings: user profile and app settings
- Tutorial: onboarding flow

DATA SOURCES: EODHD API (stock/crypto prices), Firebase Firestore (game state), Claude AI (advisors, classification)

Analyze the bug report and device context below. Return ONLY valid JSON (no markdown fences, no explanation):
{
  "summary": "Concise 1-sentence summary of the issue",
  "category": "ui_bug|data_error|crash|performance|feature_request|ux_confusion",
  "severity": "critical|major|minor|cosmetic",
  "affectedComponent": "The specific screen or component name from the lists above",
  "reproductionSteps": ["step1", "step2", "step3"],
  "possibleCause": "Brief technical hypothesis based on the architecture"
}`;

/**
 * Classify a bug report using Claude AI.
 *
 * @param {string} userDescription - The user's raw bug description
 * @param {Object} metadata - Auto-captured device/app context
 * @returns {Promise<Object>} Structured classification result
 */
export async function classifyBugReport(userDescription, metadata = {}) {
  const API_KEY = process.env.CLAUDE_API_KEY;

  if (!API_KEY) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  // Build user message with metadata context
  let userMessage = `Bug report:\n"${userDescription}"`;

  if (metadata && Object.keys(metadata).length > 0) {
    const context = {
      screen: metadata.screen || 'unknown',
      gameMode: metadata.gameMode || null,
      battleType: metadata.battleType || null,
      userAgent: metadata.userAgent || null,
      screenSize: metadata.screenWidth && metadata.screenHeight
        ? `${metadata.screenWidth}x${metadata.screenHeight}`
        : null,
      isMobile: metadata.isMobile || false,
      appVersion: metadata.appVersion || 'beta',
      recentErrors: metadata.recentErrors || [],
    };
    userMessage += `\n\nDevice/Context:\n${JSON.stringify(context, null, 2)}`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLASSIFICATION_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await response.json();

  if (data.error || !response.ok) {
    console.error('[BugClassifier] Claude API error:', data.error);
    throw new Error(data.error?.message || `Claude API error: ${response.status}`);
  }

  const text = data.content?.[0]?.text || '';

  // Strip markdown fences if Claude includes them despite instructions
  const cleaned = text.replace(/```json\s?|```/g, '').trim();

  try {
    const classification = JSON.parse(cleaned);

    // Validate required fields
    const requiredFields = ['summary', 'category', 'severity', 'affectedComponent', 'reproductionSteps', 'possibleCause'];
    for (const field of requiredFields) {
      if (classification[field] === undefined || classification[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate enum values
    const validCategories = ['ui_bug', 'data_error', 'crash', 'performance', 'feature_request', 'ux_confusion'];
    if (!validCategories.includes(classification.category)) {
      classification.category = 'ui_bug'; // safe default
    }

    const validSeverities = ['critical', 'major', 'minor', 'cosmetic'];
    if (!validSeverities.includes(classification.severity)) {
      classification.severity = 'minor'; // safe default
    }

    // Ensure reproductionSteps is an array
    if (!Array.isArray(classification.reproductionSteps)) {
      classification.reproductionSteps = [String(classification.reproductionSteps)];
    }

    return classification;
  } catch (parseError) {
    console.error('[BugClassifier] Failed to parse classification:', parseError.message);
    // Return degraded classification rather than failing the whole pipeline
    return {
      summary: userDescription.substring(0, 100),
      category: 'ui_bug',
      severity: 'minor',
      affectedComponent: metadata?.screen || 'unknown',
      reproductionSteps: ['Unable to auto-generate steps'],
      possibleCause: 'Classification parsing failed — manual review needed',
      _parseError: true,
    };
  }
}
