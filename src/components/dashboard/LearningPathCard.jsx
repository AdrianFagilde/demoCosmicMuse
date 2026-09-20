import React, { useMemo } from 'react'
import { CCard, CCardBody, CCardHeader, CBadge, CProgress, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBook, cilArrowRight, cilArrowRight as cilFlag, cilStar } from '@coreui/icons'

const LearningPathCard = ({ courses, myProgress, onViewCourses }) => {
  const activeCourse = useMemo(() => {
    if (!courses?.length || !myProgress?.length) return null
    const withProgress = courses
      .filter((c) => c.course_enrollments?.some((e) => e.student_id))
      .map((course) => {
        const items = course.course_tasks?.flatMap((t) => t.task_checklist_items || []) || []
        const done = items.filter((item) => myProgress.some((p) => p.item_id === item.id)).length
        const total = items.length
        const percent = total > 0 ? Math.round((done / total) * 100) : 0
        return { ...course, progress: { done, total, percent, items } }
      })
      .filter((c) => c.progress.total > 0)
      .sort((a, b) => b.progress.percent - a.progress.percent)
    return withProgress[0] || null
  }, [courses, myProgress])

  const nextItem = activeCourse?.progress?.items?.find(
    (item) => !myProgress?.some((p) => p.item_id === item.id),
  )
  const nextMilestone =
    activeCourse && activeCourse.progress.percent < 100
      ? {
          needed: Math.min(3, activeCourse.progress.total - activeCourse.progress.done),
          target:
            activeCourse.progress.percent +
            Math.round(
              (Math.min(3, activeCourse.progress.total - activeCourse.progress.done) /
                activeCourse.progress.total) *
                100,
            ),
        }
      : null

  if (!activeCourse) {
    return (
      <CCard className="h-100 learning-path-empty">
        <CCardBody className="d-flex flex-column align-items-center text-center py-4">
          <CIcon icon={cilBook} size="xl" className="text-medium-emphasis mb-3" />
          <h6 className="mb-1">Sin ruta activa</h6>
          <p className="text-medium-emphasis small mb-3">
            Tu profesor te inscribirá en cursos pronto
          </p>
          <CButton color="primary" variant="outline" size="sm" onClick={onViewCourses}>
            <CIcon icon={cilArrowRight} className="me-1" /> Ver cursos
          </CButton>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard className="h-100 learning-path-card">
      <CCardHeader className="d-flex justify-content-between align-items-center py-2">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilBook} className="text-primary" />
          Mi ruta de aprendizaje
        </span>
        <CBadge color="primary">{activeCourse.progress.percent}%</CBadge>
      </CCardHeader>
      <CCardBody className="d-flex flex-column">
        <div className="mb-3">
          <div className="fw-semibold text-truncate mb-1">{activeCourse.title}</div>
          {activeCourse.instrument && (
            <CBadge color="info" variant="outline" className="small">
              <CIcon icon={cilBook} size="xs" className="me-1" />
              {activeCourse.instrument}
            </CBadge>
          )}
        </div>
        <CProgress
          value={activeCourse.progress.percent}
          height={8}
          color="primary"
          className="mb-2"
        />
        <div className="d-flex justify-content-between small text-medium-emphasis mb-3">
          <span>
            {activeCourse.progress.done}/{activeCourse.progress.total} ítems
          </span>
        </div>

        {nextItem && (
          <div className="next-step p-2 mb-3 rounded bg-light border">
            <div className="d-flex align-items-center gap-2 mb-1">
              <CIcon icon={cilFlag} className="text-warning" size="sm" />
              <span className="fw-semibold small">Paso actual</span>
            </div>
            <p className="small mb-0 text-truncate">{nextItem.label}</p>
          </div>
        )}

        {nextMilestone && (
          <div className="milestone p-2 mb-3 rounded bg-warning bg-opacity-10 border">
            <div className="d-flex align-items-center gap-2 mb-1">
              <CIcon icon={cilStar} className="text-warning" size="sm" />
              <span className="fw-semibold small">Próximo hito</span>
            </div>
            <p className="small mb-1">
              Completa <strong>{nextMilestone.needed} ítems</strong> para llegar al{' '}
              {nextMilestone.target}%
            </p>
            <CProgress value={nextMilestone.target} height={4} color="warning" className="mt-1" />
          </div>
        )}

        <CButton
          color="primary"
          variant="outline"
          size="sm"
          className="mt-auto"
          onClick={onViewCourses}
        >
          <CIcon icon={cilArrowRight} className="me-1" /> Ver todos mis cursos
        </CButton>
      </CCardBody>
    </CCard>
  )
}

export default LearningPathCard
