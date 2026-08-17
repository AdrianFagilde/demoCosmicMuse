import React, { createContext, useCallback, useContext, useState } from 'react'

const AppContext = createContext(null)

export const AppProvider = ({ children }) => {
  const [sidebarShow, setSidebarShow] = useState(true)
  const [sidebarUnfoldable, setSidebarUnfoldable] = useState(false)
  const [theme, setTheme] = useState('light')

  const toggleSidebar = useCallback(() => {
    setSidebarShow((prev) => !prev)
  }, [])

  const toggleSidebarUnfoldable = useCallback(() => {
    setSidebarUnfoldable((prev) => !prev)
  }, [])

  const value = {
    sidebarShow,
    setSidebarShow,
    sidebarUnfoldable,
    setSidebarUnfoldable,
    theme,
    setTheme,
    toggleSidebar,
    toggleSidebarUnfoldable,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
