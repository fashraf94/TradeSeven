import React, { useState } from 'react';

/**
 * DraftToolButtons - Integrated Tool Buttons for Command Deck
 *
 * Three futuristic console control buttons for draft analysis tools.
 * Features icons, labels, and hover glow effects.
 */

const DraftToolButtons = ({
  onAnalyze,
  onCompare,
  onNotes,
  disabled = false,
}) => {
  const tools = [
    {
      key: 'analyze',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      label: 'Analyze Draft',
      shortLabel: 'Analyze',
      onClick: onAnalyze,
      color: '#00ffff',
    },
    {
      key: 'compare',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6l9 6-9 6V6z" />
          <path d="M21 6l-9 6 9 6V6z" />
        </svg>
      ),
      label: 'Compare Picks',
      shortLabel: 'Compare',
      onClick: onCompare,
      color: '#00ffff',
    },
    {
      key: 'notes',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      label: 'My Notes',
      shortLabel: 'Notes',
      onClick: onNotes,
      color: '#00ffff',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {tools.map((tool) => (
        <ToolButton
          key={tool.key}
          icon={tool.icon}
          label={tool.label}
          shortLabel={tool.shortLabel}
          onClick={tool.onClick}
          color={tool.color}
          disabled={disabled}
        />
      ))}

      {/* Vertical label */}
      <div
        style={{
          fontSize: '9px',
          color: '#6e7681',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          letterSpacing: '0.5px',
          marginLeft: '4px',
        }}
      >
        TOOLS
      </div>
    </div>
  );
};

/**
 * Individual Tool Button Component
 */
const ToolButton = ({
  icon,
  label,
  shortLabel,
  onClick,
  color = '#00ffff',
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        position: 'relative',
        background: isPressed
          ? 'rgba(0, 255, 255, 0.15)'
          : isHovered
            ? 'rgba(0, 255, 255, 0.08)'
            : 'rgba(10, 20, 30, 0.8)',
        border: `1px solid ${
          isHovered ? 'rgba(0, 255, 255, 0.6)' : 'rgba(0, 255, 255, 0.3)'
        }`,
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        boxShadow: isHovered
          ? '0 0 15px rgba(0, 255, 255, 0.2), inset 0 0 20px rgba(0, 255, 255, 0.05)'
          : 'none',
        transform: isPressed ? 'scale(0.98)' : 'none',
        minWidth: '70px',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10px',
          right: '10px',
          height: '1px',
          background: isHovered
            ? `linear-gradient(90deg, transparent, ${color}, transparent)`
            : 'transparent',
          transition: 'background 0.2s ease',
        }}
      />

      {/* Icon */}
      <div
        style={{
          color: isHovered ? color : '#8b949e',
          transition: 'color 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>

      {/* Label - show short on mobile via CSS */}
      <span
        className="tool-label-full"
        style={{
          fontSize: '10px',
          fontWeight: '600',
          color: isHovered ? color : '#8b949e',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          transition: 'color 0.2s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>

      {/* Corner accents */}
      {isHovered && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              width: '6px',
              height: '6px',
              borderTop: `1px solid ${color}`,
              borderLeft: `1px solid ${color}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '6px',
              height: '6px',
              borderTop: `1px solid ${color}`,
              borderRight: `1px solid ${color}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              left: '4px',
              width: '6px',
              height: '6px',
              borderBottom: `1px solid ${color}`,
              borderLeft: `1px solid ${color}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              width: '6px',
              height: '6px',
              borderBottom: `1px solid ${color}`,
              borderRight: `1px solid ${color}`,
            }}
          />
        </>
      )}
    </button>
  );
};

/**
 * Compact version for mobile - icon only with tooltip
 */
export const DraftToolButtonsCompact = ({
  onAnalyze,
  onCompare,
  onNotes,
  disabled = false,
}) => {
  const tools = [
    {
      key: 'analyze',
      icon: '🔍',
      label: 'Analyze',
      onClick: onAnalyze,
    },
    {
      key: 'compare',
      icon: '⚖️',
      label: 'Compare',
      onClick: onCompare,
    },
    {
      key: 'notes',
      icon: '📝',
      label: 'Notes',
      onClick: onNotes,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {tools.map(({ key, icon, label, onClick }) => (
        <button
          key={key}
          onClick={onClick}
          disabled={disabled}
          title={label}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: 'rgba(10, 20, 30, 0.8)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
};

export default DraftToolButtons;
