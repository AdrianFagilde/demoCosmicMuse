import React, { useMemo, useState } from 'react'
import {
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilX } from '@coreui/icons'
import ChecklistBuilder from './ChecklistBuilder'

// Modal de edicion del DETALLE de una tarea, no del alta de una nueva.
//
// No reutiliza TaskEditorModal a proposito: aquel guarda solo titulo,
// descripcion y fecha porque se usa sobre el feed unificado, donde la tarea
// se crea desde el listado. Aqui el titulo va acompanado del alumno y del
// curso, que son datos que no se pueden cambiar desde este modal, asi que
// editarlos por error dejaria la lista y el detalle desincronizados. Por eso
// el estado y el progreso solo se ofrecen en tareas individuales, que son las
// unicas que los tienen (CHECK assignments_context_xor).
//
// Cada control lleva htmlFor/id propio: CFormLabel sin htmlFor no asocia la
// etiqueta al input y un lector de pantalla anuncia "campo de texto" sin
// decir cual.
const TaskDetailEditorModal = ({
  task,
  onClose,
  onUpdateTask,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}) => {
  const isCourseTask = Boolean(task.course_id)

  const original = useMemo(() => task.task_checklist_items || [], [task])
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    dueDate: task.due_date || '',
    status: task.status || 'Pendiente',
    progress: String(task.progress ?? 0),
  })
  const [items, setItems] = useState([...original])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('La tarea necesita un título.')
      return
    }
    setError('')
    setSaving(true)

    let ok = await onUpdateTask({
      title: form.title.trim(),
      description: form.description.trim(),
      due_date: form.dueDate || null,
      // Solo se envia status/progress en tareas individuales. Incluirlos en
      // una tarea de curso escribiria en columnas que su semantica no tiene.
      ...(isCourseTask
        ? {}
        : {
            status: form.status,
            progress: Math.min(100, Math.max(0, Math.round(Number(form.progress) || 0))),
          }),
    })
    if (!ok) {
      setSaving(false)
      setError('No se pudo guardar la tarea.')
      return
    }

    // Los items nuevos llegan de ChecklistBuilder con id `temp-...`, asi que
    // se distinguen de los reales por comparar contra el snapshot inicial.
    const currentIds = new Set(original.map((item) => item.id))
    const nextIds = new Set(items.map((item) => item.id))

    for (const removed of original.filter((item) => !nextIds.has(item.id))) {
      ok = (await onDeleteItem(removed.id)) && ok
    }
    for (const added of items.filter((item) => !currentIds.has(item.id))) {
      const position = items.indexOf(added)
      const created = await onAddItem(added.label, position)
      if (!created) ok = false
    }

    const originalOrder = original.filter((item) => nextIds.has(item.id)).map((item) => item.id)
    const currentOrder = items.filter((item) => currentIds.has(item.id)).map((item) => item.id)
    if (originalOrder.join(',') !== currentOrder.join(',')) {
      ok = (await onReorderItems(items.map((item) => item.id))) && ok
    }

    setSaving(false)
    if (!ok) {
      setError('Hubo un problema guardando algunos cambios. Revisa y vuelve a intentar.')
      return
    }
    onClose()
  }

  return (
    <CModal
      visible
      onClose={onClose}
      backdrop="static"
      size="lg"
      scrollable
      aria-label="Editar detalle de la tarea"
    >
      <CForm
        onSubmit={(event) => {
          event.preventDefault()
          handleSave()
        }}
      >
        {/* closeButton={false} y boton propio: el closeButton de CoreUI se
            anuncia en ingles ("Close") y el dialogo se queda sin nombre
            accesible. */}
        <CModalHeader>
          <CModalTitle>Editar detalle de la tarea</CModalTitle>
          <CButton
            type="button"
            color="link"
            className="btn-close ms-auto"
            aria-label="Cerrar"
            disabled={saving}
            onClick={onClose}
          >
            <CIcon icon={cilX} aria-hidden="true" />
          </CButton>
        </CModalHeader>
        <CModalBody>
          <CRow className="g-3">
            <CCol md={12}>
              <CFormLabel htmlFor="tdm-title">Título *</CFormLabel>
              <CFormInput
                id="tdm-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor="tdm-description">Descripción</CFormLabel>
              <CFormTextarea
                id="tdm-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor="tdm-due">Fecha de entrega (opcional)</CFormLabel>
              <CFormInput
                id="tdm-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </CCol>
            {!isCourseTask && (
              <>
                <CCol md={6}>
                  <CFormLabel htmlFor="tdm-status">Estado</CFormLabel>
                  <CFormSelect
                    id="tdm-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En progreso">En progreso</option>
                    <option value="Completado">Completado</option>
                  </CFormSelect>
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor="tdm-progress">Progreso (%)</CFormLabel>
                  <CFormInput
                    id="tdm-progress"
                    type="number"
                    min={0}
                    max={100}
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: e.target.value })}
                  />
                </CCol>
              </>
            )}
          </CRow>

          <hr />
          <CFormLabel className="fw-semibold">Checklist (arrastra para ordenar)</CFormLabel>
          <ChecklistBuilder items={items} onChange={setItems} />

          {error && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {error}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={saving}>
            {saving ? <CSpinner size="sm" /> : 'Guardar cambios'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default TaskDetailEditorModal
