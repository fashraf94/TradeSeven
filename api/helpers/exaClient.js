// api/helpers/exaClient.js
// GENERIC Exa /search transport — auth, POST, cost logging, timeout. NO domain
// query logic lives here (that is the caller's job): the platform-bookmark
// client/domain split, mirroring api/helpers/sonar.js (generic) vs
// api/_utils/sonarCatalystFetch.js (mover query). Surface verified against the
// Exa OpenAPI spec (exa-labs/openapi-spec): POST https://api.exa.ai/search,
// header `x-api-key` (NOT Bearer), text/highlights nested under `contents`,
// response carries top-level `costDollars`.

const EXA_SEARCH_URL = 'https://api.exa.ai/search';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Execute one Exa /search request.
 * @param {object} body — the /search request body (query, type, contents, …)
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{results: object[], costDollars: any, searchType: string|null, requestId: string|null}>}
 * @throws if EXA_API_KEY is missing, the request times out, or the API errors
 */
export async function queryExa(body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error('EXA_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(EXA_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Exa API error ${resp.status}: ${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    const results = Array.isArray(data.results) ? data.results : [];
    // Cost logging — the C9 discipline persists into production: every call
    // reports its own costDollars in-band, so the cost bound stays observable.
    console.log(
      `[Exa] /search results=${results.length} cost=${JSON.stringify(data.costDollars ?? null)} ` +
      `searchType=${data.searchType ?? 'n/a'}`,
    );
    return {
      results,
      costDollars: data.costDollars ?? null,
      searchType: data.searchType ?? null,
      requestId: data.requestId ?? null,
    };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Exa timeout');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
