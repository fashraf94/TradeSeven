// api/_utils/wireEditorialJudge.test.js
// Phase 2 N3.3/N3.6 — the advisory judge machinery. Matrix rows:
//   P2-11 — judge completeness: missing / unknown / duplicate sample IDs
//           reject the chunk → the run's gateEligible false downstream.
// Plus the mechanical hallucination check (a flag whose excerpt is not a
// verbatim substring, or whose cited field/value doesn't exist as stated,
// is DISCARDED as judge error and counted) and the deterministic chunking
// + budget-reserve contract.
//
// The model call is INJECTED (callModel) — no vi.mock module games, no SDK
// anywhere near this suite; production call sites pass nothing and get
// wireModelCall.

import { describe, it, expect } from 'vitest';
import {
  buildJudgeContent,
  judgeChunks,
  judgeProseOf,
  validateJudgeChunk,
  checkAdvisoryFlag,
  runJudgePass,
  EditorialBudgetExceeded,
  EDITORIAL_JUDGE_TOOL,
  EDITORIAL_JUDGE_EXECUTION,
  EDITORIAL_JUDGE_CHUNK_SIZE,
} from './wireEditorialJudge.js';

const story = (storyId, over = {}) => ({
  sampleItem: { storyId, reporter: over.reporter ?? 'doug', eventType: over.eventType ?? 'earnings_recap', marketDate: '2026-07-28' },
  storyDoc: {
    headline: over.headline ?? `${storyId} crushes expectations`,
    body: over.body ?? `The quarter came in strong. Shares rallied after hours on the beat. ${storyId} guidance was raised.`,
  },
  entry: {
    storyId,
    agentFacts: {
      eventType: over.eventType ?? 'earnings_recap',
      digest: `${storyId} digest.`,
      direction: 'up',
      magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
      keyLevel: null, figures: [], qualifiers: ['guidance_raised'],
      primaryTicker: 'NVDA', subjectRef: null,
    },
  },
});

const toolResponse = (reviews, over = {}) => ({
  stop_reason: over.stop_reason ?? 'tool_use',
  usage: { input_tokens: 900, output_tokens: 200 },
  content: [{ type: 'tool_use', name: EDITORIAL_JUDGE_TOOL.name, input: { reviews } }],
});

const emptyReviews = (ids) => ids.map((storyId) => ({ storyId, flags: [] }));

describe('chunking + content (N3.6 deterministic)', () => {
  it('fixed-size chunks over sample order', () => {
    const stories = Array.from({ length: 23 }, (_, i) => story(`s${i}`));
    const chunks = judgeChunks(stories);
    expect(chunks.map((c) => c.length)).toEqual([10, 10, 3]);
    expect(chunks[0][0].sampleItem.storyId).toBe('s0');
    expect(EDITORIAL_JUDGE_CHUNK_SIZE).toBe(10);
  });

  it('content lists every id, carries typed facts + prose, and forces the tool', () => {
    const content = buildJudgeContent([story('a1'), story('a2')]);
    expect(content.tool_choice).toEqual({ type: 'tool', name: 'submit_editorial_review' });
    expect(content.messages[0].content).toContain('a1, a2');
    expect(content.messages[0].content).toContain('TYPED FACTS');
    expect(content.messages[0].content).toContain('crushes expectations');
    expect(content.system).toContain('ADVISORY');
  });
});

describe('P2-11 — M13 chunk validation', () => {
  const ids = ['s1', 's2', 's3'];
  it('accepts exactly-once coverage', () => {
    expect(validateJudgeChunk(ids, { reviews: emptyReviews(ids) }).ok).toBe(true);
  });
  it('missing id → rejected', () => {
    const v = validateJudgeChunk(ids, { reviews: emptyReviews(['s1', 's2']) });
    expect(v).toMatchObject({ ok: false, missing: ['s3'] });
  });
  it('unknown id → rejected', () => {
    const v = validateJudgeChunk(ids, { reviews: emptyReviews([...ids, 'sX']) });
    expect(v).toMatchObject({ ok: false, unknown: ['sX'] });
  });
  it('duplicate id → rejected', () => {
    const v = validateJudgeChunk(ids, { reviews: emptyReviews(['s1', 's1', 's2', 's3']) });
    expect(v).toMatchObject({ ok: false, duplicates: ['s1'] });
  });
});

