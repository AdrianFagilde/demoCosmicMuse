import supabase from '../lib/supabase'

// `referenceType` / `referenceId` apuntan a la entidad que la notificacion
// abre al pulsarse (`task`). Son opcionales a proposito: las notificaciones
// manuales de /send-notifications son broadcasts sin entidad, y asi quedan
// con las columnas a NULL, que es lo que el frontend trata como "no navegar".
//
// El override por destinatario existe porque al asignar una tarea a varios
// alumnos se insertan varias filas y cada una es una tarea DISTINTA. Sin el,
// todas las notificaciones apuntarian al mismo id.
export const notifyInApp = async ({
  senderId = null,
  recipients = [],
  title,
  message,
  referenceType = null,
  referenceId = null,
}) => {
  if (!recipients.length) return false

  const rows = recipients.map((recipient) => ({
    sender_id: senderId,
    recipient_id: recipient.id ?? recipient.studentId ?? recipient.recipientId,
    title,
    message,
    reference_type: recipient.referenceType ?? referenceType,
    reference_id: recipient.referenceId ?? referenceId,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('[Notifications] Error:', error.message, error)
    return false
  }
  return true
}
