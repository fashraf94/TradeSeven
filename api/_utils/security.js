/**
 * Security utilities for API endpoints
 *
 * Provides CORS handling, security headers, and preflight request handling.
 * Import and use at the start of every API handler.
 */

import { applyRateLimit } from './rateLimit.js';

// =============================================================================
// ALLOWED ORIGINS CONFIGURATION
// =============================================================================

/**
 * Production domains - Update these with your actual deployment URLs
 * Find your Vercel URLs in: Vercel Dashboard > Project > Settings > Domains
 */
const ALLOWED_ORIGINS = [
  // Vercel auto-generated URLs (update with your actual project name)
  'https://trade-seven.vercel.app',
  'https://trade-seven-cyan.vercel.app',
  'https://portfolio-duel.vercel.app',
  'https://marketclash.vercel.app',
  // Custom domains (add if configured)
  'https://www.marketclash.app',
  'https://marketclash.app',
];

/**
 * Development origins - only allowed in dev/preview environments
 */
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',  // Vite preview
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
];

// =============================================================================
// ORIGIN VALIDATION
// =============================================================================

/**
 * Check if we're in a development/preview environment.
 * Defaults to PRODUCTION (restrictive) when VERCEL_ENV is unset.
 */
export function isDevelopment() {
  const env = process.env.VERCEL_ENV;
  return env === 'development' || env === 'preview' || process.env.NODE_ENV === 'development';
}

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins() {
  return isDevelopment() ? [...ALLOWED_ORIGINS, ...DEV_ORIGINS] : ALLOWED_ORIGINS;
}

/**
 * Check if an origin is allowed
 * @param {string} origin - The origin header value
 * @returns {boolean} True if origin is allowed
 */
export function isOriginAllowed(origin) {
  if (!origin) return false;

  const allowed = getAllowedOrigins();

  // Check exact match first
  if (allowed.includes(origin)) return true;

  // Check Vercel preview URLs (pattern: {project}-{hash}-{scope}.vercel.app)
  // Match against full project name prefix to prevent subdomain spoofing
  const PREVIEW_PREFIXES = ['trade-seven-cyan', 'trade-seven', 'portfolio-duel', 'marketclash'];
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app') && url.protocol === 'https:') {
      const subdomain = url.hostname.replace('.vercel.app', '');
      return PREVIEW_PREFIXES.some(prefix => subdomain === prefix || subdomain.startsWith(prefix + '-'));
    }
  } catch {
    // Invalid URL
  }

  return false;
}

// =============================================================================
// CORS HANDLING
// =============================================================================

/**
 * Apply CORS headers with origin validation
 * @param {Request} req - The incoming request
 * @param {Response} res - The response object
 * @param {Object} options - Configuration options
 * @param {boolean} options.strictOrigin - If true, only allow configured origins
 */
export function applyCORS(req, res, { strictOrigin = false } = {}) {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    // Echo back the exact allowed origin (best practice)
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!strictOrigin && isDevelopment()) {
    // In development, be more permissive for easier testing
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  } else if (!strictOrigin) {
    // In production, fall back to first allowed origin (safer than *)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  } else {
    // Strict mode - CORS will block the request
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours preflight cache
  // Access-Control-Allow-Credentials removed — not needed (Firebase auth is client-side).
  // Including it amplifies the impact of any CORS origin misconfiguration.
}

// =============================================================================
// SECURITY HEADERS
// =============================================================================

/**
 * Apply security headers to response
 * @param {Response} res - The response object
 */
export function applySecurityHeaders(res) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // API responses should not be cached by default
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// =============================================================================
// PREFLIGHT HANDLING
// =============================================================================

/**
 * Handle OPTIONS preflight request
 * @param {Request} req - The incoming request
 * @param {Response} res - The response object
 * @returns {boolean} True if this was an OPTIONS request (already handled)
 */
export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// =============================================================================
// COMBINED MIDDLEWARE
// =============================================================================

/**
 * Apply all security middleware at once
 *
 * Call at the start of every API handler:
 *
 * @example
 * export default async function handler(req, res) {
 *   if (applySecurityMiddleware(req, res)) return;
 *   // ... rest of handler
 * }
 *
 * @param {Request} req - The incoming request
 * @param {Response} res - The response object
 * @param {Object} options - Configuration options
 * @param {Object} options.rateLimit - Rate limit config { limit, windowMs }
 * @param {boolean} options.strictOrigin - If true, reject unknown origins
 * @param {boolean} options.skipRateLimit - If true, skip rate limiting
 * @returns {boolean} True if request was handled (blocked or preflight), false to continue
 */
export function applySecurityMiddleware(req, res, options = {}) {
  const {
    rateLimit: rateLimitOptions = { limit: 60, windowMs: 60000 },
    strictOrigin = false,
    skipRateLimit = false
  } = options;

  // Apply security headers
  applySecurityHeaders(res);

  // Apply CORS
  applyCORS(req, res, { strictOrigin });

  // Handle preflight
  if (handlePreflight(req, res)) {
    return true;
  }

  // Apply rate limiting (unless skipped)
  if (!skipRateLimit && applyRateLimit(req, res, rateLimitOptions)) {
    return true;
  }

  return false;
}

/**
 * Create a configured middleware function for a specific endpoint
 *
 * @example
 * const middleware = createSecurityMiddleware({ rateLimit: { limit: 20 } });
 *
 * export default async function handler(req, res) {
 *   if (middleware(req, res)) return;
 *   // ... rest of handler
 * }
 */
export function createSecurityMiddleware(defaultOptions = {}) {
  return (req, res, overrideOptions = {}) => {
    return applySecurityMiddleware(req, res, { ...defaultOptions, ...overrideOptions });
  };
}
