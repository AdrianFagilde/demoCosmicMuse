import React from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CListGroup,
  CListGroupItem,
  CRow,
} from '@coreui/react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CIcon from '@coreui/icons-react'
import { cilMenu, cilPlus, cilTrash } from '@coreui/icons'
import { CHOICE_TYPES, FORM_QUESTION_TYPES } from '../utils/forms'

const SortableQuestionCard = ({ question, index, onChange, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const patch = (updates) => onChange(question.id, updates)

  const addOption = () => patch({ options: [...(question.options || []), ''] })

  const updateOption = (optionIndex, value) =>
    patch({
      options: (question.options || []).map((option, i) => (i === optionIndex ? value : option)),
    })

  const removeOption = (optionIndex) =>
    patch({
      options: (question.options || []).filter((_, i) => i !== optionIndex),
    })

  return (
    <CCard ref={setNodeRef} style={style} className="mb-2">
      <CCardBody>
        <div className="d-flex align-items-start gap-2">
          <span
            {...attributes}
            {...listeners}
            className="text-medium-emphasis mt-2"
            style={{ cursor: 'grab', touchAction: 'none' }}
          >
            <CIcon icon={cilMenu} />
          </span>
          <div className="flex-grow-1">
            <CRow className="g-2 mb-2">
              <CCol md={7}>
                <CFormInput
                  placeholder={`Pregunta ${index + 1}...`}
                  value={question.question_text}
                  onChange={(e) => patch({ question_text: e.target.value })}
                />
              </CCol>
              <CCol md={5}>
                <CFormSelect
                  value={question.type}
                  onChange={(e) => patch({ type: e.target.value })}
                >
                  {FORM_QUESTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>

            {CHOICE_TYPES.includes(question.type) && (
              <>
                {(question.options || []).length === 0 && (
                  <small className="text-warning d-block mb-1">
                    Agrega al menos una opción para este tipo de pregunta.
                  </small>
                )}
                <CListGroup flush className="mb-2">
                  {(question.options || []).map((option, optionIndex) => (
                    <CListGroupItem key={optionIndex} className="py-1 px-0 border-0">
                      <CInputGroup size="sm">
                        <CInputGroupText>{optionIndex + 1}</CInputGroupText>
                        <CFormInput
                          placeholder={`Opción ${optionIndex + 1}`}
                          value={option}
                          onChange={(e) => updateOption(optionIndex, e.target.value)}
                        />
                        <CButton
                          type="button"
                          color="danger"
                          variant="outline"
                          onClick={() => removeOption(optionIndex)}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CInputGroup>
                    </CListGroupItem>
                  ))}
                </CListGroup>
                <CButton size="sm" color="primary" variant="outline" onClick={addOption}>
                  <CIcon icon={cilPlus} className="me-1" /> Agregar opción
                </CButton>
              </>
            )}

            <div className="d-flex justify-content-end mt-2">
              <CFormCheck
                type="switch"
                id={`required-${question.id}`}
                label="Obligatoria"
                checked={Boolean(question.required)}
                onChange={(e) => patch({ required: e.target.checked })}
              />
            </div>
          </div>
          <CButton size="sm" color="danger" variant="outline" onClick={() => onDelete(question.id)}>
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      </CCardBody>
    </CCard>
  )
}

const FormBuilder = ({ questions, onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleChange = (id, updates) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)))

  const handleDelete = (id) => onChange(questions.filter((q) => q.id !== id))

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = questions.findIndex((q) => q.id === active.id)
    const newIndex = questions.findIndex((q) => q.id === over.id)
    onChange(arrayMove(questions, oldIndex, newIndex))
  }

  if (questions.length === 0) {
    return null
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        {questions.map((question, index) => (
          <SortableQuestionCard
            key={question.id}
            question={question}
            index={index}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

export default FormBuilder
