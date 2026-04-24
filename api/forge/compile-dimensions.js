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
// Mirrors src/utils/dimensionMapper.js:DIMENSION_DEFAULTS (new-shape keys)
// and the ranges declared in spec Section 3.1. Kept as a server-local copy
// so this module can run without pulling React modules. Any schema change
// in dimensionMapper must be reflected here.
//
// Phase 2 (Forge Expansion Sprint v3): expanded to carry the full rule
// palette — per-param `rule` annotation, `enumNumber` / `stringArray` types,
// and `requires` gating for conditional sub-params (sx-05 trigger branches,
// sx-06 gating, se-09 mode branching, etc.).

const DURATION_OPTIONS = [5, 10, 15, 20];
const DEFAULT_DURATION = 20;

const SECTOR_UNIVERSE = [
  'Technology', 'Healthcare', 'Financials', 'Energy',
  'Consumer Discretionary', 'Consumer Staples', 'Industrials',
  'Materials', 'Utilities', 'Real Estate', 'Communication Services',
];

const DIMENSION_SCHEMA = {
  riskPosture: {
    description: 'Drawdown tolerance.',
    params: {
      stopLossPct:     { rule: 'sx-01', type: 'number', min: 3, max: 20, default: 8,  unit: '%' },
      trailingStopPct: { rule: 'sx-02', type: 'number', min: 3, max: 25, default: 10, unit: '%' },
    },
  },
  entryAggression: {
    description: 'How selective the entry filter is.',
    params: {
      rsiCeiling:              { rule: 'se-01', type: 'integer', min: 50, max: 80, default: 65, unit: 'RSI' },
      volumeConfirmEnabled:    { rule: 'se-02', type: 'boolean', default: true },
      volumeMultiplier:        { rule: 'se-02', type: 'enumNumber', options: [1.2, 1.5, 2.0, 3.0], default: 1.5, unit: 'x', requires: { volumeConfirmEnabled: true } },
      trendAlignmentEnabled:   { rule: 'se-03', type: 'boolean', default: false },
      trendAlignmentSmaPeriod: { rule: 'se-03', type: 'enumNumber', options: [20, 50, 100, 200], default: 50, unit: 'days', requires: { trendAlignmentEnabled: true } },
      fundamentalFloor:        { rule: 'se-05', type: 'integer', min: 20, max: 80, default: 45, unit: 'score' },
      momentumThresholdPct:    { rule: 'se-06', type: 'number', min: 0.5, max: 10, default: 2, unit: '%' },
      momentumLookbackDays:    { rule: 'se-06', type: 'enumNumber', options: [5, 10, 20], default: 10, unit: 'days' },
      institutionalEnabled:    { rule: 'se-08', type: 'boolean', default: false },
      institutionalDirection:  { rule: 'se-08', type: 'enum', stringOptions: ['any', 'increased', 'stable_or_increased'], default: 'increased', requires: { institutionalEnabled: true } },
      institutionalQuarters:   { rule: 'se-08', type: 'enumNumber', options: [1, 2, 4], default: 2, unit: 'Q', requires: { institutionalEnabled: true } },
    },
  },
  exitDiscipline: {
    description: 'Profit-taking and cut-loss discipline.',
    params: {
      profitTargetPct:              { rule: 'sx-04', type: 'number', min: 5, max: 50, default: 15, unit: '%' },
      timeExitDays:                 { rule: 'sx-03', type: 'integer', min: 2, max: 15, default: 5, unit: 'days' },
      timeExitMinGainPct:           { rule: 'sx-03', type: 'enumNumber', options: [0, 1, 3, 5], default: 1, unit: '%' },
      technicalExitEnabled:         { rule: 'sx-05', type: 'boolean', default: false },
      technicalExitTrigger:         { rule: 'sx-05', type: 'enum', stringOptions: ['rsi_overbought', 'macd_bearish', 'either_rsi_or_macd', 'below_sma'], default: 'rsi_overbought', requires: { technicalExitEnabled: true } },
      technicalExitRsiThreshold:    { rule: 'sx-05', type: 'enumNumber', options: [65, 70, 75, 80, 85], default: 75, unit: 'RSI', requires: { technicalExitEnabled: true, technicalExitTrigger: ['rsi_overbought', 'either_rsi_or_macd'] } },
      technicalExitSmaPeriod:       { rule: 'sx-05', type: 'enumNumber', options: [20, 50, 100, 200], default: 50, unit: 'days', requires: { technicalExitEnabled: true, technicalExitTrigger: 'below_sma' } },
      earningsExitEnabled:          { rule: 'sx-06', type: 'boolean', default: false },
      earningsExitDays:             { rule: 'sx-06', type: 'enumNumber', options: [1, 2, 3, 5], default: 2, unit: 'days', requires: { earningsExitEnabled: true } },
      earningsExitOnlyIfProfitable: { rule: 'sx-06', type: 'boolean', default: true, requires: { earningsExitEnabled: true } },
    },
  },
  sectorStrategy: {
    description: 'Concentration vs diversification posture + sector universe filter.',
    params: {
      maxSectorWeightPct:      { rule: 'se-07', type: 'integer', min: 15, max: 50, default: 30, unit: '%' },
      sectorDriftTolerancePct: { rule: 'sr-03', type: 'integer', min: 5, max: 20, default: 10, unit: '%' },
      rebalanceOnDrift:        { rule: 'sr-03', type: 'boolean', default: true },
      sectorFilterEnabled:     { rule: 'se-09', type: 'boolean', default: false },
      sectorFilterMode:        { rule: 'se-09', type: 'enum', stringOptions: ['top_n', 'specific_sectors'], default: 'top_n', requires: { sectorFilterEnabled: true } },
      sectorFilterTimeframe:   { rule: 'se-09', type: 'enum', stringOptions: ['1D', '1W', '1M'], default: '1W', requires: { sectorFilterEnabled: true, sectorFilterMode: 'top_n' } },
      sectorFilterTopN:        { rule: 'se-09', type: 'enumNumber', options: [1, 2, 3, 5], default: 3, requires: { sectorFilterEnabled: true, sectorFilterMode: 'top_n' } },
      sectorFilterSelected:    { rule: 'se-09', type: 'stringArray', itemOptions: SECTOR_UNIVERSE, minItems: 1, maxItems: 5, default: [], requires: { sectorFilterEnabled: true, sectorFilterMode: 'specific_sectors' } },
    },
  },
  momentumSensitivity: {
    description: 'Vestigial — momentum posture. Retained for radar-chart continuity (spec §4.5).',
    params: {
      momentumThresholdPct: { rule: 'se-06', type: 'number', min: 0.5, max: 10, default: 2, unit: '%' },
    },
  },
  eventRisk: {
    description: 'Event-driven entry blocking (earnings). Renamed from macroAwareness (spec §4.6).',
    params: {
      earningsAvoidanceDays: { rule: 'se-04', type: 'integer', min: 0, max: 10, default: 3, unit: 'days' },
    },
  },
  positionSizing: {
    description: 'Position sizing, cash deployment, active management, and correlation discipline.',
    params: {
      maxPositionWeightPct:           { rule: 'sr-01', type: 'integer', min: 10, max: 30, default: 15, unit: '%' },
      cashDeploymentTriggerPct:       { rule: 'sr-02', type: 'integer', min: 5, max: 40, default: 15, unit: '%' },
      addToWinnersEnabled:            { rule: 'sr-04', type: 'boolean', default: false },
      winnerReturnTrigger:            { rule: 'sr-04', type: 'enumNumber', options: [5, 10, 15, 20], default: 10, unit: '%', requires: { addToWinnersEnabled: true } },
      winnerAddWeight:                { rule: 'sr-04', type: 'enumNumber', options: [1, 2, 3, 5], default: 2, unit: '%', requires: { addToWinnersEnabled: true } },
      cutUnderperformersEnabled:      { rule: 'sr-05', type: 'boolean', default: false },
      loserUnderperformanceTrigger:   { rule: 'sr-05', type: 'enumNumber', options: [3, 5, 8, 10], default: 5, unit: '%', requires: { cutUnderperformersEnabled: true } },
      loserLookbackDays:              { rule: 'sr-05', type: 'enumNumber', options: [3, 5, 10, 15], default: 5, unit: 'days', requires: { cutUnderperformersEnabled: true } },
      loserReduceWeight:              { rule: 'sr-05', type: 'enumNumber', options: [1, 2, 3, 5], default: 3, unit: '%', requires: { cutUnderperformersEnabled: true } },
      correlationExitEnabled:         { rule: 'sx-07', type: 'boolean', default: false },
      correlationThreshold:           { rule: 'sx-07', type: 'enumNumber', options: [0.7, 0.8, 0.9], default: 0.8, requires: { correlationExitEnabled: true } },
      correlationLookbackDays:        { rule: 'sx-07', type: 'enumNumber', options: [20, 30, 60, 90], default: 30, unit: 'days', requires: { correlationExitEnabled: true } },
    },
  },
};

