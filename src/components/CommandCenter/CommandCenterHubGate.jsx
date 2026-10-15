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
//   frame  — App's host wrapper for what the gate itself draws (desktop: the
//            sidebar offset). Absent → nothing wraps it (mobile).
//
// It renders:
//   loading  → frame(skeleton) while the hub chunk is in flight;
//   loaded   → frame(hub);
//   rejected → frame(notice) and then `legacy`: the shell the hub-off flag
//              renders at this width and flags, never the Dashboard boundary's
//              error screen. The failure is reported (console + the house
//              error log, logErrorToFirebase) and the notice offers Retry and
//              Reload. `legacy` keeps its own wrapper and is never framed, so
//              DashboardDesktop, which offsets itself, is not offset twice.
//
// Only a REJECTED IMPORT falls back. The loader tags the rejection
// (HubLoadError) and this gate's boundary handles nothing else: any other error
// the hub throws is rethrown to App's `Dashboard` ErrorBoundary, so a hub bug
// is never hidden behind the legacy shell.
//
// React keeps a rejected lazy() forever, so Retry builds a NEW lazy() and
// remounts the boundary: the import runs again. Reload is for a browser that
// keeps the failed module fetch (a stale deploy, say).
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

/** A rejected hub import, tagged so the boundary can tell it from a hub render error. */
export class HubLoadError extends Error {
  constructor(cause) {
    super(`The Command Center hub chunk failed to load: ${cause?.message ?? String(cause)}`, { cause });
    this.name = 'HubLoadError';
  }
}

export const isHubLoadError = (error) => error instanceof HubLoadError;

/**
 * One lazy hub at a time. `retry()` swaps in a fresh lazy(), because React
 * keeps a rejected one forever. A synchronous throw from `importHub` is a
 * rejected import too.
 */
export function createHubLoader(importHub) {
  const fresh = () => lazy(() => new Promise((resolve) => { resolve(importHub()); })
    .catch((cause) => { throw new HubLoadError(cause); }));
  let Hub = fresh();
  return {
    current: () => Hub,
    retry: () => { Hub = fresh(); },
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

  componentDidCatch(error, errorInfo) {
    // Anything else was rethrown by render() and is reported by the boundary that takes it.
    if (!isHubLoadError(error)) return;
    console.error('[CommandCenterHubGate] the hub chunk failed to load; rendering the legacy dashboard:', error);
    logErrorToFirebase(error, errorInfo, 'Command Center hub (chunk load)');
  }

  render() {
    if (!this.state.caught) return this.props.children;
    // Not a load failure: App's Dashboard ErrorBoundary takes it, as it would without the gate.
    if (!isHubLoadError(this.state.error)) throw this.state.error;
    return this.props.renderFallback();
  }
}

const unframed = (node) => node;

const layer = { position: 'relative', zIndex: 1 };

function HubSkeleton() {
  return (
    <div
      role="status"
      data-hub-gate="loading"
      style={{ ...layer, minHeight: '100vh', padding: '48px 24px', textAlign: 'center', fontSize: 13, color: cssVar('text-secondary') }}
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

function HubLoadNotice({ onRetry, onReload }) {
  return (
    <div
      role="alert"
      data-hub-gate="load-error"
      style={{
        ...layer,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: cssVar('bg-card'),
        borderBottom: `1px solid ${cssVar('border-strong')}`,
        color: cssVar('text-primary'),
        fontSize: 13,
      }}
    >
      <span style={{ flex: '1 1 220px' }}>{COPY.loadFailed}</span>
      <button type="button" onClick={onRetry} style={noticeButton}>{COPY.retry}</button>
      <button type="button" onClick={onReload} style={noticeButton}>{COPY.reload}</button>
    </div>
  );
}

const reloadPage = () => window.location.reload();

/**
 * The gate for one hub module. The default export below binds the real chunk
 * and the real page reload; tests bind ones they control (jsdom cannot reload).
 */
export function createCommandCenterHubGate(importHub, { reload = reloadPage } = {}) {
  const loader = createHubLoader(importHub);

  /**
   * @param {React.ReactElement} props.legacy  the hub-off shell for this site, as App renders it
   * @param {Function}           [props.frame] App's host wrapper for the gate's own output
   */
  function CommandCenterHubGate({ legacy, frame = unframed }) {
    const [attempt, setAttempt] = useState(0);
    const Hub = loader.current();
    const retry = () => {
      loader.retry();
      setAttempt((n) => n + 1);
    };
    return (
      <HubLoadBoundary
        key={attempt}
        renderFallback={() => (
          <>
            {frame(<HubLoadNotice onRetry={retry} onReload={reload} />)}
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
