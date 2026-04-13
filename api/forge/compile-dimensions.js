// api/forge/compile-dimensions.js
//
// Workshop Mode thesis → Strategy Dimension values compiler.
//
// Input: a workshop sessionId. Server re-reads the session's latestThesis
// (ignoring any client-supplied thesis — prevents tampering). Ships the
// thesis + the dimension schema to Haiku as a structured mapping task;
// validates the JSON response against parameter ranges (clamping or
// defaulting bad values); persists the compiled config to
// `workshopTheses/{thesisId}`, flips the session status to 'compiled', and
// returns the dimension values to the client.
//
// The client then opens SeasonEntryModal with `initialDimensionValues`
// pre-filled and `initialStep=1` so the user lands on the sliders.
//
// Guardrails:
//   * Every numeric field is clamped to the schema range on the way out.
//   * Missing fields fall back to the dimension-level defaults.
//   * Wrong types fall back to defaults.
//   * Any field the server had to override is recorded in `appliedClamps`
//     and surfaced to the client as a transparent note.

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logCompilation } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 30 };

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// ==================== DIMENSION SCHEMA ====================
//
// Mirrors src/utils/dimensionMapper.js:DIMENSION_DEFAULTS and the ranges
// declared in src/components/Forge/StrategyDimensions.jsx. Kept as a
// server-local copy so this module can run without pulling React modules.
// Any schema change in dimensionMapper must be reflected here.

const DIMENSION_SCHEMA = {
  riskPosture: {
    description: 'Drawdown tolerance.',
    params: {
      stopLoss: { type: 'number', min: 3, max: 20, default: 8, unit: '%' },
      trailingStop: { type: 'number', min: 3, max: 25, default: 10, unit: '%' },
    },
  },
  entryAggression: {
    description: 'How selective the entry filter is.',
    params: {
      rsiUpper: { type: 'number', min: 50, max: 80, default: 65, unit: 'RSI' },
      volumeConfirm: { type: 'boolean', default: true },
      fundamentalFloor: { type: 'number', min: 20, max: 80, default: 45, unit: 'score' },
    },
  },
  exitDiscipline: {
    description: 'Profit-taking and cut-loss discipline.',
    params: {
      profitTarget: { type: 'number', min: 5, max: 50, default: 15, unit: '%' },
      timeExit: { type: 'number', min: 2, max: 15, default: 5, unit: 'days' },
      technicalExit: { type: 'boolean', default: false },
    },
  },
  sectorStrategy: {
    description: 'Concentration vs diversification posture.',
    params: {
      maxSectorWeight: { type: 'number', min: 15, max: 50, default: 30, unit: '%' },
      sectorDriftTolerance: { type: 'number', min: 5, max: 20, default: 10, unit: '%' },
      rebalanceOnDrift: { type: 'boolean', default: true },
    },
  },
  momentumSensitivity: {
    description: 'Momentum chasing vs contrarian posture.',
    params: {
      momentumThreshold: { type: 'number', min: 0.5, max: 10, default: 2, unit: '%' },
      addToWinners: { type: 'boolean', default: true },
      cutUnderperformers: { type: 'boolean', default: true },
    },
  },
  macroAwareness: {
    description: 'How much macro/calendar events change behavior.',
    params: {
      earningsAvoidance: { type: 'number', min: 0, max: 10, default: 3, unit: 'days' },
      fomcDefensive: { type: 'boolean', default: false },
      benchmarkGapResponse: {
        type: 'enum',
        options: ['off', 'react', 'aggressive'],
        default: 'react',
      },
    },
  },
  positionSizing: {
    description: 'Position sizing and cash-deployment posture.',
    params: {
      maxPosition: { type: 'number', min: 10, max: 30, default: 15, unit: '%' },
      cashDeploymentTrigger: { type: 'number', min: 5, max: 40, default: 15, unit: '%' },
      trimThreshold: { type: 'number', min: 3, max: 20, default: 3, unit: '%' },
    },
  },
};

function buildSchemaDescriptionForPrompt() {
  const lines = [];
  for (const [dimKey, dim] of Object.entries(DIMENSION_SCHEMA)) {
    lines.push(`${dimKey} — ${dim.description}`);
    for (const [paramKey, p] of Object.entries(dim.params)) {
      if (p.type === 'number') {
        lines.push(
          `  ${paramKey}: number in [${p.min}, ${p.max}]${p.unit ? ' (' + p.unit + ')' : ''}, default ${p.default}`
        );
      } else if (p.type === 'boolean') {
        lines.push(`  ${paramKey}: boolean, default ${p.default}`);
      } else if (p.type === 'enum') {
        lines.push(
          `  ${paramKey}: one of [${p.options.map((o) => `"${o}"`).join(', ')}], default "${p.default}"`
        );
      }
    }
  }
  return lines.join('\n');
}

