import React, { createContext, useCallback, useContext, useState } from 'react'

const AppContext = createContext(null)

export const AppProvider = ({ children }) => {
  // CoreUI renders the sidebar as a full-screen fixed overlay below 992px,
  // so it must start hidden or it covers the content on every mobile load.
  const [sidebarShow, setSidebarShow] = useState(false)
  const [sidebarUnfoldable, setSidebarUnfoldable] = useState(false)

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
