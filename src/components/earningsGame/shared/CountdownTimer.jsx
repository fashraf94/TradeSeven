import { useState, useEffect, useCallback } from 'react';
import { designColors, fontMono } from '../designConstants';

export default function CountdownTimer({
  deadline,
  size = 'medium',
  showLabel = true,
}) {
  const calculateTimeLeft = useCallback(() => {
    const diff = new Date(deadline) - new Date();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };

    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false,
    };
  }, [deadline]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const fontSize = size === 'large' ? '28px' : size === 'small' ? '14px' : '18px';

  const formatNum = (n) => String(n).padStart(2, '0');

  if (timeLeft.expired) {
    return (
      <span style={{
        fontFamily: fontMono,
        fontSize,
        color: designColors.red,
        fontWeight: 'bold',
      }}>
        LOCKED
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <span style={{
        fontFamily: fontMono,
        fontSize,
        fontWeight: 'bold',
        color: designColors.cyan,
      }}>
        {formatNum(timeLeft.hours)}:{formatNum(timeLeft.minutes)}:{formatNum(timeLeft.seconds)}
      </span>
      {showLabel && (
        <span style={{
          fontSize: '10px',
          color: designColors.textMuted,
          marginLeft: '4px',
        }}>
          ⏱️
        </span>
      )}
    </div>
  );
}
