import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilStar } from '@coreui/icons'
import { getBadge } from '../../utils/gamification'

/**
 * Insignias ganadas y las proximas por desbloquear. `nextBadges` viene del RPC
 * get_next_badges (ya trae nombre, descripcion, progress y target); las
 * ganadas solo guardan badge_key, por eso se resuelven con el catalogo local.
 */
const BadgesGallery = ({ badges = [], nextBadges = [] }) => {
  return (
    <div className="app-card app-card-compact h-100 d-flex flex-column">
      <div className="d-flex align-items-center gap-2 mb-3">
        <CIcon icon={cilStar} className="text-primary" size="lg" aria-hidden="true" />
        <span className="fw-semibold">Logros</span>
        <span className="ms-auto text-medium-emphasis small">
          {badges.length} conseguido{badges.length === 1 ? '' : 's'}
        </span>
      </div>

      {badges.length === 0 ? (
        <div className="text-center text-medium-emphasis small py-3">
          Todavía no tienes logros. ¡Empieza a practicar!
        </div>
      ) : (
        <div className="badges-grid">
          {badges.map((badge) => {
            const meta = getBadge(badge.badge_key)
            return (
              <div
                key={badge.badge_key}
                className="badge-chip"
                title={meta.description || meta.name}
              >
                <span
                  className="badge-chip__icon"
                  style={{ '--badge-color': meta.color }}
                  aria-hidden="true"
                >
                  <CIcon icon={meta.icon} />
                </span>
                <span className="badge-chip__name">{meta.name}</span>
              </div>
            )
          })}
        </div>
      )}

      {nextBadges.length > 0 && (
        <div className="mt-3">
          <div className="text-medium-emphasis small fw-semibold mb-2">Próximos logros</div>
          <div className="d-flex flex-column gap-2">
            {nextBadges.map((badge) => {
              const meta = getBadge(badge.badge_key)
              const pct = badge.target
                ? Math.min(100, Math.round((badge.progress / badge.target) * 100))
                : 0
              return (
                <div key={badge.badge_key} className="next-badge">
                  <span
                    className="badge-chip__icon badge-chip__icon--muted"
                    style={{ '--badge-color': meta.color }}
                    aria-hidden="true"
                  >
                    <CIcon icon={meta.icon} />
                  </span>
                  <div className="flex-grow-1">
                    <div className="small fw-semibold">{badge.badge_name}</div>
                    <div
                      className="progress"
                      style={{ height: 6 }}
                      role="progressbar"
                      aria-label={`Progreso de ${badge.badge_name}`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-medium-emphasis small">
                    {badge.progress}/{badge.target}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default BadgesGallery
