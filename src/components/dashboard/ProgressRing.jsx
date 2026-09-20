import React from 'react'

const ProgressRing = ({
  progress = 0,
  size = 64,
  strokeWidth = 6,
  color = '#6366f1',
  backgroundColor = 'rgba(99, 102, 241, 0.15)',
  showValue = true,
  valueLabel = '',
  children,
  className = '',
  animate = true,
  animationDuration = 800,
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const offset = circumference * (1 - clampedProgress / 100)

  const ringStyle = {
    strokeDasharray: circumference,
    strokeDashoffset: animate ? offset : circumference,
    transition: animate ? `stroke-dashoffset ${animationDuration}ms ease-out` : 'none',
    transform: 'rotate(-90deg)',
    transformOrigin: 'center',
  }

  return (
    <div
      className={`progress-ring ${className}`}
      style={{ width: size, height: size, position: 'relative' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={ringStyle}
        />
      </svg>
      <div
        className="progress-ring-content"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {showValue && (
          <span
            className="progress-ring-value"
            style={{
              fontSize: size * 0.18,
              fontWeight: 700,
              color: color,
              lineHeight: 1,
            }}
          >
            {clampedProgress.toFixed(0)}%
          </span>
        )}
        {valueLabel && (
          <span
            className="progress-ring-label"
            style={{
              fontSize: size * 0.1,
              color: 'var(--cui-text-muted)',
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            {valueLabel}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

export default ProgressRing
