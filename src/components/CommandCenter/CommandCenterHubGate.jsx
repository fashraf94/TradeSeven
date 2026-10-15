// src/components/CommandCenter/CommandCenterHubGate.jsx
//
// Command Center hub, slice S0 — the lazy hub gate (spec
// docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md §2, §4,
// §11.3).
//
// App renders this at a dashboard site ONLY when pickDashboardShell() names the
// hub. The gate never chooses a shell. App hands it:
//   legacy — the legacy shell element exactly as App renders it at this site
//            with the hub off (the picker's `legacyShell`, wrapper included);
//   frame  — App's host wrapper for what replaces that shell (desktop: the
//            sidebar offset). Absent → nothing wraps it (mobile).
//
// It renders:
//   loading  → frame(skeleton) while the hub chunk is in flight;
//   loaded   → frame(hub);
//   rejected → `legacy`, the shell the hub-off flag renders at this width and
//              flags (never the Dashboard boundary's error screen), under a
//              notice offering Retry, Reload and Dismiss. `legacy` keeps its own
//              wrapper and is never framed, so DashboardDesktop, which offsets
//              itself, is not offset twice. The notice floats (position: fixed)
//              rather than sitting in the page flow, so it never pushes a
//              fixed-height shell (CommandDashboardDesktop is 100vh) off screen.
//
// Only a REJECTED IMPORT falls back. The loader tags the rejection
// (HubLoadError) and this gate's boundary handles nothing else: an error the hub
// throws while rendering is rethrown to App's `Dashboard` ErrorBoundary, so a
// hub render bug is never hidden behind the legacy shell. An error thrown while
// the hub chunk EVALUATES rejects the import, so it does fall back — and its
// report carries the cause's name, message and stack, so it reads as what it is.
//
// The failure is reported by the loader, once per import attempt, at the
// moment the import rejects (console + the house error log,
// logErrorToFirebase): never again for a later mount that merely shows the same
// cached failure, and never lost when something else throws in the same render.
//
// React keeps a rejected lazy() forever, so Retry starts a FRESH import while
// the legacy shell stays on screen, and swaps in a new lazy() only once that
// import has loaded. A failed retry leaves the page exactly as it was. Reload
// is for a browser that keeps the failed module fetch (a stale deploy, say).
//
// The lazy() lives at module scope, one per gate (App.jsx's lazy screens are
// the house convention). Creating it calls nothing: importing this module
// requests no chunk, only rendering the gate does, and once the chunk has
// loaded a later visit renders the hub at once with no skeleton flash.
//
// The gate adds no read, timer, listener, subscription or effect. With the hub
// flag off App never renders it, so none of this runs.

import React, { Component, Suspense, lazy, useState } from 'react';
import { logErrorToFirebase } from '../ErrorBoundary';
import { cssVar } from '../../theme/cssTokens';
import { HUB_GATE_COPY as COPY } from './hubGateCopy';

/** The error-log screen name for a failed hub import. */
export const HUB_LOAD_REPORT = 'Command Center hub (chunk load)';

/** A rejected hub import, tagged so the boundary can tell it from a hub render error. */
export class HubLoadError extends Error {
  constructor(cause) {
    const name = typeof cause?.name === 'string' ? cause.name : 'Error';
    super(`The Command Center hub chunk failed to load (${name}: ${cause?.message ?? String(cause)})`, { cause });
    this.name = 'HubLoadError';
    // The report's stack is the cause's: where the fetch, or the module's evaluation, failed.
    if (typeof cause?.stack === 'string') this.stack = cause.stack;
  }
}

export const isHubLoadError = (error) => error instanceof HubLoadError;

/** One report per failed import attempt: the console and the house error log. */
export function reportHubLoadFailure(error) {
  console.error('[CommandCenterHubGate] the hub chunk failed to load; rendering the legacy dashboard:', error);
  logErrorToFirebase(error, undefined, HUB_LOAD_REPORT);
}

/**
 * The hub's lazy component and its retries. Each import attempt that rejects is
 * tagged and reported once, here. `retry()` runs a fresh import and swaps in a
 * new lazy() only when it loads (React keeps a rejected lazy forever); calls
 * while one is in flight share it. A synchronous throw from `importHub` is a
 * rejected import too.
 */