describe('the mechanical hallucination check', () => {
  const s = story('h1');
  const goodFlag = {
    dimension: 'causality',
    excerpt: 'Shares rallied after hours on the beat.',
    citedField: 'magnitude.value',
    citedValue: '8.2',
    note: 'causal claim beyond typed facts',
  };

  it('a verbatim excerpt + existing field with stated value passes', () => {
    expect(checkAdvisoryFlag(goodFlag, s)).toEqual({ ok: true });
  });

  it('a paraphrased excerpt is discarded (excerpt_not_verbatim)', () => {
    expect(checkAdvisoryFlag({ ...goodFlag, excerpt: 'Shares rallied strongly on the beat.' }, s))
      .toMatchObject({ ok: false, code: 'excerpt_not_verbatim' });
  });

  it('a cited field that does not exist is discarded', () => {
    expect(checkAdvisoryFlag({ ...goodFlag, citedField: 'magnitude.sigma' }, s))
      .toMatchObject({ ok: false, code: 'cited_field_missing' });
  });

  it('a cited value that mismatches the typed value is discarded', () => {
    expect(checkAdvisoryFlag({ ...goodFlag, citedValue: '9.9' }, s))
      .toMatchObject({ ok: false, code: 'cited_value_mismatch' });
  });

  it('unknown dimensions and oversize excerpts are discarded', () => {
    expect(checkAdvisoryFlag({ ...goodFlag, dimension: 'vibes' }, s).code).toBe('unknown_dimension');
    expect(checkAdvisoryFlag({ ...goodFlag, excerpt: 'x'.repeat(201) }, s).code).toBe('excerpt_invalid');
  });

  it('object-valued cited fields compare by JSON', () => {
    const flag = { ...goodFlag, citedField: 'magnitude', citedValue: JSON.stringify({ value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' }) };
    expect(checkAdvisoryFlag(flag, s).ok).toBe(true);
  });
});

describe('runJudgePass — aggregation, discards, budget', () => {
  const deadline = () => Date.now() + 120_000;

  it('aggregates kept flags per story and counts discarded ones as judge errors', async () => {
    const stories = [story('s1'), story('s2')];
    const callModel = async (execution, content) => {
      expect(execution).toBe(EDITORIAL_JUDGE_EXECUTION); // P11: the frozen object itself
      expect(content.tools[0].name).toBe('submit_editorial_review');
      return {
        response: toolResponse([
          { storyId: 's1', flags: [
            { dimension: 'causality', excerpt: 'Shares rallied after hours on the beat.', citedField: 'magnitude.value', citedValue: '8.2' },
            { dimension: 'causality', excerpt: 'NOT IN THE PROSE AT ALL', citedField: 'magnitude.value', citedValue: '8.2' },
          ] },
          { storyId: 's2', flags: [] },
        ]),
      };
    };
    const out = await runJudgePass(stories, { deadline: deadline(), callModel });
    expect(out.complete).toBe(true);
    expect(out.reviewsByStoryId.get('s1')).toHaveLength(1);
    expect(out.reviewsByStoryId.get('s2')).toEqual([]);
    expect(out.judgeErrors).toBe(1);
    expect(out.discardedFlags[0]).toMatchObject({ storyId: 's1', code: 'excerpt_not_verbatim' });
    expect(out.judgeModelId).toBe('claude-sonnet-4-6');
    expect(out.chunks[0].stopReason).toBe('tool_use');
  });

  it('P2-11: a chunk missing an id → incomplete with the reason recorded', async () => {
    const stories = [story('s1'), story('s2'), story('s3')];
    const callModel = async () => ({ response: toolResponse(emptyReviews(['s1', 's2'])) });
    const out = await runJudgePass(stories, { deadline: deadline(), callModel });
    expect(out.complete).toBe(false);
    expect(out.incompleteReason).toMatch(/chunk_ids_invalid:missing=1/);
  });

  it('a truncation (stop_reason max_tokens) → incomplete, never trusted', async () => {
    const callModel = async () => ({ response: { stop_reason: 'max_tokens', usage: {}, content: [] } });
    const out = await runJudgePass([story('s1')], { deadline: deadline(), callModel });
    expect(out.complete).toBe(false);
    expect(out.incompleteReason).toMatch(/chunk_no_tool_use:max_tokens/);
  });

  it('multi-chunk samples aggregate across calls (deterministic order)', async () => {
    const stories = Array.from({ length: 12 }, (_, i) => story(`m${i}`));
    const seenBatches = [];
    const callModel = async (_e, content) => {
      const ids = content.messages[0].content.match(/Return every id exactly once: ([^\n]*)/)[1].split(', ');
      seenBatches.push(ids.length);
      return { response: toolResponse(emptyReviews(ids)) };
    };
    const out = await runJudgePass(stories, { deadline: deadline(), callModel });
    expect(out.complete).toBe(true);
    expect(seenBatches).toEqual([10, 2]);
    expect(out.reviewsByStoryId.size).toBe(12);
  });

  it('an exhausted budget throws EditorialBudgetExceeded BEFORE issuing the call (the run stays resumable)', async () => {
    let called = 0;
    const callModel = async () => { called++; return { response: toolResponse([]) }; };
    await expect(runJudgePass([story('s1')], { deadline: Date.now() + 1_000, callModel }))
      .rejects.toBeInstanceOf(EditorialBudgetExceeded);
    expect(called).toBe(0);
  });
});
