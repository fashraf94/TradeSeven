// src/components/CommandCenter/hubGateCopy.js
//
// Command Center hub, slice S0 — the gate's strings, and only the gate's. The
// gate ships in the main chunk (App imports it), so its copy stays apart from
// the hub's own table (hub/hubCopy.js), which travels in the lazy hub chunk and
// grows with every later slice. A deliberate second copy table beside the one
// spec §2 names; together they hold every user-visible string of the hub.

export const HUB_GATE_COPY = Object.freeze({
  /** The skeleton, while the hub chunk is in flight. */
  loading: 'Loading the Command Center…',
  /** Over the legacy shell, after the hub chunk failed to load. */
  loadFailed: "Couldn't load the Command Center, so this is your current dashboard.",
  /** Starts a fresh import of the hub chunk; the dashboard stays while it runs. */
  retry: 'Retry',
  /** The Retry button while that import runs. */
  retrying: 'Retrying…',
  /** Reloads the page, for a browser that keeps the failed fetch. */
  reload: 'Reload page',
  /** The notice's close button: its accessible name, and the mark it shows. */
  dismiss: 'Dismiss',
  dismissMark: '×',
});
