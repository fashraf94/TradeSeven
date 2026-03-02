#!/usr/bin/env node
/**
 * Builds stockIntelligenceData.js — 20-stock version
 * 
 * Sources:
 *   Batch 1 (Tech): Preserves existing embedded data from current stockIntelligenceData.js
 *   Batch 2 (Financials): Reads from project files (_knowledge_package.md, _ledger_extract.md, _deep_research_extract.md)
 *
 * Run: node buildStockData.js
 * Output: stockIntelligenceData.js (importable ES module)
 */

const fs = require('fs');

const TICKERS = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AMD', 'AVGO', 'SNOW',
  'JPM', 'C', 'GS', 'MS', 'V', 'AXP', 'BX', 'AFRM', 'PNC', 'ALLY',
];

const BATCH1_TICKERS = TICKERS.slice(0, 10);
const BATCH2_TICKERS = TICKERS.slice(10);

const STOCK_META = {
  NVDA: { name: 'NVIDIA Corporation', shortName: 'NVIDIA', sector: 'Semiconductors', fyEnd: 'Late January' },
  AAPL: { name: 'Apple Inc.', shortName: 'Apple', sector: 'Consumer Electronics', fyEnd: 'Late September' },
  MSFT: { name: 'Microsoft Corporation', shortName: 'Microsoft', sector: 'Software / Cloud', fyEnd: 'June 30' },
  AMZN: { name: 'Amazon.com Inc.', shortName: 'Amazon', sector: 'E-Commerce / Cloud', fyEnd: 'December 31' },
  META: { name: 'Meta Platforms Inc.', shortName: 'Meta', sector: 'Social Media / Advertising', fyEnd: 'December 31' },
  GOOGL: { name: 'Alphabet Inc.', shortName: 'Alphabet', sector: 'Search / Cloud', fyEnd: 'December 31' },
  TSLA: { name: 'Tesla Inc.', shortName: 'Tesla', sector: 'Automotive / Energy', fyEnd: 'December 31' },
  AMD: { name: 'Advanced Micro Devices Inc.', shortName: 'AMD', sector: 'Semiconductors', fyEnd: 'Late December' },
  AVGO: { name: 'Broadcom Inc.', shortName: 'Broadcom', sector: 'Semiconductors / Software', fyEnd: 'Early November' },
  SNOW: { name: 'Snowflake Inc.', shortName: 'Snowflake', sector: 'Cloud Data Platform', fyEnd: 'January 31' },
  JPM: { name: 'JPMorgan Chase & Co.', shortName: 'JPMorgan', sector: 'Diversified Banking', fyEnd: 'December 31' },
  C: { name: 'Citigroup Inc.', shortName: 'Citigroup', sector: 'Diversified Banking', fyEnd: 'December 31' },
  GS: { name: 'Goldman Sachs Group Inc.', shortName: 'Goldman Sachs', sector: 'Investment Banking', fyEnd: 'December 31' },
  MS: { name: 'Morgan Stanley', shortName: 'Morgan Stanley', sector: 'Investment Banking / Wealth Management', fyEnd: 'December 31' },
  V: { name: 'Visa Inc.', shortName: 'Visa', sector: 'Payment Networks', fyEnd: 'September 30' },
  AXP: { name: 'American Express Company', shortName: 'American Express', sector: 'Payment Networks / Consumer Finance', fyEnd: 'December 31' },
  BX: { name: 'Blackstone Inc.', shortName: 'Blackstone', sector: 'Alternative Asset Management', fyEnd: 'December 31' },
  AFRM: { name: 'Affirm Holdings Inc.', shortName: 'Affirm', sector: 'Fintech / BNPL', fyEnd: 'June 30' },
  PNC: { name: 'PNC Financial Services Group Inc.', shortName: 'PNC', sector: 'Regional Banking', fyEnd: 'December 31' },
  ALLY: { name: 'Ally Financial Inc.', shortName: 'Ally', sector: 'Digital Banking / Auto Finance', fyEnd: 'December 31' },
};

const PROJECT_DIR = '/mnt/project';

