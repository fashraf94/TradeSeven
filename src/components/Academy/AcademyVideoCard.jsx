import React from 'react';
import { Play, Gamepad2 } from 'lucide-react';

const OBSIDIAN_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)';

export default function AcademyVideoCard({ video, categories }) {
  const category = categories.find(c => c.id === video.category);
  const color = category?.color || '#00d9ff';

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      gap: '12px',
      background: '#15171E',
      borderRadius: '14px',
      padding: '12px',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: OBSIDIAN_SHADOW,
      cursor: 'pointer',
      transition: 'transform 0.15s ease, border-color 0.15s ease',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.01)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      {/* NEW dot */}
      {video.isNew && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#00d9ff',
          boxShadow: '0 0 6px rgba(0,217,255,0.5)',
        }} />
      )}

      {/* Thumbnail */}
      <div style={{
        flexShrink: 0,
        width: '120px',
        height: '90px',
        borderRadius: '10px',
        background: `linear-gradient(135deg, ${color}1A 0%, ${color}0D 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Play size={20} color="rgba(255,255,255,0.6)" style={{ marginLeft: '1px' }} />
        {/* Duration badge */}
        <span style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          fontSize: '10px',
          fontWeight: 600,
          color: '#ffffff',
          background: 'rgba(0,0,0,0.7)',
          padding: '2px 6px',
          borderRadius: '4px',
        }}>
          {video.duration}s
        </span>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* Title */}
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {video.title}
        </div>

        {/* Category + difficulty */}
        <div style={{
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ color: color }}>{category?.label}</span>
          <span style={{ color: '#6e7681' }}>&bull;</span>
          <span style={{
            color: '#94a3b8',
            textTransform: 'capitalize',
          }}>
            {video.difficulty}
          </span>
        </div>

        {/* Hook */}
        <div style={{
          fontSize: '13px',
          color: '#6e7681',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {video.hook}
        </div>

        {/* Game connection pill */}
        {video.gameConnection && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '10px',
            color: '#6e7681',
            marginTop: '2px',
          }}>
            <Gamepad2 size={10} />
            {video.gameConnection}
          </div>
        )}
      </div>
    </div>
  );
}