function formatParamConstraints(p) {
  if (p.type === 'number' || p.type === 'integer') {
    return `${p.type} in [${p.min}, ${p.max}]${p.unit ? ' (' + p.unit + ')' : ''}, default ${p.default}`;
  }
  if (p.type === 'boolean') {
    return `boolean, default ${p.default}`;
  }
  if (p.type === 'enum') {
    return `one of [${p.stringOptions.map((o) => `"${o}"`).join(', ')}], default "${p.default}"`;
  }
  if (p.type === 'enumNumber') {
    return `one of [${p.options.join(', ')}]${p.unit ? ' (' + p.unit + ')' : ''}, default ${p.default}`;
  }
  if (p.type === 'stringArray') {
    const examples = p.itemOptions.slice(0, 3).map((s) => `"${s}"`).join(', ');
    return `array of ${p.minItems}-${p.maxItems} strings from the 11-sector universe (e.g. [${examples}, ...])`;
  }
  return '';
}

function formatRequires(req) {
  if (!req) return '';
  const parts = Object.entries(req).map(([k, v]) => {
    const arr = Array.isArray(v) ? v : [v];
    const values = arr.map((x) => (typeof x === 'string' ? `"${x}"` : String(x))).join(' | ');
    return `${k}=${values}`;
  });
  return ` — only when ${parts.join(', ')}`;
}

