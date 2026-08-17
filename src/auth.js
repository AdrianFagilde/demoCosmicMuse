const defaultUsers = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Aurora Rivera',
    email: 'admin@cosmomusic.com',
  },
  {
    id: 2,
    username: 'maria',
    password: 'student123',
    role: 'student',
    name: 'María López',
    email: 'maria.lopez@cosmomusic.com',
  },
  {
    id: 3,
    username: 'javier',
    password: 'student123',
    role: 'student',
    name: 'Javier Torres',
    email: 'javier.torres@cosmomusic.com',
  },
]

const STORAGE_KEY = 'cosmo-music-user'

const getUsers = () => {
  try {
    const envUsers = import.meta.env.VITE_DEMO_USERS
    if (envUsers) {
      return JSON.parse(envUsers)
    }
  } catch {
    // fallback to defaults
  }
  return defaultUsers
}

const getCurrentUser = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('Unable to read current user', error)
    return null
  }
}

const isAuthenticated = () => Boolean(getCurrentUser())

const login = (username, password) => {
  const users = getUsers()
  const user = users.find(
    (item) =>
      item.username.toLowerCase() === username.toLowerCase().trim() && item.password === password,
  )
  if (user) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return user
  }
  return null
}

const logout = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export { getUsers, getCurrentUser, isAuthenticated, login, logout }
