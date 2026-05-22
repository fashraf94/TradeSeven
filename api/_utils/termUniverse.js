// api/_utils/termUniverse.js
//
// Phase 2.5 Voice Layer Rework — backend term token list.
//
// Thin sibling of src/data/termUniverse.js (which carries the full modal
// content). This file exposes ONLY the token list — the Voice Layer prompt
// block (SUPPORTED_TERMS_BLOCK in voiceLayerPrompt.js) needs to know which
// terms have backing modals so Gemma's vocabulary biases toward terms users
// can self-serve on.
//
// The split exists because api/ cannot import from src/ under Vercel
// serverless functions (see api/_utils/rankingConfig.js line 7 for the same
// constraint). Drift between this file and src/data/termUniverse.js is
// caught by TM6 in api/scripts/test-voice-layer-phase-2-5.js, which
// compares the token sets of both files.
//
// LINTED BY test-voice-layer-phase-2-5.js TM6 — preserve "TOKEN: " line format

export const TERM_UNIVERSE = {
  VWAP: 'VWAP',
  RSI:  'RSI',
  MACD: 'MACD',
  ATR:  'ATR',
  SMA:  'SMA',
  EMA:  'EMA',
  PCE:  'PCE',
  CPI:  'CPI',
  FOMC: 'FOMC',
  NFP:  'NFP',
  PPI:  'PPI',
  GDP:  'GDP',
};

export const TERM_TOKENS = Object.keys(TERM_UNIVERSE);