function buildRulePaletteSection() {
  const lines = [];
  for (const [dimKey, dim] of Object.entries(DIMENSION_SCHEMA)) {
    lines.push(`${dimKey} — ${dim.description}`);
    for (const [paramKey, p] of Object.entries(dim.params)) {
      const prefix = p.rule ? `(${p.rule}) ` : '';
      lines.push(`  ${prefix}${paramKey}: ${formatParamConstraints(p)}${formatRequires(p.requires)}`);
    }
  }
  return lines.join('\n');
}

export function buildSchemaDefaults() {
  const out = {};
  for (const [dimKey, dim] of Object.entries(DIMENSION_SCHEMA)) {
    out[dimKey] = {};
    for (const [paramKey, p] of Object.entries(dim.params)) {
      out[dimKey][paramKey] = Array.isArray(p.default) ? [...p.default] : p.default;
    }
  }
  return out;
}

function buildOutputSchemaExample() {
  return JSON.stringify(buildSchemaDefaults(), null, 2);
}

// ==================== VALIDATION ====================

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nearestAllowed(value, options) {
  return options.reduce(
    (best, opt) => (Math.abs(opt - value) < Math.abs(best - value) ? opt : best),
    options[0]
  );
}

// Evaluate a param's `requires` clause against ALREADY-sanitized sibling
// values. Single value and array-of-allowed are both supported, so both
// string enums (technicalExitTrigger === 'below_sma') and boolean gates
// (earningsExitEnabled === true) fall through the same resolver.
function requirementsMet(requires, sanitizedDim) {
  if (!requires) return true;
  for (const [siblingKey, expected] of Object.entries(requires)) {
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(sanitizedDim[siblingKey])) return false;
  }
  return true;
}

