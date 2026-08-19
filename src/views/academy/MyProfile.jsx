import React, { useEffect, useState } from 'react'
import {
  CAvatar,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCamera, cilUser } from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabaseLessons from '../../hooks/useSupabaseLessons'
import supabase from '../../lib/supabase'

const MyProfile = () => {
  const { user, profile } = useAuth()
  const { lessons, loading } = useSupabaseLessons(user?.id)
  const [form, setForm] = useState({ phone: '', instrument: '', level: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        phone: profile.phone || '',
        instrument: profile.instrument || '',
        level: profile.level || 'Principiante',
      })
    }
  }, [profile])

  if (!profile || profile.role !== 'student') {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <h4>Acceso restringido</h4>
          <p>Esta seccion solo esta disponible para los estudiantes de Cosmic Muse.</p>
        </CCardBody>
      </CCard>
    )
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'danger', text: 'Solo se permiten archivos de imagen.' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'danger', text: 'La imagen no debe superar 2 MB.' })
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile || !user?.id) return
    setUploadingAvatar(true)
    setMessage({ type: '', text: '' })

    const fileExt = avatarFile.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true })

    if (uploadError) {
      setMessage({ type: 'danger', text: 'Error al subir la imagen.' })
      setUploadingAvatar(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      setMessage({ type: 'danger', text: 'Error al guardar la foto de perfil.' })
    } else {
      setMessage({ type: 'success', text: 'Foto de perfil actualizada.' })
      setAvatarFile(null)
    }
    setUploadingAvatar(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    const { error } = await supabase
      .from('profiles')
      .update({
        phone: form.phone || null,
        instrument: form.instrument || null,
        level: form.level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'danger', text: 'Error al guardar los cambios.' })
    } else {
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' })
    }
    setSaving(false)
  }

  const currentAvatar = avatarPreview || profile.avatar_url

  return (
    <>
      {message.text && (
        <CRow className="mb-3">
          <CCol>
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          </CCol>
        </CRow>
      )}
      <CRow className="mb-4">
        <CCol md={4} className="mb-3">
          <CCard>
            <CCardHeader>Mi informacion</CCardHeader>
            <CCardBody>
              <div className="d-flex flex-column align-items-center text-center mb-3">
                <div className="position-relative mb-3">
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt="Avatar"
                      className="rounded-circle"
                      style={{ width: '96px', height: '96px', objectFit: 'cover' }}
                    />
                  ) : (
                    <CAvatar color="primary" size="xl">
                      {profile.full_name
                        .split(' ')
                        .map((word) => word[0])
                        .join('')}
                    </CAvatar>
                  )}
                </div>
                <h4 className="mb-1">{profile.full_name}</h4>
                <div className="text-medium-emphasis">Estudiante</div>
              </div>
              <div className="mb-3">
                <strong>Email:</strong> {profile.email}
              </div>
              <div className="mb-3">
                <strong>Profesor:</strong> {profile.teacher || '—'}
              </div>
              <div className="mb-3">
                <strong>Progreso:</strong>{' '}
                <CBadge color="success">{profile.progress}%</CBadge>
              </div>
              <div className="mb-3">
                <strong>Asistencia:</strong> {profile.attendance}%
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={8} className="mb-3">
          <CCard className="mb-3">
            <CCardHeader>Foto de perfil</CCardHeader>
            <CCardBody>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center bg-body-secondary overflow-hidden"
                  style={{ width: '72px', height: '72px', flexShrink: 0 }}
                >
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt="Vista previa"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <CIcon icon={cilUser} size="xl" className="text-body-secondary" />
                  )}
                </div>
                <div>
                  <CFormInput
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    id="avatarUpload"
                    className="d-none"
                  />
                  <CButton
                    color="secondary"
                    variant="outline"
                    as="label"
                    htmlFor="avatarUpload"
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilCamera} className="me-1" />
                    Seleccionar foto
                  </CButton>
                  <div className="text-body-secondary small mt-1">
                    JPG, PNG o WebP. Max 2 MB.
                  </div>
                </div>
                {avatarFile && (
                  <CButton
                    color="primary"
                    size="sm"
                    onClick={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="ms-auto"
                  >
                    {uploadingAvatar ? 'Subiendo...' : 'Guardar foto'}
                  </CButton>
                )}
              </div>
            </CCardBody>
          </CCard>
          <CCard>
            <CCardHeader>Editar perfil</CCardHeader>
            <CCardBody>
              <CFormInput
                label="Telefono"
                placeholder="Ej: +58 412 1234567"
                className="mb-3"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <CFormSelect
                label="Instrumento"
                className="mb-3"
                value={form.instrument}
                onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))}
              >
                <option value="">Seleccionar...</option>
                <option value="Piano">Piano</option>
                <option value="Guitarra">Guitarra</option>
                <option value="Violin">Violin</option>
                <option value="Saxofon">Saxofon</option>
                <option value="Bateria">Bateria</option>
                <option value="Otro">Otro</option>
              </CFormSelect>
              <CFormSelect
                label="Nivel"
                className="mb-3"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              >
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </CFormSelect>
              <CButton color="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </CButton>
            </CCardBody>
          </CCard>
          <CCard className="mt-3">
            <CCardHeader>Proximas clases</CCardHeader>
            <CCardBody>
              {loading ? (
                <CSpinner color="primary" />
              ) : (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Fecha</CTableHeaderCell>
                      <CTableHeaderCell>Hora</CTableHeaderCell>
                      <CTableHeaderCell>Instrumento</CTableHeaderCell>
                      <CTableHeaderCell>Profesor</CTableHeaderCell>
                      <CTableHeaderCell>Duracion</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {lessons.length > 0 ? (
                      lessons.map((lesson) => (
                        <CTableRow key={lesson.id}>
                          <CTableDataCell>{lesson.lesson_date}</CTableDataCell>
                          <CTableDataCell>{lesson.lesson_time}</CTableDataCell>
                          <CTableDataCell>{lesson.instrument}</CTableDataCell>
                          <CTableDataCell>{lesson.teacher}</CTableDataCell>
                          <CTableDataCell>{lesson.duration}</CTableDataCell>
                        </CTableRow>
                      ))
                    ) : (
                      <CTableRow>
                        <CTableDataCell colSpan={5}>No hay clases programadas.</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default MyProfile
