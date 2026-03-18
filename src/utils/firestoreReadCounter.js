// src/utils/firestoreReadCounter.js
// Dev-mode Firestore read counter — tracks reads in the console for optimization monitoring.

const isDev = import.meta.env.DEV;

let readCount = 0;
let sessionStart = Date.now();

export function trackRead(source, count = 1) {
  if (!isDev) return;
  readCount += count;
  const elapsed = ((Date.now() - sessionStart) / 1000 / 60).toFixed(1);
  const rate = (readCount / (parseFloat(elapsed) || 1) * 60).toFixed(0);
  console.log(
    `%c[Firestore] +${count} read${count > 1 ? 's' : ''} from ${source} | Total: ${readCount} in ${elapsed}min | Rate: ${rate}/hr`,
    'color: #f59e0b; font-weight: bold;'
  );
}

export function getReadStats() {
  const elapsed = (Date.now() - sessionStart) / 1000 / 60;
  return {
    totalReads: readCount,
    minutesElapsed: elapsed.toFixed(1),
    readsPerHour: (readCount / (elapsed || 1) * 60).toFixed(0),
    estimatedDaily: (readCount / (elapsed || 1) * 60 * 24).toFixed(0),
  };
}

// Expose to console for manual checking
if (isDev && typeof window !== 'undefined') {
  window.firestoreReadStats = getReadStats;
}
