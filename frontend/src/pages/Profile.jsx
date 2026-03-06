import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Camera, Loader2, UserPlus, UserMinus, Heart, Repeat2, Grid3x3,
  Pencil, Trash2, Check, X, BadgeCheck, MessageSquare, Clock, ShieldOff, Shield, MoreHorizontal
} from 'lucide-react'
import GIFCard from '../components/GIFCard'
import FollowModal from '../components/FollowModal'
import { useBlock } from '../context/BlockContext'
import { usePresence } from '../context/PresenceContext'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'posts',   label: 'Gönderiler', icon: Grid3x3 },
  { id: 'reposts', label: 'Reposts',    icon: Repeat2 },
  { id: 'liked',   label: 'Beğendikleri', icon: Heart },
]

export default function Profile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user, profile: myProfile, fetchProfile } = useAuth()

  const [profile, setProfile]       = useState(null)
  const [tab, setTab]               = useState('posts')
  const [posts, setPosts]           = useState([])
  const [reposts, setReposts]       = useState([])
  const [liked, setLiked]           = useState([])
  const [followStatus, setFollowStatus] = useState(null) // null | 'pending' | 'accepted'
  const [isBlocked, setIsBlocked]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [editMode, setEditMode]     = useState(false)
  const [editData, setEditData]     = useState({ display_name: '', bio: '', username: '' })
  const [saving, setSaving]         = useState(false)
  const [followModal, setFollowModal] = useState(null)
  const [settings, setSettings]     = useState(null)
  const [editSettings, setEditSettings] = useState(null)
  const [showMenu, setShowMenu]     = useState(false)

  const isMe = user && (myProfile?.username === username || user.id === username)
  const { blockedIds, allBlockedIds, loadBlocks } = useBlock()
  const { onlineUsers } = usePresence()

  useEffect(() => { loadProfile() }, [username, user?.id])

  async function loadProfile() {
    setLoading(true)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)
    let prof = null

    if (isUUID) {
      const { data } = await supabase.from('profiles').select('*').eq('id', username).single()
      prof = data
      if (prof?.username) { navigate(`/profile/${prof.username}`, { replace: true }); return }
    } else {
      const { data } = await supabase.from('profiles').select('*').eq('username', username).single()
      prof = data
    }

    if (!prof) { setLoading(false); return }
    setProfile(prof)
    setEditData({ display_name: prof.display_name || '', bio: prof.bio || '', username: prof.username || '', show_online_status: prof.show_online_status !== false })

    const [postsRes, repostsRes, likedRes] = await Promise.all([
      supabase.from('posts')
        .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified)')
        .eq('user_id', prof.id).order('created_at', { ascending: false }),
      supabase.from('reposts')
        .select('post_id, created_at, posts(*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified))')
        .eq('user_id', prof.id).order('created_at', { ascending: false }),
      supabase.from('likes')
        .select('post_id, created_at, posts(*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified))')
        .eq('user_id', prof.id).order('created_at', { ascending: false }),
    ])

    const rawPosts = postsRes.data || []
    if (user && rawPosts.length > 0) {
      const postIds = rawPosts.map(p => p.id)
      const [likeRes2, repostRes2] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      ])
      const likedIds = new Set((likeRes2.data || []).map(l => l.post_id))
      const repostedIds = new Set((repostRes2.data || []).map(r => r.post_id))
      setPosts(rawPosts.map(p => ({ ...p, user_liked: likedIds.has(p.id), user_reposted: repostedIds.has(p.id) })))
    } else {
      setPosts(rawPosts)
    }

    setReposts((repostsRes.data || []).map(r => r.posts).filter(Boolean)
      .filter(p => !allBlockedIds.has(p.user_id))
      .map(p => ({ ...p, _repost: true })))
    setLiked((likedRes.data || []).map(l => ({ ...l.posts, _liked: true, user_liked: true }))
      .filter(p => p?.id && !allBlockedIds.has(p.user_id)))

    if (user && !isMe) {
      const [followRes, blockRes] = await Promise.all([
        supabase.from('follows').select('status')
          .eq('follower_id', user.id).eq('following_id', prof.id).maybeSingle(),
        supabase.from('blocks').select('blocker_id')
          .eq('blocker_id', user.id).eq('blocked_id', prof.id).maybeSingle(),
      ])
      setFollowStatus(followRes.data?.status || null)
      setIsBlocked(!!blockRes.data)
    }

    const { data: settData } = await supabase.from('user_settings').select('*').eq('user_id', prof.id).maybeSingle()
    const defaultSett = { is_private: false, who_can_comment: 'all', who_can_reply: 'all', show_liked_posts: true, allow_dm: true, show_read_receipts: true }
    setSettings(settData || defaultSett)
    if (isMe) setEditSettings(settData || defaultSett)

    setLoading(false)
  }

  async function toggleFollow() {
    if (!user) { toast.error('Giriş yap'); return }
    if (followStatus === 'accepted') {
      // Takipten çık
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.id)
      setFollowStatus(null)
      setProfile(p => ({ ...p, followers_count: Math.max(0, (p.followers_count || 1) - 1) }))
    } else if (followStatus === 'pending') {
      // İsteği geri çek
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.id)
      setFollowStatus(null)
      toast('Takip isteği geri alındı')
    } else {
      // Takip et
      const isPrivate = settings?.is_private
      const status = isPrivate ? 'pending' : 'accepted'
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id, status })
      if (error) { toast.error('Takip hatası'); return }
      setFollowStatus(status)
      if (status === 'accepted') {
        setProfile(p => ({ ...p, followers_count: (p.followers_count || 0) + 1 }))
        await supabase.from('notifications').insert({ user_id: profile.id, type: 'follow', from_user_id: user.id })
      } else {
        await supabase.from('notifications').insert({ user_id: profile.id, type: 'follow_request', from_user_id: user.id })
        toast('Takip isteği gönderildi')
      }
    }
    fetchProfile(user.id)
  }

  async function toggleBlock() {
    if (!user) return
    setShowMenu(false)
    if (isBlocked) {
      await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', profile.id)
      setIsBlocked(false)
      loadBlocks()
      toast('Engel kaldırıldı')
    } else {
      await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: profile.id })
      await supabase.from('follows').delete()
        .or(`and(follower_id.eq.${user.id},following_id.eq.${profile.id}),and(follower_id.eq.${profile.id},following_id.eq.${user.id})`)
      setIsBlocked(true)
      setFollowStatus(null)
      loadBlocks()
      toast.success('Kullanıcı engellendi')
    }
  }

  async function saveProfile() {
    setSaving(true)
    const newUsername = editData.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (newUsername !== profile.username) {
      if (newUsername.length < 3) { toast.error('Kullanıcı adı en az 3 karakter'); setSaving(false); return }
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', newUsername).maybeSingle()
      if (existing) { toast.error('Bu kullanıcı adı alınmış'); setSaving(false); return }
    }
    const { error } = await supabase.from('profiles')
      .update({ bio: editData.bio.trim(), display_name: editData.display_name.trim(), username: newUsername, show_online_status: editData.show_online_status })
      .eq('id', user.id)
    if (!error) {
      toast.success('Profil güncellendi')
      setEditMode(false)
      setProfile(p => ({ ...p, ...editData, username: newUsername }))
      fetchProfile(user.id)
      if (newUsername !== username) navigate(`/profile/${newUsername}`, { replace: true })
    } else toast.error('Hata: ' + error.message)
    setSaving(false)
  }

  async function saveSettings() {
    if (!editSettings) return
    const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...editSettings })
    if (!error) { setSettings(editSettings); toast.success('Ayarlar kaydedildi') }
    else toast.error('Ayar kaydı hatası')
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from('gifs').upload(path, file, { upsert: true })
    if (error) { toast.error('Avatar yükleme hatası'); return }
    const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    toast.success('Profil fotoğrafı güncellendi')
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    fetchProfile(user.id)
  }

  async function deletePost(postId) {
    if (!window.confirm('Bu gönderiyi silmek istiyor musun?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id)
    if (!error) { setPosts(prev => prev.filter(p => p.id !== postId)); toast.success('Gönderi silindi') }
    else toast.error('Silme hatası')
  }

  const currentItems = tab === 'posts' ? posts : tab === 'reposts' ? reposts : liked

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
  if (!profile) return (
    <div className="text-center py-20 text-gray-500"><p className="text-4xl mb-2">😕</p><p>Kullanıcı bulunamadı</p></div>
  )

  // Engelleme ekranı
  if (!isMe && profile && allBlockedIds.has(profile.id)) {
    const iBlockedThem = blockedIds.has(profile.id)
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">
        <Shield className="w-14 h-14 mx-auto mb-4 text-gray-600" />
        <p className="text-lg font-semibold text-gray-300 mb-2">
          {iBlockedThem ? 'Bu kullanıcıyı engellediniz' : 'Bu içeriği görüntüleyemezsiniz'}
        </p>
        <p className="text-sm text-gray-600 mb-6">
          {iBlockedThem
            ? 'Engeli kaldırana kadar profil ve gönderiler gizlenir.'
            : 'Bu kullanıcı sizi engelledi.'}
        </p>
        {iBlockedThem && (
          <button onClick={toggleBlock} className="btn-ghost text-sm">Engeli Kaldır</button>
        )}
      </div>
    )
  }

  // Follow butonu metni
  const followBtnLabel = followStatus === 'accepted'
    ? <><UserMinus className="w-4 h-4" />Takibi Bırak</>
    : followStatus === 'pending'
    ? <><Clock className="w-4 h-4" />İstek Gönderildi</>
    : <><UserPlus className="w-4 h-4" />Takip Et</>

  const followBtnClass = followStatus === 'accepted'
    ? 'bg-white/10 hover:bg-red-500/10 hover:text-red-400 text-gray-300'
    : followStatus === 'pending'
    ? 'bg-yellow-500/10 text-yellow-400'
    : 'btn-primary'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8" onClick={() => showMenu && setShowMenu(false)}>
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-brand-800 overflow-hidden flex items-center justify-center text-2xl font-bold text-brand-200">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (profile.display_name || profile.username)?.[0]?.toUpperCase()}
            </div>
            {isMe && (
              <label className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full p-1.5 cursor-pointer hover:bg-brand-600 transition-colors z-10">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </label>
            )}
            {!isMe && onlineUsers.has(profile.id) && profile.show_online_status !== false && (
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0d0d1a]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0 flex-1">
                {editMode ? (
                  <div className="space-y-2">
                    <input className="input text-sm" placeholder="Görünen ad"
                      value={editData.display_name} onChange={e => setEditData(d => ({ ...d, display_name: e.target.value }))} />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                      <input className="input text-sm pl-7" placeholder="kullaniciadi"
                        value={editData.username}
                        onChange={e => setEditData(d => ({ ...d, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
                    </div>
                    <textarea className="input text-sm resize-none" rows={2} placeholder="Biyografi..."
                      value={editData.bio} onChange={e => setEditData(d => ({ ...d, bio: e.target.value }))} />

                    {/* Gizlilik Ayarları */}
                    <div className="border border-[#2a2a3f] rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Gizlilik</p>
                      <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer select-none">
                        <span className="text-xs">Çevrimiçi durumumu göster</span>
                        <input type="checkbox" checked={!!editData.show_online_status} className="ml-2 accent-brand-500"
                          onChange={e => setEditData(d => ({ ...d, show_online_status: e.target.checked }))} />
                      </label>
                      {editSettings && [
                        { key: 'is_private',          label: 'Gizli hesap (takip isteği gönderilir)' },
                        { key: 'show_liked_posts',    label: 'Beğendiklerimi göster' },
                        { key: 'allow_dm',            label: 'Mesaj almaya izin ver' },
                        { key: 'show_read_receipts',  label: 'Okundu bilgisi gönder' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center justify-between text-sm text-gray-300 cursor-pointer select-none">
                          <span className="text-xs">{label}</span>
                          <input type="checkbox" checked={!!editSettings[key]} className="ml-2 accent-brand-500"
                            onChange={e => setEditSettings(s => ({ ...s, [key]: e.target.checked }))} />
                        </label>
                      ))}
                      {editSettings && (
                        <button onClick={saveSettings} className="btn-ghost text-xs px-2 py-1 mt-1">Ayarları Kaydet</button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={saveProfile} disabled={saving}
                        className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Kaydet
                      </button>
                      <button onClick={() => setEditMode(false)} className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1">
                        <X className="w-3 h-3" /> İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="font-bold text-xl flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{profile.display_name || profile.username}</span>
                      {profile.is_verified && <BadgeCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />}
                      {settings?.is_private && <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">Gizli</span>}
                    </h1>
                    <p className="text-gray-500 text-sm">@{profile.username}</p>
                    {profile.bio
                      ? <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>
                      : isMe && <p className="text-gray-600 text-sm mt-1 italic cursor-pointer hover:text-gray-400" onClick={() => setEditMode(true)}>Biyografi ekle...</p>
                    }
                  </>
                )}
              </div>

              {!editMode && (
                isMe ? (
                  <button onClick={() => setEditMode(true)}
                    className="btn-ghost text-sm flex-shrink-0 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Düzenle
                  </button>
                ) : user && (
                  <div className="flex gap-2 items-center flex-wrap">
                    <button onClick={toggleFollow}
                      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-medium transition-all ${followBtnClass}`}>
                      {followBtnLabel}
                    </button>
                    {settings?.allow_dm !== false && (
                      <Link to={`/messages/${profile.id}`}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-medium bg-white/10 hover:bg-brand-500/20 hover:text-brand-400 text-gray-300 transition-all">
                        <MessageSquare className="w-4 h-4" />
                      </Link>
                    )}
                    {/* 3 nokta menüsü */}
                    <div className="relative">
                      <button onClick={e => { e.stopPropagation(); setShowMenu(m => !m) }}
                        className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {showMenu && (
                        <div className="absolute right-0 top-9 bg-[#1a1a2e] border border-[#3a3a5c] rounded-xl shadow-xl z-20 min-w-[160px] py-1"
                          onClick={e => e.stopPropagation()}>
                          <button onClick={toggleBlock}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                              isBlocked ? 'text-gray-300 hover:bg-white/5' : 'text-red-400 hover:bg-red-500/10'
                            }`}>
                            {isBlocked ? <><ShieldOff className="w-4 h-4" /> Engeli Kaldır</> : <><Shield className="w-4 h-4" /> Engelle</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="flex gap-5 mt-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-white">{posts.length}</p>
                <p className="text-gray-500">Gönderi</p>
              </div>
              <button onClick={() => setFollowModal('followers')} className="text-center hover:opacity-70 transition-opacity">
                <p className="font-bold text-white">{profile.followers_count || 0}</p>
                <p className="text-gray-500">Takipçi</p>
              </button>
              <button onClick={() => setFollowModal('following')} className="text-center hover:opacity-70 transition-opacity">
                <p className="font-bold text-white">{profile.following_count || 0}</p>
                <p className="text-gray-500">Takip</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a3f] mb-4">
        {TABS.filter(t => t.id !== 'liked' || isMe || settings?.show_liked_posts !== false).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              tab === id ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400 hover:text-white'
            }`}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            <span className="text-xs text-gray-600 ml-0.5">
              ({id === 'posts' ? posts.length : id === 'reposts' ? reposts.length : liked.length})
            </span>
          </button>
        ))}
      </div>

      {currentItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-3xl mb-2">{tab === 'posts' ? '🎬' : tab === 'reposts' ? '🔁' : '❤️'}</p>
          <p className="text-sm">{tab === 'posts' ? 'Henüz gönderi yok' : tab === 'reposts' ? 'Henüz repost yok' : 'Henüz beğeni yok'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentItems.map(post => (
            <div key={post.id + (post._repost ? '_r' : post._liked ? '_l' : '')} className="relative">
              <GIFCard post={post} showRepostBadge={!!post._repost}
                onDelete={isMe && tab === 'posts' ? deletePost : undefined} />
            </div>
          ))}
        </div>
      )}

      {followModal && (
        <FollowModal profileId={profile.id} type={followModal}
          onClose={() => setFollowModal(null)} onCountChange={loadProfile} />
      )}
    </div>
  )
}
