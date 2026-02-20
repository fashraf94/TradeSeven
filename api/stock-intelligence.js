// api/stock-intelligence.js
// Stock Intelligence Agent — Educational analysis endpoint powered by Claude.
// Takes a symbol + question, fetches cached market data, and returns
// balanced educational analysis with bull/bear perspectives.

import { applySecurityMiddleware } from './_utils/security.js';
import { getStockAnalysisData } from './_utils/marketDataCache.js';
import { buildIntelligencePrompt, detectComparisonSymbols } from './_utils/intelligencePrompt.js';
import { getSupplyChainCoverage } from './_utils/supplyChainLookup.js';

const LOG_PREFIX = '[StockIntelligence]';

// ── Configuration constants ──────────────────────────────────
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MAX_TOKENS_BASE = 1200;
const MAX_TOKENS_COMPARISON = 1500;
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
  const { symbol, question, context } = req.body || {};

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
