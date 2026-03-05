/**
 * Input sanitization utilities for API endpoints.
 * Provides prompt injection filtering and Firestore document ID validation.
 *
 * Created: March 2026 — Tier 1 security hardening
 */

/**
 * Sanitize a string input for use in AI prompts.
 * Strips common prompt injection patterns and enforces length limits.
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowed length (default 2000)
 * @returns {string|null} Sanitized string, or null if input is invalid/empty
 */
export function sanitizeInput(input, maxLength = 2000) {
  if (typeof input !== 'string') return null;

  let clean = input
    .replace(/system\s*prompt/gi, '')
    .replace(/ignore\s*(previous|above|all|prior|every)\s*(instructions?|rules?|prompts?|guidelines?)/gi, '')
    .replace(/you\s*are\s*now/gi, '')
    .replace(/pretend\s*(you|to\s*be|you're)/gi, '')
    .replace(/(?:^|\.\s*)act\s+as\s+(?:a\s+)?(?:different|new|evil|unfiltered|helpful|my|an?\s+ai|an?\s+assistant|chatgpt|gpt|claude)/gi, '')
    .replace(/new\s*instructions?:/gi, '')
    .replace(/override\s*(all|previous|prior)/gi, '')
    .replace(/disregard\s*(all|previous|prior|above)/gi, '')
    .replace(/reveal\s*(your|the)\s*(system|initial|original)\s*prompt/gi, '')
    .replace(/what\s*(are|is)\s*your\s*(system|initial|original)\s*(prompt|instructions?)/gi, '')
    .replace(/\[\s*SYSTEM\s*\]/gi, '')
    .replace(/\[\s*INST\s*\]/gi, '')
    .replace(/<\/?s>/gi, '')
    .replace(/<\/?system>/gi, '')
    .trim();

  clean = clean.substring(0, maxLength);

  if (clean.length < 2) return null;

  return clean;
}

/**
 * Validate and sanitize a Firestore document ID.
 * Prevents path traversal and invalid characters.
 * @param {string} id - Raw document ID from user input
 * @param {RegExp} pattern - Expected format (default: alphanumeric + dots, hyphens, underscores)
 * @returns {string|null} Sanitized ID, or null if invalid
 */
export function sanitizeDocumentId(id, pattern = /^[A-Za-z0-9._-]+$/) {
  if (typeof id !== 'string') return null;

  const trimmed = id.trim();

  if (trimmed.length === 0) return null;
  if (trimmed.length > 200) return null;
  if (trimmed.includes('/') || trimmed.includes('..') || trimmed.includes('\\')) return null;
  if (!pattern.test(trimmed)) return null;

  return trimmed;
}
