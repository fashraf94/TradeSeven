// api/_utils/explore/pdfWorker.js
//
// Explore publish step — the worker thread that reads one PDF (pdfText.js pdfTextInWorker; review S3). It reads the
// bytes it is handed, answers once, and ends. Its heap limit and its time limit are set by the thread that starts it.

import { parentPort, workerData } from 'node:worker_threads';
import { pdfTextOf } from './pdfText.js';

const { bytes, pagesMax, textCharsMax } = workerData;
pdfTextOf(bytes, { ...(pagesMax !== undefined ? { pagesMax } : {}), ...(textCharsMax !== undefined ? { textCharsMax } : {}) })
  .then((result) => parentPort.postMessage({ ok: true, result }))
  .catch((err) => parentPort.postMessage({ ok: false, message: err?.message ?? String(err) }));
