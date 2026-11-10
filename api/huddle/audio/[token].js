// api/huddle/audio/[token].js
//
// GET /api/huddle/audio/{token} — stream one huddle's MP3 (Huddle S1 spec V1.1 §6 audio
// row). UNAUTHENTICATED BY DESIGN: native <audio> cannot send headers, so the
// owner-issued, short-lived, rotated token is the credential (api/_utils/huddle/playback.js).
// The hash is looked up in the day's index, then checked against the record's own hash
// and expiry. Range support: 206 with Content-Range, Accept-Ranges: bytes, 416 for an
// unsatisfiable range; `Cache-Control: private, no-store`; the storage stream is
// destroyed when the client disconnects. Same origin, allowed by the CSP's default-src
// 'self' (vercel.json:38). 404 while DRB_HUDDLE_ENABLED is off. Nothing here logs the
// token or the request path.

import { getFirebaseAdmin } from '../../_utils/firebaseAdmin.js';
import { admitHuddleRoute } from '../../_utils/huddle/routeKit.js';
import { resolvePlaybackToken, parseRange } from '../../_utils/huddle/playback.js';
import { audioSizeOf, openAudioStream } from '../../_utils/huddle/audioStore.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res, deps = {}) {
  const admitted = await admitHuddleRoute(req, res, { method: 'GET', auth: false, rateLimit: { limit: 240, windowMs: 60_000 } });
  if (!admitted) return;
  const db = deps.db || getFirebaseAdmin();
  const sizeOf = deps.audioSizeOf || audioSizeOf;
  const open = deps.openAudioStream || openAudioStream;
  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const found = await resolvePlaybackToken(db, { token });
    if (found.kind !== 'ok') return res.status(found.status).json({ error: found.status === 410 ? 'expired' : 'not_found' });
    const size = await sizeOf(found.gcsPath);
    if (size === null) return res.status(404).json({ error: 'not_found' });
    const range = parseRange(req.headers?.range, size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');
    if (range.kind === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    const start = range.kind === 'partial' ? range.start : 0;
    const end = range.kind === 'partial' ? range.end : size - 1;
    res.setHeader('Content-Length', String(end - start + 1));
    if (range.kind === 'partial') res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.status(range.kind === 'partial' ? 206 : 200);
    const stream = open(found.gcsPath, { start, end });
    const stop = () => { if (typeof stream.destroy === 'function') stream.destroy(); };
    req.on?.('close', stop);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    stream.pipe(res);
    return undefined;
  } catch (err) {
    console.error('[huddle/audio] failed', JSON.stringify({ message: err?.message }));
    if (!res.headersSent) return res.status(500).json({ error: 'stream_failed' });
    res.end();
    return undefined;
  }
}
