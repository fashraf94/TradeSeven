// api/_utils/shadowLogger.js
// Fire-and-forget shadow logging to Google Cloud Storage.
// Writes structured JSONL records for AI training data capture.
// NEVER throws. NEVER blocks. All errors are swallowed after console.error.

import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'fantasytrades';

let bucketInstance = null;

function getGCSBucket() {
  if (bucketInstance) return bucketInstance;

  const creds = process.env.GCS_CREDENTIALS;
  if (!creds) {
    console.warn('[ShadowLogger] GCS_CREDENTIALS not set — shadow logging disabled');
    return null;
  }

  try {
    const storage = new Storage({
      projectId: 'macro-nuance-474602-f5',
      credentials: JSON.parse(creds),
    });
    bucketInstance = storage.bucket(BUCKET_NAME);
    return bucketInstance;
  } catch (err) {
    console.error('[ShadowLogger] Init failed:', err.message);
    return null;
  }
}

async function appendToStream(stream, record) {
  const bucket = getGCSBucket();
  if (!bucket) return;

  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const eventId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `shadow/${stream}/${dateKey}/${eventId}.jsonl`;

    const line = JSON.stringify({
      ...record,
      _stream: stream,
      _loggedAt: now.toISOString(),
    }) + '\n';

    await bucket.file(filePath).save(line, {
      contentType: 'application/x-ndjson',
      resumable: false,
    });
  } catch (err) {
    console.error(`[ShadowLogger] ${stream} write failed:`, err.message);
  }
}

export const logConversation  = (r) => appendToStream('conversations', r);
export const logDecision      = (r) => appendToStream('decisions', r);
export const logReflection    = (r) => appendToStream('reflections', r);
export const logEvaluation    = (r) => appendToStream('evaluations', r);
export const logCompilation   = (r) => appendToStream('compilations', r);
export const logPartnerSignal = (r) => appendToStream('partner_signals', r);
