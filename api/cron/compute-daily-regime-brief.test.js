// api/cron/compute-daily-regime-brief.test.js
//
// DRB stale fix (Oct 29 2026) — the producer's answer handling, through the real handler. Firestore, the two calendar
// fetchers, the storage log and the Anthropic SDK are doubles; the prompt builder and the answer reader are real. Pinned:
//   - every answer logs its stop_reason and usage, with forDate and the input counts, before it is read;
//   - an answer that lost `themes` (or `keyEvents`) keeps the day: [] for the lost field, the loss named in sourceFailures;
//   - only a missing or empty brief still fails the run, and a failed run never overwrites the stored brief;
//   - the model call itself is unchanged (model, 2,500-token cap, forced tool), and the stored document keeps its fields.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ create: null, set: null, existing: null, earnings: null, macro: null }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicDouble {
    constructor() { this.messages = { create: (args) => state.create(args) }; }
  },
}));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: () => ({
      doc: (id) => ({
        get: async () => (id === 'dailyRegimeBrief'
          ? { exists: !!state.existing, data: () => state.existing }
          : { exists: true, data: () => ({ regime: 'Risk-on', breadthTier: 'broad', volatilityRegime: 'normal' }) }),
        set: (doc) => state.set(id, doc),
      }),
    }),
  }),
}));
vi.mock('../_utils/fetchMacroEvents.js', () => ({
  fetchMacroEvents: async () => { if (state.macro instanceof Error) throw state.macro; return state.macro; },
}));
vi.mock('../_utils/fetchEarningsCalendarEODHD.js', () => ({ fetchEarningsCalendarEODHD: async () => state.earnings }));
vi.mock('../_utils/shadowLogger.js', () => ({ logDailyRegimeBrief: async () => {} }));

import handler, { readBriefAnswer } from './compute-daily-regime-brief.js';

const TODAY = '2026-10-28';
const EVENT = { label: 'FOMC rate decision', eventDate: '2026-10-28', eventTime: '2:00 PM ET', kind: 'fed', whyItMatters: 'Rate path sets the tone for duration and growth.', tickers: ['SPY', 'TLT'] };
const EVENT2 = { label: 'MSFT earnings', eventDate: '2026-10-28', eventTime: 'AMC', kind: 'earnings', whyItMatters: 'Cloud growth read for AI capex.', tickers: ['MSFT'] };
const answer = (input, { stop = 'tool_use', output = 640 } = {}) => ({
  content: [{ type: 'tool_use', name: 'submit_daily_regime_brief', input }],
  stop_reason: stop,
  usage: { input_tokens: 2300, output_tokens: output },
});
const FULL = { brief: 'FOMC Wednesday, GDP and PCE Thursday: a front-loaded macro week.', keyEvents: [EVENT, EVENT2], themes: ['AI capex', 'rates repricing'] };

function earningsRows(n) {
  return Array.from({ length: n }, (_, i) => ({ date: TODAY, day: 'Wednesday', timing: 'AMC', symbol: `S${i}`, name: `S${i}`, significance: 'high', marketCap: 1e12 - i, priorityRank: null }));
}

