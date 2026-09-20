import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilStar, cilPeople } from '@coreui/icons'
import { LEAGUE_COLORS, LEAGUE_ICONS } from '../../utils/colors'
import ProgressRing from './ProgressRing'

const LeagueWidget = ({
  league = 'plata',
  rank = 3,
  totalPlayers = 30,
  xpThisWeek = 450,
  onViewLeague,
}) => {
  const color = LEAGUE_COLORS[league.toLowerCase()] || LEAGUE_COLORS.plata
  const icon = LEAGUE_ICONS[league.toLowerCase()] || LEAGUE_ICONS.plata
  const percentInLeague = Math.min(100, Math.round((rank / totalPlayers) * 100))
  const toPromote = rank <= 5
  const toDemote = rank > totalPlayers - 5

  const bgGradients = {
    bronce: 'linear-gradient(135deg, #cd7f32 0%, #a0522d 100%)',
    plata: 'linear-gradient(135deg, #c0c0c0 0%, #808080 100%)',
    oro: 'linear-gradient(135deg, #ffd700 0%, #daa520 100%)',
    diamante: 'linear-gradient(135deg, #b9f2ff 0%, #00bfff 100%)',
  }

  return (
    <div
      className="league-widget dash-card mb-4"
      style={{
        background: bgGradients[league.toLowerCase()] || bgGradients.plata,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <span
                className="fw-bold text-white"
                style={{ fontSize: '1.1rem', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
              >
                Liga {league.charAt(0).toUpperCase() + league.slice(1)}
              </span>
            </div>
            <div className="text-white-50 small">
              #{rank} de {totalPlayers} • {xpThisWeek} XP esta semana
            </div>
          </div>
          <div className="text-end">
            <div className="league-rank">{rank}</div>
            <div className="text-white-50 small">Tu posición</div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-3">
          <ProgressRing
            progress={100 - percentInLeague}
            size={56}
            strokeWidth={5}
            color="#fff"
            backgroundColor="rgba(255,255,255,0.2)"
            showValue={false}
            animate={true}
          />
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between small text-white-50 mb-1">
              <span>
                {toPromote
                  ? '↑ Zona de ascenso'
                  : toDemote
                    ? '↓ Zona de descenso'
                    : '● Zona segura'}
              </span>
              <span className="fw-bold">
                {100 - percentInLeague}% para {'ascender'}
              </span>
            </div>
            <div
              className="progress"
              style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}
            >
              <div
                className="progress-bar"
                style={{
                  width: `${100 - percentInLeague}%`,
                  background: '#fff',
                  borderRadius: 3,
                  transition: 'width 0.8s ease-out',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div
        className="position-absolute top-0 end-0"
        style={{
          width: 120,
          height: 120,
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '0 0 0 100%',
        }}
      />
    </div>
  )
}

export default LeagueWidget
