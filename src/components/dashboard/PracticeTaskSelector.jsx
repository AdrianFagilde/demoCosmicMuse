import React, { useMemo } from 'react'
import { CModal, CModalHeader, CModalTitle, CModalBody } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMusicNote, cilChevronRight, cilMediaPlay } from '@coreui/icons'

/**
 * Modal que se abre al pulsar "Practicar". Deja elegir que se va a practicar:
 * una tarea individual, una tarea de curso o practica libre. Devuelve
 * { taskId, courseTaskId, label } y quemain el caller arranca la sesion.
 *
 * Las tareas de curso no tienen student_id (CHECK assignments_context_xor):
 * se identifican por course_id y su avance real es el checklist. Ambas viven
 * en la tabla unificada `tasks`, asi que comparten forma.
 */
const PracticeTaskSelector = ({ visible, onClose, onSelect, tasks = [] }) => {
  const { courseTasks, individualTasks } = useMemo(() => {
    return {
      courseTasks: tasks.filter((task) => task.course_id),
      individualTasks: tasks.filter((task) => !task.course_id),
    }
  }, [tasks])

  const choose = (payload) => {
    onSelect(payload)
    onClose()
  }

  const hasTasks = individualTasks.length > 0 || courseTasks.length > 0

  return (
    <CModal visible={visible} onClose={onClose} alignment="center" scrollable>
      <CModalHeader>
        <CModalTitle>¿Qué vas a practicar?</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-2">
          <button
            type="button"
            className="practice-choice practice-choice--free"
            onClick={() => choose({ taskId: null, courseTaskId: null, label: 'Práctica libre' })}
          >
            <span className="practice-choice__icon">
              <CIcon icon={cilMediaPlay} aria-hidden="true" />
            </span>
            <span className="practice-choice__text">
              <span className="fw-semibold d-block">Práctica libre</span>
              <span className="text-medium-emphasis small">Sin tarea asociada</span>
            </span>
            <CIcon icon={cilChevronRight} aria-hidden="true" />
          </button>

          {individualTasks.length > 0 && (
            <div className="practice-choice__group">
              <div className="text-medium-emphasis small fw-semibold mb-1">Tareas individuales</div>
              {individualTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="practice-choice"
                  onClick={() => choose({ taskId: task.id, courseTaskId: null, label: task.title })}
                >
                  <span className="practice-choice__icon practice-choice__icon--task">
                    <CIcon icon={cilMusicNote} aria-hidden="true" />
                  </span>
                  <span className="practice-choice__text">
                    <span className="fw-semibold d-block">{task.title}</span>
                    {task.due_date && (
                      <span className="text-medium-emphasis small">Entrega: {task.due_date}</span>
                    )}
                  </span>
                  <CIcon icon={cilChevronRight} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {courseTasks.length > 0 && (
            <div className="practice-choice__group">
              <div className="text-medium-emphasis small fw-semibold mb-1">Tareas de curso</div>
              {courseTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="practice-choice"
                  onClick={() => choose({ taskId: null, courseTaskId: task.id, label: task.title })}
                >
                  <span className="practice-choice__icon practice-choice__icon--course">
                    <CIcon icon={cilMusicNote} aria-hidden="true" />
                  </span>
                  <span className="practice-choice__text">
                    <span className="fw-semibold d-block">{task.title}</span>
                    <span className="text-medium-emphasis small">
                      {task.course?.title || 'Curso'}
                      {typeof task.checklist_percent === 'number'
                        ? ` · ${task.checklist_percent}%`
                        : ''}
                    </span>
                  </span>
                  <CIcon icon={cilChevronRight} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {!hasTasks && (
            <div className="text-center text-medium-emphasis small py-3">
              No tienes tareas pendientes. Usa la práctica libre.
            </div>
          )}
        </div>
      </CModalBody>
    </CModal>
  )
}

export default PracticeTaskSelector