const res = () => {
  const r = { statusCode: null, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => { r.body = body; return r; };
  return r;
};
const run = async () => { const r = res(); await handler({ headers: { 'x-vercel-cron': '1' } }, r); return r; };
/** The JSON a log line carried, by its message. */
const logged = (spy, message) => spy.mock.calls.filter((c) => String(c[0]).includes(message)).map((c) => JSON.parse(c[1]));

let log;
let err;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:30:00Z`));
  state.existing = { forDate: '2026-10-23', dailyBrief: "Friday's brief" };
  state.set = vi.fn(async () => {});
  state.create = vi.fn(async () => answer(FULL));
  state.macro = { thisWeek: [{ date: TODAY, day: 'Wednesday', time: '2:00 PM ET', event: 'FOMC rate decision', impact: 'high' }], nextWeek: [] };
  state.earnings = { thisWeek: earningsRows(45), nextWeek: earningsRows(12) };
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a complete answer: stored as before, with stop_reason and usage logged', () => {
  it('writes the same fields as before, and only those', async () => {
    const r = await run();
    expect(r.statusCode).toBe(200);
    expect(state.set).toHaveBeenCalledTimes(1);
    const [id, doc] = state.set.mock.calls[0];
    expect(id).toBe('dailyRegimeBrief');
    expect(Object.keys(doc).sort()).toEqual(['dailyBrief', 'forDate', 'generatedAt', 'keyEvents', 'model', 'sourceFailures', 'themes', 'tokenUsage']);
    expect(doc).toEqual({
      dailyBrief: FULL.brief, keyEvents: [EVENT, EVENT2], themes: FULL.themes, forDate: TODAY, generatedAt: 'SERVER_TIMESTAMP',
      model: 'claude-sonnet-4-6', tokenUsage: { input: 2300, output: 640 }, sourceFailures: [],
    });
  });

  it('the call is unchanged: the model, the 2,500-token cap, no thinking, low effort, the forced tool', async () => {
    await run();
    const args = state.create.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-4-6');
    expect(args.max_tokens).toBe(2500);
    expect(args.thinking).toEqual({ type: 'disabled' });
    expect(args.output_config).toEqual({ effort: 'low' });
    expect(args.tool_choice).toEqual({ type: 'tool', name: 'submit_daily_regime_brief' });
    expect(args.tools.map((t) => t.name)).toEqual(['submit_daily_regime_brief']);
  });

  it('the prompt it sends lists 8 + 5 earnings of the 45 + 12, and the log says so', async () => {
    await run();
    const prompt = state.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatch(/\n\(\+37 more not listed\)\n/);
    expect(prompt).toMatch(/\n\(\+7 more not listed\)\n/);
    expect(logged(log, 'Calling Sonnet')[0]).toEqual({ forDate: TODAY, econEvents: 1, earnings: 57, earningsListed: { thisWeek: 8, nextWeek: 5 }, sourceFailures: [] });
  });

  it('logs stop_reason, usage and the answer\'s shape (types and lengths, never its text) with forDate and the input counts', async () => {
    await run();
    expect(logged(log, 'Sonnet answered')).toEqual([{
      forDate: TODAY, stopReason: 'tool_use', usage: { input: 2300, output: 640 },
      shape: { brief: `string:${FULL.brief.length}`, keyEvents: 'array:2', themes: 'array:2', keys: ['brief', 'keyEvents', 'themes'] },
      econEvents: 1, earnings: 57, earningsListed: { thisWeek: 8, nextWeek: 5 },
    }]);
    expect(JSON.stringify(logged(log, 'Sonnet answered'))).not.toContain('front-loaded');
  });
});

describe('a cut-off answer keeps the day (founder ruling Oct 29 2026)', () => {
  it('(b) a complete answer with no themes: accepted, themes [] and the loss named in sourceFailures — beside a fetcher\'s own failure', async () => {
    state.macro = new Error('calendar down');
    state.create = vi.fn(async () => answer({ brief: FULL.brief, keyEvents: [EVENT, EVENT2] }));
    const r = await run();
    expect(r.statusCode).toBe(200);
    const [, doc] = state.set.mock.calls[0];
    expect(doc.dailyBrief).toBe(FULL.brief);
    expect(doc.keyEvents).toEqual([EVENT, EVENT2]);
    expect(doc.themes).toEqual([]);
    expect(doc.sourceFailures).toEqual(['macro-events', 'themes-truncated']);
    expect(r.body.sourceFailures).toEqual(['macro-events', 'themes-truncated']);
    expect(logged(err, 'Brief answer degraded')[0]).toMatchObject({ forDate: TODAY, failures: ['themes-truncated'], stopReason: 'tool_use' });
  });

  it('(b) cut off inside keyEvents (the failing days\' shape): the brief kept, themes [], and the last, possibly partial, event dropped', async () => {
    state.create = vi.fn(async () => answer({ brief: FULL.brief, keyEvents: [EVENT, EVENT2] }, { stop: 'max_tokens', output: 2500 }));
    const r = await run();
    expect(r.statusCode).toBe(200);
    expect(state.set.mock.calls[0][1]).toMatchObject({ dailyBrief: FULL.brief, keyEvents: [EVENT], themes: [], sourceFailures: ['output-max-tokens', 'key-events-incomplete', 'themes-truncated'] });
    expect(logged(log, 'Sonnet answered')[0]).toMatchObject({ stopReason: 'max_tokens', usage: { input: 2300, output: 2500 }, shape: { keyEvents: 'array:2', themes: 'missing', keys: ['brief', 'keyEvents'] } });
    expect(logged(err, 'Brief answer degraded')[0]).toMatchObject({ forDate: TODAY, failures: ['output-max-tokens', 'key-events-incomplete', 'themes-truncated'], stopReason: 'max_tokens' });
  });

  it('(b) themes that are not a list of strings are stored as [] the same way', async () => {
    for (const themes of ['AI capex', [1, 2], { a: 1 }, null]) {
      state.set.mockClear();
      state.create = vi.fn(async () => answer({ ...FULL, themes }));
      expect((await run()).statusCode, JSON.stringify(themes)).toBe(200);
      expect(state.set.mock.calls[0][1]).toMatchObject({ themes: [], sourceFailures: ['themes-truncated'] });
    }
  });

  it('a cut last event is dropped even when it looks whole: a ticker can be cut mid-word', async () => {
    const cutTickers = { ...EVENT2, tickers: ['MSFT', 'AZ'] };
    state.create = vi.fn(async () => answer({ brief: FULL.brief, keyEvents: [EVENT, cutTickers] }, { stop: 'max_tokens' }));
    await run();
    expect(state.set.mock.calls[0][1]).toMatchObject({ keyEvents: [EVENT], sourceFailures: ['output-max-tokens', 'key-events-incomplete', 'themes-truncated'] });
  });

  it('a partial event elsewhere in a cut answer is dropped too, never stored; a cut last theme is dropped', async () => {
    const partial = { label: 'NVDA earnings', eventDate: '2026-10-2' };
    state.create = vi.fn(async () => answer({ brief: FULL.brief, keyEvents: [partial, EVENT, EVENT2], themes: ['AI capex', 'rates repri'] }, { stop: 'max_tokens' }));
    await run();
    expect(state.set.mock.calls[0][1]).toMatchObject({ keyEvents: [EVENT, EVENT2], themes: ['AI capex'], sourceFailures: ['output-max-tokens', 'key-events-incomplete', 'themes-incomplete'] });
  });

  it('a complete answer with no keyEvents list at all: the brief is still kept, with keyEvents []', async () => {
    state.create = vi.fn(async () => answer({ brief: FULL.brief, themes: FULL.themes }));
    expect((await run()).statusCode).toBe(200);
    expect(state.set.mock.calls[0][1]).toMatchObject({ dailyBrief: FULL.brief, keyEvents: [], themes: FULL.themes, sourceFailures: ['key-events-truncated'] });
  });

  it('cut off inside the brief itself: not intact, so the run fails and nothing is written', async () => {
    state.create = vi.fn(async () => answer({ brief: 'The Fed meets Wednesday and the tape is' }, { stop: 'max_tokens', output: 2500 }));
    const r = await run();
    expect(r.statusCode).toBe(500);
    expect(r.body.error).toBe('Brief cut off at the output cap (stop_reason max_tokens)');
    expect(state.set).not.toHaveBeenCalled();
    expect(logged(err, 'Brief generation failed')[0]).toMatchObject({ stopReason: 'max_tokens', shape: { brief: 'string:39', keyEvents: 'missing', keys: ['brief'] } });
  });
});

describe('(c) only a missing or empty brief fails, and a failed run never overwrites the stored brief', () => {
  for (const [name, input] of [
    ['no brief', { keyEvents: [EVENT], themes: ['x'] }],
    ['an empty brief', { brief: '', keyEvents: [EVENT], themes: ['x'] }],
    ['a blank brief', { brief: '   ', keyEvents: [EVENT], themes: ['x'] }],
    ['a brief that is not text', { brief: ['x'], keyEvents: [EVENT], themes: ['x'] }],
    ['no input at all', undefined],
  ]) {
    it(`${name}: 500, nothing written, and the failure log still carries stop_reason and usage`, async () => {
      state.create = vi.fn(async () => answer(input, { stop: 'max_tokens', output: 2500 }));
      const r = await run();
      expect(r.statusCode).toBe(500);
      expect(r.body.error).toMatch(/non-empty brief/);
      expect(state.set).not.toHaveBeenCalled();
      expect(logged(err, 'Brief generation failed')[0]).toMatchObject({ forDate: TODAY, stopReason: 'max_tokens', usage: { input: 2300, output: 2500 }, earnings: 57 });
    });
  }

  it('no tool call in the answer: 500 and nothing written', async () => {
    state.create = vi.fn(async () => ({ content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
    const r = await run();
    expect(r.statusCode).toBe(500);
    expect(r.body.error).toBe('No tool_use block in Sonnet response');
    expect(state.set).not.toHaveBeenCalled();
  });

  it('an API error: 500, nothing written, the failure log with the input counts and no stop_reason', async () => {
    state.create = vi.fn(async () => { throw new Error('overloaded'); });
    const r = await run();
    expect(r.statusCode).toBe(500);
    expect(state.set).not.toHaveBeenCalled();
    expect(logged(err, 'Brief generation failed')[0]).toMatchObject({ message: 'overloaded', forDate: TODAY, earnings: 57, stopReason: null, usage: null });
  });

  it('the 45 s timeout still applies, unchanged: 500 and nothing written', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:30:00Z`));
    state.create = vi.fn(() => new Promise(() => {}));
    const pending = run();
    await vi.advanceTimersByTimeAsync(44_999);
    expect(state.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const r = await pending;
    expect(r.statusCode).toBe(500);
    expect(r.body.error).toBe('Sonnet timeout (45s)');
    expect(state.set).not.toHaveBeenCalled();
  });

  it('a create() that throws at once fails the run and leaves no timer behind to reject later', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:30:00Z`));
    state.create = vi.fn(() => { throw new Error('bad request'); });
    const r = await run();
    expect(r.statusCode).toBe(500);
    expect(r.body.error).toBe('bad request');
    expect(state.set).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a brief already stored for today is not regenerated', async () => {
    state.existing = { forDate: TODAY, dailyBrief: 'x' };
    const r = await run();
    expect(r.body).toMatchObject({ skipped: true });
    expect(state.create).not.toHaveBeenCalled();
  });
});

describe('readBriefAnswer — the reader on its own', () => {
  it('a complete answer reads with no failures', () => {
    expect(readBriefAnswer(answer(FULL))).toEqual({ brief: FULL.brief, keyEvents: [EVENT, EVENT2], themes: FULL.themes, failures: [] });
  });

  it('a complete answer stores its events as they came, as before: the field check is for a cut answer only', () => {
    const odd = { ...EVENT, kind: 'Fed', tickers: undefined };
    expect(readBriefAnswer(answer({ ...FULL, keyEvents: [EVENT, odd] }))).toEqual({ brief: FULL.brief, keyEvents: [EVENT, odd], themes: FULL.themes, failures: [] });
  });

  it('an answer cut inside themes keeps every event and drops only the last theme', () => {
    expect(readBriefAnswer(answer(FULL, { stop: 'max_tokens' }))).toEqual({ brief: FULL.brief, keyEvents: [EVENT, EVENT2], themes: ['AI capex'], failures: ['output-max-tokens', 'themes-incomplete'] });
  });

  it('in a cut answer, drops every event missing a required field or carrying one of the wrong type', () => {
    const bad = [
      { ...EVENT, label: '' }, { ...EVENT, eventDate: '2026-10-2' }, { ...EVENT, kind: 'earn' }, { ...EVENT, whyItMatters: undefined },
      { ...EVENT, tickers: 'SPY' }, { ...EVENT, tickers: ['SP', 3] }, null, 'FOMC', [EVENT],
    ];
    const read = readBriefAnswer(answer({ brief: FULL.brief, themes: FULL.themes, keyEvents: [EVENT, ...bad, EVENT2, EVENT] }, { stop: 'max_tokens' }));
    expect(read.keyEvents).toEqual([EVENT, EVENT2]);
    expect(read.themes).toEqual(FULL.themes);
    expect(read.failures).toEqual(['output-max-tokens', 'key-events-incomplete']);
  });

  it('a cut that falls inside a field is named even when nothing was left to drop', () => {
    expect(readBriefAnswer(answer({ brief: FULL.brief, keyEvents: [EVENT], themes: [] }, { stop: 'max_tokens' })))
      .toEqual({ brief: FULL.brief, keyEvents: [EVENT], themes: [], failures: ['output-max-tokens', 'themes-incomplete'] });
    expect(readBriefAnswer(answer({ brief: FULL.brief, keyEvents: [] }, { stop: 'max_tokens' })))
      .toEqual({ brief: FULL.brief, keyEvents: [], themes: [], failures: ['output-max-tokens', 'key-events-incomplete', 'themes-truncated'] });
  });

  it('keeps an event without its optional eventTime, cut or not', () => {
    const { eventTime, ...noTime } = EVENT;
    expect(eventTime).toBeDefined();
    expect(readBriefAnswer(answer({ ...FULL, keyEvents: [noTime] })).keyEvents).toEqual([noTime]);
    expect(readBriefAnswer(answer({ brief: FULL.brief, themes: FULL.themes, keyEvents: [noTime, noTime] }, { stop: 'max_tokens' })).keyEvents).toEqual([noTime]);
  });
});
