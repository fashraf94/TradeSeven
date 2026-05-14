// api/_utils/signalDropPrompt.test.js
//
// Sprint 6 Phase 4.5a — verifies the set-intersection logic added to
// buildDialogueInputs. Decision 4 locked: dialogue prompt sees only validated
// explicit tickers; impliedTickers stays raw. The intersection is applied with
// normalizeTicker canonicalization so BRK.B / BRK-B variants don't slip
// through as silent mismatches.

import { describe, it, expect } from 'vitest';
import { buildDialogueInputs } from './signalDropPrompt.js';

describe('buildDialogueInputs — Phase 4.5a set intersection', () => {
  it('V-26: filters off-universe tickers from parse.tickers', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: {
        tickers: ['AAPL', 'GK'],
        impliedTickers: [],
        extractedText: 'test',
        topic: 'test',
        contentType: 'tweet',
        signalDirection: 'bullish',
        timeHorizon: 'positional',
        referencedDate: '',
        dataPoints: [],
        confidence: 0.8,
      },
      validation: {
        validated: [{ symbol: 'AAPL', sectorId: 'XLK' }],
        unsupported: ['GK'],
      },
    });
    expect(parsedSignalBlock.tickers).toEqual(['AAPL']);
  });

  it('V-27: all-validated input — parsed block contains full list', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: { tickers: ['AAPL', 'MSFT', 'XLK'], impliedTickers: [] },
      validation: {
        validated: [
          { symbol: 'AAPL', sectorId: 'XLK' },
          { symbol: 'MSFT', sectorId: 'XLK' },
          { symbol: 'XLK', sectorId: 'XLK' },
        ],
        unsupported: [],
      },
    });
    expect(parsedSignalBlock.tickers).toEqual(['AAPL', 'MSFT', 'XLK']);
  });

  it('V-28: all-unsupported input — parsed block tickers empty', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: { tickers: ['GK', 'ARKK'], impliedTickers: [] },
      validation: {
        validated: [],
        unsupported: ['GK', 'ARKK'],
      },
    });
    expect(parsedSignalBlock.tickers).toEqual([]);
  });

  it('V-29: impliedTickers passes through unchanged regardless of validation', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: { tickers: [], impliedTickers: ['NVDA', 'MSFT'] },
      validation: { validated: [], unsupported: [] },
    });
    expect(parsedSignalBlock.impliedTickers).toEqual(['NVDA', 'MSFT']);
  });

  it('V-30: normalization — BRK.B in parse.tickers matches BRK-B in validation', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: { tickers: ['BRK.B', 'AAPL'], impliedTickers: [] },
      validation: {
        validated: [
          { symbol: 'BRK-B', sectorId: 'XLF' },
          { symbol: 'AAPL', sectorId: 'XLK' },
        ],
        unsupported: [],
      },
    });
    expect(parsedSignalBlock.tickers).toEqual(['BRK-B', 'AAPL']);
  });

  it('V-31: missing validation field — parsed block tickers empty (no throw)', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: { tickers: ['AAPL'], impliedTickers: [] },
    });
    expect(parsedSignalBlock.tickers).toEqual([]);
  });

  it('throws when parseResult is missing', () => {
    expect(() => buildDialogueInputs(null)).toThrow();
    expect(() => buildDialogueInputs(undefined)).toThrow();
  });

  it('case-insensitive normalization (lowercase tickers from Haiku)', () => {
    const { parsedSignalBlock } = buildDialogueInputs({
      parse: { tickers: ['aapl', 'msft'], impliedTickers: [] },
      validation: {
        validated: [
          { symbol: 'AAPL', sectorId: 'XLK' },
          { symbol: 'MSFT', sectorId: 'XLK' },
        ],
        unsupported: [],
      },
    });
    expect(parsedSignalBlock.tickers).toEqual(['AAPL', 'MSFT']);
  });
});
