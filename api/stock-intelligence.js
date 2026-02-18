// api/stock-intelligence.js
// Stock Intelligence Agent — Educational analysis endpoint powered by Claude.
// Takes a symbol + question, fetches cached market data, and returns
// balanced educational analysis with bull/bear perspectives.

import { applySecurityMiddleware } from './_utils/security.js';
import { getStockAnalysisData } from './_utils/marketDataCache.js';
import { buildIntelligencePrompt } from './_utils/intelligencePrompt.js';

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
    // 5. Fetch cached market data
    const stockData = await getStockAnalysisData(cleanSymbol);

    // 6. Build prompt (with compound question type detection)
    const { systemPrompt, userPrompt, questionTypes, estimatedTokens } = buildIntelligencePrompt(
      question.trim(),
      stockData,
      context || {}
    );

    // Analytics logging
    console.log(`${LOG_PREFIX} Query:`, {
      symbol: cleanSymbol,
      questionTypes,
      isCrypto: stockData.isCrypto,
      estimatedInputTokens: estimatedTokens,
      cacheStatus: stockData.cacheStatus,
      staleData: stockData.staleData,
    });

    // 7. Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
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

    // 8. Parse JSON response
    const text = data.content?.[0]?.text || '';
    let analysis;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      // Fallback: wrap raw text in the expected structure
      console.warn(`${LOG_PREFIX} JSON parse failed, using fallback structure:`, parseError.message);
      analysis = {
        headline: `${cleanSymbol} Analysis`,
        content: text,
        dataPoints: {},
        bullCase: '',
        bearCase: '',
        educationalNote: '',
      };
    }

    // 9. Token usage
    const usage = {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };

    console.log(`${LOG_PREFIX} Complete:`, {
      symbol: cleanSymbol,
      questionTypes,
      tokens: usage,
    });

    // 10. Return structured response
    return res.status(200).json({
      success: true,
      analysis,
      meta: {
        symbol: cleanSymbol,
        questionTypes,
        isCrypto: stockData.isCrypto,
        cacheStatus: stockData.cacheStatus,
        staleData: stockData.staleData || false,
        staleFields: stockData.staleFields || [],
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
