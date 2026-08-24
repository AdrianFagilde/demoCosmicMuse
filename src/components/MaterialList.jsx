import React, { useState } from 'react'
import { CBadge, CButton, CSpinner } from '@coreui/react'
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
import { cilFile, cilLink, cilMenu, cilNotes, cilTrash } from '@coreui/icons'
import { getCourseFileUrl } from '../utils/forms'

const TYPE_META = {
  text: { icon: cilNotes, color: 'secondary', label: 'Texto' },
  link: { icon: cilLink, color: 'info', label: 'Enlace' },
  file: { icon: cilFile, color: 'primary', label: 'Archivo' },
}

const MaterialRow = ({ material, readOnly, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: material.id,
    disabled: readOnly,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  const meta = TYPE_META[material.type] || TYPE_META.text
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    const url = await getCourseFileUrl(material.file_path)
    setDownloading(false)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded p-2 mb-2 d-flex align-items-start gap-2"
    >
      {!readOnly && (
        <span
          {...attributes}
          {...listeners}
          className="text-medium-emphasis"
          style={{ cursor: 'grab', touchAction: 'none' }}
        >
          <CIcon icon={cilMenu} />
        </span>
      )}
      <span className="text-medium-emphasis mt-1">
        <CIcon icon={meta.icon} />
      </span>
      <div className="flex-grow-1">
        <div className="fw-semibold d-flex align-items-center gap-2">
          {material.title}
          <CBadge color={meta.color}>{meta.label}</CBadge>
        </div>
        {material.type === 'text' && material.body && (
          <p className="mb-0 text-body-secondary" style={{ whiteSpace: 'pre-wrap' }}>
            {material.body}
          </p>
        )}
        {material.type === 'link' && (
          <a href={material.url} target="_blank" rel="noreferrer noopener" className="small">
            {material.url}
          </a>
        )}
        {material.type === 'file' && material.file_name && (
          <small className="text-medium-emphasis">{material.file_name}</small>
        )}
      </div>
      {material.type === 'file' && (
        <CButton size="sm" color="primary" variant="outline" onClick={handleDownload}>
          {downloading ? <CSpinner size="sm" /> : 'Descargar'}
        </CButton>
      )}
      {!readOnly && onDelete && (
        <CButton size="sm" color="danger" variant="outline" onClick={() => onDelete(material)}>
          <CIcon icon={cilTrash} />
        </CButton>
      )}
    </div>
  )
}

const MaterialList = ({ materials, readOnly = false, onDelete, onReorder }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = materials.findIndex((m) => m.id === active.id)
    const newIndex = materials.findIndex((m) => m.id === over.id)
    onReorder(arrayMove(materials, oldIndex, newIndex))
  }

  if (!readOnly) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={materials.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {materials.map((material) => (
            <MaterialRow
              key={material.id}
              material={material}
              readOnly={readOnly}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
    )
  }

  return materials.map((material) => (
    <MaterialRow key={material.id} material={material} readOnly={readOnly} />
  ))
}

export default MaterialList