export function createHubLoader(importHub, report = reportHubLoadFailure) {
  const load = () => new Promise((resolve) => { resolve(importHub()); })
    .catch((cause) => {
      const error = new HubLoadError(cause);
      try { report(error); } catch { /* a failing report never changes the outcome */ }
      throw error;
    });
  let Hub = lazy(load);
  let pending = null;
  return {
    current: () => Hub,
    retry() {
      if (!pending) {
        pending = load()
          .then((module) => { Hub = lazy(() => Promise.resolve(module)); })
          .finally(() => { pending = null; });
      }
      return pending;
    },
  };
}

/** Catches a rejected hub import and nothing else. */
class HubLoadBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { caught: false, error: undefined };
  }

  static getDerivedStateFromError(error) {
    return { caught: true, error };
  }

  render() {
    if (!this.state.caught) return this.props.children;
    // Not a load failure: App's Dashboard ErrorBoundary takes it, as it would without the gate.
    if (!isHubLoadError(this.state.error)) throw this.state.error;
    return this.props.renderFallback();
  }
}

const unframed = (node) => node;

function HubSkeleton() {
  return (
    <div
      role="status"
      data-hub-gate="loading"
      style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '48px 24px', textAlign: 'center', fontSize: 13, color: cssVar('text-secondary') }}
    >
      {COPY.loading}
    </div>
  );
}

const noticeButton = {
  minHeight: 44,
  padding: '0 14px',
  background: 'transparent',
  border: `1px solid ${cssVar('accent')}`,
  borderRadius: 8,
  color: cssVar('accent'),
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

function HubLoadNotice({ retrying, onRetry, onReload, onDismiss }) {
  return (
    <div
      role="alert"
      data-hub-gate="load-error"
      style={{
        position: 'fixed',
        zIndex: 45,
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 16,
        right: 16,
        maxWidth: 560,
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 8px 8px 16px',
        background: cssVar('bg-card'),
        border: `1px solid ${cssVar('border-strong')}`,
        borderRadius: 12,
        color: cssVar('text-primary'),
        fontSize: 13,
      }}
    >
      <span style={{ flex: '1 1 220px' }}>{COPY.loadFailed}</span>
      {/* aria-disabled, not disabled: the button keeps focus while the retry runs. */}
      <button type="button" aria-disabled={retrying} onClick={onRetry} style={noticeButton}>
        {retrying ? COPY.retrying : COPY.retry}
      </button>
      <button type="button" onClick={onReload} style={noticeButton}>{COPY.reload}</button>
      <button type="button" aria-label={COPY.dismiss} onClick={onDismiss} style={{ ...noticeButton, border: 'none', minWidth: 44, padding: 0 }}>
        {COPY.dismissMark}
      </button>
    </div>
  );
}

/** Reloads the page. `location` is a parameter only so a test can hand it a stand-in. */
export function reloadPage(location = window.location) {
  location.reload();
}

/**
 * The gate for one hub module. The default export below binds the real chunk
 * and the real page reload; tests bind ones they control (jsdom cannot reload).
 */
export function createCommandCenterHubGate(importHub, { reload = reloadPage } = {}) {
  const loader = createHubLoader(importHub);

  /**
   * @param {React.ReactElement} props.legacy  the hub-off shell for this site, as App renders it
   * @param {Function}           [props.frame] App's host wrapper for the skeleton and the hub
   */
  function CommandCenterHubGate({ legacy, frame = unframed }) {
    const [loads, setLoads] = useState(0);
    const [retrying, setRetrying] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const Hub = loader.current();
    const retry = () => {
      if (retrying) return;
      setRetrying(true);
      loader.retry().then(
        () => { setRetrying(false); setLoads((n) => n + 1); },
        // Already reported by the loader; the legacy shell simply stays.
        () => { setRetrying(false); },
      );
    };
    return (
      <HubLoadBoundary
        key={loads}
        renderFallback={() => (
          <>
            {!dismissed && (
              <HubLoadNotice
                retrying={retrying}
                onRetry={retry}
                onReload={() => reload()}
                onDismiss={() => setDismissed(true)}
              />
            )}
            {legacy}
          </>
        )}
      >
        {frame(
          <Suspense fallback={<HubSkeleton />}>
            <Hub />
          </Suspense>,
        )}
      </HubLoadBoundary>
    );
  }

  return CommandCenterHubGate;
}

export default createCommandCenterHubGate(() => import('./CommandCenterHub'));
