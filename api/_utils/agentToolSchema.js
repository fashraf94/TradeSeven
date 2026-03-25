// Tool Use schemas for agent decide endpoint
// Sonnet uses STRATEGY_TOOL, Haiku uses PORTFOLIO_TOOL

export const STRATEGY_TOOL = {
  name: 'submit_strategy',
  description: 'Submit your strategic analysis and recommended stock shortlist.',
  input_schema: {
    type: 'object',
    required: ['brief', 'shortlist'],
    properties: {
      brief: {
        type: 'string',
        description:
          'Strategic brief: market assessment, sector outlook, risk factors, how directives inform approach (~200 words)',
      },
      shortlist: {
        type: 'array',
        items: { type: 'string' },
        minItems: 20,
        maxItems: 40,
        description:
          '25-35 recommended ticker symbols ordered by conviction. Must all be from the provided stock universe.',
      },
      topConviction: {
        type: 'string',
        description:
          'Why your top 5 picks stand out (2-3 sentences)',
      },
      risks: {
        type: 'string',
        description:
          'Key risks to watch and which picks are most exposed (1-2 sentences)',
      },
    },
  },
};

export const PORTFOLIO_TOOL = {
  name: 'submit_portfolio',
  description:
    'Submit a complete BaggerBomb portfolio with tier assignments and rationale.',
  input_schema: {
    type: 'object',
    required: [
      'star',
      'core',
      'support_stocks',
      'support_crypto',
      'bench_stocks',
      'bench_crypto',
      'innerMonologue',
    ],
    properties: {
      star: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 2,
        description: 'Exactly 2 stock tickers for Star tier (2x multiplier)',
      },
      core: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 2,
        description: 'Exactly 2 stock tickers for Core tier (1.5x multiplier)',
      },
      support_stocks: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 2,
        description: 'Exactly 2 stock tickers for Support tier (1x multiplier)',
      },
      support_crypto: {
        type: 'string',
        description: 'Exactly 1 crypto symbol for Support tier',
      },
      bench_stocks: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3,
        description: 'Exactly 3 stock tickers for bench (swap reserves)',
      },
      bench_crypto: {
        type: 'string',
        description:
          'Exactly 1 crypto symbol for bench (different from support_crypto)',
      },
      innerMonologue: {
        type: 'object',
        required: [
          'strategy',
          'starRationale',
          'coreRationale',
          'supportRationale',
          'benchRationale',
        ],
        properties: {
          strategy: {
            type: 'string',
            description: 'Overall strategy summary (2-3 sentences)',
          },
          starRationale: {
            type: 'string',
            description: 'Why these Star picks (1-2 sentences)',
          },
          coreRationale: {
            type: 'string',
            description: 'Why these Core picks (1-2 sentences)',
          },
          supportRationale: {
            type: 'string',
            description: 'Why these Support picks (1-2 sentences)',
          },
          benchRationale: {
            type: 'string',
            description: 'Why these bench picks (1 sentence)',
          },
        },
      },
    },
  },
};
