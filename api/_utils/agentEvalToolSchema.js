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
    },
  },
};
