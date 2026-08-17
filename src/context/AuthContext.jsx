import React, { createContext, useCallback, useContext, useState } from 'react'
import {
  getCurrentUser as fetchCurrentUser,
  login as authLogin,
  logout as authLogout,
} from '../auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => fetchCurrentUser())

  const login = useCallback((username, password) => {
    const logged = authLogin(username, password)
    if (logged) {
      setUser(logged)
    }
    return logged
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
  }, [])

  const value = { user, login, logout, isAuthenticated: Boolean(user) }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
