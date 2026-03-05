import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PresenceContext = createContext({ onlineUsers: new Set() })

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user) { setOnlineUsers(new Set()); return }

    const ch = supabase.channel('presence:gifwave', {
      config: { presence: { key: user.id } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      setOnlineUsers(new Set(Object.keys(ch.presenceState())))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ online: true })
    })

    channelRef.current = ch
    return () => {
      ch.untrack()
      supabase.removeChannel(ch)
    }
  }, [user?.id])

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  )
}

export const usePresence = () => useContext(PresenceContext)
