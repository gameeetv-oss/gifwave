import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const activeUser = useRef(null)
  const mounted = useRef(false)
  const profileRequest = useRef(0)

  useEffect(() => {
    mounted.current = true
    let disposed = false
    let authChanged = false
    const applySession = (session) => {
      if (disposed) return
      const nextUser = session?.user ?? null
      activeUser.current = nextUser?.id ?? null
      setUser(nextUser)
      setProfile(null)
      setLoading(false)
      if (nextUser) {
        // Leave the auth callback before querying Supabase again.
        setTimeout(() => {
          if (!disposed && activeUser.current === nextUser.id) fetchProfile(nextUser.id).catch(() => {})
        }, 0)
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true
      applySession(session)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (disposed || authChanged) return
      if (error) throw error
      applySession(data.session)
    }).catch(() => {
      if (!disposed && !authChanged) setLoading(false)
    })
    return () => {
      disposed = true
      mounted.current = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    const request = ++profileRequest.current
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) return
      if (mounted.current && activeUser.current === userId && request === profileRequest.current) {
        setProfile(data)
      }
    } finally {
      if (mounted.current && activeUser.current === userId) setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isPremium = !!(profile?.is_premium && (!profile?.premium_until || new Date(profile.premium_until) > new Date()))

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, fetchProfile, isPremium }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
