import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Compass, Upload, Bell, User, LogOut, Waves, MessageSquare, Search, X, BadgeCheck, Loader2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [unreadDMs, setUnreadDMs] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)
  const searchDebounce = useRef(null)

  const myProfileLink = profile?.username
    ? `/profile/${profile.username}`
    : user?.id ? `/profile/${user.id}` : '/login'

  // Bildirim + DM sayısı
  useEffect(() => {
    if (!user) return

    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnread(count || 0))

    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadDMs(count || 0))

    const channel = supabase.channel('navbar-realtime-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => setUnread(n => n + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (p) => { if (p.new.read && !p.old?.read) setUnread(n => Math.max(0, n - 1)) })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => setUnreadDMs(n => n + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, (p) => { if (p.new.read && !p.old?.read) setUnreadDMs(n => Math.max(0, n - 1)) })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  // Arama
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, username, display_name, avatar_url, is_verified, followers_count')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .order('followers_count', { ascending: false })
        .limit(10)
      setSearchResults(data || [])
      setSearchLoading(false)
    }, 300)
  }, [searchQuery])

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handle(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

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
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 text-brand-400 font-bold text-xl flex-shrink-0">
          <Waves className="w-6 h-6" />
          <span className="hidden sm:inline">GifWave</span>
        </Link>

        {/* Arama */}
        <div className="flex-1 max-w-sm relative" ref={searchRef}>
          <div className="relative">
            {searchLoading
              ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 animate-spin" />
              : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            }
            <input
              className="w-full bg-[#1a1a2e] border border-[#2a2a3f] rounded-xl py-2 pl-9 pr-8 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
              placeholder="Kullanıcı ara..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchLoading(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121e] border border-[#3a3a5c] rounded-2xl shadow-2xl overflow-hidden z-50">
              {searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-5 text-center text-sm text-gray-500">
                  "<span className="text-gray-300">{searchQuery}</span>" için sonuç bulunamadı
                </div>
              ) : (
                searchResults.map(u => (
                  <Link
                    key={u.id}
                    to={`/profile/${u.username}`}
                    onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-[#2a2a3f] last:border-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-brand-200 ring-2 ring-[#2a2a3f]">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        : u.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white flex items-center gap-1">
                        {u.username}
                        {u.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {u.display_name && u.display_name !== u.username ? u.display_name + ' · ' : ''}
                        {u.followers_count > 0 ? `${u.followers_count} takipçi` : 'Yeni üye'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Nav linkleri */}
        <div className="flex items-center gap-1">
          {nav.map((item) => {
            const { to, icon: Icon, label, badge } = item
            return (
              <Link key={label} to={to}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(item) ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
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
            <button onClick={() => { signOut(); navigate('/login') }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2">
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
