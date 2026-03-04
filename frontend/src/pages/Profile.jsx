import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Camera, Loader2, UserPlus, UserMinus, Heart, Repeat2, Grid3x3 } from 'lucide-react'
import GIFCard from '../components/GIFCard'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'posts', label: 'Gönderiler', icon: Grid3x3 },
  { id: 'reposts', label: 'Reposts', icon: Repeat2 },
  { id: 'liked', label: 'Beğendikleri', icon: Heart },
]

export default function Profile() {
  const { username } = useParams()
  const { user, profile: myProfile, fetchProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [reposts, setReposts] = useState([])
  const [liked, setLiked] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({ display_name: '', bio: '' })
  const [saving, setSaving] = useState(false)

  const isMe = user && myProfile?.username === username

  useEffect(() => { loadProfile() }, [username])

  async function loadProfile() {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).single()
    if (!prof) { setLoading(false); return }
    setProfile(prof)
    setEditData({ display_name: prof.display_name || '', bio: prof.bio || '' })

    const [postsRes, repostsRes, likedRes] = await Promise.all([
      supabase.from('posts')
        .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url)')
        .eq('user_id', prof.id)
        .order('created_at', { ascending: false }),
      supabase.from('reposts')
        .select('post_id, posts(*, profiles!fk_posts_profiles(username, display_name, avatar_url))')
        .eq('user_id', prof.id)
        .order('created_at', { ascending: false }),
      supabase.from('likes')
        .select('post_id, posts(*, profiles!fk_posts_profiles(username, display_name, avatar_url))')
        .eq('user_id', prof.id)
        .order('created_at', { ascending: false }),
    ])

    setPosts(postsRes.data || [])
    setReposts((repostsRes.data || []).map(r => ({ ...r.posts, _repost: true })).filter(Boolean))
    setLiked((likedRes.data || []).map(l => ({ ...l.posts, _liked: true })).filter(Boolean))

    if (user && !isMe) {
      const { data } = await supabase.from('follows')
        .select('follower_id').eq('follower_id', user.id).eq('following_id', prof.id).single()
      setIsFollowing(!!data)
    }
    setLoading(false)
  }

  async function toggleFollow() {
    if (!user) { toast.error('Giriş yap'); return }
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.id)
      await supabase.from('profiles').update({ followers_count: Math.max(0, profile.followers_count - 1) }).eq('id', profile.id)
      await supabase.from('profiles').update({ following_count: Math.max(0, myProfile.following_count - 1) }).eq('id', user.id)
      setIsFollowing(false)
      setProfile(p => ({ ...p, followers_count: Math.max(0, p.followers_count - 1) }))
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id })
      await supabase.from('profiles').update({ followers_count: (profile.followers_count || 0) + 1 }).eq('id', profile.id)
      await supabase.from('profiles').update({ following_count: (myProfile.following_count || 0) + 1 }).eq('id', user.id)
      await supabase.from('notifications').insert({ user_id: profile.id, type: 'follow', from_user_id: user.id })
      setIsFollowing(true)
      setProfile(p => ({ ...p, followers_count: (p.followers_count || 0) + 1 }))
    }
  }

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ bio: editData.bio, display_name: editData.display_name })
      .eq('id', user.id)
    if (!error) {
      toast.success('Profil güncellendi')
      setEditMode(false)
      setProfile(p => ({ ...p, ...editData }))
      fetchProfile(user.id)
    } else toast.error('Hata oluştu')
    setSaving(false)
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

  const currentPosts = tab === 'posts' ? posts : tab === 'reposts' ? reposts : liked

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
  if (!profile) return <div className="text-center py-20 text-gray-500">Kullanıcı bulunamadı</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Profil başlığı */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-brand-800 overflow-hidden flex items-center justify-center text-2xl font-bold text-brand-200">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : profile.username?.[0]?.toUpperCase()}
            </div>
            {isMe && (
              <label className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full p-1.5 cursor-pointer hover:bg-brand-600 transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </label>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {editMode ? (
                  <div className="space-y-2">
                    <input className="input text-sm" placeholder="Görünen ad" value={editData.display_name}
                      onChange={e => setEditData(d => ({ ...d, display_name: e.target.value }))} />
                    <textarea className="input text-sm resize-none" rows={3} placeholder="Biyografi..."
                      value={editData.bio} onChange={e => setEditData(d => ({ ...d, bio: e.target.value }))} />
                    <div className="flex gap-2">
                      <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm px-3 py-1.5">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kaydet'}
                      </button>
                      <button onClick={() => setEditMode(false)} className="btn-ghost text-sm px-3 py-1.5">İptal</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="font-bold text-xl truncate">{profile.display_name || profile.username}</h1>
                    <p className="text-gray-500 text-sm">@{profile.username}</p>
                    {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
                  </>
                )}
              </div>

              {!editMode && (
                isMe ? (
                  <button onClick={() => setEditMode(true)} className="btn-ghost text-sm flex-shrink-0">Düzenle</button>
                ) : user && (
                  <button onClick={toggleFollow}
                    className={`flex items-center gap-1.5 text-sm flex-shrink-0 ${isFollowing ? 'btn-ghost' : 'btn-primary'}`}>
                    {isFollowing ? <><UserMinus className="w-4 h-4" />Takibi Bırak</> : <><UserPlus className="w-4 h-4" />Takip Et</>}
                  </button>
                )
              )}
            </div>

            <div className="flex gap-5 mt-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-white">{posts.length}</p>
                <p className="text-gray-500">Gönderi</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-white">{profile.followers_count || 0}</p>
                <p className="text-gray-500">Takipçi</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-white">{profile.following_count || 0}</p>
                <p className="text-gray-500">Takip</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a3f] mb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              tab === id ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400 hover:text-white'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {currentPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-3xl mb-2">
            {tab === 'posts' ? '🎬' : tab === 'reposts' ? '🔁' : '❤️'}
          </p>
          <p className="text-sm">
            {tab === 'posts' ? 'Henüz gönderi yok' : tab === 'reposts' ? 'Henüz repost yok' : 'Henüz beğeni yok'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentPosts.map(post => (
            <GIFCard key={post.id + (post._repost ? '_r' : '')} post={post} showRepostBadge={post._repost} />
          ))}
        </div>
      )}
    </div>
  )
}