function sanitizeParam(p, incoming, dimKey, paramKey, appliedClamps) {
  // number / integer
  if (p.type === 'number' || p.type === 'integer') {
    if (typeof incoming !== 'number' || Number.isNaN(incoming)) {
      appliedClamps.push(`${dimKey}.${paramKey}: not a number — default ${p.default} applied.`);
      return p.default;
    }
    let v = clampNumber(incoming, p.min, p.max);
    if (p.type === 'integer') v = Math.round(v);
    if (v !== incoming) {
      appliedClamps.push(
        `${dimKey}.${paramKey}: ${incoming} out of [${p.min}, ${p.max}] — clamped to ${v}.`
      );
    }
    return v;
  }

  // boolean
  if (p.type === 'boolean') {
    if (typeof incoming !== 'boolean') {
      appliedClamps.push(`${dimKey}.${paramKey}: not a boolean — default ${p.default} applied.`);
      return p.default;
    }
    return incoming;
  }

  // string enum
  if (p.type === 'enum') {
    if (!p.stringOptions.includes(incoming)) {
      appliedClamps.push(
        `${dimKey}.${paramKey}: "${incoming}" not in [${p.stringOptions.join(', ')}] — default "${p.default}" applied.`
      );
      return p.default;
    }
    return incoming;
  }

  // numeric enum — coerce "1.5" → 1.5, exact-match first, nearest on miss
  if (p.type === 'enumNumber') {
    const num = typeof incoming === 'number' ? incoming : Number(incoming);
    if (!Number.isFinite(num)) {
      appliedClamps.push(`${dimKey}.${paramKey}: not a number — default ${p.default} applied.`);
      return p.default;
    }
    if (p.options.includes(num)) return num;
    const nearest = nearestAllowed(num, p.options);
    appliedClamps.push(
      `${dimKey}.${paramKey}: ${num} not in [${p.options.join(', ')}] — snapped to ${nearest}.`
    );
    return nearest;
  }

  // string array (se-09 sectorFilterSelected)
  if (p.type === 'stringArray') {
    if (!Array.isArray(incoming)) {
      appliedClamps.push(`${dimKey}.${paramKey}: not an array — default [] applied.`);
      return [];
    }
    const cleaned = incoming.filter((s) => typeof s === 'string' && p.itemOptions.includes(s));
    const rejected = incoming.filter((s) => !(typeof s === 'string' && p.itemOptions.includes(s)));
    if (rejected.length > 0) {
      appliedClamps.push(
        `${dimKey}.${paramKey}: rejected ${rejected.length} item(s) not in the 11-sector universe.`
      );
    }
    // Per Phase 2 clarification: when result is below minItems, sanitize to
    // [] and surface in appliedClamps. Do NOT force the rule off — let the
    // SE-09 evaluator's existing "no sectors selected" fail-closed behavior
    // handle user error, and let the transparency panel surface the clamp.
    if (cleaned.length < (p.minItems ?? 0)) {
      appliedClamps.push(
        `${dimKey}.${paramKey}: no valid sectors remained after filtering (min ${p.minItems}) — empty list will fail SE-09 at evaluation.`
      );
      return [];
    }
    if (cleaned.length > (p.maxItems ?? Infinity)) {
      const trimmed = cleaned.slice(0, p.maxItems);
      appliedClamps.push(
        `${dimKey}.${paramKey}: ${cleaned.length} items exceeds max ${p.maxItems} — trimmed to first ${p.maxItems}.`
      );
      return trimmed;
    }
    return cleaned;
  }

  return p.default;
}

/**
 * Walk Haiku's dimensionValues and enforce schema compliance.
 * Returns { sanitized, appliedClamps[] } — sanitized always matches the schema.
 *
 * Two-pass per dimension: first sanitize gate-defining params (those that
 * appear in another param's `requires` clause), then sanitize gated params.
 * This avoids false-zero on a legitimate sub-param when the gate happens to
 * sit later in iteration order.
 */
export function validateAndClamp(raw) {
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

    // Pass 1: identify gate-defining params (referenced by any sibling's
    // `requires`) and sanitize them first. Non-gate params that have no
    // `requires` clause are also safe to sanitize here — they don't depend
    // on any gate.
    const paramEntries = Object.entries(dim.params);
    const gateKeys = new Set();
    for (const [, p] of paramEntries) {
      if (p.requires) Object.keys(p.requires).forEach((k) => gateKeys.add(k));
    }

    const pass1 = paramEntries.filter(([key, p]) => gateKeys.has(key) || !p.requires);
    const pass2 = paramEntries.filter(([key, p]) => !gateKeys.has(key) && p.requires);

    for (const [paramKey, p] of pass1) {
      sanitized[dimKey][paramKey] = sanitizeParam(p, incoming[paramKey], dimKey, paramKey, appliedClamps);
    }

    // Pass 2: gated params. If gate unmet, force default WITHOUT logging a
    // clamp (the field is meaningless when the gate is off).
    for (const [paramKey, p] of pass2) {
      if (!requirementsMet(p.requires, sanitized[dimKey])) {
        sanitized[dimKey][paramKey] = Array.isArray(p.default) ? [...p.default] : p.default;
        continue;
      }
      sanitized[dimKey][paramKey] = sanitizeParam(p, incoming[paramKey], dimKey, paramKey, appliedClamps);
    }
  }

  return { sanitized, appliedClamps };
}

export function validateRecommendedDuration(raw, appliedClamps) {
  if (raw === null || raw === undefined) return null;
  if (DURATION_OPTIONS.includes(raw)) return raw;
  appliedClamps.push(
    `recommendedDurationDays: ${JSON.stringify(raw)} not in [${DURATION_OPTIONS.join(', ')}] — ignored.`
  );
  return null;
}

