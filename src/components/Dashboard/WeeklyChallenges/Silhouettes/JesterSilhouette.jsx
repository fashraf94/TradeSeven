// Wild Card silhouette - Jester/joker figure

export default function JesterSilhouette({ color = '#8b5cf6' }) {
  return (
    <div style={{ position: 'relative', width: '80px', height: '120px' }}>
      {/* Body - diamond shape */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%) rotate(45deg)',
        width: '36px',
        height: '36px',
        background: color,
        filter: `drop-shadow(0 0 18px ${color})`,
        opacity: 0.85,
      }} />
      {/* Head */}
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: color,
        filter: `drop-shadow(0 0 14px ${color})`,
        opacity: 0.9,
      }} />
      {/* Jester hat - left bell */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '14px',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: color,
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.8,
      }} />
      {/* Jester hat - right bell */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '14px',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: color,
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.8,
      }} />
      {/* Jester hat - top bell */}
      <div style={{
        position: 'absolute',
        top: '2px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: color,
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.8,
      }} />
      {/* Left arm (waving) */}
      <div style={{
        position: 'absolute',
        top: '50px',
        left: '6px',
        width: '4px',
        height: '30px',
        background: color,
        transform: 'rotate(30deg)',
        borderRadius: '2px',
        filter: `drop-shadow(0 0 8px ${color})`,
        opacity: 0.7,
      }} />
      {/* Right arm (waving) */}
      <div style={{
        position: 'absolute',
        top: '50px',
        right: '6px',
        width: '4px',
        height: '30px',
        background: color,
        transform: 'rotate(-30deg)',
        borderRadius: '2px',
        filter: `drop-shadow(0 0 8px ${color})`,
        opacity: 0.7,
      }} />
    </div>
  );
}
