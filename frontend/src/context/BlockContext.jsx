import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const BlockContext = createContext({ blockedIds: new Set(), blockedByIds: new Set(), allBlockedIds: new Set(), loadBlocks: () => {} })

export function BlockProvider({ children }) {
  const { user } = useAuth()
  const [blockedIds, setBlockedIds] = useState(new Set())     // benim engellediğim
  const [blockedByIds, setBlockedByIds] = useState(new Set()) // beni engelleyen

  useEffect(() => {
    if (!user) { setBlockedIds(new Set()); setBlockedByIds(new Set()); return }
    loadBlocks()
  }, [user?.id])

  async function loadBlocks() {
    const [myRes, theirRes] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id),
    ])
    setBlockedIds(new Set((myRes.data || []).map(b => b.blocked_id)))
    setBlockedByIds(new Set((theirRes.data || []).map(b => b.blocker_id)))
  }

  const allBlockedIds = new Set([...blockedIds, ...blockedByIds])

  return (
    <BlockContext.Provider value={{ blockedIds, blockedByIds, allBlockedIds, loadBlocks }}>
      {children}
    </BlockContext.Provider>
  )
}

export const useBlock = () => useContext(BlockContext)
