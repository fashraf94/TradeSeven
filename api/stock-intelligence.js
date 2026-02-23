// api/stock-intelligence.js
// Stock Intelligence Agent — Educational analysis endpoint powered by Claude.
// Takes a symbol + question, fetches cached market data, and returns
// balanced educational analysis with bull/bear perspectives.

import { applySecurityMiddleware } from './_utils/security.js';
import { getStockAnalysisData } from './_utils/marketDataCache.js';
import { buildIntelligencePrompt, detectComparisonSymbols } from './_utils/intelligencePrompt.js';
import { getSupplyChainCoverage } from './_utils/supplyChainLookup.js';
import { getStockContext, TICKERS } from './_utils/stockIntelligenceData.js';

const LOG_PREFIX = '[StockIntelligence]';

// ── Configuration constants ──────────────────────────────────
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MAX_TOKENS_BASE = 1200;
const MAX_TOKENS_COMPARISON = 1500;
const MAX_TOKENS_QUICK = 1200;
const MAX_TOKENS_DEEP = 2000;
const RATE_LIMIT = 15;
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_SYMBOL_LENGTH = 10;
const MAX_QUESTION_LENGTH = 500;

export default async function handler(req, res) {
  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS } })) {
    return;
  }

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Validate API key
  const API_KEY = process.env.CLAUDE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  // 4. Extract and validate request body
  const { symbol, question, context, mode: requestedMode } = req.body || {};

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing required field: symbol' });
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  if (cleanSymbol.length > MAX_SYMBOL_LENGTH || !/^[A-Z0-9.\-]+$/.test(cleanSymbol)) {
    return res.status(400).json({ success: false, error: 'Invalid symbol format' });
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Missing required field: question' });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ success: false, error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` });
  }

  try {
    // 5. Detect comparison mode — user may be comparing two assets
    const comparison = detectComparisonSymbols(question);

    // 6. Fetch cached market data (both assets in comparison mode)
    let stockData;
    let comparisonData = null;

    if (comparison) {
      // Fetch both assets in parallel
      const [dataA, dataB] = await Promise.all([
        getStockAnalysisData(comparison.symbolA),
        getStockAnalysisData(comparison.symbolB),
      ]);
      stockData = dataA;
      comparisonData = dataB;
    } else {
      stockData = await getStockAnalysisData(cleanSymbol);
    }

    // ── Intelligence Bundle path (supported stocks, non-comparison) ──
    const isSupported = TICKERS.includes(cleanSymbol);

    if (isSupported && !comparison) {
      const mode = requestedMode === 'deep' ? 'deep' : 'quick';

      // Format live EODHD data as a string for the context builder
      const latestClose = stockData.daily?.[0]?.close;
      const prevClose = stockData.daily?.[1]?.close;
      const changePct = latestClose && prevClose
        ? (((latestClose - prevClose) / prevClose) * 100).toFixed(2)
        : 'N/A';
      const fund = stockData.fundamentals || {};
      const rsiVal = stockData.technicals?.rsi?.value;

      const eohdString = [
        `Price: $${latestClose ?? 'N/A'}`,
        `Change: ${changePct}%`,
        `52w Low/High: $${fund.week52Low ?? 'N/A'} / $${fund.week52High ?? 'N/A'}`,
        `Market Cap: ${formatMarketCap(fund.marketCap)}`,
        `P/E: ${fund.peRatio ?? 'N/A'}`,
        `RSI(14): ${rsiVal ?? 'N/A'}`,
        `MA50: $${fund.ma50 ?? 'N/A'}`,
        `MA200: $${fund.ma200 ?? 'N/A'}`,
        `Consensus: ${getConsensusLabel(fund.analystRating)}`,
      ].join(' | ');

      // Build enriched context from the intelligence bundle
      const bundleContext = getStockContext(cleanSymbol, eohdString, { mode });

      // Mode-specific system prompts — produce structured JSON matching AnalysisCard schema
      const intelligenceSystemPrompt = mode === 'quick'
        ? `You are the MarketClash Stock Intelligence Agent — an educational tool that helps users understand stocks through data-backed analysis. You are NOT a financial advisor.\n\nMODE: QUICK INSIGHTS\nRespond ONLY with valid JSON, no markdown fences, no preamble.\nSchema:\n{\n  "headline": "Key tension or insight in ≤12 words",\n  "content": "3-4 bullet points. Each bullet: **Metric:** Value — one sentence of context. Keep total under 120 words. Never recommend buying or selling.",\n  "dataPoints": [\n    { "label": "METRIC NAME", "value": "specific number or value", "context": "One sentence explaining what it means" }\n  ],\n  "bullCase": "2-3 sentences. Data-backed reasons for optimism. Cite specific metrics.",\n  "bearCase": "2-3 sentences. Data-backed risks or concerns. Cite specific metrics.",\n  "educationalNote": "Teach one concept that helps the user understand this stock better. 2-3 sentences."\n}\nRules:\n- dataPoints: exactly 3-4 items, each with a concrete number\n- content: use **bold** for metric names in bullets\n- Never recommend buying, selling, or holding\n- Every claim must reference a specific number from the provided data`
        : `You are the MarketClash Stock Intelligence Agent — an educational tool that helps users understand stocks through data-backed analysis. You are NOT a financial advisor.\n\nMODE: DEEP ANALYSIS\nRespond ONLY with valid JSON, no markdown fences, no preamble.\nSchema:\n{\n  "headline": "Key tension or thesis in ≤15 words",\n  "content": "3-4 paragraphs of analysis. Lead with data, not opinion. Explain concepts — teach what metrics mean, not just their values. Present both sides. Reference cross-company connections when relevant. Use 'the data suggests,' 'bulls would argue / bears would counter.' Keep under 300 words. Never recommend buying or selling.",\n  "dataPoints": [\n    { "label": "METRIC NAME", "value": "specific number or value", "context": "One sentence explaining significance" }\n  ],\n  "bullCase": "3-4 sentences. Comprehensive data-backed bull thesis with specific metrics and cross-company context.",\n  "bearCase": "3-4 sentences. Comprehensive data-backed bear thesis with specific metrics and structural risks.",\n  "educationalNote": "Teach one important concept this data reveals — explain a metric, a pattern, or a structural dynamic that helps the user think about stocks more intelligently. 3-4 sentences."\n}\nRules:\n- dataPoints: exactly 4 items, each with a concrete number\n- content: use **bold** for emphasis on key terms\n- Never recommend buying, selling, or holding\n- Every claim must reference a specific number from the provided data\n- Cross-company connections (e.g., how this stock relates to others) are encouraged in content and bullCase/bearCase`;

      const intelligenceUserMessage = `${bundleContext}\n\n---\n\nUser Question: ${question.trim()}`;

      const maxTokens = mode === 'quick' ? MAX_TOKENS_QUICK : MAX_TOKENS_DEEP;

      const intelligenceResponse = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          system: intelligenceSystemPrompt,
          messages: [{ role: 'user', content: intelligenceUserMessage }],
        }),
      });

      const intelligenceData = await intelligenceResponse.json();

      if (intelligenceData.error || !intelligenceResponse.ok) {
        console.error(`${LOG_PREFIX} Intelligence API error:`, intelligenceData.error);
        return res.status(200).json({
          success: false,
          error: 'AI analysis unavailable',
          details: intelligenceData.error?.message || 'Unknown API error',
        });
      }

      const rawText = intelligenceData.content?.[0]?.text || '';

      // Parse the JSON response from Haiku
      const parsed = extractJSON(rawText);
      let analysis;
      if (parsed && parsed.headline) {
        analysis = parsed;
      } else {
        // Fallback: wrap raw text as plain content
        analysis = {
          headline: `${cleanSymbol} Analysis`,
          content: rawText,
          dataPoints: [],
          bullCase: '',
          bearCase: '',
          educationalNote: '',
        };
      }

      // Add intelligenceMode to the parsed analysis
      analysis.intelligenceMode = mode;

      const usage = {
        inputTokens: intelligenceData.usage?.input_tokens || 0,
        outputTokens: intelligenceData.usage?.output_tokens || 0,
      };
      const scCoverage = getSupplyChainCoverage(cleanSymbol);

      return res.status(200).json({
        success: true,
        analysis,
        meta: {
          symbol: cleanSymbol,
          questionTypes: [],
          isComparison: false,
          comparisonSymbols: null,
          isCrypto: stockData.isCrypto,
          cacheStatus: stockData.cacheStatus,
          staleData: stockData.staleData || false,
          staleFields: stockData.staleFields || [],
          hasSupplyChainData: scCoverage.hasCompany,
          supplyChainCoverage: [
            ...(scCoverage.hasProducts ? ['products'] : []),
            ...(scCoverage.hasThemes ? ['themes'] : []),
            ...(scCoverage.hasScenarios ? ['scenarios'] : []),
          ],
          model: CLAUDE_MODEL,
          usage,
        },
      });
    }

    // 7. Build prompt (with compound question type detection + comparison support)
    const {
      systemPrompt, userPrompt, questionTypes, estimatedTokens,
      isComparison, comparisonSymbols,
    } = buildIntelligencePrompt(
      question.trim(),
      stockData,
      context || {},
      comparisonData
    );

    // 8. Call Claude API
    const maxTokens = isComparison ? MAX_TOKENS_COMPARISON : MAX_TOKENS_BASE;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error || !response.ok) {
      console.error(`${LOG_PREFIX} Anthropic API error:`, data.error);
      return res.status(200).json({
        success: false,
        error: 'AI analysis unavailable',
        details: data.error?.message || 'Unknown API error',
      });
    }

    // 9. Parse JSON response — multi-strategy with markdown fence stripping
    const rawText = data.content?.[0]?.text || '';
    let analysis;

    try {
      // Step A: Strip markdown code fences that Claude sometimes adds
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Step B: Try parsing the cleaned text directly (pure JSON response)
      try {
        analysis = JSON.parse(cleaned);
      } catch {
        // Step C: Extract the outermost JSON object via regex
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in response');
        analysis = JSON.parse(jsonMatch[0]);
      }

      // Step D: Validate that we got the expected structure
      if (!analysis.headline && !analysis.content) {
        throw new Error('Parsed object missing expected fields');
      }
    } catch (parseError) {
      // All parsing strategies failed — extract fields individually from broken JSON
      console.warn(`${LOG_PREFIX} JSON parse failed, attempting field extraction:`, parseError.message);

      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Extract a string field: "fieldName": "value (may contain escaped quotes)"
      const extractStr = (field) => {
        const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
        const m = cleaned.match(re);
        return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t') : '';
      };

      // Extract an object field: "fieldName": { ... } — brace-counting for nested objects
      const extractObj = (field) => {
        const marker = `"${field}"`;
        const startIdx = cleaned.indexOf(marker);
        if (startIdx === -1) return {};
        const braceStart = cleaned.indexOf('{', startIdx + marker.length);
        if (braceStart === -1) return {};
        let depth = 0;
        for (let i = braceStart; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++;
          else if (cleaned[i] === '}') {
            depth--;
            if (depth === 0) {
              try { return JSON.parse(cleaned.substring(braceStart, i + 1)); }
              catch { return {}; }
            }
          }
        }
        return {};
      };

      analysis = {
        headline: extractStr('headline') || `${cleanSymbol} Analysis`,
        content: extractStr('content') || 'Analysis could not be fully parsed. Please try rephrasing your question.',
        dataPoints: extractObj('dataPoints'),
        bullCase: extractStr('bullCase'),
        bearCase: extractStr('bearCase'),
        educationalNote: extractStr('educationalNote'),
      };
    }

    // 10. Token usage
    const usage = {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };

    // 11. Supply chain coverage check
    const scCoverage = getSupplyChainCoverage(cleanSymbol);

    // 12. Return structured response
    return res.status(200).json({
      success: true,
      analysis,
      meta: {
        symbol: cleanSymbol,
        questionTypes,
        isComparison: isComparison || false,
        comparisonSymbols: comparisonSymbols || null,
        isCrypto: stockData.isCrypto,
        cacheStatus: stockData.cacheStatus,
        staleData: stockData.staleData || false,
        staleFields: stockData.staleFields || [],
        hasSupplyChainData: scCoverage.hasCompany,
        supplyChainCoverage: [
          ...(scCoverage.hasProducts ? ['products'] : []),
          ...(scCoverage.hasThemes ? ['themes'] : []),
          ...(scCoverage.hasScenarios ? ['scenarios'] : []),
        ],
        model: CLAUDE_MODEL,
        usage,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
    return res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}

// ── Helper: extract JSON from Claude response (fence-agnostic) ─
function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Strategy 1: Try parsing the raw string directly (ideal case — no fences)
  try {
    return JSON.parse(raw.trim());
  } catch (e) { /* continue */ }

  // Strategy 2: Find the first { and last } and try parsing that substring
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch (e) { /* continue */ }
  }

  // Strategy 3: Failed to parse
  return null;
}

// ── Helper: format market cap for display ────────────────────
function formatMarketCap(val) {
  if (!val) return 'N/A';
  if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
  if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(0) + 'M';
  return String(val);
}

// ── Helper: analyst rating → consensus label ─────────────────
function getConsensusLabel(analystRating) {
  if (!analystRating) return 'N/A';
  if (analystRating >= 4.5) return 'Strong Buy';
  if (analystRating >= 3.5) return 'Buy';
  if (analystRating >= 2.5) return 'Hold';
  if (analystRating >= 1.5) return 'Sell';
  return 'Strong Sell';
}
