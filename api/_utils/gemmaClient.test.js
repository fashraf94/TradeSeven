// api/_utils/gemmaClient.test.js
//
// Coverage for parseVoiceLayerResponse — the 4-tier JSON extractor.
//
// Background: previously tier-4 returned `{ response: cleanedText || '...' }`
// which let Gemma's plain-text failure responses (e.g., "I have hit a snag…")
// flow through verbatim as agentMessage in callers that didn't shape-check.
// The contract changed to a structured parse-failure shape:
//   { parseError: true, errorReason: 'plaintext_passthrough' | 'empty_content', rawText }
// Callers MUST detect parseError and route to their own structured-error path.

import { describe, it, expect } from 'vitest';
import { parseVoiceLayerResponse } from './gemmaClient.js';

describe('parseVoiceLayerResponse — happy paths (tiers 1-3 unchanged)', () => {
  it('tier 1: parses raw JSON', () => {
    const out = parseVoiceLayerResponse('{"response":"hello","hasDirective":false}');
    expect(out).toEqual({ response: 'hello', hasDirective: false });
    expect(out.parseError).toBeUndefined();
  });

  it('tier 2: extracts JSON from a fenced ```json block', () => {
    const fenced = 'preamble\n```json\n{"response":"hi","scratchpad":"thinking"}\n```\ntrailing prose';
    const out = parseVoiceLayerResponse(fenced);
    expect(out).toEqual({ response: 'hi', scratchpad: 'thinking' });
    expect(out.parseError).toBeUndefined();
  });

  it('tier 3: extracts the first {...} object even with surrounding prose', () => {
    const messy = 'Sure, here you go: {"response":"hi","x":1} and then some explanation.';
    const out = parseVoiceLayerResponse(messy);
    // Tier 3 grabs from first { to the LAST } via /\{[\s\S]*\}/.
    // For this input the last } is the JSON's own closer, so we get a clean parse.
    expect(out).toEqual({ response: 'hi', x: 1 });
    expect(out.parseError).toBeUndefined();
  });

  it('preserves arbitrary nested keys when JSON is valid', () => {
    const json = '{"response":"hi","activeThesis":{"summary":"s","instruments":["AAPL"]}}';
    const out = parseVoiceLayerResponse(json);
    expect(out.activeThesis.summary).toBe('s');
    expect(out.activeThesis.instruments).toEqual(['AAPL']);
  });
});

describe('parseVoiceLayerResponse — tier 4 structured parse failure', () => {
  it('returns parseError=true with errorReason="plaintext_passthrough" on plain text', () => {
    const out = parseVoiceLayerResponse('I have hit a snag, could you repeat the question?');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('plaintext_passthrough');
    expect(out.rawText).toBe('I have hit a snag, could you repeat the question?');
  });

  it('returns parseError=true with errorReason="empty_content" on empty string', () => {
    const out = parseVoiceLayerResponse('');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
    expect(out.rawText).toBe('');
  });

  it('returns parseError=true with errorReason="empty_content" on whitespace only', () => {
    const out = parseVoiceLayerResponse('   \n\t  ');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
  });

  it('returns parseError=true with errorReason="empty_content" when only fenced code blocks remain', () => {
    // Fenced block is non-JSON so tier 2 fails to parse; tier 3 also fails;
    // tier 4 strips ```...``` and finds nothing left → empty_content.
    const out = parseVoiceLayerResponse('```\nnot json\n```');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
  });

  it('preserves the raw text verbatim for shadow logging', () => {
    const raw = "I'm sorry, I cannot help with that request.";
    const out = parseVoiceLayerResponse(raw);
    expect(out.parseError).toBe(true);
    expect(out.rawText).toBe(raw);
  });

  it('returns parseError shape (not throw) on null input', () => {
    const out = parseVoiceLayerResponse(null);
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
    expect(out.rawText).toBe('');
  });

  it('returns parseError shape (not throw) on undefined input', () => {
    const out = parseVoiceLayerResponse(undefined);
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
    expect(out.rawText).toBe('');
  });

  it('returns parseError on malformed JSON that looks like JSON', () => {
    // Trailing comma — invalid JSON, no fence, no extractable {...}.
    // Wait: regex /\{[\s\S]*\}/ DOES match this. JSON.parse fails → falls to tier 4.
    const out = parseVoiceLayerResponse('{"response": "hi",}');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('plaintext_passthrough');
  });
});

describe('parseVoiceLayerResponse — contract guarantees', () => {
  it('never throws on garbage input', () => {
    const garbageInputs = [
      null,
      undefined,
      '',
      '   ',
      'not json at all',
      '{ broken',
      '}{}',
      '```',
      '```json\nnot json```',
      '{ "key": "value" extra junk',
    ];
    for (const input of garbageInputs) {
      expect(() => parseVoiceLayerResponse(input)).not.toThrow();
    }
  });

  it('parseError shape never includes legacy fields like response/_scratchpad', () => {
    // Regression guard: if a caller still reads parsed.response on a
    // parse failure, it should get undefined (not Gemma's plain text).
    const out = parseVoiceLayerResponse('I have hit a snag.');
    expect(out.response).toBeUndefined();
    expect(out._scratchpad).toBeUndefined();
    expect(out.hasDirective).toBeUndefined();
    expect(out.directive).toBeUndefined();
    expect(out.suggestedActions).toBeUndefined();
  });
});
