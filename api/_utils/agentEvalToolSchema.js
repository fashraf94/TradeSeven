// api/_utils/agentEvalToolSchema.js
// Tool Use schema for the Haiku mid-battle evaluation call.

export const TRADE_DECISION_TOOL = {
  name: 'submit_trade_decision',
  description:
    'Submit your portfolio evaluation decision. HOLD keeps all positions. SWAP replaces one active position with a bench stock. If your conviction for SWAP is below 70, you MUST choose HOLD instead.',
  input_schema: {
    type: 'object',
    required: ['decision', 'rationale', 'conviction', 'hypothesis', 'riskAssessment'],
    properties: {
      decision: {
        type: 'string',
        enum: ['HOLD', 'SWAP'],
        description:
          'HOLD = keep all positions. SWAP = replace one active position with a bench stock. Choose HOLD if conviction < 70.',
      },
      symbolOut: {
        type: 'string',
        description: 'Ticker being removed from active portfolio. Required if SWAP.',
      },
      symbolIn: {
        type: 'string',
        description:
          'Ticker from bench entering active portfolio. Required if SWAP. Must not be on cooldown.',
      },
      rationale: {
        type: 'string',
        description:
          'Your inner monologue. First person, in character. Reference specific numbers. 3-5 sentences analyzing the situation. Do NOT include the hypothesis here.',
      },
      hypothesis: {
        type: 'string',
        description:
          'A specific, falsifiable prediction about what you expect to happen next. Start with "Hypothesis:". Example: "Hypothesis: MSFT will reach 1.0x ATR bonus within the next trading day." This will be graded in your post-battle debrief.',
      },
      conviction: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description:
          'Confidence in this decision (0-100). SWAP requires >= 70. If below 70, decision MUST be HOLD.',
      },
      riskAssessment: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description:
          'low = HOLD or Support swap. medium = Core swap. high = Star swap or Survival Mode override.',
      },
      ignoredDirectiveIds: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Array of directive IDs being overridden due to Survival Mode. Empty array if no directives violated. Example: ["d1", "d3"]',
      },
      directiveThreadId: {
        type: ['string', 'null'],
        description:
          'If this trade was influenced by the ACTIVE DIRECTIVE shown in live context, copy its threadId here verbatim. null if no active directive, or if the trade is independent of the directive.',
      },
      status_feed_update: {
        type: 'string',
        description:
          'A 1-2 sentence status update for the battle dashboard. Reference the active strategy, specific indicators, or risk levels. Be concise and personality-consistent. Only generate when something meaningful happened (trade, threshold crossed, notable move). Omit if nothing noteworthy.',
      },
      trade_reasoning: {
        type: ['object', 'null'],
        description:
          'Structured breakdown of why this trade was made. Set on swap/hold actions with notable reasoning. null if no trade action taken or routine hold with nothing to say. Supplementary to status_feed_update, not a replacement.',
        properties: {
          thesis: {
            type: 'string',
            description:
              'One sentence: the core reason for this trade. Be specific — cite the stock, setup, or catalyst. Example: "INTC showing breakout energy at +4.72% with 5h runway to threshold."',
          },
          strategy: {
            type: 'string',
            description:
              'Which strategy drove this decision. Example: "Volatility Squeeze", "Momentum Breakout", "RS Rotation", "Risk Management".',
          },
          indicators: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Key indicators that supported the decision, with values. Example: ["RSI 28 (oversold)", "BB width 5th percentile", "VWAP +0.4%"].',
          },
          citedRules: {
            type: 'array',
            items: { type: 'string' },
            description: 'Forge rule IDs cited in this decision (e.g., ["C1", "S3"]). Empty array if none.',
          },
          conviction: {
            type: 'number',
            description: 'Conviction score 0-100 for this trade. Higher = more confident.',
          },
        },
        required: ['thesis', 'strategy'],
      },
      pvp_context: {
        type: 'string',
        description:
          'Market-relative observation comparing portfolio performance to benchmarks. Example: "Tech positions outperforming broader market" or "Portfolio trailing S&P on sector rotation." Omit if nothing noteworthy — do not generate filler observations every tick.',
      },
      cited_rules: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Strategy or rule names that influenced this decision. Use these standard names when applicable: "volatility_squeeze", "52w_high_breakout", "rs_momentum", "vwap_mean_reversion", "news_catalyst", "bust_avoidance", "vwap_failure", "threshold_lock". Empty array if no specific rule was primary driver.',
      },
      cited_forge_rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string', description: 'The rule identifier (C1, S2, etc.)' },
            ruleText: { type: 'string', description: 'The rule text for traceability' },
            influence: {
              type: 'string',
              enum: ['followed', 'blocked_trade'],
              description: 'How this rule influenced the decision',
            },
          },
          required: ['ruleId', 'influence'],
        },
        description:
          'Forge rules that influenced this decision. Only include rules that materially affected your reasoning. Empty array if no forge rules were relevant.',
      },
      overridden_forge_rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string', description: 'The rule identifier (C1, S2, etc.)' },
            ruleText: { type: 'string', description: 'The rule text for traceability' },
            reason: {
              type: 'string',
              enum: ['no_match', 'conflict_with_constraint', 'market_conditions', 'insufficient_data', 'higher_priority_opportunity'],
              description: 'Why the rule was considered but not followed. no_match = no stocks met criteria. conflict_with_constraint = a higher-priority constraint blocked it. market_conditions = current conditions make the signal unreliable. insufficient_data = data unavailable. higher_priority_opportunity = a better opportunity outside this rule scope.',
            },
          },
          required: ['ruleId', 'reason'],
        },
        description:
          'Forge rules that were deliberately overridden in this decision, with structured reason.',
      },
    },
  },
};
