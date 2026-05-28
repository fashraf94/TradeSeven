// src/components/FantasyTimes/ReporterNavStrip.jsx
// Horizontal reporter navigation — "★ FRONT PAGE · KAI · ALEX · NETA · DOUG · KIM"

import React from 'react';
import { Search } from 'lucide-react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';

const SECTIONS = [
  { key: 'frontPage', label: 'FRONT PAGE', prefix: '★ ', color: '#00d9ff' },
  { key: 'kai', label: 'KAI', color: REPORTER_COLORS.kai.hex },
  { key: 'alex', label: 'ALEX', color: REPORTER_COLORS.alex.hex },
  { key: 'neta', label: 'NETA', color: REPORTER_COLORS.neta.hex },
  { key: 'doug', label: 'DOUG', color: REPORTER_COLORS.doug.hex },
  { key: 'kim', label: 'KIM', color: REPORTER_COLORS.kim.hex },
  // Vera uses her on-dark accent (not primary navy) so the active tab stays legible as
  // text on the near-black bar (desktop) and as a pill background (mobile).
  { key: 'vera', label: 'VERA', color: REPORTER_COLORS.vera.onDarkAccent },
];

export default function ReporterNavStrip({ activeSection, onSectionChange, isDesktop }) {
  if (isDesktop) {
    return (
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 48px',
        borderBottom: `1px solid ${BROADSHEET_TOKENS.sectionRule}`,
        height: BROADSHEET_TOKENS.navStripHeight,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          flex: 1,
        }}>
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.key;
            return (
              <button
                key={section.key}
                onClick={() => onSectionChange(section.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${section.color}` : '2px solid transparent',
                  padding: '10px 0',
                  cursor: 'pointer',
                  fontFamily: BROADSHEET_TOKENS.fontMono,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: isActive ? section.color : '#859398',
                  transition: 'color 0.2s ease, border-color 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {section.prefix || ''}{section.label}
              </button>
            );
          })}
        </div>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#859398',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Search stories"
        >
          <Search size={16} />
        </button>
      </nav>
    );
  }

  // Mobile: horizontal scroll strip with pill buttons
  return (
    <nav style={{
      display: 'flex',
      gap: 8,
      padding: '12px 16px',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      msOverflowStyle: 'none',
      scrollbarWidth: 'none',
      borderBottom: '1px solid rgba(60, 73, 77, 0.2)',
    }}>
      {SECTIONS.map((section) => {
        const isActive = activeSection === section.key;
        return (
          <button
            key={section.key}
            onClick={() => onSectionChange(section.key)}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 16,
              border: isActive ? 'none' : '1px solid rgba(60, 73, 77, 0.3)',
              background: isActive ? section.color : '#343439',
              color: isActive ? '#003641' : '#fff9ef',
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {section.prefix || ''}{section.label}
          </button>
        );
      })}
    </nav>
  );
}
