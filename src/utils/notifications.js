import supabase from '../lib/supabase'

export const notifyInApp = async ({ senderId = null, recipients = [], title, message }) => {
  if (!recipients.length) return false

  const rows = recipients.map((recipient) => ({
    sender_id: senderId,
    recipient_id: recipient.id ?? recipient.studentId ?? recipient.recipientId,
    title,
    message,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('[Notifications] Error:', error.message, error)
    return false
  }
  return true
}
