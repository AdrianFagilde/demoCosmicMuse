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
 */
const useSupabaseQuery = (queryFn, autoFetch = true) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState(null)
  const requestSeq = useRef(0)

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refetch()
    }
  }, [autoFetch, refetch])

  return { data, setData, loading, error, refetch }
}

export default useSupabaseQuery
