import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ChevronDown, ChevronUp, Clock, User, Monitor, Loader2 } from 'lucide-react';
import { getTimeAgo } from '../../utils/formatters';

// =============================================================================
// CONSTANTS
// =============================================================================

const ADMIN_USERS = ['Flash', 'Faisal'];

const SEVERITY_CONFIG = {
  critical: { color: '#ff4757', label: 'Critical', order: 0 },
  major:    { color: '#f59e0b', label: 'Major',    order: 1 },
  minor:    { color: '#00d9ff', label: 'Minor',    order: 2 },
  cosmetic: { color: '#8b949e', label: 'Cosmetic', order: 3 },
};

const STATUS_OPTIONS = [
  { value: 'new',         label: 'New' },
  { value: 'triaging',    label: 'Triaging' },
  { value: 'diagnosed',   label: 'Diagnosed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'fixed',       label: 'Fixed' },
  { value: 'wontfix',     label: "Won't Fix" },
  { value: 'duplicate',   label: 'Duplicate' },
];

const STATUS_FILTERS = ['all', 'new', 'triaging', 'in_progress', 'fixed'];
const SEVERITY_FILTERS = ['all', 'critical', 'major', 'minor', 'cosmetic'];

const REFRESH_INTERVAL_MS = 60000;

// =============================================================================
// HELPERS
// =============================================================================

function parseTimestamp(ts) {
  if (!ts) return null;
  // Firestore Timestamp with _seconds
  if (ts._seconds) return new Date(ts._seconds * 1000);
  // Firestore Timestamp with seconds
  if (ts.seconds) return new Date(ts.seconds * 1000);
  // ISO string or Date-parseable
  return new Date(ts);
}

function getSeverityOrder(report) {
  const sev = report.aiClassification?.severity;
  return SEVERITY_CONFIG[sev]?.order ?? 99;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export { ADMIN_USERS };

export default function BugReportAdmin({ user, colors, isDesktop, onBack }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const refreshTimer = useRef(null);

  // ─── DATA FETCHING ──────────────────────────────────────────

  const fetchReports = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/bug-report?limit=50');
      const data = await res.json();
      if (data.success && data.reports) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error('[BugReportAdmin] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(true);
    refreshTimer.current = setInterval(() => fetchReports(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer.current);
  }, [fetchReports]);

  // ─── STATUS UPDATE ──────────────────────────────────────────

  const updateReport = async (reportId, updates) => {
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', reportId, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setReports(prev => prev.map(r =>
          r.id === reportId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
        ));
      }
    } catch (err) {
      console.error('[BugReportAdmin] Update error:', err.message);
    }
  };

  // ─── FILTERING & SORTING ───────────────────────────────────

  const filtered = reports
    .filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (severityFilter !== 'all') {
        const sev = r.aiClassification?.severity;
        if (sev !== severityFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by severity first, then by date descending
      const sevDiff = getSeverityOrder(a) - getSeverityOrder(b);
      if (sevDiff !== 0) return sevDiff;
      const dateA = parseTimestamp(a.createdAt);
      const dateB = parseTimestamp(b.createdAt);
      return (dateB || 0) - (dateA || 0);
    });

  // ─── STATS ─────────────────────────────────────────────────

  const openStatuses = ['new', 'triaging', 'diagnosed', 'in_progress'];
  const totalCount = reports.length;
  const openCount = reports.filter(r => openStatuses.includes(r.status)).length;
  const criticalCount = reports.filter(r =>
    r.aiClassification?.severity === 'critical' && openStatuses.includes(r.status)
  ).length;

  // ─── RENDER ────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: colors?.textPrimary || '#e6edf3',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderBottom: '1px solid #21262d',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#00d9ff',
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bug size={18} color="#00d9ff" />
            <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', margin: 0 }}>
              ClashBot Reports
            </h1>
          </div>

          <button
            onClick={() => fetchReports(true)}
            style={{
              color: '#8b949e',
              fontSize: 12,
              backgroundColor: 'transparent',
              border: '1px solid #21262d',
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 40px' }}>

        {/* Stats Bar */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 16,
          marginBottom: 16,
        }}>
          <StatChip label="Total" value={totalCount} color="#8b949e" />
          <StatChip label="Open" value={openCount} color="#00d9ff" />
          <StatChip label="Critical" value={criticalCount} color="#ff4757" />
        </div>

        {/* Status Filters */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#6e7681', fontWeight: 600, marginBottom: 6 }}>STATUS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_FILTERS.map(f => (
              <FilterChip
                key={f}
                label={f === 'all' ? 'All' : STATUS_OPTIONS.find(s => s.value === f)?.label || f}
                active={statusFilter === f}
                onClick={() => setStatusFilter(f)}
                color="#00d9ff"
              />
            ))}
          </div>
        </div>

        {/* Severity Filters */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#6e7681', fontWeight: 600, marginBottom: 6 }}>SEVERITY</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SEVERITY_FILTERS.map(f => (
              <FilterChip
                key={f}
                label={f === 'all' ? 'All' : SEVERITY_CONFIG[f]?.label || f}
                active={severityFilter === f}
                onClick={() => setSeverityFilter(f)}
                color={f === 'all' ? '#00d9ff' : SEVERITY_CONFIG[f]?.color || '#8b949e'}
              />
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#8b949e' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 8, fontSize: 13 }}>Loading reports...</div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6e7681',
          }}>
            <Bug size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {reports.length === 0
                ? 'No reports yet — your app is running clean!'
                : 'No reports match the current filters'}
            </div>
            <div style={{ fontSize: 13 }}>
              {reports.length > 0 && 'Try adjusting the status or severity filters'}
            </div>
          </div>
        )}

        {/* Report Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!loading && filtered.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              expanded={expandedId === report.id}
              onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
              onUpdateStatus={(status) => updateReport(report.id, { status, resolvedBy: user?.username })}
              onUpdateResolution={(resolution) => updateReport(report.id, { resolution, resolvedBy: user?.username })}
              onMarkDuplicate={(duplicateOf) => updateReport(report.id, { status: 'duplicate', duplicateOf })}
              colors={colors}
              isDesktop={isDesktop}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatChip({ label, value, color }) {
  return (
    <div style={{
      flex: 1,
      backgroundColor: '#161b22',
      border: `1px solid ${color}33`,
      borderRadius: 8,
      padding: '10px 12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 16,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${active ? color : '#21262d'}`,
        backgroundColor: active ? `${color}18` : 'transparent',
        color: active ? color : '#8b949e',
        transition: 'all 0.15s',
        outline: 'none',
      }}
    >
      {label}
    </button>
  );
}

function ReportCard({
  report,
  expanded,
  onToggle,
  onUpdateStatus,
  onUpdateResolution,
  onMarkDuplicate,
  colors,
  isDesktop,
}) {
  const [resolutionText, setResolutionText] = useState(report.resolution || '');
  const [duplicateTicket, setDuplicateTicket] = useState('');

  const ai = report.aiClassification;
  const severity = ai?.severity || 'minor';
  const sevConfig = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.minor;
  const summary = ai?.summary || report.userDescription;
  const createdDate = parseTimestamp(report.createdAt);
  const timeAgo = createdDate ? getTimeAgo(createdDate.toISOString()) : '';

  return (
    <motion.div
      layout
      style={{
        backgroundColor: '#161b22',
        border: `1px solid ${expanded ? sevConfig.color + '60' : '#21262d'}`,
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Card Header — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          outline: 'none',
        }}
      >
        {/* Severity dot */}
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: sevConfig.color,
          marginTop: 4,
          flexShrink: 0,
          boxShadow: severity === 'critical' ? `0 0 8px ${sevConfig.color}` : 'none',
          animation: severity === 'critical' ? 'clashbot-pulse 2s ease-in-out infinite' : 'none',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Ticket + Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: sevConfig.color }}>
              {report.ticketNumber}
            </span>
            <StatusBadge status={report.status} />
            {ai?.category && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#8b949e',
                backgroundColor: '#21262d',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                {ai.category.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Summary */}
          <div style={{
            fontSize: 13,
            color: '#e6edf3',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {summary}
          </div>

          {/* Meta row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 6,
            fontSize: 11,
            color: '#6e7681',
          }}>
            {ai?.affectedComponent && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Monitor size={10} /> {ai.affectedComponent}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <User size={10} /> {report.userId || 'anonymous'}
            </span>
            {timeAgo && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {timeAgo}
              </span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        {expanded
          ? <ChevronUp size={16} color="#6e7681" style={{ marginTop: 4, flexShrink: 0 }} />
          : <ChevronDown size={16} color="#6e7681" style={{ marginTop: 4, flexShrink: 0 }} />
        }
      </button>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 14px 14px',
              borderTop: '1px solid #21262d',
              marginTop: 0,
            }}>
              {/* Full Description */}
              <DetailSection title="Description">
                <div style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {report.userDescription}
                </div>
              </DetailSection>

              {/* AI Reproduction Steps */}
              {ai?.reproductionSteps?.length > 0 && (
                <DetailSection title="Reproduction Steps">
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#c9d1d9', lineHeight: 1.6 }}>
                    {ai.reproductionSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </DetailSection>
              )}

              {/* AI Possible Cause */}
              {ai?.possibleCause && (
                <DetailSection title="Possible Cause">
                  <div style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.5 }}>
                    {ai.possibleCause}
                  </div>
                </DetailSection>
              )}

              {/* Metadata */}
              <DetailSection title="Metadata">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                  {report.metadata?.screen && <MetaTag label="Screen" value={report.metadata.screen} />}
                  {report.metadata?.gameMode && <MetaTag label="Mode" value={report.metadata.gameMode} />}
                  {report.metadata?.battleId && <MetaTag label="Battle" value={report.metadata.battleId} />}
                  {report.metadata?.isMobile !== undefined && (
                    <MetaTag label="Device" value={report.metadata.isMobile ? 'Mobile' : 'Desktop'} />
                  )}
                  {report.metadata?.screenWidth && report.metadata?.screenHeight && (
                    <MetaTag label="Size" value={`${report.metadata.screenWidth}x${report.metadata.screenHeight}`} />
                  )}
                  {report.metadata?.appVersion && <MetaTag label="Version" value={report.metadata.appVersion} />}
                </div>
              </DetailSection>

              {/* Recent Console Errors */}
              {report.metadata?.recentErrors?.length > 0 && (
                <DetailSection title="Console Errors">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {report.metadata.recentErrors.map((err, i) => (
                      <div key={i} style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#ff4757',
                        backgroundColor: '#1a0000',
                        padding: '4px 8px',
                        borderRadius: 4,
                        wordBreak: 'break-all',
                      }}>
                        {err}
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Status Update */}
              <DetailSection title="Update Status">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onUpdateStatus(opt.value)}
                      disabled={report.status === opt.value}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: report.status === opt.value ? 'default' : 'pointer',
                        border: `1px solid ${report.status === opt.value ? '#00d9ff' : '#21262d'}`,
                        backgroundColor: report.status === opt.value ? 'rgba(0,217,255,0.1)' : 'transparent',
                        color: report.status === opt.value ? '#00d9ff' : '#8b949e',
                        outline: 'none',
                        opacity: report.status === opt.value ? 1 : 0.8,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </DetailSection>

              {/* Resolution Notes */}
              <DetailSection title="Resolution Notes">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="Add resolution notes..."
                    style={{
                      flex: 1,
                      backgroundColor: '#0d1117',
                      color: '#e6edf3',
                      border: '1px solid #21262d',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={() => onUpdateResolution(resolutionText)}
                    disabled={!resolutionText.trim()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: resolutionText.trim() ? 'pointer' : 'default',
                      border: '1px solid #00d9ff',
                      backgroundColor: resolutionText.trim() ? 'rgba(0,217,255,0.1)' : 'transparent',
                      color: resolutionText.trim() ? '#00d9ff' : '#6e7681',
                      outline: 'none',
                    }}
                  >
                    Save
                  </button>
                </div>
              </DetailSection>

              {/* Mark as Duplicate */}
              <DetailSection title="Mark as Duplicate">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={duplicateTicket}
                    onChange={(e) => setDuplicateTicket(e.target.value)}
                    placeholder="CB-0001"
                    style={{
                      width: 100,
                      backgroundColor: '#0d1117',
                      color: '#e6edf3',
                      border: '1px solid #21262d',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (duplicateTicket.trim()) {
                        onMarkDuplicate(duplicateTicket.trim());
                        setDuplicateTicket('');
                      }
                    }}
                    disabled={!duplicateTicket.trim()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: duplicateTicket.trim() ? 'pointer' : 'default',
                      border: '1px solid #f59e0b',
                      backgroundColor: duplicateTicket.trim() ? 'rgba(245,158,11,0.1)' : 'transparent',
                      color: duplicateTicket.trim() ? '#f59e0b' : '#6e7681',
                      outline: 'none',
                    }}
                  >
                    Mark Duplicate
                  </button>
                </div>
              </DetailSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const statusColors = {
    new:         '#00d9ff',
    triaging:    '#f59e0b',
    diagnosed:   '#8b5cf6',
    in_progress: '#3b82f6',
    fixed:       '#22c55e',
    wontfix:     '#6e7681',
    duplicate:   '#6e7681',
  };
  const color = statusColors[status] || '#6e7681';
  const label = STATUS_OPTIONS.find(s => s.value === status)?.label || status;

  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color,
      backgroundColor: `${color}18`,
      padding: '2px 7px',
      borderRadius: 4,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {label}
    </span>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#6e7681',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MetaTag({ label, value }) {
  return (
    <span style={{
      backgroundColor: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: 4,
      padding: '3px 8px',
      color: '#8b949e',
    }}>
      <span style={{ color: '#6e7681' }}>{label}: </span>
      <span style={{ color: '#c9d1d9' }}>{value}</span>
    </span>
  );
}
