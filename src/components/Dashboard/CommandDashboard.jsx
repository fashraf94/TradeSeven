// src/components/Dashboard/CommandDashboard.jsx
//
// The mobile loop-home — directing an AI trading agent through the real loop:
// Read → Equip → Deploy → Manage → Review. Renders behind the
// COMMAND_DASHBOARD_ENABLED flag in place of DashboardLoop (called with the same
// props, so it's a drop-in). Desktop is unaffected.
//
// PHASE 1: flag + loop scaffold + the Read station (powered by the net-new
// useDailyRegimeBrief hook) + the agent-identity Orb. Equip / Deploy / Manage /
// Review are rendered as visible, labeled stubs so the five-station structure
// reads end-to-end; they get wired in later phases.
//
// Theme: obsidian (DARK_TOKENS) surfaces + each agent's own accent
// (agent.avatarColors). Glow is restrained; red is reserved for downside only
// (via GainLossBadge, introduced in a later phase) and never appears here.

import React from 'react';
import { motion } from 'framer-motion';
import { Menu, BookOpen, Boxes, Rocket, Activity, Film, ArrowRight } from 'lucide-react';
import HoloCard from '../shared/HoloCard';
import AgentOrb from '../shared/AgentOrb';
import { useTheme } from '../../contexts/ThemeContext';
import useAgent from '../../hooks/useAgent';
import useDailyRegimeBrief from '../../hooks/useDailyRegimeBrief';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function prettyDate(forDate) {
  if (!forDate) return null;
  try {
    // forDate is YYYY-MM-DD; render without a TZ shift by anchoring to UTC.
    const [y, m, d] = forDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return forDate;
  }
}

// The five loop stages. `read` is the only active stage in Phase 1.
const STAGES = [
  { key: 'read', n: '01', label: 'Read', Icon: BookOpen },
  { key: 'equip', n: '02', label: 'Equip', Icon: Boxes },
  { key: 'deploy', n: '03', label: 'Deploy', Icon: Rocket },
  { key: 'manage', n: '04', label: 'Manage', Icon: Activity },
  { key: 'review', n: '05', label: 'Review', Icon: Film },
];

const STATION_BLURB = {
  equip: 'Your agent’s bench — archetype, watchlist, and an open rules slot.',
  deploy: 'Send your agent into a live hour on today’s read.',
  manage: 'Track your agent while a battle is live.',
  review: 'Break down the tape after the bell.',
};