function buildSchemaDefaults() {
  const out = {};
  for (const [dimKey, dim] of Object.entries(DIMENSION_SCHEMA)) {
    out[dimKey] = {};
    for (const [paramKey, p] of Object.entries(dim.params)) {
      out[dimKey][paramKey] = p.default;
    }
  }
  return out;
}

// ==================== VALIDATION ====================

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Walk Haiku's dimensionValues and enforce schema compliance.
 * Returns { sanitized, appliedClamps[] } — sanitized always matches the schema.
 */
function validateAndClamp(raw) {
  const sanitized = buildSchemaDefaults();
  const appliedClamps = [];

  if (!raw || typeof raw !== 'object') {
    appliedClamps.push('No dimensionValues object returned — using full defaults.');
    return { sanitized, appliedClamps };
  }

  for (const [dimKey, dim] of Object.entries(DIMENSION_SCHEMA)) {
    const incoming = raw[dimKey];
    if (!incoming || typeof incoming !== 'object') {
      appliedClamps.push(`${dimKey}: entire dimension missing — defaults applied.`);
      continue;
    }

    for (const [paramKey, p] of Object.entries(dim.params)) {
      const v = incoming[paramKey];

      if (p.type === 'number') {
        if (typeof v !== 'number' || Number.isNaN(v)) {
          appliedClamps.push(`${dimKey}.${paramKey}: not a number — default ${p.default} applied.`);
        } else {
          const clamped = clampNumber(v, p.min, p.max);
          if (clamped !== v) {
            appliedClamps.push(
              `${dimKey}.${paramKey}: ${v} out of [${p.min}, ${p.max}] — clamped to ${clamped}.`
            );
          }
          sanitized[dimKey][paramKey] = clamped;
        }
      } else if (p.type === 'boolean') {
        if (typeof v !== 'boolean') {
          appliedClamps.push(`${dimKey}.${paramKey}: not a boolean — default ${p.default} applied.`);
        } else {
          sanitized[dimKey][paramKey] = v;
        }
      } else if (p.type === 'enum') {
        if (!p.options.includes(v)) {
          appliedClamps.push(
            `${dimKey}.${paramKey}: "${v}" not in [${p.options.join(', ')}] — default "${p.default}" applied.`
          );
        } else {
          sanitized[dimKey][paramKey] = v;
        }
      }
    }
  }

  return { sanitized, appliedClamps };
}

// ==================== HAIKU CLIENT ====================

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

function buildSystemPrompt() {
  return `You are a strategy compiler for FantasyTrades, a skill-based fantasy trading game. The user has developed a trading thesis through conversation with their agent. Your job is to map this thesis to specific parameter values across 7 strategy dimensions.

STRATEGY DIMENSIONS SCHEMA (use EXACTLY these keys and ranges):
${buildSchemaDescriptionForPrompt()}

Rules:
- Choose numeric values that best represent the thesis intent. If the thesis implies "tight stops" pick a low stopLoss; "patient exits" pick a high profitTarget and timeExit; etc.
- For booleans and enums, pick the option that most faithfully represents the user's stated approach.
- If the thesis does not address a dimension, use the listed default.
- All numeric values MUST fall within their stated ranges. Do not invent keys outside the schema.

Output requirements — respond with ONLY a single JSON object, no markdown, no commentary:
{
  "dimensionValues": {
    "riskPosture": { "stopLoss": 8, "trailingStop": 10 },
    "entryAggression": { "rsiUpper": 65, "volumeConfirm": true, "fundamentalFloor": 45 },
    "exitDiscipline": { "profitTarget": 15, "timeExit": 5, "technicalExit": false },
    "sectorStrategy": { "maxSectorWeight": 30, "sectorDriftTolerance": 10, "rebalanceOnDrift": true },
    "momentumSensitivity": { "momentumThreshold": 2, "addToWinners": true, "cutUnderperformers": true },
    "macroAwareness": { "earningsAvoidance": 3, "fomcDefensive": false, "benchmarkGapResponse": "react" },
    "positionSizing": { "maxPosition": 15, "cashDeploymentTrigger": 15, "trimThreshold": 3 }
  },
  "confidence": 0.0-1.0,
  "warnings": ["Short strings flagging gaps between the thesis and the chosen values. Empty array if none."],
  "mappingNotes": ["Short strings explaining key mapping choices. e.g. 'Mapped tight downside protection to 6% stopLoss, 8% trailingStop.'"]
}

Keep the response as compact valid JSON.`;
}

function buildUserMessage(thesis) {
  return `Here is the user's trading thesis to compile:

${JSON.stringify(thesis, null, 2)}

Produce the JSON response now.`;
}

