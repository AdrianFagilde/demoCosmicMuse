import React, { useEffect, useState } from 'react'

/**
 * Respeta la preferencia del sistema "reducir movimiento". La transicion se
 * aplica desde JS (stroke-dashoffset), asi que una media query en CSS no la
 * cubre: hay que consultarla aqui. Con movimiento reducido el anillo se dibuja
 * ya en su posicion final, sin interpolacion.
 */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const ProgressRing = ({
  progress = 0,
  size = 64,
  strokeWidth = 6,
  color = '#6366f1',
  backgroundColor = 'rgba(99, 102, 241, 0.15)',
  showValue = true,
  valueLabel = '',
  label = 'Progreso',
  decorative = false,
  children,
  className = '',
  animate = true,
  animationDuration = 800,
}) => {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)

  useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event) => setReducedMotion(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const shouldAnimate = animate && !reducedMotion
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const offset = circumference * (1 - clampedProgress / 100)

  const ringStyle = {
    strokeDasharray: circumference,
    // Siempre el offset FINAL del progreso. Antes se escribia `circumference`
    // cuando no habia animacion, que deja el trazo completamente vacio: con
    // "reducir movimiento" activado los anillos aparecerian a 0% en vez de
    // mostrar el progreso real. La transicion sigue produciendose porque el
    // navegador interpola entre el valor anterior y el nuevo cuando cambia el
    // progreso.
    strokeDashoffset: offset,
    transition: shouldAnimate ? `stroke-dashoffset ${animationDuration}ms ease-out` : 'none',
    transform: 'rotate(-90deg)',
    transformOrigin: 'center',
  }

  // El anillo es un grafico, y el patron ARIA para un valor numerico es
  // role="progressbar" con aria-valuenow/min/max. Antes el div de fuera y el
  // <svg> de dentro llevaban los dos role="img" con la MISMA etiqueta, y el
  // svg arrastraba aria-valuenow/min/max, que no son atributos validos de
  // role="img": un lector de pantalla anuncia "Progreso: 82%" dos veces.
  //
  // El <svg> queda como decoracion (aria-hidden): el trazo no aporta nada que
  // el valor ya no diga. `decorative` es para cuando el llamante pinta el
  // porcentaje al lado (ActionCard): entonces el anillo no aporta nada y se
  // oculta entero para no repetir el mismo dato dos veces seguidas.
  const accessibleValue = `${clampedProgress}%${valueLabel ? `, ${valueLabel}` : ''}`

  return (
    <div
      className={`progress-ring ${className}`}
      style={{ width: size, height: size, position: 'relative' }}
      {...(decorative
        ? { 'aria-hidden': 'true' }
        : {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuenow': clampedProgress,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuetext': accessibleValue,
          })}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        focusable="false"
      >
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
              color: 'var(--app-text-muted)',
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
