import React, { useState } from 'react'
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
import { CButton, CFormInput, CInputGroup, CListGroup, CListGroupItem } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu, cilPlus, cilTrash } from '@coreui/icons'

const SortableItem = ({ item, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <CListGroupItem ref={setNodeRef} style={style} className="d-flex align-items-center gap-2 py-2">
      <span
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${item.label}`}
        className="text-medium-emphasis drag-handle"
      >
        <CIcon icon={cilMenu} aria-hidden="true" />
      </span>
      <span className="flex-grow-1">{item.label}</span>
      <CButton
        size="sm"
        color="danger"
        variant="outline"
        onClick={() => onDelete(item.id)}
        aria-label={`Eliminar ${item.label}`}
      >
        <CIcon icon={cilTrash} aria-hidden="true" />
      </CButton>
    </CListGroupItem>
  )
}

const ChecklistBuilder = ({ items, onChange }) => {
  const [newLabel, setNewLabel] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleAdd = () => {
    const label = newLabel.trim()
    if (!label) return
    onChange([...items, { id: `temp-${crypto.randomUUID()}`, label }])
    setNewLabel('')
  }

  const handleDelete = (id) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <>
      <CInputGroup className="mb-2">
        <CFormInput
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Ítem del checklist y presiona Enter..."
        />
        <CButton
          type="button"
          color="primary"
          variant="outline"
          onClick={handleAdd}
          aria-label="Añadir ítem al checklist"
        >
          <CIcon icon={cilPlus} aria-hidden="true" />
        </CButton>
      </CInputGroup>
      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <CListGroup flush>
              {items.map((item) => (
                <SortableItem key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </CListGroup>
          </SortableContext>
        </DndContext>
      )}
    </>
  )
}

export default ChecklistBuilder
