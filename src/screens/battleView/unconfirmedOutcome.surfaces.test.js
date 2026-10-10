// src/screens/battleView/unconfirmedOutcome.surfaces.test.js
//
// Enforce readiness (8 Oct 2026) — acceptance 2 for the Battle View surfaces
// that read the Why? state: table G (docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md,
// V1.4). Report: docs/audits/20261008_BUILD_ENFORCE_READINESS.md §2.
//
// Every surface below takes its label from `selectWhyState` — the tape's check
// card (buildTape), the character's bubble (deriveBubble), the peek line
// (derivePeekLine) and Bench's author footer (selectBench) — so each is fed the
// model route's real marked entry and asked what it shows. Each must say
// something true or nothing: the table G label, an author line, or the agent's
// own words; never `held by a guardrail`, `did not go through`, `the system
// held it`, `stayed as it was`, a blank, "null" or "undefined".

import { describe, it, expect } from 'vitest';
import { buildTape } from './buildTape';
import { deriveBubble } from './deriveBubble';
import { derivePeekLine } from './derivePeekLine';
import { selectBench } from './selectBench';
import { WHY_KIND } from './selectWhyState';
import { LABEL_COLOR } from './TapeCards';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const AT = '2026-09-01T16:45:02.000Z';
const RATIONALE = 'NOW has lost its bid and TSLA is showing the stronger tape; swapping NOW for TSLA.';
const FORCED = 'Guardrail override (guardrail_stopLoss): Guardrail override: stop-loss at 8% breached on NOW (-9.24%). Forcing exit → TSLA.';

/** The model route's marked entry, exactly as agent-evaluate.js writes it (Part D). */
const marked = (over = {}) => ({
  evalId: 'eval_044', timestamp: AT, decision: 'HOLD', downgraded: true, rationale: RATIONALE,
  symbolOut: null, symbolIn: null, validationErrors: [], executionOutcome: 'unknown', ...over,
});
const forced = (over = {}) => marked({
  rationale: FORCED,
  guardrailSourceNote: 'guardrail_stopLoss',
  guardrailOverrides: [{ type: 'stopLoss', symbol: 'NOW', action: 'forced_exit', replacementSymbol: 'TSLA' }],
  ...over,
});

const FALSE_CLAIMS = [/held by a guardrail/, /did not go through/, /the system held it/, /stayed as it was/, /\bnull\b/, /\bundefined\b/];
const claims = (text) => FALSE_CLAIMS.filter((re) => re.test(String(text)));

const tape = (evaluations) => buildTape({ trades: [], statusFeed: [], evaluations, receipts: {}, chatExchanges: [] });

describe('the tape’s check card (buildTape → TapeCards)', () => {
  it('the agent variant: kind, the table G label, the author line, the words — and never folded into a quiet run', () => {
    const [card] = tape([marked()]);
    expect(card.kind).toBe(WHY_KIND.UNCONFIRMED);
    expect(card.label).toBe('Argued for a swap · its outcome could not be confirmed');
    expect(card.footer).toBe(COPY.motiveAgent);
    expect(card.firstSentence).toBe(RATIONALE);
    expect(card.quiet).toBe(false);
    expect(claims(`${card.label} ${card.footer}`)).toEqual([]);
    // The card's colour is ruled, never the fallback.
    expect(LABEL_COLOR[card.kind]).toBe(LABEL_COLOR[WHY_KIND.FAILED]);
  });

  it('the guardrail variant: the guardrail is the subject, the system the author, the pair from the override', () => {
    const [card] = tape([forced()]);
    expect(card.kind).toBe(WHY_KIND.GUARDRAIL_UNCONFIRMED);
    expect(card.label).toBe('A guardrail called for a swap · its outcome could not be confirmed');
    expect(card.footer).toBe(COPY.motiveSystem);
    expect([card.symbolOut, card.symbolIn]).toEqual(['NOW', 'TSLA']);
    expect(claims(`${card.label} ${card.footer}`)).toEqual([]);
    expect(LABEL_COLOR[card.kind]).toBe(LABEL_COLOR[WHY_KIND.GUARDRAIL_FAILED]);
  });

  it('every label a check card can carry is mapped to a colour — a new kind cannot fall to the default unnoticed', () => {
    for (const kind of Object.values(WHY_KIND)) expect(LABEL_COLOR[kind], kind).toBeTruthy();
  });
});

describe('the character’s bubble and the peek line', () => {
  it('the bubble’s eyebrow carries the table G label in its ruled colour; the line is the agent’s own first sentence', () => {
    const items = tape([marked()]);
    const bubble = deriveBubble(items);
    expect(bubble.eyebrow).toBe(COPY.checkCardLabel(AT, 'Argued for a swap · its outcome could not be confirmed'));
    expect(bubble.eyebrowColor).toBe(LABEL_COLOR[WHY_KIND.UNCONFIRMED]);
    expect(bubble.line).toBe(RATIONALE);
    expect(claims(`${bubble.eyebrow} ${bubble.line}`)).toEqual([]);
  });

  it('the peek line names the slot and the table G label — for both variants', () => {
    expect(derivePeekLine(tape([marked()]))).toMatch(/· Argued for a swap · its outcome could not be confirmed$/);
    expect(derivePeekLine(tape([forced()]))).toMatch(/· A guardrail called for a swap · its outcome could not be confirmed$/);
    expect(claims(derivePeekLine(tape([marked()])))).toEqual([]);
  });
});

describe('Bench (selectBench) — the author footer beside the decider’s words', () => {
  const doc = (evaluation) => ({
    scoreState: { lastScoredAt: AT },
    portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [], bench: { stocks: [{ symbol: 'NOW' }, { symbol: 'TSLA' }] } },
    evaluations: [evaluation],
    chatExchanges: [],
  });

  it('a marked agent entry: the agent’s words, footed `The agent’s own words` — not `the system held it`', () => {
    const bench = selectBench(doc(marked()));
    expect(bench.footer).toBe(COPY.motiveAgent);
    expect(claims(bench.footer)).toEqual([]);
    expect(bench.cards.length).toBeGreaterThan(0);
  });

  it('a marked guardrail-forced entry: footed `The system’s reason` — not `the position stayed as it was`', () => {
    const bench = selectBench(doc(forced()));
    expect(bench.footer).toBe(COPY.motiveSystem);
    expect(claims(bench.footer)).toEqual([]);
  });

  it('base rendered the false footers for exactly these entries (the rows above can fail)', () => {
    expect(selectBench(doc(marked({ executionOutcome: undefined }))).footer).toBe(COPY.downgradedFooter);
    expect(selectBench(doc(forced({ executionOutcome: undefined }))).footer).toBe(COPY.guardrailForcedFailedFooter);
  });
});
