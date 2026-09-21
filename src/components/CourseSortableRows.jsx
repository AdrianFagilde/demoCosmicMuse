import { CBadge, CButton, CCard, CCardBody, CFormCheck } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu, cilPencil, cilPlus, cilTrash } from '@coreui/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const baseStyle = (transform, transition, isDragging) => ({
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.6 : 1,
})

const dragHandleProps = (attributes, listeners) => ({
  ...attributes,
  ...listeners,
  className: 'text-medium-emphasis',
  style: { cursor: 'grab', touchAction: 'none' },
})

export const SortableTaskRow = ({
  task,
  attachedForm,
  onEdit,
  onAddForm,
  onEditForm,
  onViewFormResponses,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  return (
    <CCard ref={setNodeRef} style={baseStyle(transform, transition, isDragging)} className="mb-2">
      <CCardBody className="d-flex align-items-center gap-2 py-2">
        <span {...dragHandleProps(attributes, listeners)}>
          <CIcon icon={cilMenu} />
        </span>
        <div className="flex-grow-1">
          <div className="fw-semibold">{task.title}</div>
          {task.description && <small className="text-medium-emphasis">{task.description}</small>}
        </div>
        <CBadge color="info">{(task.task_checklist_items || []).length} checks</CBadge>
        {attachedForm ? (
          <>
            <CBadge color="success">{(attachedForm.form_questions || []).length} preguntas</CBadge>
            <CButton size="sm" color="primary" variant="outline" onClick={onEditForm}>
              Formulario
            </CButton>
            <CButton size="sm" color="primary" variant="outline" onClick={onViewFormResponses}>
              Respuestas
            </CButton>
          </>
        ) : (
          <CButton size="sm" color="primary" variant="outline" onClick={onAddForm}>
            <CIcon icon={cilPlus} className="me-1" /> Formulario
          </CButton>
        )}
        {task.due_date && <CBadge color="warning text-dark">Entrega: {task.due_date}</CBadge>}
        <CButton size="sm" color="primary" variant="outline" onClick={() => onEdit(task)}>
          <CIcon icon={cilPencil} />
        </CButton>
        <CButton size="sm" color="danger" variant="outline" onClick={() => onDelete(task.id)}>
          <CIcon icon={cilTrash} />
        </CButton>
      </CCardBody>
    </CCard>
  )
}

export const SortableFormRow = ({ form, taskLabel, onEdit, onViewResponses, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: form.id,
  })
  return (
    <CCard ref={setNodeRef} style={baseStyle(transform, transition, isDragging)} className="mb-2">
      <CCardBody className="d-flex align-items-center gap-3 py-2">
        <span {...dragHandleProps(attributes, listeners)}>
          <CIcon icon={cilMenu} />
        </span>
        <div className="flex-grow-1">
          <div className="fw-semibold">{form.title}</div>
          {form.description && <small className="text-medium-emphasis">{form.description}</small>}
        </div>
        <CBadge color="info">{(form.form_questions || []).length} preguntas</CBadge>
        {taskLabel && <CBadge color="dark">Tarea: {taskLabel}</CBadge>}
        {form.due_date && <CBadge color="warning text-dark">Límite: {form.due_date}</CBadge>}
        <CButton size="sm" color="primary" variant="outline" onClick={onViewResponses}>
          Respuestas
        </CButton>
        <CButton size="sm" color="primary" variant="outline" onClick={onEdit}>
          <CIcon icon={cilPencil} />
        </CButton>
        <CButton size="sm" color="danger" variant="outline" onClick={onDelete}>
          <CIcon icon={cilTrash} />
        </CButton>
      </CCardBody>
    </CCard>
  )
}

export const StudentSortableChecklistItem = ({ item, checked, onChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  return (
    <div ref={setNodeRef} style={baseStyle(transform, transition, isDragging)} className="mb-2">
      <div
        {...dragHandleProps(attributes, listeners)}
        className="text-medium-emphasis d-flex align-items-center gap-2"
        style={{ cursor: 'grab', touchAction: 'none', padding: '4px 8px', borderRadius: '4px' }}
      >
        <CIcon icon={cilMenu} />
        <CFormCheck
          id={`check-${item.id}`}
          label={item.label}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="flex-grow-1 mb-0"
        />
      </div>
    </div>
  )
}
