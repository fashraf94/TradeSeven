// api/_utils/agentConsolidationToolSchema.js
// Forced Tool Use schema for the Sonnet consolidation call.
// Fires every 5 games (post-reflection) to distill accumulated reflections + lessons
// into structured disciplines and refresh the agent's consolidatedInsight.
//
// Funnel principle: this is the ONLY writer of agent.disciplines.

export const SUBMIT_CONSOLIDATION_TOOL = {
  name: 'submit_consolidation',
  description:
    'Submit the consolidated dossier update for this evolution cycle. Distill the past 5 reflections and unconsumed lessons into discipline-shaped statements (specific behavioral rules, not pattern observations), refresh the consolidatedInsight in the agent\'s first-person voice, and emit a single evolution event for the timeline.',
  input_schema: {
    type: 'object',
    required: [
      'disciplines',
      'consolidatedInsightText',
      'cycleNarrative',
      'evolutionEvent',
      'lessonsAbsorbed',
      'lessonsCarriedForward',
      'cycleSummary',
    ],
    properties: {
      disciplines: {
        type: 'object',
        required: ['selection', 'execution'],
        description:
          'Structured disciplines split by category. selection = which assets to engage with. execution = how to act on them. Both arrays MUST be present (use empty arrays when nothing applies).',
        properties: {
          selection: {
            type: 'array',
            description: 'Disciplines governing what to trade.',
            items: {
              type: 'object',
              required: [
                'id',
                'statement',
                'formedInCycle',
                'reinforcedInCycles',
                'confidence',
                'source',
                'category',
              ],
              properties: {
                id: {
                  type: 'string',
                  description:
                    'Stable discipline ID. For new disciplines use a fresh "disc_<uuid>". For an existing discipline being reinforced, echo back its existing id verbatim.',
                },
                statement: {
                  type: 'string',
                  description:
                    'The discipline itself, in the agent\'s first-person voice. Must be a specific behavioral rule (e.g., "I do not enter momentum positions in the final 30 minutes of a trading day"), not a pattern observation. Max 200 characters.',
                },
                formedInCycle: {
                  type: 'integer',
                  minimum: 1,
                  description:
                    'The evolutionCycle in which this discipline was first formed. For brand-new disciplines this equals the cycle being completed.',
                },
                reinforcedInCycles: {
                  type: 'array',
                  items: { type: 'integer' },
                  description:
                    'List of evolution cycles in which this discipline was reinforced. Excludes the formation cycle. Empty array on first formation.',
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description:
                    'Confidence in this discipline (0-1). New disciplines start at 0.5. Reinforcement adds +0.05, capped at 1.0.',
                },
                source: {
                  type: 'string',
                  enum: ['consolidation'],
                  description: 'Always "consolidation" in Sprint 1.',
                },
                category: {
                  type: 'string',
                  enum: ['selection', 'execution'],
                  description: 'Must equal "selection" for items in the selection array.',
                },
              },
            },
          },
          execution: {
            type: 'array',
            description: 'Disciplines governing how to act on chosen trades.',
            items: {
              type: 'object',
              required: [
                'id',
                'statement',
                'formedInCycle',
                'reinforcedInCycles',
                'confidence',
                'source',
                'category',
              ],
              properties: {
                id: { type: 'string' },
                statement: { type: 'string' },
                formedInCycle: { type: 'integer', minimum: 1 },
                reinforcedInCycles: { type: 'array', items: { type: 'integer' } },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                source: { type: 'string', enum: ['consolidation'] },
                category: { type: 'string', enum: ['selection', 'execution'] },
              },
            },
          },
        },
      },
      consolidatedInsightText: {
        type: 'string',
        description:
          'A natural-language first-person summary of the dossier as it stands NOW (not just this cycle\'s shift). This text will be injected into the strategy and voice-layer prompts. Max 300 words.',
      },
      cycleNarrative: {
        type: 'string',
        description:
          'What specifically shifted this cycle. Agent first-person voice. Max 200 words.',
      },
      evolutionEvent: {
        type: 'object',
        required: ['headline', 'narrative'],
        description:
          'A single timeline event marking this consolidation. Surfaced in the AgentEvolutionTab UI.',
        properties: {
          headline: {
            type: 'string',
            description:
              'Short, ceremonial headline shown in the timeline list. Max 60 characters.',
          },
          narrative: {
            type: 'string',
            description:
              'Expanded narrative shown when the user taps the event. Max 200 words.',
          },
        },
      },
      lessonsAbsorbed: {
        type: 'array',
        items: { type: 'string' },
        description:
          'IDs of lessons (from the unconsumed-lessons input list) that were integrated into the disciplines this cycle. These will be marked consumed.',
      },
      lessonsCarriedForward: {
        type: 'array',
        items: { type: 'string' },
        description:
          'IDs of unconsumed lessons that did NOT graduate into a discipline this cycle. They remain pending and will reappear next cycle.',
      },
      cycleSummary: {
        type: 'object',
        required: ['cyclesCompleted', 'keyShift', 'confidenceLevel'],
        properties: {
          cyclesCompleted: {
            type: 'integer',
            minimum: 1,
            description:
              'Total evolution cycles completed by this agent including the one being closed (i.e., the new evolutionCycle value).',
          },
          keyShift: {
            type: 'string',
            description: 'One-line summary of the most important change. Max 80 characters.',
          },
          confidenceLevel: {
            type: 'string',
            enum: ['forming', 'consolidating', 'crystallized'],
            description:
              'Subjective dossier maturity. forming = early, exploratory. consolidating = patterns stabilizing. crystallized = high-confidence, stable disciplines.',
          },
        },
      },
    },
  },
};
