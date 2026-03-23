// api/_utils/validateKbEntry.js
// Validates a v2 KB entry has the required fields before sending to Sonnet for script generation.

export function validateKbEntry(entry) {
  const errors = [];

  if (!entry) {
    return { valid: false, errors: ['Entry is null or undefined'] };
  }

  if (!entry.content?.hooks?.length) errors.push('Missing hooks');
  if (!entry.content?.definition) errors.push('Missing definition');
  if (!entry.content?.mechanism?.explanation) errors.push('Missing mechanism');
  if (!entry.content?.historicalExamples?.length) errors.push('Missing historicalExamples');
  if (!entry.content?.surpriseMoment?.statement) errors.push('Missing surpriseMoment');
  if (!entry.gameConnections?.length) errors.push('Missing gameConnections');
  if (!entry.sceneMap?.scenes?.length) errors.push('Missing sceneMap');
  if (!entry.videoConfig) errors.push('Missing videoConfig');

  return { valid: errors.length === 0, errors };
}
