export const formatDateTime = (value) => {
  if (!value) return '--'
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}
