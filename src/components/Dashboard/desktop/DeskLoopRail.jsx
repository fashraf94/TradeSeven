// src/components/Dashboard/desktop/DeskLoopRail.jsx
//
// Desktop loop stepper for the Command top bar — the full Read → Equip → Deploy
// → Manage → Review cycle, labeled, with the active stage lit in the agent
// accent. The desktop counterpart to the mobile LoopRail (compact dots): same
// STAGES, more room. Pure presentation.
//
// The cmd-loop-* class hooks let CommandDashboardDesktop shrink the rail
// (padding / label / connectors) at ≤1199px so the labeled stepper stays
// legible and fits its own row without clipping. The label is a plain span
// (not <Mono>, which doesn't forward className) so the media rule can target it.

import React from 'react';
import { motion } from 'framer-motion';
import { CMD, alpha, MONO } from '../commandUI';

const STAGES = [
  { k: 'read', n: '01', label: 'Read' },
  { k: 'equip', n: '02', label: 'Equip' },
  { k: 'deploy', n: '03', label: 'Deploy' },
  { k: 'manage', n: '04', label: 'Manage' },
  { k: 'review', n: '05', label: 'Review' },
];

export default function DeskLoopRail({ active, primary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STAGES.map((s, i) => {
        const on = s.k === active;
        return (
          <React.Fragment key={s.k}>
            {i > 0 && <div className="cmd-loop-conn" style={{ width: 30, height: 1, background: CMD.hair, margin: '0 4px' }} />}
            <div
              className="cmd-loop-pill"
              title={s.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '7px 13px', borderRadius: 999,
                background: on ? alpha(primary, 0.1) : 'transparent',
                border: `1px solid ${on ? alpha(primary, 0.3) : 'transparent'}`,
              }}
            >
              <motion.div
                animate={on ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: on ? 9 : 6, height: on ? 9 : 6, borderRadius: '50%', flexShrink: 0,
                  background: on ? primary : CMD.ink3,
                  boxShadow: on ? `0 0 10px ${alpha(primary, 0.7)}` : 'none',
                }}
              />
              <span className="cmd-loop-label" style={{
                fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 600, whiteSpace: 'nowrap', color: on ? CMD.ink : CMD.ink3,
              }}>{s.n} {s.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