function readFile(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

// Step 1: Extract existing Batch 1 data from current stockIntelligenceData.js
console.log('Step 1: Extracting Batch 1 (Tech) data from existing stockIntelligenceData.js...');
const existingContent = readFile(`${PROJECT_DIR}/stockIntelligenceData.js`);
let existingData = {};

if (existingContent) {
  const match = existingContent.match(/export const STOCK_DATA = ({[\s\S]*?});/);
  if (match) {
    try {
      existingData = eval('(' + match[1] + ')');
      console.log(`  Extracted ${Object.keys(existingData).length} stocks from existing file`);
    } catch (e) {
      console.error('  ERROR parsing existing file:', e.message);
    }
  }
}

// Step 2: Build combined stock data
console.log('\nStep 2: Building combined 20-stock dataset...');
const stockData = {};

// Batch 1: Preserve existing embedded data, refresh KP from project files
for (const ticker of BATCH1_TICKERS) {
  if (existingData[ticker]) {
    const freshKP = readFile(`${PROJECT_DIR}/${ticker}_knowledge_package.md`);
    stockData[ticker] = {
      ...STOCK_META[ticker],
      ticker,
      knowledgePackage: freshKP || existingData[ticker].knowledgePackage,
      ledgerExtract: existingData[ticker].ledgerExtract || '',
      deepResearch: existingData[ticker].deepResearch || '',
    };
    console.log(`  ${ticker}: preserved (KP: ${stockData[ticker].knowledgePackage.length}b, Ledger: ${stockData[ticker].ledgerExtract.length}b, Deep: ${stockData[ticker].deepResearch.length}b)`);
  } else {
    stockData[ticker] = {
      ...STOCK_META[ticker],
      ticker,
      knowledgePackage: readFile(`${PROJECT_DIR}/${ticker}_knowledge_package.md`),
      ledgerExtract: '',
      deepResearch: '',
    };
    console.warn(`  ${ticker}: WARNING - no existing data, KP only`);
  }
}

// Batch 2: Read from project files
for (const ticker of BATCH2_TICKERS) {
  const kp = readFile(`${PROJECT_DIR}/${ticker}_knowledge_package.md`);
  const ledger = readFile(`${PROJECT_DIR}/${ticker}_ledger_extract.md`);
  const deep = readFile(`${PROJECT_DIR}/${ticker}_deep_research_extract.md`);

  if (!kp) console.warn(`  WARNING: Missing knowledge package for ${ticker}`);
  if (!ledger) console.warn(`  WARNING: Missing ledger extract for ${ticker}`);
  if (!deep) console.warn(`  WARNING: Missing deep research extract for ${ticker}`);

  stockData[ticker] = {
    ...STOCK_META[ticker],
    ticker,
    knowledgePackage: kp,
    ledgerExtract: ledger,
    deepResearch: deep,
  };
  console.log(`  ${ticker}: loaded (KP: ${kp.length}b, Ledger: ${ledger.length}b, Deep: ${deep.length}b)`);
}

// Step 3: Generate output
console.log('\nStep 3: Generating stockIntelligenceData.js...');

const output = `// Auto-generated by buildStockData.js — ${new Date().toISOString().split('T')[0]}
// Three-tier context architecture for ${TICKERS.length} stocks.
// Batch 1: Tech/Digital Economy (NVDA, AAPL, MSFT, AMZN, META, GOOGL, TSLA, AMD, AVGO, SNOW)
// Batch 2: Financial Sector (JPM, C, GS, MS, V, AXP, BX, AFRM, PNC, ALLY)
//
// Tier 1 (Quick Mode): knowledgePackage + ledgerExtract + real-time data
// Tier 2 (Deep Mode):  Tier 1 + deepResearch
//
// Usage:
//   import { STOCK_DATA, getStockContext, TICKERS } from './stockIntelligenceData';
//
//   const quickCtx = getStockContext('NVDA', eohdDataString);
//   const deepCtx = getStockContext('NVDA', eohdDataString, { mode: 'deep' });

export const TICKERS = ${JSON.stringify(TICKERS)};

export const STOCK_DATA = ${JSON.stringify(stockData, null, 2)};

/**
 * Assembles the context string for a single-stock Haiku API call.
 */
export function getStockContext(ticker, realtimeData = '', options = {}) {
  const { mode = 'quick' } = options;
  const stock = STOCK_DATA[ticker];
  if (!stock) {
    throw new Error(\`Unknown ticker: \${ticker}. Available: \${TICKERS.join(', ')}\`);
  }

  let context = stock.knowledgePackage;

  if (stock.ledgerExtract) {
    context += '\\n\\n---\\n\\n' + stock.ledgerExtract;
  }

  if (mode === 'deep' && stock.deepResearch) {
    context += '\\n\\n---\\n\\n' + stock.deepResearch;
  }

  if (realtimeData) {
    context += '\\n\\n---\\n\\n## REAL-TIME MARKET DATA\\n' + realtimeData;
  }

  return context;
}

/**
 * Returns metadata for a stock without the full text content.
 */
export function getStockMeta(ticker) {
  const stock = STOCK_DATA[ticker];
  if (!stock) return null;
  const { knowledgePackage, ledgerExtract, deepResearch, ...meta } = stock;
  return meta;
}

/**
 * Returns estimated token counts for a stock's context layers.
 */
export function getTokenEstimate(ticker) {
  const stock = STOCK_DATA[ticker];
  if (!stock) return null;
  const quickTokens = Math.round((stock.knowledgePackage.length + stock.ledgerExtract.length + 200) / 4);
  const deepTokens = quickTokens + Math.round(stock.deepResearch.length / 4);
  return { quick: quickTokens, deep: deepTokens };
}
`;

fs.writeFileSync('/home/claude/stockIntelligenceData.js', output, 'utf8');

// === SUMMARY ===
console.log('\n========================================');
console.log('  BUILD COMPLETE — 20 STOCKS');
console.log('========================================');
console.log(`Stocks bundled: ${TICKERS.length}`);
const totalSize = Buffer.byteLength(output, 'utf8');
console.log(`Output file size: ${(totalSize / 1024).toFixed(1)} KB`);
console.log(`Estimated total tokens (all stocks, all tiers): ~${Math.round(totalSize / 4)}`);

console.log('\nPer-stock context sizes:');
console.log('  Ticker  | Quick Mode      | Deep Mode       | Deep Research');
console.log('  --------|-----------------|-----------------|-------------');
for (const t of TICKERS) {
  const s = stockData[t];
  const quickBytes = s.knowledgePackage.length + s.ledgerExtract.length + 200;
  const deepBytes = quickBytes + s.deepResearch.length;
  const drBytes = s.deepResearch.length;
  const qTok = Math.round(quickBytes / 4);
  const dTok = Math.round(deepBytes / 4);
  const drTok = Math.round(drBytes / 4);
  console.log(`  ${t.padEnd(8)}| ~${String(qTok).padEnd(5)} tok (${(qTok/200000*100).toFixed(1)}%) | ~${String(dTok).padEnd(5)} tok (${(dTok/200000*100).toFixed(1)}%) | ~${drTok} tok`);
}

const avgQuick = TICKERS.reduce((sum, t) => {
  const s = stockData[t];
  return sum + s.knowledgePackage.length + s.ledgerExtract.length + 200;
}, 0) / TICKERS.length;
const avgDeep = TICKERS.reduce((sum, t) => {
  const s = stockData[t];
  return sum + s.knowledgePackage.length + s.ledgerExtract.length + s.deepResearch.length + 200;
}, 0) / TICKERS.length;

console.log(`\n  Average Quick Mode: ~${Math.round(avgQuick/4)} tokens (${(avgQuick/4/200000*100).toFixed(1)}% of 200K window)`);
console.log(`  Average Deep Mode:  ~${Math.round(avgDeep/4)} tokens (${(avgDeep/4/200000*100).toFixed(1)}% of 200K window)`);

for (const [label, tickers] of [['Batch 1 (Tech)', BATCH1_TICKERS], ['Batch 2 (Financial)', BATCH2_TICKERS]]) {
  const bAvgQ = tickers.reduce((sum, t) => {
    const s = stockData[t];
    return sum + s.knowledgePackage.length + s.ledgerExtract.length + 200;
  }, 0) / tickers.length;
  const bAvgD = tickers.reduce((sum, t) => {
    const s = stockData[t];
    return sum + s.knowledgePackage.length + s.ledgerExtract.length + s.deepResearch.length + 200;
  }, 0) / tickers.length;
  console.log(`\n  ${label}:`);
  console.log(`    Avg Quick: ~${Math.round(bAvgQ/4)} tok | Avg Deep: ~${Math.round(bAvgD/4)} tok`);
}

console.log(`\nOutput: /home/claude/stockIntelligenceData.js`);
