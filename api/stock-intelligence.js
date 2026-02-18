// api/stock-intelligence.js
// Stock Intelligence Agent — Educational analysis endpoint powered by Claude.
// Takes a symbol + question, fetches cached market data, and returns
// balanced educational analysis with bull/bear perspectives.

import { applySecurityMiddleware } from './_utils/security.js';
import { getStockAnalysisData } from './_utils/marketDataCache.js';
import { buildIntelligencePrompt, detectComparisonSymbols } from './_utils/intelligencePrompt.js';
import { getSupplyChainCoverage } from './_utils/supplyChainLookup.js';

const LOG_PREFIX = '[StockIntelligence]';

export default async function handler(req, res) {
  // 1. Security middleware — 15 requests/min per IP
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 15, windowMs: 60000 } })) {
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
  if (cleanSymbol.length > 10 || !/^[A-Z0-9.\-]+$/.test(cleanSymbol)) {
    return res.status(400).json({ success: false, error: 'Invalid symbol format' });
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Missing required field: question' });
  }

  if (question.length > 500) {
    return res.status(400).json({ success: false, error: 'Question must be 500 characters or fewer' });
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

    // Analytics logging
    console.log(`${LOG_PREFIX} Query:`, {
      symbol: cleanSymbol,
      questionTypes,
      isComparison,
      comparisonSymbols,
      isCrypto: stockData.isCrypto,
      estimatedInputTokens: estimatedTokens,
      cacheStatus: stockData.cacheStatus,
      staleData: stockData.staleData,
    });

    // 8. Call Claude API (1200 base to avoid truncated JSON, 1500 for comparisons)
    const maxTokens = isComparison ? 1500 : 1200;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
      // All parsing strategies failed — clean up the raw text for display
      console.warn(`${LOG_PREFIX} JSON parse failed, using fallback:`, parseError.message);
      const fallbackText = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*\{/, '')
        .replace(/\}\s*$/, '')
        .replace(/"headline"\s*:\s*"[^"]*",?\s*/g, '')
        .replace(/"(content|bullCase|bearCase|educationalNote|dataPoints)"\s*:/g, '')
        .replace(/[{}"]/g, '')
        .trim();
      analysis = {
        headline: `${cleanSymbol} Analysis`,
        content: fallbackText || 'Analysis could not be fully parsed. Please try rephrasing your question.',
        dataPoints: {},
        bullCase: '',
        bearCase: '',
        educationalNote: '',
      };
    }

    // 10. Token usage
    const usage = {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };

    console.log(`${LOG_PREFIX} Complete:`, {
      symbol: cleanSymbol,
      questionTypes,
      tokens: usage,
    });

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
        model: 'claude-haiku-4-5-20251001',
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
