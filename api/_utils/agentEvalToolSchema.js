// api/_utils/agentEvalToolSchema.js
// Tool Use schema for the Haiku mid-battle evaluation call.

const TRADE_DECISION_TOOL_BASE = {
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
      swap_type: {
        type: 'string',
        enum: ['defensive_cut', 'profit_take', 'momentum_rotation', 'upgrade'],
        description:
          'Which of these best classifies this swap. Required if SWAP; omit on HOLD. ' +
          'defensive_cut = exiting a loser or deteriorating position to stop the bleed. ' +
          'profit_take = realizing gains on a winner. ' +
          'momentum_rotation = exiting a stalling or weakening name for a stronger setup (outgoing-side). ' +
          'upgrade = the incoming bench candidate is simply better (the outgoing name is not necessarily weak). ' +
          'Report the one that fits what you are doing — this is a label, not an instruction.',
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
      anticipationCandidates: {
        type: 'array',
        description:
          'Phase 3 Voice Layer Rework. Optional. Bench candidates or current holdings you are watching but have NOT acted on this tick — that warrant being narrated aloud to the user. Populate ONLY when a candidate currently meets watch-worthy signals you can see in your context (RS percentile, threshold proximity, NR7 flag, BB squeeze, current regime favoring action, WARNING risk status). Most evaluations produce ZERO entries — quietness is the default. A typical busy day produces 1-3 entries across all evaluations. If you populate on most ticks, you are over-narrating. See ANTICIPATION CANDIDATES section in the system prompt for full guidance.',
        items: {
          type: 'object',
          required: ['symbol', 'direction', 'signalSummary', 'threshold'],
          properties: {
            symbol: {
              type: 'string',
              description: 'Ticker symbol of the candidate being watched. Example: "CRWD".',
            },
            direction: {
              type: 'string',
              enum: ['potential_entry', 'potential_exit'],
              description: 'potential_entry = bench candidate worth bringing in if it confirms. potential_exit = active holding whose signal profile degraded enough that exit is plausible.',
            },
            signalSummary: {
              type: 'string',
              description: 'One short sentence on why this candidate just became interesting. Anchor in signals you can see directly (RS percentile, threshold proximity, NR7 / BB squeeze state, regime, risk status). Example: "Relative strength building against XLK and volume is confirming."',
            },
            threshold: {
              type: 'string',
              description: 'One short sentence stating the specific condition that would make you act. Must be specific, and built on something you were shown this check. "If it holds above +0.5x ATR through the next check" is specific. "If conditions improve" is too vague. Example: "If it holds above +0.5x ATR through the next check, I would rotate it into Core."',
            },
            rationale: {
              type: 'string',
              description: 'Optional. Fuller context for the Voice Layer, 1-2 sentences. Omit if signalSummary + threshold already convey the read.',
            },
            signalSource: {
              type: 'string',
              description: 'Optional category tag for the dominant signal. Examples: "relative_strength", "threshold_proximity", "momentum", "regime", "risk_status".',
            },
          },
        },
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Cockpit Build 0 — the flag-conditional `declarations` property (spec
// docs/design/COCKPIT_SPEC_V1_3.md §3.1; contract
// docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §2).
//
// The tool the model receives is BUILT per check: with declarations off it is
// the literal above, the same object — so every import, every pin, and the
// trade-result validator (agentEvalToolResultValidation.js captures
// `TRADE_DECISION_TOOL.input_schema` once, at import) are unchanged. With
// declarations on it is that literal plus exactly one top-level property,
// `declarations`, typed ['object','null'] and never in `required` (a required
// block would reject every HOLD that declares nothing — the swap_type trap).
//
// THE TRADE VALIDATOR NEVER SEES THIS PROPERTY. The calls validator
// (api/_utils/callRecords/validate.js) is the only validation boundary for the
// block, and a bad block never alters the trade result.
//
// Reviewed as fenced-class (contract §2): extending the model's output schema
// is model-visible at shadow/on even though no prompt section teaches it.

/** Freeze a value and everything it holds (the on-tool shares nothing mutable — review C-6). */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * The `declarations` property — contract §2's shape, in the model's terms.
 * The wording states INTENT only (review C-4), and names the recipient Build 0
 * really has (branch review BR-3): the block is stored only. It is not shown to
 * the player, requests no response, executes or schedules nothing, and is not
 * supplied to a later check. It never stands in for the decision or for
 * anticipationCandidates. Every field is framed as a conditional record; no
 * text tells the model to wait, withhold a trade, repeat itself in narration or
 * seek permission. The horizon text states contract V1.4 H2 (docs review C2):
 * next_check's slot is a judgment boundary, a later first reach judges from its
 * own observation, pre-slot hits are unchanged, and nothing is scheduled.
 * Model-visible text: fenced-class review (contract §2).
 */
export const DECLARATIONS_PROPERTY = deepFreeze({
  type: ['object', 'null'],
  description:
    'Optional record of conditional intent from this check. These fields are stored only; they are not shown to the player, ' +
    'do not request a response, do not execute or schedule a trade, and are not supplied to a later check. They do not change ' +
    'this check\'s decision or anticipationCandidates. Most checks declare nothing: omit this or send null. At most 6 ' +
    'calledShots. A level is a price in the symbol\'s own quote, read from what you were shown this check.',
  properties: {
    calledShots: {
      type: 'array',
      description:
        'At most 6. Each records one conditional trade you are calling: SYMBOL trading above or below LEVEL before the horizon ' +
        'ends (for next_check, as horizonPhrase describes). Declare only calls you actually hold.',
      items: {
        type: 'object',
        required: ['symbol', 'direction', 'slot', 'condition', 'horizonPhrase', 'defaultAction', 'said'],
        properties: {
          symbol: {
            type: 'string',
            description: 'The ticker the condition watches. entry: the bench name you would bring in. exit: the held name you would move out.',
          },
          direction: {
            type: 'string',
            enum: ['entry', 'exit'],
            description: 'entry = bring the symbol into the book. exit = move the held symbol out.',
          },
          slot: {
            type: 'string',
            enum: ['star', 'core', 'support'],
            description: 'The slot the trade lands in (entry) or leaves (exit).',
          },
          counterpart: {
            type: 'string',
            description: 'Optional. entry: the held name it would replace. exit: the bench name that would come in. Omit if undecided.',
          },
          condition: {
            type: 'object',
            required: ['side', 'level'],
            properties: {
              side: { type: 'string', enum: ['above', 'below'], description: 'above = the price must trade above the level; below = under it.' },
              level: { type: 'number', description: 'The price level.' },
            },
          },
          horizonPhrase: {
            type: 'string',
            enum: ['next_check', 'this_session', 'this_battle', 'explicit'],
            description:
              'How long the call stands: until its next_check judgment, the end of this session, the end of this battle, or an ' +
              'explicit expiry. next_check uses the next eligible evaluator slot as a judgment boundary: the call records a condition ' +
              'and does not schedule a trade at that slot. Before the slot it can be hit as under any horizon. At or after the slot, ' +
              'the first check to reach the stored call judges it once, from that check\'s own observation: hit if the condition is ' +
              'met, otherwise expired. That first reach may be a later check than the slot\'s own.',
          },
          expiresAtMs: {
            type: 'number',
            description: 'Only with horizonPhrase explicit: the expiry instant as epoch milliseconds.',
          },
          defaultAction: {
            type: 'string',
            enum: ['act', 'hold'],
            description: 'Intent recorded at declaration time if the condition is met: act = would favor a trade; hold = would favor holding. This records an intention, not an instruction or promise of execution.',
          },
          said: {
            type: 'string',
            description: 'The call as one conditional sentence, in your voice, at most 280 characters. Stored only; not shown to the player. The typed fields are the call; this sentence only presents it.',
          },
        },
      },
    },
    watching: {
      type: 'array',
      items: { type: 'string' },
      description: 'At most 6 tickers you are watching without calling a trade. Separate from anticipationCandidates, which it never replaces.',
    },
    playerAsk: {
      type: ['object', 'null'],
      description: 'Optional record of an unresolved research question and 2 to 4 possible answers. Stored only; no question is delivered and no answer is expected.',
      required: ['question', 'options'],
      properties: {
        question: { type: 'string', description: 'At most 200 characters.' },
        options: { type: 'array', items: { type: 'string' }, description: '2 to 4 possible answers, each at most 60 characters.' },
        symbol: { type: 'string', description: 'Optional. The ticker the question is about.' },
      },
    },
    fork: {
      type: ['object', 'null'],
      description: 'Optional record of an unresolved choice for one slot: 2 to 4 names from this battle that could replace swapOut. Stored only; no selection is requested or acted on.',
      required: ['slot', 'swapOut', 'options', 'said'],
      properties: {
        slot: { type: 'string', enum: ['star', 'core', 'support'], description: 'The slot the choice concerns.' },
        swapOut: { type: 'string', description: 'The held name an option would replace.' },
        options: {
          type: 'array',
          description: '2 to 4 options.',
          items: {
            type: 'object',
            required: ['symbol', 'why'],
            properties: {
              symbol: { type: 'string', description: 'A ticker from this battle.' },
              why: { type: 'string', description: 'At most 140 characters.' },
            },
          },
        },
        said: { type: 'string', description: 'The choice as one conditional sentence, in your voice, at most 280 characters. Stored only; not shown to the player.' },
      },
    },
  },
});

/**
 * The declarations-on tool: the base literal plus exactly one property, built
 * once — from a DEEP CLONE of the base, then deep-frozen, so it shares no
 * object with the off tool (review C-6: a shared `required` array or property
 * object would let a mutation of one reach the other, and the trade
 * validator's captured schema with it). The base literal itself is untouched.
 */
const BASE_CLONE = structuredClone(TRADE_DECISION_TOOL_BASE);
const TRADE_DECISION_TOOL_WITH_DECLARATIONS = deepFreeze({
  ...BASE_CLONE,
  input_schema: {
    ...BASE_CLONE.input_schema,
    properties: {
      ...BASE_CLONE.input_schema.properties,
      declarations: DECLARATIONS_PROPERTY,
    },
  },
});

/**
 * The evaluation tool for one check. `declarations: true` only when the
 * check's resolved CALL_RECORDS_MODE is not 'off'; anything else returns the
 * base literal itself (identity, not a copy).
 *
 * @param {{ declarations?: boolean }} [opts]
 */
export function buildTradeDecisionTool({ declarations = false } = {}) {
  return declarations === true ? TRADE_DECISION_TOOL_WITH_DECLARATIONS : TRADE_DECISION_TOOL_BASE;
}

/** The declarations-off tool — the constant every existing reader imports. */
export const TRADE_DECISION_TOOL = buildTradeDecisionTool({ declarations: false });
