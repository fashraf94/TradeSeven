/**
 * Simple in-memory rate limiter for Vercel serverless functions
 *
 * Note: This resets on cold starts, but still provides protection
 * against rapid abuse within a function instance's lifetime.
 *
 * For production, consider using Vercel Edge Config or Upstash Redis
 * for distributed rate limiting across serverless instances.
 */

const rateLimitMap = new Map();

/**
 * Check if request should be rate limited
 * @param {Request} req - The incoming request
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Max requests per window (default: 60)
 * @param {number} options.windowMs - Time window in ms (default: 60000 = 1 minute)
 * @returns {Object} { allowed, remaining, resetAt, clientIP }
 */
export function rateLimit(req, { limit = 60, windowMs = 60000 } = {}) {
  // Get client identifier from various headers
  const clientIP =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create client record
  let record = rateLimitMap.get(clientIP);
  if (!record || record.windowStart < windowStart) {
    record = { windowStart: now, count: 0 };
  }

  record.count++;
  rateLimitMap.set(clientIP, record);

  // Periodic cleanup (1% chance each request to avoid memory leaks)
  if (Math.random() < 0.01) {
    for (const [ip, rec] of rateLimitMap.entries()) {
      if (rec.windowStart < windowStart) {
        rateLimitMap.delete(ip);
      }
    }
  }

  const allowed = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);
  const resetAt = record.windowStart + windowMs;

  return { allowed, remaining, resetAt, clientIP };
}

/**
 * Apply rate limit headers and return 429 response if exceeded
 * @param {Request} req - The incoming request
 * @param {Response} res - The response object
 * @param {Object} options - Rate limit configuration
 * @param {number} options.limit - Max requests per window (default: 60)
 * @param {number} options.windowMs - Time window in ms (default: 60000)
 * @returns {boolean} True if request was blocked (caller should return), false if allowed
 */
export function applyRateLimit(req, res, options = {}) {
  const { limit = 60, windowMs = 60000 } = options;
  const result = rateLimit(req, { limit, windowMs });

  // Add rate limit headers to all responses
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter
    });
    return true; // Indicates request was blocked
  }

  return false; // Indicates request is allowed
}

/**
 * Get current rate limit status for a client without incrementing
 * Useful for debugging or status endpoints
 */
export function getRateLimitStatus(req, { limit = 60, windowMs = 60000 } = {}) {
  const clientIP =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown';

  const now = Date.now();
  const windowStart = now - windowMs;

  const record = rateLimitMap.get(clientIP);
  if (!record || record.windowStart < windowStart) {
    return { count: 0, remaining: limit, resetAt: now + windowMs };
  }

  return {
    count: record.count,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.windowStart + windowMs
  };
}