/**
 * Phase 5.5 — enforce Gemma's duration recommendation as authoritative.
 *
 * When the input thesis carries a valid `recommendedDurationDays` (5/10/15/20),
 * it represents the Workshop conversation's recommendation — collaboratively
 * established with the user. Haiku is instructed (SYSTEM_INSTRUCTIONS item 5)
 * to echo that value in its output; this helper is the server-side backstop
 * when the model ignores or contradicts the instruction.
 *
 * `mappingNotes` surfaces the override only when Haiku emitted a *different
 * valid* duration. Silent restore when Haiku punted with null — the common
 * post-prompt-change case, not worth cluttering the transparency panel.
 *
 * @param {*} thesisRecommended - `thesis.recommendedDurationDays` from the
 *   Workshop conversation state. Any non-enum value is treated as absent.
 * @param {number|null} haikuRecommended - already normalized by
 *   validateRecommendedDuration (null when Haiku output was null/invalid).
 * @param {string[]} mappingNotes - mutable accumulator. Only appended to
 *   when a visible override occurred.
 * @returns {number|null} the duration the client should see.
 */
export function applyDurationAuthority(thesisRecommended, haikuRecommended, mappingNotes) {
  const gemmaHadOpinion = DURATION_OPTIONS.includes(thesisRecommended);
  if (!gemmaHadOpinion) return haikuRecommended;

  if (haikuRecommended !== null && haikuRecommended !== thesisRecommended) {
    // Haiku emitted a different valid duration — user-visible override.
    mappingNotes.push(
      `Preserved Workshop duration recommendation (${thesisRecommended} days); compile model suggested ${haikuRecommended} days.`
    );
  }
  // Silent restore when Haiku null or already agreed.
  return thesisRecommended;
}

// ==================== HAIKU CLIENT ====================

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

const DURATION_GUIDANCE = `Duration-rule fit guidance:
- Short durations (5-10 trading days): favor catalyst-driven rules and tight time exits. Earnings exits become relevant (any earnings within the window are nearly guaranteed events). Trend alignment with long SMAs (100, 200) is nonsensical — prefer 20 or 50. Profit targets default lower; 15% in 5 days is aggressive. For sector_momentum_filter top_n mode, bias timeframe to 1W.
- Medium durations (15 trading days): balanced posture. Moderate trend filters (SMA 50 is a good default), moderate time exits, moderate profit targets. Either 1W or 1M sector timeframe is reasonable.
- Long durations (20 trading days): favor trend alignment (SMA 50 or 100), patient exits, fundamental floors, and sector rotation themes. Sector timeframe biases toward 1M.`;

const SYSTEM_INSTRUCTIONS = `Instructions:
1. Map every concrete claim in the thesis to one or more rules and parameters.
2. For any claim you cannot map to an available rule, add a short description to \`warnings\`. Example: "User requested VWAP-based entry; no rule supports this."
3. For any rule you enabled with a non-default parameter, add a brief note to \`mappingNotes\`. Example: "Mapped 'tight stops' to 5% stopLossPct."
4. For any parameter the user requested that falls outside the valid range, clamp to the nearest valid value and describe in \`appliedClamps\`. Example: "User requested 1% stop; clamped to 3% minimum."
5. recommendedDurationDays handling — IMPORTANT:
   - If the input thesis contains a \`recommendedDurationDays\` field with a value of 5, 10, 15, or 20, your output MUST set \`recommendedDurationDays\` to the same value. This represents a Workshop conversation's recommendation established collaboratively with the user — overriding it breaks trust.
   - If the input thesis's \`recommendedDurationDays\` is null, absent, or any other value (invalid): assess the thesis yourself and emit your best recommendation (5, 10, 15, or 20), or null if the thesis is genuinely timeframe-agnostic.
6. Sector momentum mapping: if the user mentions "top sectors", sector rotation, or timeframe-specific sector strength — enable sectorFilterEnabled with sectorFilterMode "top_n" and pick a sensible timeframe/topN. If the user names specific sectors explicitly — use "specific_sectors" mode with those sector names from the 11-sector universe.
7. \`confidence\` is your self-assessment of how cleanly the thesis mapped. 0.9+ for clean mappings, 0.5-0.75 for moderate ambiguity, below 0.5 when the thesis has significant unmappable content.
8. Output ONLY valid JSON matching the schema — no markdown, no commentary, no leading/trailing prose.`;

