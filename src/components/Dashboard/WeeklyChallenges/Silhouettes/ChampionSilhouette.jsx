// Any Mode silhouette - Champion with arms raised and trophy

export default function ChampionSilhouette({ color = '#f59e0b' }) {
  return (
    <div style={{ position: 'relative', width: '80px', height: '120px' }}>
      {/* Trophy */}
      <div style={{
        position: 'absolute',
        top: '0px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '20px',
        height: '16px',
        background: color,
        borderRadius: '4px 4px 0 0',
        filter: `drop-shadow(0 0 16px ${color})`,
        opacity: 0.9,
      }} />
      {/* Trophy stem */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '6px',
        height: '8px',
        background: color,
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.85,
      }} />
      {/* Trophy base */}
      <div style={{
        position: 'absolute',
        top: '22px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '14px',
        height: '4px',
        background: color,
        borderRadius: '2px',
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.85,
      }} />
      {/* Head */}
      <div style={{
        position: 'absolute',
        top: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: color,
        filter: `drop-shadow(0 0 14px ${color})`,
        opacity: 0.9,
      }} />
      {/* Body - Y shape (arms raised) */}
      <div style={{
        position: 'absolute',
        bottom: '0px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '36px',
        height: '54px',
        background: color,
        clipPath: 'polygon(30% 0%, 70% 0%, 70% 50%, 100% 100%, 0% 100%, 30% 50%)',
        filter: `drop-shadow(0 0 18px ${color})`,
        opacity: 0.85,
      }} />
      {/* Left arm raised */}
      <div style={{
        position: 'absolute',
        top: '38px',
        left: '4px',
        width: '4px',
        height: '32px',
        background: color,
        transform: 'rotate(40deg)',
        transformOrigin: 'bottom center',
        borderRadius: '2px',
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.8,
      }} />
      {/* Right arm raised */}
      <div style={{
        position: 'absolute',
        top: '38px',
        right: '4px',
        width: '4px',
        height: '32px',
        background: color,
        transform: 'rotate(-40deg)',
        transformOrigin: 'bottom center',
        borderRadius: '2px',
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.8,
      }} />
    </div>
  );
}
