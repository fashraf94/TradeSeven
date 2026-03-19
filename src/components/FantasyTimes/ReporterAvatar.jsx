import React from 'react';
import { REPORTER_COLORS } from '../../constants/reporterTheme';

const ReporterAvatar = ({ reporter, size = 24 }) => {
  const color = REPORTER_COLORS[reporter];
  if (!color) return null;

  const letter = reporter.charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `rgba(${color.rgb}, 0.2)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: size * 0.5,
          fontWeight: 600,
          color: color.hex,
          lineHeight: 1,
        }}
      >
        {letter}
      </span>
    </div>
  );
};

export default ReporterAvatar;
