// src/components/Forge/ParamControls/ParamSlider.jsx
// Slider control for 'number' type params in the Rule Config Drawer.

import React, { useId } from 'react';

export default function ParamSlider({ param, value, onChange, categoryColor }) {
  const sliderId = useId();
  const pct = ((value - param.min) / (param.max - param.min)) * 100;

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 6,
      }}>
        <label htmlFor={sliderId} style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#E6EDF3',
        }}>
          {param.label}
        </label>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#5EEAD4',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}{param.unit ? ` ${param.unit}` : ''}
        </span>
      </div>

      {/* Slider */}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 6,
          borderRadius: 3,
          background: '#15171E',
        }} />
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${pct}%`,
          height: 6,
          borderRadius: 3,
          background: categoryColor,
          opacity: 0.7,
          pointerEvents: 'none',
        }} />
        <input
          id={sliderId}
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: 20,
            WebkitAppearance: 'none',
            appearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            margin: 0,
            position: 'relative',
            zIndex: 1,
          }}
        />
        <style>{`
          #${CSS.escape(sliderId)}::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: ${categoryColor};
            border: 3px solid #0D0E12;
            box-shadow: 0 0 6px ${categoryColor}44;
            cursor: pointer;
            transition: transform 0.15s ease;
          }
          #${CSS.escape(sliderId)}::-webkit-slider-thumb:active {
            transform: scale(1.15);
          }
          #${CSS.escape(sliderId)}::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${categoryColor};
            border: 3px solid #0D0E12;
            box-shadow: 0 0 6px ${categoryColor}44;
            cursor: pointer;
          }
          #${CSS.escape(sliderId)}::-webkit-slider-runnable-track {
            height: 6px;
            background: transparent;
          }
          #${CSS.escape(sliderId)}::-moz-range-track {
            height: 6px;
            background: transparent;
            border: none;
          }
        `}</style>
      </div>

      {/* Hint */}
      {param.hint && (
        <div style={{
          fontSize: 11,
          color: '#6E7681',
          marginTop: 4,
          lineHeight: 1.4,
        }}>
          {param.hint}
        </div>
      )}
    </div>
  );
}
