// api/_utils/huddle/audioStore.js
//
// Huddle S1 — the audio's storage (spec V1.1 §5.3 "Store", §6 audio row). The existing
// GCS bucket and credential the shadow logger uses (api/_utils/shadowLogger.js:18-36):
// bucket `fantasytrades`, project `macro-nuance-474602-f5`, `GCS_CREDENTIALS`. Objects
// are private (the bucket's own default; no public ACL is ever set) and addressed as
//   huddle/{uid}/{etDate}/{claimGeneration}/audio.mp3
//   huddle/{uid}/{etDate}/{claimGeneration}/alignment.json
// The generation in the path means a stale attempt can never overwrite published audio.
// Served only through /api/huddle/audio/{token} (same origin; the CSP's default-src
// 'self' covers it, vercel.json:38).

import { Storage } from '@google-cloud/storage';

export const AUDIO_BUCKET = 'fantasytrades';
const PROJECT_ID = 'macro-nuance-474602-f5';

let bucket = null;

/** The bucket, or null when GCS_CREDENTIALS is unset or unreadable (the caller records `storage_unavailable`). */
export function getAudioBucket() {
  if (bucket) return bucket;
  const creds = process.env.GCS_CREDENTIALS;
  if (!creds) return null;
  try {
    bucket = new Storage({ projectId: PROJECT_ID, credentials: JSON.parse(creds) }).bucket(AUDIO_BUCKET);
    return bucket;
  } catch {
    return null;
  }
}

/** For tests: hand the module a bucket stand-in (or null to reset). */
export function setAudioBucketForTest(b) {
  bucket = b;
}

export function audioPathsOf({ uid, etDate, claimGeneration }) {
  const base = `huddle/${uid}/${etDate}/${claimGeneration}`;
  return { gcsPath: `${base}/audio.mp3`, alignmentPath: `${base}/alignment.json` };
}

/** Write the MP3 and its alignment. Throws when storage is unavailable or a write fails. */
export async function storeHuddleAudio({ uid, etDate, claimGeneration, mp3, alignment }) {
  const b = getAudioBucket();
  if (!b) throw new Error('storage_unavailable');
  const { gcsPath, alignmentPath } = audioPathsOf({ uid, etDate, claimGeneration });
  await b.file(gcsPath).save(mp3, { resumable: false, contentType: 'audio/mpeg', metadata: { cacheControl: 'private, no-store' } });
  await b.file(alignmentPath).save(JSON.stringify(alignment), { resumable: false, contentType: 'application/json', metadata: { cacheControl: 'private, no-store' } });
  return { gcsPath, alignmentPath };
}

/** The object's byte length (for Range answers), or null when it does not exist. */
export async function audioSizeOf(gcsPath) {
  const b = getAudioBucket();
  if (!b) throw new Error('storage_unavailable');
  const file = b.file(gcsPath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [meta] = await file.getMetadata();
  const size = Number(meta?.size);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

/** A read stream over [start, end] inclusive. */
export function openAudioStream(gcsPath, { start, end }) {
  const b = getAudioBucket();
  if (!b) throw new Error('storage_unavailable');
  return b.file(gcsPath).createReadStream({ start, end, validation: false });
}
