import React, { useEffect, useState } from 'react';

interface TourCursorProps {
  x: number;
  y: number;
  hasArrived: boolean;
}

const TourCursor: React.FC<TourCursorProps> = ({ x, y, hasArrived }) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!hasArrived) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(t);
  }, [hasArrived]);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          transform: `translate(-5px, -3px) scale(${pulse ? 0.8 : 1})`,
          transition: 'left 0.7s cubic-bezier(0.25,0.46,0.45,0.94), top 0.7s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.25s ease-out',
          zIndex: 999999,
          pointerEvents: 'none',
        }}
      >
        {/* Cursor SVG */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="white"
          stroke="#0F1110"
          strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.28))' }}
        >
          <path d="M5 3l14 9-7 1-4 7z" />
        </svg>

        {/* Label badge */}
        <div style={{
          position: 'absolute',
          top: 22,
          left: 4,
          background: 'rgba(15,17,16,0.90)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(149,163,149,0.4)',
          borderRadius: 5,
          padding: '3px 10px',
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: '"Space Mono", monospace, sans-serif',
            fontSize: 10,
            color: '#95A395',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}>
            ARIA Guide
          </span>
        </div>

        {/* Ripple on arrival */}
        {pulse && (
          <div style={{
            position: 'absolute',
            top: -8,
            left: -8,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '2px solid #95A395',
            animation: 'tourRipple 0.5s ease-out forwards',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      <style>{`
        @keyframes tourRipple {
          from { transform: scale(0.5); opacity: 0.9; }
          to   { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </>
  );
};

export default TourCursor;