// ─── Motion ──────────────────────────────────────────────────────────────────

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommandDashboard({
  user,
  setScreen,
  setSidebarOpen,
  unreadCount,
  // The remaining DashboardLoop props (battles, modal setters, etc.) are passed
  // by the same call site and get destructured here as later phases wire
  // Deploy / Manage / Review. Unreferenced for now — harmlessly ignored.
}) {
  const { tokens } = useTheme();
  const { agent, record } = useAgent(user?.odUserId);
  const drb = useDailyRegimeBrief();

  // The user-picked primaryColor supersedes the Haiku-generated avatarColors
  // (onboarding rule); fall back to avatarColors only when it's absent (null
  // on agents created before the color picker).
  const accent = agent?.primaryColor || agent?.avatarColors?.[0] || tokens.teal;
  const accent2 = agent?.primaryColor || agent?.avatarColors?.[1] || accent;
  const agentName = agent?.name || user?.username || 'your agent';
  const archetype = agent?.archetype ? getArchetypeDisplayName(agent.archetype) : null;

  const orbState = drb.loading ? 'reading' : 'ready';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: tokens.bgApp,
      color: tokens.textPrimary,
      position: 'relative',
      zIndex: 1,
    }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        background: tokens.bgCard,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Left: menu */}
          <button
            onClick={() => setSidebarOpen?.(true)}
            aria-label="Open menu"
            style={{
              position: 'relative', minWidth: '44px', minHeight: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: accent, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Menu size={22} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                minWidth: '18px', height: '18px', padding: '0 5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: tokens.red, borderRadius: '9px', color: tokens.textWhite,
                fontSize: '10px', fontWeight: 700, lineHeight: 1, boxShadow: tokens.glowRedDot,
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Center: title + greeting */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px',
              textTransform: 'uppercase', color: accent,
            }}>
              Command
            </div>
            <div style={{
              fontSize: '13px', color: tokens.textMuted,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {getGreeting()}, {user?.username || 'Player'}
            </div>
          </div>

          {/* Right: avatar → profile */}
          <div
            onClick={() => setScreen?.('profile')}
            role="button"
            aria-label="Open profile"
            style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: tokens.bgCard, border: `2px solid ${accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: 600, color: tokens.textWhite,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {(user?.username || 'P')[0].toUpperCase()}
          </div>
        </div>

        {/* Loop rail */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '4px', marginTop: '12px',
        }}>
          {STAGES.map((s, i) => {
            const active = s.key === 'read';
            return (
              <React.Fragment key={s.key}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  opacity: active ? 1 : 0.42,
                }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? hexToRgba(accent, 0.14) : tokens.bgIcon,
                    border: `1px solid ${active ? hexToRgba(accent, 0.4) : tokens.borderDefault}`,
                    color: active ? accent : tokens.textFaint,
                  }}>
                    <s.Icon size={15} />
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: active ? accent : tokens.textFaint,
                  }}>
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div style={{ flex: 1, height: '1px', background: tokens.borderDefault, marginTop: '-12px' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </header>

      {/* ─── Feed ────────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          flex: 1, padding: '20px 16px 130px 16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
        }}
      >
        {/* ── 01 · READ ─────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <HoloCard
            accentColor={accent}
            size="lg"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderDefault}`,
              boxShadow: `${tokens.obsidianShadow}, 0 0 26px ${hexToRgba(accent, 0.10)}`,
              borderTop: `2px solid ${hexToRgba(accent, 0.55)}`,
            }}
          >
            {/* Header row: orb + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              <AgentOrb colors={[accent, accent2]} size={64} state={orbState} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '2px',
                  textTransform: 'uppercase', color: accent, marginBottom: '4px',
                }}>
                  01 · Read
                </div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: tokens.textWhite, lineHeight: 1.25 }}>
                  {agentName} on today&apos;s read
                </div>
                {archetype && (
                  <div style={{ fontSize: '12px', color: tokens.textMuted, marginTop: '2px' }}>
                    {archetype}{record ? ` · ${record}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Brief body */}
            {drb.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0.95, 0.85, 0.6].map((w, i) => (
                  <div key={i} style={{
                    height: '12px', width: `${w * 100}%`, borderRadius: '6px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                  }} />
                ))}
              </div>
            ) : drb.dailyBrief ? (
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: tokens.textSecondary }}>
                {drb.dailyBrief}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: tokens.textMuted }}>
                {drb.error
                  ? 'Couldn’t load today’s brief just now — pull to retry shortly.'
                  : 'Today’s brief isn’t in yet. Your agent will read it the moment it lands.'}
              </p>
            )}

            {/* Theme + key-event chips (light supporting context) */}
            {!drb.loading && (drb.themes.length > 0 || drb.keyEvents.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
                {drb.themes.slice(0, 3).map((t, i) => (
                  <span key={`t-${i}`} style={{
                    fontSize: '11px', fontWeight: 600, color: tokens.textSecondary,
                    padding: '4px 10px', borderRadius: '20px',
                    background: hexToRgba(accent, 0.10), border: `1px solid ${hexToRgba(accent, 0.20)}`,
                  }}>
                    {t}
                  </span>
                ))}
                {drb.keyEvents.slice(0, 2).map((e, i) => (
                  <span key={`e-${i}`} style={{
                    fontSize: '11px', fontWeight: 600, color: tokens.textMuted,
                    padding: '4px 10px', borderRadius: '20px',
                    background: tokens.bgIcon, border: `1px solid ${tokens.borderDefault}`,
                  }}>
                    {e?.label || ''}
                  </span>
                ))}
              </div>
            )}

            {/* Meta + tagline */}
            {!drb.loading && drb.forDate && (
              <div style={{ fontSize: '11px', color: tokens.textFaint, marginTop: '12px' }}>
                Brief for {prettyDate(drb.forDate)}{drb.isStale ? ' · showing the latest available' : ''}
              </div>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
              marginTop: '14px', paddingTop: '12px',
              borderTop: `1px solid ${tokens.borderDefault}`,
              fontSize: '12px', fontWeight: 600, color: tokens.textMuted,
            }}>
              <span>Read the brief</span>
              <ArrowRight size={12} color={tokens.textFaint} />
              <span>equip the open rules slot</span>
              <ArrowRight size={12} color={tokens.textFaint} />
              <span style={{ color: accent }}>Deploy</span>
            </div>
          </HoloCard>
        </motion.div>

        {/* ── 02–05 · stubs (wired in later phases) ─────────────────────── */}
        {STAGES.filter(s => s.key !== 'read').map(s => (
          <motion.div key={s.key} variants={sectionVariants}>
            <HoloCard
              size="lg"
              style={{
                background: tokens.bgCard,
                border: `1px solid ${tokens.borderDefault}`,
                boxShadow: tokens.obsidianShadow,
                opacity: 0.7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: tokens.bgIcon, border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textMuted,
                }}>
                  <s.Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.textPrimary }}>
                    {s.n} · {s.label}
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.textMuted, marginTop: '2px' }}>
                    {STATION_BLURB[s.key]}
                  </div>
                </div>
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  color: tokens.textFaint, padding: '3px 8px', borderRadius: '20px',
                  background: tokens.bgIcon, border: `1px solid ${tokens.borderDefault}`,
                }}>
                  Soon
                </span>
              </div>
            </HoloCard>
          </motion.div>
        ))}

        {/* Footer loop label */}
        <div style={{
          textAlign: 'center', marginTop: '4px',
          fontSize: '10px', fontWeight: 600, letterSpacing: '1px',
          textTransform: 'uppercase', color: tokens.textFaintest,
        }}>
          Read → Equip → Deploy → Manage → Review
        </div>
      </motion.div>
    </div>
  );
}
