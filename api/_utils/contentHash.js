// Phase 1 content-hash utility for the signalDropCache dedup layer.
// Same input → same hash → cache hit, so two users dropping the same tweet
// share the parse + expansion (cuts LLM cost during prompt iteration).

import { createHash } from 'crypto';

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function hashText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('hashText expects a string');
  }
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return sha256Hex(normalized);
}

export function hashUrl(url) {
  if (typeof url !== 'string') {
    throw new TypeError('hashUrl expects a string');
  }
  // Lowercase host + drop trailing slash; keep path/query case-sensitive
  // since some URLs are case-significant (e.g. base64-encoded query params).
  let normalized = url.trim();
  try {
    const parsed = new URL(normalized);
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname === '/') parsed.pathname = '';
    normalized = parsed.toString().replace(/\/$/, '');
  } catch {
    // Fall back to raw trim if URL is malformed; the caller already validated shape.
  }
  return sha256Hex(normalized);
}

// Phase 1 hashes images by raw byte SHA-256, so only byte-identical duplicates
// dedup. Phase 2 will swap to perceptual hashing (sharp + pHash) when the
// image-upload UI lands and recompressed copies become a real concern.
export function hashImage(buffer) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('hashImage expects a Buffer or Uint8Array');
  }
  return sha256Hex(buffer);
}
