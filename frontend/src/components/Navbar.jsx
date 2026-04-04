import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Compass, Plus, User, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import UploadModal from './UploadModal'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [unreadDMs, setUnreadDMs] = useState(0)
  const [showUpload, setShowUpload] = useState(false)

  const myProfileLink = profile?.username
    ? `/profile/${profile.username}`
    : user?.id ? `/profile/${user.id}` : '/login'

  useEffect(() => {
    if (!user) return
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnread(count || 0))
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadDMs(count || 0))
    const channel = supabase.channel('navbar-rt-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => setUnread(n => n + 1))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => { if (p.new.read && !p.old?.read) setUnread(n => Math.max(0, n - 1)) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => setUnreadDMs(n => n + 1))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, (p) => { if (p.new.read && !p.old?.read) setUnreadDMs(n => Math.max(0, n - 1)) })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  if (!user) {
    return (
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#0a0a14]/95 backdrop-blur border-t border-[#2a2a3f] h-16 flex items-center justify-around px-4">
        <Link to="/login" className="btn-ghost text-sm">Giriş</Link>
        <Link to="/register" className="btn-primary text-sm">Kayıt Ol</Link>
      </nav>
    )
  }

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#0a0a14]/95 backdrop-blur border-t border-[#2a2a3f] h-16 flex items-center justify-around px-2">
        <Link to="/" className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${isActive('/') ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Home className="w-6 h-6" />
          <span className="text-[10px]">Ana Sayfa</span>
        </Link>

        <Link to="/explore" className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${isActive('/explore') ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Compass className="w-6 h-6" />
          <span className="text-[10px]">Keşfet</span>
        </Link>

        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center justify-center w-12 h-8 bg-white rounded-xl hover:bg-gray-200 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 text-black font-bold" />
        </button>

        <div className="relative">
          <Link to="/inbox" className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${isActive('/inbox') ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px]">Gelen Kutusu</span>
          </Link>
          {(unread + unreadDMs) > 0 && (
            <span className="absolute top-1 right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{(unread + unreadDMs) > 9 ? '9+' : unread + unreadDMs}</span>
          )}
        </div>

        <Link to={myProfileLink} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${isActive('/profile') ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <User className="w-6 h-6" />
          <span className="text-[10px]">Profil</span>
        </Link>
      </nav>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => navigate('/')} />}
    </>
  )
}
