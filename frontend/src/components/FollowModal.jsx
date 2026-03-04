import { useEffect, useState } from 'react'
import { X, UserMinus, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function FollowModal({ profileId, type, onClose, onCountChange }) {
  const { user, fetchProfile } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [myFollowing, setMyFollowing] = useState(new Set())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    load()
    return () => { document.body.style.overflow = '' }
  }, [])

  async function load() {
    setLoading(true)
    let profiles = []

    if (type === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('profiles!fk_follows_follower_profiles(id, username, display_name, avatar_url)')
        .eq('following_id', profileId)
      profiles = (data || []).map(d => d.profiles).filter(Boolean)
    } else {
      const { data } = await supabase
        .from('follows')
        .select('profiles!fk_follows_following_profiles(id, username, display_name, avatar_url)')
        .eq('follower_id', profileId)
      profiles = (data || []).map(d => d.profiles).filter(Boolean)
    }

    setList(profiles)

    if (user) {
      const { data: myF } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id)
      setMyFollowing(new Set((myF || []).map(f => f.following_id)))
    }
    setLoading(false)
  }

  async function unfollow(targetId, targetUsername) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId)

    // Sayıları yeniden hesapla
    const [{ count: newFollowers }, { count: myNewFollowing }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    ])
    await Promise.all([
      supabase.from('profiles').update({ followers_count: newFollowers || 0 }).eq('id', targetId),
      supabase.from('profiles').update({ following_count: myNewFollowing || 0 }).eq('id', user.id),
    ])

    setMyFollowing(prev => { const s = new Set(prev); s.delete(targetId); return s })
    toast(`@${targetUsername} takipten çıkıldı`)
    fetchProfile(user.id)
    onCountChange?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-sm max-h-[70vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3f]">
          <h3 className="font-semibold">{type === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          )}
          {!loading && list.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              {type === 'followers' ? 'Henüz takipçi yok' : 'Henüz takip edilen yok'}
            </p>
          )}
          {list.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
              <Link to={`/profile/${p.username}`} onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-brand-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-brand-200">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (p.display_name || p.username)?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{p.display_name || p.username}</p>
                  <p className="text-gray-500 text-xs">@{p.username}</p>
                </div>
              </Link>

              {user && user.id !== p.id && myFollowing.has(p.id) && (
                <button
                  onClick={() => unfollow(p.id, p.username)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0"
                >
                  <UserMinus className="w-3.5 h-3.5" /> Çıkar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
