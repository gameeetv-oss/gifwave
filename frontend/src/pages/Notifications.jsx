import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, Loader2 } from 'lucide-react'

const TYPE_ICONS = {
  like: { icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' },
  comment: { icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  follow: { icon: UserPlus, color: 'text-green-400', bg: 'bg-green-500/10' },
}
const TYPE_TEXT = {
  like: "GIF'ini beğendi",
  comment: "GIF'ine yorum yaptı",
  follow: 'seni takip etmeye başladı',
}

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadNotifications()
  }, [user])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, from_profile:profiles!fk_notif_from_profiles(username, display_name, avatar_url), post:posts(gif_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }

  function formatTime(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'şimdi'
    if (m < 60) return `${m}dk önce`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}sa önce`
    return `${Math.floor(h / 24)}g önce`
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Bildirimler</h1>
      {loading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>}
      {!loading && notifications.length === 0 && (
        <div className="text-center py-16 text-gray-500"><p className="text-4xl mb-3">🔔</p><p>Henüz bildirim yok</p></div>
      )}
      <div className="space-y-2">
        {notifications.map(notif => {
          const { icon: Icon, color, bg } = TYPE_ICONS[notif.type] || TYPE_ICONS.like
          const fromUser = notif.from_profile
          return (
            <div key={notif.id} className={`card p-4 flex items-center gap-3 transition-all ${!notif.read ? 'border-brand-500/30 bg-brand-500/5' : ''}`}>
              <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Link to={`/profile/${fromUser?.username}`} className="w-9 h-9 rounded-full bg-brand-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-brand-200">
                  {fromUser?.avatar_url ? <img src={fromUser.avatar_url} alt="" className="w-full h-full object-cover" /> : fromUser?.username?.[0]?.toUpperCase()}
                </Link>
                <p className="text-sm flex-1 min-w-0 truncate">
                  <Link to={`/profile/${fromUser?.username}`} className="font-semibold text-brand-400 hover:text-brand-300">
                    {fromUser?.display_name || fromUser?.username}
                  </Link>
                  {' '}{TYPE_TEXT[notif.type]}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {notif.post?.gif_url && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/20">
                    <img src={notif.post.gif_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="text-xs text-gray-600 hidden sm:block">{formatTime(notif.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
