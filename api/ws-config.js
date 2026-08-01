// Vercel Serverless Function - WebSocket Configuration
// GET /api/ws-config → { available: false, transport: "rest" }
//
// SECURITY (containment B1): this endpoint MUST NOT read or emit the EODHD API
// key. It previously returned vendor WebSocket URLs with the raw key embedded
// as a query parameter, which disclosed the *shared* EODHD credential to any
// client that could reach the route — CORS is browser-enforced only, so the
// credential-bearing body was still delivered to `curl` and to every
// authenticated browser (visible in DevTools / JS memory / reconnect state).
// Direct browser-to-vendor WebSocket streaming is therefore disabled here: the
// client falls back to the existing same-origin REST/EOD price proxies. A
// server-side relay that would keep the credential server-side is a separate
// future task and is intentionally NOT built in this pass.
//
// INVARIANT: no response, header, or field of this route may contain the EODHD
// credential or a vendor URL embedding it. The route reads no EODHD env var.

import { applySecurityMiddleware } from './_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  // Low limit — this endpoint is called once per session, not per symbol
  if (applySecurityMiddleware(req, res, {
    rateLimit: { limit: 10, windowMs: 60000 },
    strictOrigin: true,
  })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Never cache a transport-config response anywhere (browser, CDN, proxy).
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');

  // Stable disabled-transport contract. A normal 200 (not an error) so clients
  // treat it as a terminal "no browser WebSocket" signal and switch to REST
  // polling without entering an error-driven reconnect/retry loop.
  return res.status(200).json({ available: false, transport: 'rest' });
}
