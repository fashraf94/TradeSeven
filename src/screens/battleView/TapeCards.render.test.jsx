// src/screens/battleView/TapeCards.render.test.jsx
//
// A2.2 — what the two cards and the collapsed line actually put on screen.
// The builder's test guards what reaches the entry; this one guards what
// reaches the player, including the hostile render: a trade record with every
// forbidden field on it, fed through the real builder, must produce html that
// contains none of them.
//
// renderToString + toContain, the repo's component-test idiom.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradeCard, CheckCard, CheckRunLine } from './TapeCards.jsx';
import { buildTradeEntries, buildCheckEntries } from './buildTape';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;
const strip = (h) => h.replace(/<!-- -->/g, '');

const HOSTILE_TRADE = {
  symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core',
  lockedPoints: 8.04,
  swappedOutAt: T('17:31'),
  evaluationId: 'eval_009',
  rationale: 'GILD has stalled at the 200-day and MOS is breaking out on volume.',
  source: 'haiku',
  hypothesis: 'Hypothesis: MOS continues into the close.',
  conviction: 78,
  exitReason: 'haiku_decision',
  entryRegime: 'risk_on',
  triggeredBy: 'price_drop',
  citedRules: ['RULE_MOMENTUM_7'],
  pvpContext: { opponentScore: 44 },
  trade_reasoning: { indicators: ['rsi_14', 'vwap_dev'] },
};

const FEED = [{
  timestamp: T('17:31'), action: 'swap', evalId: 'eval_009',
  symbolOut: 'GILD', symbolIn: 'MOS',
  message: 'Rotated the core slot.', directiveThreadId: 'dir_1',
}];

const tradeHtml = (trade = HOSTILE_TRADE, feed = FEED) => strip(
  renderToString(<TradeCard entry={buildTradeEntries([trade], feed)[0]} />),
);
const checkHtml = (evaluation) => strip(
  renderToString(<CheckCard entry={buildCheckEntries([evaluation], {}, [])[0]} />),
);

const check = (over = {}) => ({
  evalId: 'eval_046', timestamp: T('19:46'), decision: 'HOLD', downgraded: false,
  rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
  scores: { active: 12, banked: 40, total: 52 },
  ...over,
});

