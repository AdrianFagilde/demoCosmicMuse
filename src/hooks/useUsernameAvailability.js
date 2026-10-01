import { useCallback, useEffect, useRef, useState } from 'react'
import supabase from '../lib/supabase'

/**
 * Hook para comprobar disponibilidad de username en tiempo real (debounced).
 *
 * Uso:
 *   const { available, checking, check } = useUsernameAvailability()
 *   <input onChange={(e) => check(e.target.value)} />
 *
 * - Debounce 300ms por defecto
 * - Limpia timers al desmontar
 * - Ignora peticiones obsoletas (race condition)
 * - No dispara si username < 3 chars o solo espacios
 */
export const useUsernameAvailability = (debounceMs = 300) => {
  const [available, setAvailable] = useState(null) // null | true | false
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState('')
  const timeoutRef = useRef(null)
  const seqRef = useRef(0)

  const checkAvailability = useCallback(
    async (username) => {
      const clean = (username || '').trim().toLowerCase()
      if (!clean || clean.length < 3) {
        setAvailable(null)
        setLastChecked('')
        return
      }

      // Cancelar timer anterior
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      // Nueva secuencia para ignorar respuestas tardías de llamadas previas
      const seq = ++seqRef.current
      setChecking(true)

      timeoutRef.current = setTimeout(async () => {
        try {
          // Buscar en profiles si el username ya existe
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', clean)
            .maybeSingle()

          // Ignorar si hubo una llamada más reciente
          if (seq !== seqRef.current) return

          const isAvailable = !error && !data
          setAvailable(isAvailable)
          setLastChecked(clean)
        } catch (err) {
          if (seq === seqRef.current) {
            console.error('[UsernameAvailability] Error:', err?.message || err)
            setAvailable(null) // indeterminado si falla red
          }
        } finally {
          if (seq === seqRef.current) setChecking(false)
        }
      }, debounceMs)
    },
    [debounceMs],
  )

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setAvailable(null)
    setChecking(false)
    setLastChecked('')
    seqRef.current += 1
  }, [])

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  return { available, checking, lastChecked, check: checkAvailability, reset }
}

export default useUsernameAvailability
