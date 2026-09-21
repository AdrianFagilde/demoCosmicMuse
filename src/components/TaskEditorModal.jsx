import React, { useMemo, useState } from 'react'
import {
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import ChecklistBuilder from './ChecklistBuilder'

const TaskEditorModal = ({
  task,
  onClose,
  onUpdateTask,
  onAddItem,
  onDeleteItem,
  onReorderItems,
  onSaved,
}) => {
  const original = useMemo(() => task.task_checklist_items || [], [task])
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    dueDate: task.due_date || '',
  })
  const [items, setItems] = useState([...original])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('La tarea necesita un título.')
      return
    }
    setSaving(true)
    let ok = await onUpdateTask(task.id, {
      title: form.title.trim(),
      description: form.description.trim(),
      due_date: form.dueDate || null,
    })
    if (!ok) {
      setSaving(false)
      setError('No se pudo guardar la tarea.')
      return
    }
    const currentIds = new Set(original.map((item) => item.id))
    const nextIds = new Set(items.map((item) => item.id))

    for (const removed of original.filter((item) => !nextIds.has(item.id))) {
      ok = (await onDeleteItem(removed.id)) && ok
    }
    for (const added of items.filter((item) => !currentIds.has(item.id))) {
      const position = items.indexOf(added)
      const created = await onAddItem(task.id, added.label, position)
      if (!created) ok = false
    }
    // Detect reorder by comparing sequence of existing item IDs
    const originalExistingIds = original
      .filter((item) => nextIds.has(item.id))
      .map((item) => item.id)
    const currentExistingIds = items
      .filter((item) => currentIds.has(item.id))
      .map((item) => item.id)
    const orderChanged = originalExistingIds.join(',') !== currentExistingIds.join(',')
    if (orderChanged) {
      ok = (await onReorderItems(items)) && ok
    }
    setSaving(false)
    if (!ok) {
      setError('Hubo un problema guardando algunos cambios. Revisa y vuelve a intentar.')
      return
    }
    onClose()
    await onSaved()
  }

  return (
    <CModal visible onClose={onClose} backdrop="static" size="lg" scrollable>
      <CForm
        onSubmit={(event) => {
          event.preventDefault()
          handleSave()
        }}
      >
        <CModalHeader closeButton>
          <CModalTitle>Editar tarea</CModalTitle>
        </CModalHeader>
        <CModalBody style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="mb-3">
            <CFormLabel>Título *</CFormLabel>
            <CFormInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Descripción</CFormLabel>
            <CFormTextarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Fecha de entrega (opcional)</CFormLabel>
            <CFormInput
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <hr />
          <CFormLabel className="fw-semibold">Checklist (arrastra para ordenar)</CFormLabel>
          <ChecklistBuilder items={items} onChange={setItems} />
          {error && <div className="text-danger mt-3">{error}</div>}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={saving}>
            {saving ? <CSpinner size="sm" /> : 'Guardar tarea'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default TaskEditorModal
