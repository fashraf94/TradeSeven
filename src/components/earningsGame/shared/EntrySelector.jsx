// EntrySelector.jsx - Component for managing multiple tournament entries
import { motion, AnimatePresence } from 'framer-motion';
import { designColors, glowEffects } from '../designConstants';

const MAX_ENTRIES = 3;

/**
 * Entry status badge component
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    building: { label: 'BUILDING', color: designColors.orange, bg: 'rgba(249, 115, 22, 0.2)' },
    locked: { label: 'LOCKED', color: designColors.green, bg: 'rgba(16, 185, 129, 0.2)' },
    complete: { label: 'COMPLETE', color: designColors.cyan, bg: 'rgba(0, 217, 255, 0.2)' },
    in_progress: { label: 'IN PROGRESS', color: designColors.violet, bg: 'rgba(167, 139, 250, 0.2)' }
  };

  const config = statusConfig[status] || statusConfig.building;

  return (
    <span style={{
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      color: config.color,
      background: config.bg,
      padding: '3px 8px',
      borderRadius: '4px',
      border: `1px solid ${config.color}40`
    }}>
      {config.label}
    </span>
  );
};

/**
 * Single entry card component
 */
const EntryCard = ({ entry, isActive, onSelect, onEdit, onView }) => {
  const isLocked = entry.status === 'locked' || entry.status === 'complete' || entry.status === 'in_progress';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      style={{
        background: isActive ? 'rgba(0, 217, 255, 0.08)' : designColors.bgCard,
        borderRadius: '12px',
        padding: '16px',
        border: isActive
          ? `2px solid ${designColors.cyan}`
          : `1px solid ${designColors.borderDefault}`,
        cursor: 'pointer',
        boxShadow: isActive ? glowEffects.cyan : 'none',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '18px',
            fontWeight: '700',
            color: designColors.textPrimary
          }}>
            Entry {entry.entryNumber}
          </span>
          <StatusBadge status={entry.status} />
        </div>
        {isActive && (
          <span style={{
            fontSize: '10px',
            color: designColors.cyan,
            fontWeight: '600'
          }}>
            ACTIVE
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '12px'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: designColors.textMuted }}>Picks</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: designColors.textPrimary }}>
            {entry.predictionCount || entry.predictions?.length || 0}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: designColors.textMuted }}>Spent</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: designColors.textPrimary }}>
            ${(entry.totalSpent || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: designColors.textMuted }}>Potential</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: designColors.cyan }}>
            {(entry.totalPotentialPoints || 0).toLocaleString()} pts
          </div>
        </div>
        {entry.results?.totalPoints > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: designColors.textMuted }}>Score</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: designColors.green }}>
              {entry.results.totalPoints.toLocaleString()} pts
            </div>
          </div>
        )}
      </div>

      {/* Results Row (if resolved) */}
      {entry.results && entry.results.correctPredictions !== undefined && (
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '8px 0',
          borderTop: `1px solid ${designColors.borderDefault}`
        }}>
          <span style={{ fontSize: '13px', color: designColors.green }}>
            {entry.results.correctPredictions} correct
          </span>
          <span style={{ fontSize: '13px', color: designColors.red }}>
            {entry.results.incorrectPredictions} wrong
          </span>
          {entry.results.pendingPredictions > 0 && (
            <span style={{ fontSize: '13px', color: designColors.orange }}>
              {entry.results.pendingPredictions} pending
            </span>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          isLocked ? onView?.(entry) : onEdit?.(entry);
        }}
        style={{
          width: '100%',
          marginTop: '8px',
          padding: '10px',
          background: isLocked
            ? 'rgba(0, 217, 255, 0.1)'
            : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${isLocked ? designColors.cyan : designColors.green}`,
          borderRadius: '8px',
          color: isLocked ? designColors.cyan : designColors.green,
          fontWeight: '600',
          fontSize: '13px',
          cursor: 'pointer'
        }}
      >
        {isLocked ? 'View Predictions' : 'Edit Entry'}
      </button>
    </motion.div>
  );
};

/**
 * Create new entry button component
 */
const CreateEntryButton = ({ entryNumber, onClick, disabled }) => {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02, borderColor: designColors.green } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '24px',
        background: disabled ? designColors.bgCard : 'transparent',
        border: `2px dashed ${disabled ? designColors.borderDefault : designColors.borderSubtle}`,
        borderRadius: '12px',
        color: disabled ? designColors.textMuted : designColors.textSecondary,
        fontWeight: '600',
        fontSize: '15px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1
      }}
    >
      <span style={{ fontSize: '20px' }}>+</span>
      Create Entry {entryNumber}
    </motion.button>
  );
};

/**
 * Main EntrySelector component
 * Allows users to view, select, and manage multiple tournament entries
 */
export default function EntrySelector({
  entries = [],
  maxEntries = MAX_ENTRIES,
  activeEntryId = null,
  onSelectEntry,
  onCreateEntry,
  onEditEntry,
  onViewEntry,
  isDeadlinePassed = false,
  isDesktop = false
}) {
  const canCreateMore = entries.length < maxEntries && !isDeadlinePassed;
  const nextEntryNumber = entries.length + 1;

  // Sort entries by entry number
  const sortedEntries = [...entries].sort((a, b) => a.entryNumber - b.entryNumber);

  return (
    <div style={{
      padding: isDesktop ? '0' : '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '700',
          color: designColors.textPrimary
        }}>
          Your Entries
        </h3>
        <span style={{
          fontSize: '14px',
          color: designColors.textMuted,
          fontWeight: '600'
        }}>
          {entries.length}/{maxEntries}
        </span>
      </div>

      {/* Entries List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <AnimatePresence>
          {sortedEntries.map((entry) => (
            <EntryCard
              key={entry.entryId}
              entry={entry}
              isActive={entry.entryId === activeEntryId}
              onSelect={() => onSelectEntry?.(entry)}
              onEdit={() => onEditEntry?.(entry)}
              onView={() => onViewEntry?.(entry)}
            />
          ))}
        </AnimatePresence>

        {/* Create New Entry Button */}
        {canCreateMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CreateEntryButton
              entryNumber={nextEntryNumber}
              onClick={() => onCreateEntry?.(nextEntryNumber)}
              disabled={isDeadlinePassed}
            />
          </motion.div>
        )}

        {/* Deadline Passed Message */}
        {isDeadlinePassed && entries.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '24px',
            color: designColors.textMuted
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              <span role="img" aria-label="lock">🔒</span>
            </div>
            <div style={{ fontSize: '14px' }}>
              Tournament entries are locked
            </div>
          </div>
        )}
      </div>

      {/* Entry Legend */}
      {entries.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: designColors.bgCard,
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: designColors.orange
            }} />
            <span style={{ fontSize: '11px', color: designColors.textMuted }}>Building</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: designColors.green
            }} />
            <span style={{ fontSize: '11px', color: designColors.textMuted }}>Locked</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: designColors.cyan
            }} />
            <span style={{ fontSize: '11px', color: designColors.textMuted }}>Complete</span>
          </div>
        </div>
      )}
    </div>
  );
}
