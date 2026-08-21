import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { getCurrentSession, getProfile } from '../auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentSession().then(async (session) => {
      if (session?.user) {
        setUser(session.user)
        const p = await getProfile(session.user.id)
        if (p?.role === 'admin' && session.user.user_metadata?.role !== 'admin') {
          await supabase.auth.updateUser({ data: { role: 'admin' } })
        }
        setProfile(p)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        const p = await getProfile(session.user.id)
        if (p?.role === 'admin' && session.user.user_metadata?.role !== 'admin') {
          await supabase.auth.updateUser({ data: { role: 'admin' } })
        }
        setProfile(p)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email, password) => {
    const { user: authUser } = await loginWithSupabase(email, password)
    return authUser
  }, [])

  const logout = useCallback(async () => {
    await logoutSupabase()
    setUser(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    const p = await getProfile(user.id)
    if (p) setProfile(p)
  }, [user])

  const value = {
    user,
    profile,
    login,
    logout,
    refreshProfile,
    loading,
    isAuthenticated: Boolean(user),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function loginWithSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

async function logoutSupabase() {
  await supabase.auth.signOut()
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