async function callHaikuCompile(thesis) {
  const anthropic = getAnthropicClient();
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(thesis);

  const response = await Promise.race([
    anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Haiku timeout (25s)')), 25000)),
  ]);

  const text = response.content?.find((c) => c.type === 'text')?.text || '';
  return { rawText: text, model: HAIKU_MODEL };
}

function parseHaikuJSON(rawText) {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch { /* fall through */ }

  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch { /* fall through */ }
  }

  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch { /* fall through */ }
  }

  return null;
}

// ==================== HANDLER ====================

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { sessionId } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const db = getFirebaseAdmin();

  try {
    // Load session + re-read thesis (server-authoritative)
    const sessionRef = db.collection('workshopSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return res.status(404).json({ error: 'Workshop session not found' });
    }
    const session = sessionSnap.data();

    if (session.userId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized for this session' });
    }

    if (session.status === 'compiled' && session.compiledThesisId) {
      // Already compiled — return the previously compiled dimensions so the
      // client can proceed. Idempotent for retry.
      const thesisRef = db.collection('workshopTheses').doc(session.compiledThesisId);
      const thesisSnap = await thesisRef.get();
      if (thesisSnap.exists) {
        const t = thesisSnap.data();
        return res.status(200).json({
          thesisId: session.compiledThesisId,
          dimensionValues: t.compiledDimensionValues,
          confidence: t.compileConfidence,
          warnings: t.warnings || [],
          mappingNotes: t.mappingNotes || [],
          appliedClamps: t.appliedClamps || [],
          alreadyCompiled: true,
        });
      }
    }

    const thesis = session.latestThesis;
    if (!thesis || !thesis.summary || !thesis.entryLogic || !thesis.exitLogic || !thesis.riskPosture) {
      return res.status(400).json({
        error: 'thesis_not_ready',
        message:
          'This thesis is missing required fields. Keep chatting with your agent until entry, exit, and risk posture are defined.',
      });
    }

    // Call Haiku
    let haikuResult;
    try {
      haikuResult = await callHaikuCompile(thesis);
    } catch (err) {
      console.error('[compile-dimensions] Haiku call failed:', err.message);
      return res.status(502).json({
        error: 'compile_failed',
        message:
          "The strategy compiler is having trouble. Try again in a moment.",
        canRetry: true,
      });
    }

    const parsed = parseHaikuJSON(haikuResult.rawText);
    if (!parsed || !parsed.dimensionValues) {
      console.error('[compile-dimensions] Haiku returned unparseable JSON:', haikuResult.rawText?.slice(0, 500));
      return res.status(502).json({
        error: 'compile_failed',
        message: 'The compiler returned an unexpected response. Try again.',
        canRetry: true,
      });
    }

    const { sanitized, appliedClamps } = validateAndClamp(parsed.dimensionValues);

    const confidenceRaw = typeof parsed.confidence === 'number' ? parsed.confidence : 0.6;
    const confidence = clampNumber(confidenceRaw, 0, 1);

    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === 'string').slice(0, 8).map((w) => w.slice(0, 300))
      : [];
    const mappingNotes = Array.isArray(parsed.mappingNotes)
      ? parsed.mappingNotes.filter((m) => typeof m === 'string').slice(0, 8).map((m) => m.slice(0, 300))
      : [];

    // Persist compiled thesis
    const thesisRef = db.collection('workshopTheses').doc();
    const nowIso = new Date().toISOString();

    await thesisRef.set({
      sessionId,
      userId: user.uid,
      agentId: session.agentId,
      thesis,
      compiledDimensionValues: sanitized,
      compileConfidence: confidence,
      warnings,
      mappingNotes,
      appliedClamps,
      haikuRawText: haikuResult.rawText.slice(0, 4000), // bound for safety
      haikuModel: haikuResult.model,
      createdAt: nowIso,
    });

    // Flip session to compiled (terminal)
    await sessionRef.update({
      status: 'compiled',
      compiledThesisId: thesisRef.id,
      updatedAt: nowIso,
    });

    // Shadow log (fire-and-forget)
    logCompilation({
      userId: user.uid,
      agentId: session.agentId,
      sessionId,
      thesisId: thesisRef.id,
      thesis,
      compiledDimensionValues: sanitized,
      confidence,
      warnings,
      mappingNotes,
      appliedClamps,
      turnCount: Array.isArray(session.exchanges) ? session.exchanges.length : 0,
    }).catch(() => {});

    return res.status(200).json({
      thesisId: thesisRef.id,
      dimensionValues: sanitized,
      confidence,
      warnings,
      mappingNotes,
      appliedClamps,
      alreadyCompiled: false,
    });
  } catch (error) {
    console.error('[compile-dimensions] Error:', error);
    return res.status(500).json({ error: 'Compiler unavailable. Try again in a moment.' });
  }
}
