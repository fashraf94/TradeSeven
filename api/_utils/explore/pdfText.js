// api/_utils/explore/pdfText.js
//
// Explore publish step — A PDF'S TEXT (build prompt K-6; review S3). Server code, run only by the founder's command.
//
//   pdfTextOf        the PDF's text, in this thread, by unpdf (pdf.js 5.6 with eval off, no font face, no URL, so
//                    nothing is fetched): each page's text items in order, a line break where pdf.js marks one; and
//                    its own creation date (documentDate.js). A PDF of more than PAGES_MAX pages, or whose text runs
//                    past TEXT_CHARS_MAX, is refused, never read on.
//   pdfTextInWorker  the same, in a WORKER THREAD with its own heap limit (HEAP_MB) and a hard time limit
//                    (TIMEOUT_MS): a PDF that inflates its streams past the limit or runs too long ends the worker, and
//                    the run goes on with that source `read` — never a crash of the run, and the timer keeps working
//                    because the reading never blocks this thread. The run reads every PDF this way.

import { Worker } from 'node:worker_threads';
import { pdfDateOf } from './documentDate.js';

/** The options every PDF is opened with: no eval, no font face, warnings off. Nothing is fetched (no URL is given). */
export const PDF_OPTIONS = Object.freeze({ isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
/** The limits on reading one PDF (named, as the fetcher's are). */
export const PDF_LIMITS = Object.freeze({ PAGES_MAX: 2000, TEXT_CHARS_MAX: 20_000_000, TIMEOUT_MS: 60_000, HEAP_MB: 1024 });

const limitError = (message) => Object.assign(new Error(message), { code: 'EXPLORE_PDF_LIMIT' });

/** A PDF's text, page by page, and its own creation date — in this thread (the worker's job; tests). */
export async function pdfTextOf(bytes, { pagesMax = PDF_LIMITS.PAGES_MAX, textCharsMax = PDF_LIMITS.TEXT_CHARS_MAX } = {}) {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { ...PDF_OPTIONS });
  try {
    if (pdf.numPages > pagesMax) throw limitError(`the PDF has ${pdf.numPages} pages; at most ${pagesMax} are read`);
    const pages = [];
    let chars = 0;
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ''}`).join('');
      chars += text.length;
      if (chars > textCharsMax) throw limitError(`the PDF's text runs past ${textCharsMax} characters`);
      pages.push(text);
    }
    let documentDate = null;
    try {
      const meta = await pdf.getMetadata();
      documentDate = pdfDateOf(meta?.info?.CreationDate);
    } catch {
      documentDate = null;
    }
    return { text: pages.join('\n'), documentDate, pages: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
}

/** A PDF's text, read in a worker thread under the heap and time limits (see the header). */
export function pdfTextInWorker(bytes, { timeoutMs = PDF_LIMITS.TIMEOUT_MS, heapMb = PDF_LIMITS.HEAP_MB, pagesMax, textCharsMax } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdfWorker.js', import.meta.url), {
      workerData: { bytes: new Uint8Array(bytes), pagesMax, textCharsMax },
      resourceLimits: { maxOldGenerationSizeMb: heapMb },
    });
    let settled = false;
    let timer = null;
    const done = (settle, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      settle(value);
    };
    timer = setTimeout(() => done(reject, limitError(`reading the PDF took longer than ${timeoutMs / 1000} seconds`)), timeoutMs);
    worker.once('message', (m) => (m?.ok ? done(resolve, m.result) : done(reject, new Error(m?.message ?? 'the PDF reader failed'))));
    worker.once('error', (err) => done(reject, err?.code === 'ERR_WORKER_OUT_OF_MEMORY' ? limitError(`reading the PDF needed more than ${heapMb} MB`) : err));
    worker.once('exit', (code) => done(reject, new Error(`the PDF reader stopped (exit ${code})`)));
  });
}
