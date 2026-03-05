import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Compass, Upload, Bell, User, LogOut, Waves, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [unreadDMs, setUnreadDMs] = useState(0)

  // Her zaman kendi profilimizin linkini oluştur
  const myProfileLink = profile?.username
    ? `/profile/${profile.username}`
    : user?.id
    ? `/profile/${user.id}`
    : '/login'

  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnread(count || 0))

    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadDMs(count || 0))

    const channel = supabase
      .channel('notif-count-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => setUnread(n => n + 1))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => setUnreadDMs(n => n + 1))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  const nav = [
    { to: '/', icon: Home, label: 'Ana Sayfa' },
    { to: '/explore', icon: Compass, label: 'Keşfet' },
    ...(user ? [
      { to: '/upload', icon: Upload, label: 'Yükle' },
      { to: '/messages', icon: MessageSquare, label: 'Mesajlar', badge: unreadDMs },
      { to: '/notifications', icon: Bell, label: 'Bildirimler', badge: unread },
      { to: myProfileLink, icon: User, label: 'Profil', exact: true },
    ] : []),
  ]

  function isActive(item) {
    if (item.to === '/') return location.pathname === '/'
    if (item.exact) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a14]/90 backdrop-blur border-b border-[#2a2a3f] h-16 flex items-center px-4">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-brand-400 font-bold text-xl">
          <Waves className="w-6 h-6" />
          GifWave
        </Link>

        <div className="flex items-center gap-1">
          {nav.map((item) => {
            const { to, icon: Icon, label, badge } = item
            return (
              <Link
                key={label}
                to={to}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(item) ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden md:inline">{label}</span>
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            )
          })}

          {user ? (
            <button
              onClick={() => { signOut(); navigate('/login') }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Çıkış</span>
            </button>
          ) : (
            <div className="flex gap-2 ml-2">
              <Link to="/login" className="btn-ghost text-sm">Giriş</Link>
              <Link to="/register" className="btn-primary text-sm">Kayıt Ol</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
