import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useSupabaseQuery — esqueleto común para los hooks useSupabase*.
 *
 * Encapsula el ciclo completo de fetch: estado [data, loading, error],
 * refetch con protección de orden de respuestas (requestSeq), auto-fetch
 * opcional y setData para las mutaciones locales de cada dominio.
 *
 * `queryFn` debe devolver los datos o LANZAR (throw) en caso de error;
 * el estado de error lo gestiona este hook. El llamador debe memorizarla
 * con useCallback usando las dependencias reales (p. ej. [userId]).
 *
 * `emptyValue` es el estado inicial y el que se restaura al refetch cuando
 * ya hubo una carga previa.
 */

// Constante a nivel de módulo, no un `[]` literal en la firma: un default
// por defecto se evalúa en cada llamada, así que `emptyValue = []` producía
// un array NUEVO en cada render. Como el efecto dependía de él y a su vez
// hacía setData, eso realimentaba el efecto indefinidamente: todos los hooks
// que no pasaban tercer argumento (useSupabaseTasks, useSupabaseStudents,
// useSupabaseReminders, useSupabaseNotifications) entraban en bucle de
// peticiones a Supabase desde el primer montaje.
const DEFAULT_EMPTY_VALUE = []

const useSupabaseQuery = (queryFn, autoFetch = true, emptyValue = DEFAULT_EMPTY_VALUE) => {
  const [data, setData] = useState(emptyValue)
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState(null)
  const requestSeq = useRef(0)
  const hasFetched = useRef(false)

  // Se guarda en un ref y se saca de las dependencias del efecto. Así el
  // hook tampoco explota si el llamador escribe un objeto o array literal
  // como tercer argumento: cambiar la identidad de emptyValue no debe
  // provocar una recarga, solo decide qué se escribe al vaciar.
  // La escritura va en un efecto y no en el render (react-hooks/refs lo
  // prohibe); como se declara antes del efecto de fetch, cuando este ultimo
  // lo lee ya contiene el valor del render actual.
  const emptyValueRef = useRef(emptyValue)
  useEffect(() => {
    emptyValueRef.current = emptyValue
  })

  const refetch = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    try {
      const result = await queryFn()
      if (seq === requestSeq.current) {
        setData(result)
      }
      return result
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(err)
      }
      return null
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [queryFn])

  useEffect(() => {
    if (autoFetch) {
      // Los hooks cuyo queryFn depende de un argumento que llega asíncrono
      // (useSupabaseLessons/Practice/UserNotifications) reutilizaban la data
      // anterior mientras cargaba la nueva: se veían las filas del
      // estudiante previo. Se vacía antes de cada fetch, salvo el primero.
      if (hasFetched.current) setData(emptyValueRef.current)
      hasFetched.current = true
      refetch()
    }
  }, [autoFetch, refetch])

  return { data, setData, loading, error, refetch }
}

export default useSupabaseQuery
