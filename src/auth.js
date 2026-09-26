import supabase from './lib/supabase'

const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

const getCurrentSession = async () => {
  const { data } = await supabase.auth.getSession()
  return data?.session || null
}

const getProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export { login, logout, getCurrentSession, getProfile }