export function buildSystemPrompt(userSelectedDurationDays) {
  const weeks = userSelectedDurationDays / 5;
  return `You are a strategy compiler for FantasyTrades, a skill-based fantasy trading game. The user developed a trading thesis through conversation with their agent. Your job is to map this thesis to specific parameter values across the expanded strategy dimension schema below.

[CONTEXT]
Selected backtest duration: ${userSelectedDurationDays} trading days (${weeks} week${weeks === 1 ? '' : 's'}).

${DURATION_GUIDANCE}

[AVAILABLE RULE PALETTE]
Use EXACTLY these keys and constraints. Rule IDs are annotated in parentheses. Params marked "only when ..." should only be populated when the gating condition is met; when the gate is off, you may omit the param or emit the default.

${buildRulePaletteSection()}

Sector universe (for sectorFilterSelected): ${SECTOR_UNIVERSE.map((s) => `"${s}"`).join(', ')}.

[OUTPUT SCHEMA]
Produce a single JSON object with this exact shape (defaults shown for reference — replace with thesis-driven values):

{
  "dimensionValues": ${buildOutputSchemaExample()},
  "recommendedDurationDays": null,
  "confidence": 0.0,
  "warnings": [],
  "mappingNotes": [],
  "appliedClamps": []
}

[INSTRUCTIONS]
${SYSTEM_INSTRUCTIONS}`;
}

function buildUserMessage(thesis) {
  return `Here is the user's trading thesis to compile:

${JSON.stringify(thesis, null, 2)}

Produce the JSON response now.`;
}

async function callHaikuCompile(thesis, userSelectedDurationDays) {
  const anthropic = getAnthropicClient();
  const systemPrompt = buildSystemPrompt(userSelectedDurationDays);
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

  const body = req.body || {};
  const { sessionId } = body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  // Phase 2: optional user-selected backtest duration. Default to 20 trading
  // days (4 weeks, today's fixed behavior). Reject explicitly-provided
  // out-of-range values with 400 so the client knows to correct before retry.
  let userSelectedDurationDays = DEFAULT_DURATION;
  if ('userSelectedDurationDays' in body) {
    const d = body.userSelectedDurationDays;
    if (!DURATION_OPTIONS.includes(d)) {
      return res.status(400).json({
        error: 'invalid_duration',
        message: `userSelectedDurationDays must be one of ${DURATION_OPTIONS.join(', ')}.`,
      });
    }
    userSelectedDurationDays = d;
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
          recommendedDurationDays: t.recommendedDurationDays ?? null,
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
      haikuResult = await callHaikuCompile(thesis, userSelectedDurationDays);
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
    const validatedHaikuDuration = validateRecommendedDuration(
      parsed.recommendedDurationDays,
      appliedClamps
    );

    const confidenceRaw = typeof parsed.confidence === 'number' ? parsed.confidence : 0.6;
    const confidence = clampNumber(confidenceRaw, 0, 1);

    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === 'string').slice(0, 8).map((w) => w.slice(0, 300))
      : [];
    const mappingNotes = Array.isArray(parsed.mappingNotes)
      ? parsed.mappingNotes.filter((m) => typeof m === 'string').slice(0, 8).map((m) => m.slice(0, 300))
      : [];

    // Phase 5.5 — Gemma duration authority. If the thesis carries a valid
    // recommendedDurationDays from the Workshop conversation, it wins over
    // Haiku's output. The helper pushes a mappingNotes entry only when an
    // override was visible to the user (Haiku emitted a different valid
    // duration, not the silent Haiku-null case).
    const recommendedDurationDays = applyDurationAuthority(
      thesis?.recommendedDurationDays,
      validatedHaikuDuration,
      mappingNotes
    );

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
      recommendedDurationDays,
      userSelectedDurationDays,
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
      recommendedDurationDays,
      userSelectedDurationDays,
      turnCount: Array.isArray(session.exchanges) ? session.exchanges.length : 0,
    }).catch(() => {});

    return res.status(200).json({
      thesisId: thesisRef.id,
      dimensionValues: sanitized,
      confidence,
      warnings,
      mappingNotes,
      appliedClamps,
      recommendedDurationDays,
      alreadyCompiled: false,
    });
  } catch (error) {
    console.error('[compile-dimensions] Error:', error);
    return res.status(500).json({ error: 'Compiler unavailable. Try again in a moment.' });
  }
}
