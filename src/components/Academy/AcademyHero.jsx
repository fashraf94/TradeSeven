import React from 'react';
import { Play, Gamepad2 } from 'lucide-react';

const OBSIDIAN_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)';

export default function AcademyHero({ video, categories }) {
  if (!video) return null;

  const category = categories.find(c => c.id === video.category);
  const color = category?.color || '#00d9ff';

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      borderRadius: '16px',
      padding: '24px',
      background: `linear-gradient(135deg, ${color}14 0%, #15171E 100%)`,
      border: `1px solid ${color}33`,
      boxShadow: OBSIDIAN_SHADOW,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      minHeight: '240px',
    }}>
      {/* Play button */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'rgba(0,217,255,0.15)',
        border: '1px solid rgba(0,217,255,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s ease, transform 0.15s ease',
      }}>
        <Play size={24} color="#00d9ff" style={{ marginLeft: '2px' }} />
      </div>

      {/* Pills row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {video.isNew && (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0D0E12',
            background: '#00d9ff',
            padding: '3px 8px',
            borderRadius: '10px',
          }}>
            NEW
          </span>
        )}
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          color: color,
        }}>
          {category?.label}
        </span>
        <span style={{ color: '#6e7681', fontSize: '12px' }}>
          {video.duration}s
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: '28px',
        fontWeight: 700,
        color: '#ffffff',
        lineHeight: 1.2,
      }}>
        {video.title}
      </div>

      {/* Hook */}
      <div style={{
        fontSize: '16px',
        color: '#8b949e',
        lineHeight: 1.5,
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
          gap: '4px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '4px 10px',
          fontSize: '12px',
          color: '#94a3b8',
          alignSelf: 'flex-start',
        }}>
          <Gamepad2 size={12} />
          {video.gameConnection}
        </div>
      )}
    </div>
  );
}