describe('the trade card', () => {
  it('is `{t} · {out} → {in} · {tier}` with the banked points and the motive', () => {
    const html = tradeHtml();
    expect(html).toContain('1:31 PM · GILD → MOS · Core');
    expect(html).toContain('Banked 8.0 pts');
    expect(html).toContain('GILD has stalled at the 200-day and MOS is breaking out on volume.');
  });

  it('names WHOSE words the motive is', () => {
    expect(tradeHtml()).toContain('The agent&#x27;s own words');
    expect(tradeHtml()).not.toContain('The system&#x27;s reason');
    const system = { ...HOSTILE_TRADE, source: 'guardrail', rationale: 'Guardrail override (guardrail_stopLoss): forcing exit.' };
    expect(tradeHtml(system)).toContain('The system&#x27;s reason');
    expect(tradeHtml(system)).not.toContain('The agent&#x27;s own words');
  });

  it('HOSTILE RENDER — not one DO-NOT field reaches the html (hazard 29, D-64)', () => {
    const html = tradeHtml().toLowerCase();
    for (const forbidden of [
      'hypothesis', 'conviction', '78', 'haiku_decision', 'risk_on', 'price_drop',
      'rule_momentum_7', 'opponentscore', 'rsi_14', 'vwap_dev', 'pvpcontext',
      'triggeredby', 'exitreason',
    ]) {
      expect(html).not.toContain(forbidden.toLowerCase());
    }
    // …and the model tier is never named on any surface.
    expect(html).not.toContain('haiku');
  });

  it('the provenance code is TRANSLATED, never rendered raw (D-80, ruling 1)', () => {
    // This row's expectation was `toContain('guardrail_stopLoss')` at
    // `112b307d` — the A2 review recorded the token as a copy question for the
    // founder (L5-F3) rather than editing the engine's verbatim sentence on
    // its own authority. Ruled: translate. The fixture is the string the cron
    // ACTUALLY writes (agent-evaluate.js:2121).
    const forced = { ...HOSTILE_TRADE, source: 'guardrail', rationale: 'Guardrail override (guardrail_stopLoss): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.' };
    const html = tradeHtml(forced);
    expect(html).toContain('The system&#x27;s reason');
    // The card is collapsed to its first sentence (D-84); the translation
    // rides that sentence, and the whole rewritten motive is on the entry.
    expect(html).toContain('Guardrail override (stop-loss): stop-loss at 8% breached on GILD (-9.24%).');
    expect(buildTradeEntries([forced], FEED)[0].motive)
      .toBe('Guardrail override (stop-loss): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
    expect(html).not.toContain('guardrail_stopLoss');
    expect(html).not.toContain('guardrail_');
  });

  it('one row per table entry — the three ruled guardrail types (D-80)', () => {
    const motive = (token) => tradeHtml({
      ...HOSTILE_TRADE, source: 'guardrail',
      rationale: `Guardrail override (${token}): forcing exit → MOS.`,
    });
    expect(motive('guardrail_stopLoss')).toContain('Guardrail override (stop-loss): forcing exit → MOS.');
    expect(motive('guardrail_trailingStop')).toContain('Guardrail override (trailing stop): forcing exit → MOS.');
    expect(motive('guardrail_profitTarget')).toContain('Guardrail override (profit target): forcing exit → MOS.');
    for (const token of Object.keys(COPY.guardrailTypeWords)) {
      expect(motive(token)).not.toContain(token);
    }
  });

  it('an UNRULED token loses the parenthetical entirely (D-80)', () => {
    // `guardrail_max_sector_weight` (agentGuardrails.js:570) has no ruled
    // words, and `hard` is the cron's own fallback when sourceNote is null.
    // Neither is a fact a player can read, so neither renders.
    const sector = tradeHtml({
      ...HOSTILE_TRADE, source: 'guardrail',
      rationale: 'Guardrail override (guardrail_max_sector_weight): sector cap breached. Forcing exit → MOS.',
    });
    expect(sector).toContain('Guardrail override: sector cap breached.');
    expect(sector).not.toContain('guardrail_max_sector_weight');
    expect(sector).not.toContain('Guardrail override (');

    const hard = tradeHtml({
      ...HOSTILE_TRADE, source: 'guardrail',
      rationale: 'Guardrail override (hard): hard threshold breach.',
    });
    expect(hard).toContain('Guardrail override: hard threshold breach.');
    expect(hard).not.toContain('(hard)');
  });

  it('the translation touches ONLY the code parenthetical — the engine\'s numbers survive (D-80)', () => {
    // agentGuardrails.js:557 writes its own statusMessage with no code
    // parenthetical but WITH a percentage in brackets; the R11 pass writes
    // `(R11)`. A rule that dropped every bracket would eat both.
    const statusMessage = tradeHtml({
      ...HOSTILE_TRADE, source: 'guardrail',
      rationale: 'Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.',
    });
    expect(statusMessage).toContain('(-9.24%)');
    const r11 = tradeHtml({
      ...HOSTILE_TRADE, source: 'risk_manager',
      rationale: 'Deterministic guardrail enforcement during gameplan suppression (R11).',
    });
    expect(r11).toContain('(R11)');
  });

  it('the model\'s own words are never rewritten (C1)', () => {
    // ONLY the engine's own sentence is touched, and the pattern's anchor is
    // what makes that true — a rationale the model wrote keeps every bracket
    // it typed, including one that looks like a code.
    const agent = tradeHtml({
      ...HOSTILE_TRADE, source: 'haiku',
      rationale: 'GILD (stopLoss territory, by my read) has stalled at the 200-day.',
    });
    expect(agent).toContain('The agent&#x27;s own words');
    expect(agent).toContain('(stopLoss territory, by my read)');

    // …and a model sentence that DOES open with the engine's prefix is
    // engine-authored under the shipped rule, so it is translated AND
    // labelled the system's — one rule, not two that can disagree.
    const looksEngine = tradeHtml({
      ...HOSTILE_TRADE, source: 'haiku',
      rationale: 'Guardrail override (guardrail_stopLoss): forcing exit → MOS.',
    });
    expect(looksEngine).toContain('The system&#x27;s reason');
    expect(looksEngine).toContain('Guardrail override (stop-loss): forcing exit → MOS.');
  });

  it('SOURCE TRIPWIRE — the three words are the founder\'s existing swap-ledger taxonomy', () => {
    // The words are not invented by this phase. If leagueSwapLedger.js renames
    // one of the three, this row reds rather than letting two surfaces call
    // one guardrail two different things.
    const ledger = readFileSync(new URL('../../components/League/battleArena/leagueSwapLedger.js', import.meta.url), 'utf8');
    for (const [token, words] of Object.entries(COPY.guardrailTypeWords)) {
      expect(ledger).toContain(`${token}: '${words}'`);
    }
  });

  it('SOURCE TRIPWIRE — the cron still composes the parenthetical this rule anchors on', () => {
    const cron = readFileSync(new URL('../../../api/cron/agent-evaluate.js', import.meta.url), 'utf8');
    expect(cron).toContain('rationale: `Guardrail override (${result.sourceNote || \'hard\'}): ${overrideNote}`');
    const guardrails = readFileSync(new URL('../../../api/_utils/agentGuardrails.js', import.meta.url), 'utf8');
    expect(guardrails).toContain('sourceNote: `guardrail_${forcedType}`');
  });

  it('never renders the feed `message` — it is the status line, not the motive (hazard 24)', () => {
    expect(tradeHtml()).not.toContain('Rotated the core slot.');
  });

  it('carries `↳ from directive` only when the joined feed entry echoes one', () => {
    expect(tradeHtml()).toContain('↳ from directive');
    expect(tradeHtml(HOSTILE_TRADE, [{ ...FEED[0], directiveThreadId: null }])).not.toContain('↳ from directive');
    // …and never the thread id itself.
    expect(tradeHtml()).not.toContain('dir_1');
  });

  it('the echo is the SHIPPED characters — the flag-off inline copy and the card\'s cannot drift apart', () => {
    // AgentChat.jsx keeps its inline `↳ from directive` for the flag-off path
    // (the golden pins those bytes); the card reads the copy module. Two homes
    // for one string is exactly how a display starts disagreeing with itself,
    // so this row holds them equal by reading the shipped source.
    const chat = readFileSync(new URL('../../components/Agent/AgentChat.jsx', import.meta.url), 'utf8');
    expect(chat).toContain(COPY.fromDirective);
    expect(COPY.fromDirective).toBe('↳ from directive');
  });

  it('degrades without crashing: no tier, no points, no motive', () => {
    const bare = { symbolOut: 'GILD', symbolIn: 'MOS', swappedOutAt: T('17:31') };
    const html = tradeHtml(bare, []);
    expect(html).toContain('1:31 PM · GILD → MOS');
    expect(html).not.toContain('Banked');
    // With no motive there is no author to name.
    expect(html).not.toContain('The agent&#x27;s own words');
    expect(html).not.toContain('The system&#x27;s reason');
  });

  it('a negative banked score is rendered as it stands — a locked loss is a fact', () => {
    expect(tradeHtml({ ...HOSTILE_TRADE, lockedPoints: -3.2 })).toContain('Banked -3.2 pts');
    expect(tradeHtml({ ...HOSTILE_TRADE, lockedPoints: 0 })).toContain('Banked 0.0 pts');
  });
});

describe('the check card', () => {
  it('is `At the {t} check · {label}` with the first sentence, and `Read more` for the rest', () => {
    const html = checkHtml(check());
    expect(html).toContain('At the 3:45 PM check · Held');
    expect(html).toContain('The book is holding its shape.');
    expect(html).not.toContain('Nothing in the tape argues for a rotation yet.');
    expect(html).toContain('Read more');
  });

  it('a one-sentence rationale needs no `Read more`', () => {
    const html = checkHtml(check({ rationale: 'The book is holding its shape.' }));
    expect(html).toContain('The book is holding its shape.');
    expect(html).not.toContain('Read more');
  });

  it('carries the SAME labels the Why? panel shows for the four non-plain states', () => {
    expect(checkHtml(check({ downgraded: true }))).toContain('Argued for a swap · held by a guardrail');
    expect(checkHtml(check({ downgraded: true, validationErrors: ['Swap execution failed: x'] })))
      .toContain('Argued for a swap · it did not go through');
    expect(checkHtml(check({
      downgraded: true,
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ action: 'forced_exit', symbol: 'CF', replacementSymbol: 'DVN' }],
    }))).toContain('A guardrail called for a swap · it did not go through');
    expect(checkHtml(check({ haikuError: { failureClass: 'timeout' } })))
      .toContain('No decision recorded at this check · the evaluation timed out');
    expect(checkHtml(check({ haikuError: { failureClass: 'budget_skipped' } })))
      .toContain('No decision recorded at this check · the evaluation did not complete');
    expect(checkHtml(check({ decision: 'SWAP', symbolOut: 'GILD', symbolIn: 'MOS' })))
      .toContain('Swapped · GILD → MOS');
  });

  it('an outage tick never shows the cron\'s placeholder words', () => {
    const html = checkHtml(check({ rationale: 'Haiku call failed — defaulting to HOLD', haikuError: { failureClass: 'timeout' } }));
    expect(html).not.toContain('Haiku');
    expect(html).not.toContain('Read more');
  });

  it('says why the tick ran, when the type is ruled (D-78)', () => {
    expect(checkHtml(check({ triggers: ['price_drop'] }))).toContain('Woken by a price drop');
    expect(checkHtml(check({ triggers: ['news_catalyst'] }))).not.toContain('Woken by');
    expect(checkHtml(check({ triggers: ['news_catalyst'] }))).not.toContain('news_catalyst');
  });
});

describe('the collapsed run', () => {
  it('is one line: `{n} checks · no change`', () => {
    const html = strip(renderToString(<CheckRunLine entry={{ count: 4, id: 'r', at: T('14:00'), timestamp: new Date(T('14:00')) }} />));
    expect(html).toContain('4 checks · no change');
    expect(COPY.checksNoChange(4)).toBe('4 checks · no change');
  });

  it('renders nothing without an entry — the three components are null-safe', () => {
    expect(renderToString(<CheckRunLine entry={null} />)).toBe('');
    expect(renderToString(<TradeCard entry={null} />)).toBe('');
    expect(renderToString(<CheckCard entry={null} />)).toBe('');
  });
});
