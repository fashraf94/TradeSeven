// src/screens/battleView/PaneOverflow.jsx
//
// A3.5 — THE PANE'S `···` (D-95).
//
// One item: `Report a bug`. The mock's control offers `Read · Equip · Report a
// bug`; Read and Equip are not built, so the menu holds exactly what it can
// do.
//
// It does not mount a widget. It dispatches CLASHBOT_OPEN_EVENT, which the ONE
// globally-mounted ClashBotWidget subscribes to — a second widget inside the
// pane would double the panel and its cooldown state (hazard 36). The App.jsx
// mount is what withholds that widget's floating button while the pane is on;
// this is the door that replaces it.
//
// The menu is a `role="menu"` with one `role="menuitem"`, closed by Escape and
// by choosing the item. index.css forces every button to 16px !important
// (hazard 48), so both labels size an inner span.

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { CLASHBOT_OPEN_EVENT } from '../../components/ClashBot/ClashBotWidget';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

export default function PaneOverflow() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const reportBug = () => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CLASHBOT_OPEN_EVENT));
    }
  };

  return (
    <div ref={rootRef} data-pane-overflow="1" style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        data-pane-overflow-toggle={open ? 'open' : 'closed'}
        aria-label={COPY.paneMore}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 32,
          minHeight: 32,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: cssVar('text-muted'),
          cursor: 'pointer',
        }}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={COPY.paneMore}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            zIndex: 10,
            minWidth: 150,
            // The pane's own corner, once (D-98's radius, reused rather than a
            // second number).
            borderRadius: 4,
            border: `1px solid rgba(var(--ft-scrim-rgb), 0.12)`,
            background: `rgba(var(--ft-shadow-rgb), 0.94)`,
            padding: 4,
          }}
        >
          <button
            type="button"
            role="menuitem"
            data-pane-report-bug="1"
            onClick={reportBug}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              color: cssVar('text-secondary'),
              cursor: 'pointer',
              padding: '6px 8px',
              minHeight: 30,
              borderRadius: 3,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>{COPY.paneReportBug}</span>
          </button>
        </div>
      )}
    </div>
  );
}
