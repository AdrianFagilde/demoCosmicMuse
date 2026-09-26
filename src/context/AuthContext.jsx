import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import supabase from '../lib/supabase'
import {
  getCurrentSession,
  getProfile,
  login as loginWithSupabase,
  logout as logoutWithSupabase,
} from '../auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  // Secuencia para descartar respuestas de perfil que lleguen fuera de orden
  const requestSeq = useRef(0)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async (userId) => {
      const seq = ++requestSeq.current
      try {
        const p = await getProfile(userId)
        if (cancelled || seq !== requestSeq.current) return
        setProfile(p)
        setAuthError(null)
      } catch (err) {
        if (cancelled || seq !== requestSeq.current) return
        console.error('[Auth] Error cargando perfil:', err?.message || err)
        setProfile(null)
        setAuthError(
          err?.code === 'PGRST116'
            ? 'Tu cuenta no tiene un perfil asociado. Contacta con la academia.'
            : 'No se pudo cargar tu perfil. Comprueba tu conexión e inténtalo de nuevo.',
        )
      }
    }

    const init = async () => {
      try {
        const session = await getCurrentSession()
        if (cancelled) return
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Auth] Error restaurando sesión:', err?.message || err)
          setAuthError('No se pudo conectar con el servicio de autenticación.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session?.user) {
        setUser(session.user)
        // supabase-js advierte de no llamar a otras APIs de Supabase de forma
        // sincrona dentro de onAuthStateChange: el cliente de auth mantiene un
        // candado interno y getProfile() puede deadlockear. Se difiere un
        // turno de macrotarea para salir del callback.
        setTimeout(() => {
          if (!cancelled) void loadProfile(session.user.id)
        }, 0)
      } else {
        requestSeq.current += 1 // invalida cargas de perfil en curso
        setUser(null)
        setProfile(null)
        setAuthError(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { user: authUser } = await loginWithSupabase(email, password)
    return authUser
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutWithSupabase()
    } finally {
      // El estado local se limpia SIEMPRE, incluso si signOut falla por
      // red. Antes se limpiaba despues del await, asi que un fallo dejaba la
      // sesion viva y visible en la interfaz.
      setUser(null)
      setProfile(null)
      setAuthError(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    try {
      const p = await getProfile(user.id)
      setProfile(p)
      setAuthError(null)
    } catch (err) {
      console.error('[Auth] Error refrescando perfil:', err?.message || err)
    }
  }, [user])

  const retry = useCallback(() => {
    window.location.reload()
  }, [])

  const value = {
    user,
    profile,
    login,
    logout,
    refreshProfile,
    loading,
    authError,
    retry,
    isAuthenticated: Boolean(user),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
