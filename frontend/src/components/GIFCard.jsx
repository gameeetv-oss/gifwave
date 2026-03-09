import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { Heart, MessageCircle, Share2, Repeat2, MoreHorizontal, Pencil, Check, X, Loader2, Trash2, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import toast from 'react-hot-toast'
import CommentModal from './CommentModal'

export default function GIFCard({ post, onLikeToggle, showRepostBadge, onDelete }) {
  const { user, profile: myProfile } = useAuth()
  const { onlineUsers } = usePresence()
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likeCount, setLikeCount] = useState(post.likes_count || 0)
  const [commentCount, setCommentCount] = useState(post.comments_count || 0)
  const [reposted, setReposted] = useState(post.user_reposted || false)
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption || '')
  const [editOverlay, setEditOverlay] = useState(post.text_overlay || '')
  const [showOverlay, setShowOverlay] = useState(post.show_overlay || false)
  const [saving, setSaving] = useState(false)
  const [currentPost, setCurrentPost] = useState(post)

  useEffect(() => { setLiked(post.user_liked || false) }, [post.user_liked])
  useEffect(() => { setReposted(post.user_reposted || false) }, [post.user_reposted])

  const audioRef = useRef(null)
  const { ref: musicRef, inView: musicInView } = useInView({ threshold: 0.5 })
  const [audioSrc, setAudioSrc] = useState(null)
  const ytMusicId = currentPost.music_url ? getYouTubeId(currentPost.music_url) : null

  // Direkt ses dosyası (Supabase) için audioSrc ayarla; YouTube → iframe ile çalınır
  useEffect(() => {
    if (!currentPost.music_url || ytMusicId) return
    setAudioSrc(currentPost.music_url)
  }, [currentPost.id])

  // Direkt ses dosyası: görünüm alanına girince otomatik çal
  useEffect(() => {
    if (!audioRef.current || !audioSrc) return
    if (musicInView) audioRef.current.play().catch(() => {})
    else audioRef.current.pause()
  }, [musicInView, audioSrc])

  const isOwner = user?.id === post.user_id

  async function toggleLike() {
    if (!user) { toast.error('Beğenmek için giriş yap'); return }
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(n => newLiked ? n + 1 : n - 1)
    if (newLiked) {
      const { error } = await supabase.from('likes').insert({ user_id: user.id, post_id: post.id })
      if (error) { setLiked(false); setLikeCount(n => n - 1); return }
      if (post.user_id !== user.id) {
        supabase.from('notifications').insert({ user_id: post.user_id, type: 'like', from_user_id: user.id, post_id: post.id })
      }
    } else {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', post.id)
    }
    onLikeToggle?.()
  }

  async function toggleRepost() {
    if (!user) { toast.error('Repost için giriş yap'); return }
    const newReposted = !reposted
    setReposted(newReposted)
    setRepostCount(n => newReposted ? n + 1 : Math.max(0, n - 1))
    if (newReposted) {
      const { error } = await supabase.from('reposts').insert({ user_id: user.id, post_id: post.id })
      if (error) { setReposted(false); setRepostCount(n => Math.max(0, n - 1)); return }
      if (post.user_id !== user.id) {
        supabase.from('notifications').insert({ user_id: post.user_id, type: 'repost', from_user_id: user.id, post_id: post.id })
      }
      toast.success('Repost yapıldı!')
    } else {
      await supabase.from('reposts').delete().eq('user_id', user.id).eq('post_id', post.id)
      toast('Repost kaldırıldı')
    }
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('posts')
      .update({ caption: editCaption, text_overlay: editOverlay, show_overlay: showOverlay })
      .eq('id', post.id)
    if (!error) {
      setCurrentPost(p => ({ ...p, caption: editCaption, text_overlay: editOverlay, show_overlay: showOverlay }))
      setEditMode(false)
      toast.success('Gönderi güncellendi')
    } else toast.error('Güncelleme hatası')
    setSaving(false)
  }

  async function share() {
    const url = `${window.location.origin}/post/${post.id}`
    if (navigator.share) navigator.share({ title: currentPost.caption || 'GifWave', url })
    else { await navigator.clipboard.writeText(url); toast.success('Link kopyalandı!') }
  }

  async function handleDelete() {
    setShowMenu(false)
    onDelete?.(post.id)
  }

  function handleCommentOpen() {
    setShowComments(true)
  }

  function handleCommentClose(newCount) {
    setShowComments(false)
    if (typeof newCount === 'number') setCommentCount(newCount)
  }

  const avatarUrl = post.profiles?.avatar_url
  const username = post.profiles?.username || 'anonim'
  const displayName = post.profiles?.display_name || username

  return (
    <>
      <article className="card animate-fade-in overflow-hidden" onClick={() => showMenu && setShowMenu(false)}>
        {showRepostBadge && (
          <div className="flex items-center gap-1.5 px-4 pt-3 text-xs text-gray-500">
            <Repeat2 className="w-3.5 h-3.5" /> Repost edildi
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-3">
          <Link to={`/profile/${username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-800">
                {avatarUrl
                  ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-brand-200 text-sm font-bold">{username[0]?.toUpperCase()}</div>
                }
              </div>
              {onlineUsers.has(post.user_id) && (post.user_id === user?.id ? myProfile?.show_online_status !== false : post.profiles?.show_online_status !== false) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#12121e]" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm text-white flex items-center gap-1">
                {displayName}
                {post.profiles?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
              </p>
              <p className="text-xs text-gray-500">@{username} · {formatTime(post.created_at)}</p>
            </div>
          </Link>

          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowMenu(m => !m) }}
              className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-[#1a1a2e] border border-[#3a3a5c] rounded-xl shadow-xl z-20 min-w-[140px] py-1"
                onClick={e => e.stopPropagation()}>
                {isOwner && (
                  <>
                    <button onClick={() => { setEditMode(true); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                      <Pencil className="w-4 h-4" /> Düzenle
                    </button>
                    <button onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" /> Sil
                    </button>
                  </>
                )}
                <button onClick={() => { share(); setShowMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                  <Share2 className="w-4 h-4" /> Paylaş
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Düzenleme modu */}
        {editMode ? (
          <div className="px-4 pb-3 space-y-2">
            <input className="input text-sm" placeholder="Açıklama..." value={editCaption}
              onChange={e => setEditCaption(e.target.value)} />
            <input className="input text-sm" placeholder="GIF üzerine yazı (meme tarzı)..."
              value={editOverlay} onChange={e => setEditOverlay(e.target.value)} />
            {editOverlay && (
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={showOverlay} onChange={e => setShowOverlay(e.target.checked)} />
                GIF üzerinde göster
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving}
                className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Kaydet
              </button>
              <button onClick={() => setEditMode(false)} className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1">
                <X className="w-3 h-3" /> İptal
              </button>
            </div>
          </div>
        ) : currentPost.caption ? (
          <p className="px-4 pb-3 text-sm text-gray-300">
            {currentPost.caption}
            {currentPost.tags?.map(tag => (
              <Link key={tag} to={`/explore?tag=${tag}`} className="text-brand-400 ml-1">#{tag}</Link>
            ))}
          </p>
        ) : null}

        {/* GIF */}
        <div className="relative bg-black/30 min-h-[200px] flex items-center justify-center">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={currentPost.gif_url}
            alt={currentPost.caption || 'GIF'}
            className={`w-full max-h-[500px] object-contain transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
          {currentPost.show_overlay && currentPost.text_overlay && (
            <div className="absolute bottom-0 inset-x-0 bg-black/70 px-4 py-3 text-center">
              <p className="text-white font-bold text-lg leading-tight" style={{ textShadow: '2px 2px 4px black' }}>
                {currentPost.text_overlay}
              </p>
            </div>
          )}
        </div>

        {/* Music Player */}
        {currentPost.music_url && (
          <div ref={musicRef} className="px-4 pb-2">
            {ytMusicId ? (
              // YouTube → iframe embed (proxy gerektirmez, her zaman çalışır)
              <iframe
                src={`https://www.youtube.com/embed/${ytMusicId}?controls=1&modestbranding=1&rel=0`}
                className="w-full rounded-lg"
                style={{ height: '80px', border: 'none' }}
                allow="encrypted-media"
                loading="lazy"
              />
            ) : audioSrc ? (
              // Direkt ses dosyası (Supabase mp3 vb.)
              <audio ref={audioRef} src={audioSrc} loop controls
                className="w-full h-8" style={{ colorScheme: 'dark' }} />
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 px-3 py-3">
          <button onClick={toggleLike}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              liked ? 'text-red-400 bg-red-500/10' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
            }`}>
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>

          <button onClick={handleCommentOpen}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              commentCount > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10'
            }`}>
            <MessageCircle className={`w-5 h-5 ${commentCount > 0 ? 'fill-current opacity-30' : ''}`} />
            <span>{commentCount}</span>
          </button>

          <button onClick={toggleRepost}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              reposted ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
            }`}>
            <Repeat2 className="w-5 h-5" />
            <span>{repostCount}</span>
          </button>
        </div>
      </article>

      {showComments && (
        <CommentModal
          post={{ ...currentPost, comments_count: commentCount }}
          onClose={handleCommentClose}
        />
      )}
    </>
  )
}

function getYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v')
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    if (u.hostname.includes('music.youtube.com')) return u.searchParams.get('v')
  } catch { return null }
  return null
}

function formatTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m}dk`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}sa`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}g`
  return new Date(ts).toLocaleDateString('tr-TR')
}
