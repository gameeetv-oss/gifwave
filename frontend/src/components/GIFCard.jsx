import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { Heart, MessageCircle, Share2, Repeat2, MoreHorizontal, Pencil, Check, X, Loader2, Trash2, BadgeCheck, Play, Pause, Music, ExternalLink, VolumeX, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import toast from 'react-hot-toast'
import CommentModal from './CommentModal'

const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0

function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (window._ytApiPromise) return window._ytApiPromise
  window._ytApiPromise = new Promise(resolve => {
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
    window.onYouTubeIframeAPIReady = resolve
  })
  return window._ytApiPromise
}

export default function GIFCard({ post, onDelete }) {
  const { user, profile: myProfile } = useAuth()
  const { onlineUsers } = usePresence()
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likeCount, setLikeCount] = useState(post.likes_count || 0)
  const [commentCount, setCommentCount] = useState(post.comments_count || 0)
  const [reposted, setReposted] = useState(post.user_reposted || false)
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption || '')
  const [editOverlay, setEditOverlay] = useState(() => {
    try { const p = JSON.parse(post.text_overlay || ''); return p.text || '' } catch { return post.text_overlay || '' }
  })
  const [showOverlay, setShowOverlay] = useState(post.show_overlay || false)
  const [saving, setSaving] = useState(false)
  const [currentPost, setCurrentPost] = useState(post)
  const [captionExpanded, setCaptionExpanded] = useState(false)

  useEffect(() => { setLiked(post.user_liked || false) }, [post.user_liked])
  useEffect(() => { setReposted(post.user_reposted || false) }, [post.user_reposted])

  // ── Müzik ──────────────────────────────────────────────────
  const audioRef = useRef(null)
  const ytContainerRef = useRef(null)
  const ytPlayerRef = useRef(null)
  const userStartedRef = useRef(false)
  const { ref: musicRef, inView: musicInView } = useInView({ threshold: 0.3 })
  const ytMusicId = currentPost.music_url ? getYouTubeId(currentPost.music_url) : null
  const [ytReady, setYtReady] = useState(false)
  const [ytPlaying, setYtPlaying] = useState(false)
  const [ytTitle, setYtTitle] = useState('YouTube Müziği')
  const [ytMounted, setYtMounted] = useState(false)
  const [audioSrc, setAudioSrc] = useState(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => {
    if (musicInView && ytMusicId && !ytMounted) setYtMounted(true)
  }, [musicInView, ytMusicId])

  useEffect(() => {
    if (!ytMusicId) return
    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${ytMusicId}&format=json`)
      .then(r => r.json()).then(d => { if (d.title) setYtTitle(d.title) }).catch(() => {})
  }, [ytMusicId])

  useEffect(() => {
    if (!ytMounted || !ytMusicId || !ytContainerRef.current) return
    let player
    loadYTApi().then(() => {
      if (!ytContainerRef.current) return
      player = new window.YT.Player(ytContainerRef.current, {
        width: '200', height: '112', videoId: ytMusicId,
        playerVars: { autoplay: isMobile ? 0 : 1, mute: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { ytPlayerRef.current = player; setYtReady(true) },
          onStateChange: (e) => { setYtPlaying(e.data === 1) },
        },
      })
    })
    return () => {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy() } catch {}
        ytPlayerRef.current = null; setYtReady(false); setYtPlaying(false)
      }
    }
  }, [ytMounted, ytMusicId])

  useEffect(() => {
    const p = ytPlayerRef.current
    if (!ytReady || !p) return
    if (musicInView) {
      try { p.unMute(); p.setVolume(100); p.playVideo() } catch {}
      setYtPlaying(true)
      setNeedsTap(false)
    } else {
      try { p.mute(); p.pauseVideo() } catch {}
      setYtPlaying(false)
    }
  }, [musicInView, ytReady])

  function toggleYt() {
    const p = ytPlayerRef.current
    if (!p) return
    userStartedRef.current = true
    setNeedsTap(false)
    if (ytPlaying) {
      try { p.mute(); p.pauseVideo() } catch {}; setYtPlaying(false)
    } else {
      try { p.unMute(); p.setVolume(100); p.playVideo() } catch {}; setYtPlaying(true)
    }
  }

  useEffect(() => {
    if (!currentPost.music_url || ytMusicId) return
    setAudioSrc(currentPost.music_url)
  }, [currentPost.id])

  useEffect(() => {
    if (!audioRef.current || !audioSrc) return
    if (musicInView) {
      audioRef.current.play().then(() => {
        setAudioPlaying(true)
        setNeedsTap(false)
      }).catch(() => {
        // WebView autoplay bloke ediyorsa tap göster
        setNeedsTap(true)
      })
    } else {
      audioRef.current.pause()
      setAudioPlaying(false)
      setNeedsTap(false)
    }
  }, [musicInView, audioSrc])

  function toggleAudio() {
    if (!audioRef.current) return
    if (audioPlaying) {
      audioRef.current.pause()
      setAudioPlaying(false)
    } else {
      audioRef.current.play().then(() => {
        setAudioPlaying(true)
        setNeedsTap(false)
      }).catch(() => {})
    }
  }
  // ───────────────────────────────────────────────────────────

  const isOwner = user?.id === post.user_id
  const avatarUrl = post.profiles?.avatar_url
  const username = post.profiles?.username || 'anonim'
  const displayName = post.profiles?.display_name || username

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

  function handleCommentClose(newCount) {
    setShowComments(false)
    if (typeof newCount === 'number') setCommentCount(newCount)
  }

  const caption = currentPost.caption || ''
  const isLongCaption = caption.length > 80

  return (
    <>
      <div
        className="relative h-full w-full bg-black overflow-hidden"
        onClick={() => showMenu && setShowMenu(false)}
        ref={musicRef}
      >
        {/* GIF - tam ekran arka plan */}
        <img
          src={currentPost.gif_url}
          alt={currentPost.caption || 'GIF'}
          className="absolute inset-0 w-full h-full object-contain"
          loading="lazy"
        />

        {/* Metin overlay */}
        {currentPost.show_overlay && currentPost.text_overlay && (() => {
          let ov = { text: currentPost.text_overlay, size: 26, color: '#ffffff', pos: 'top', bold: true }
          try { const p = JSON.parse(currentPost.text_overlay); if (p.text) ov = p } catch {}
          const posClass = ov.pos === 'center' ? 'top-1/2 -translate-y-1/2' : ov.pos === 'bottom' ? 'bottom-20' : 'top-14'
          return (
            <div className={`absolute inset-x-0 ${posClass} px-4 text-center z-10 pointer-events-none`}>
              <p style={{ fontSize: ov.size, color: ov.color, fontWeight: ov.bold ? 800 : 400,
                textShadow: '0 2px 10px rgba(0,0,0,0.95)', WebkitTextStroke: ov.bold ? '0.5px rgba(0,0,0,0.4)' : 'none' }}
                className="leading-tight">
                {ov.text}
              </p>
            </div>
          )
        })()}

        {/* Alt gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {/* Sol alt: kullanıcı + açıklama + müzik */}
        <div className="absolute bottom-20 left-4 right-20 z-10">
          <Link to={`/profile/${username}`} className="flex items-center gap-2 mb-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-800 ring-2 ring-white/30">
                {avatarUrl
                  ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white font-bold">{username[0]?.toUpperCase()}</div>
                }
              </div>
              {onlineUsers.has(post.user_id) && (post.user_id === user?.id ? myProfile?.show_online_status !== false : post.profiles?.show_online_status !== false) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white font-bold text-sm drop-shadow">{displayName}</span>
              {post.profiles?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />}
            </div>
          </Link>

          {caption && (
            <div className="mb-2">
              <p className="text-white text-sm leading-snug drop-shadow">
                {isLongCaption && !captionExpanded ? caption.slice(0, 80) + '...' : caption}
                {currentPost.tags?.map(tag => (
                  <Link key={tag} to={`/explore?tag=${tag}`} className="text-brand-300 ml-1">#{tag}</Link>
                ))}
              </p>
              {isLongCaption && (
                <button onClick={() => setCaptionExpanded(e => !e)} className="text-white/60 text-xs mt-0.5">
                  {captionExpanded ? 'Daha az' : 'Devamı'}
                </button>
              )}
            </div>
          )}

          {/* Müzik */}
          {currentPost.music_url && (
            <div>
              {ytMounted && (
                <div ref={ytContainerRef}
                  style={{ position: 'fixed', left: '-400px', top: '50%', width: '200px', height: '112px', pointerEvents: 'none' }} />
              )}
              {ytMusicId ? (
                <button onClick={toggleYt}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1.5 w-fit">
                  {needsTap
                    ? <VolumeX className="w-3.5 h-3.5 text-white animate-pulse" />
                    : ytPlaying
                    ? <Pause className="w-3.5 h-3.5 text-white" />
                    : <Play className="w-3.5 h-3.5 text-white fill-white" />}
                  <Music className={`w-3.5 h-3.5 text-white ${ytPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                  <span className="text-white text-xs max-w-[160px] truncate">{needsTap ? 'Sese dokun' : ytTitle}</span>
                  {!ytReady && <Loader2 className="w-3 h-3 text-white/60 animate-spin" />}
                </button>
              ) : audioSrc ? (
                <>
                  <audio ref={audioRef} src={audioSrc} loop className="hidden" />
                  <button onClick={toggleAudio}
                    className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1.5 w-fit">
                    {needsTap
                      ? <VolumeX className="w-3.5 h-3.5 text-white animate-pulse" />
                      : audioPlaying
                      ? <Pause className="w-3.5 h-3.5 text-white" />
                      : <Play className="w-3.5 h-3.5 text-white fill-white" />}
                    <Music className={`w-3.5 h-3.5 text-white ${audioPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                    <span className="text-white text-xs">{needsTap ? 'Sese dokun' : audioPlaying ? 'Çalıyor' : 'Oynat'}</span>
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Sağ: aksiyon butonları dikey - TikTok stili */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">
          {/* Profil avatar */}
          <Link to={`/profile/${username}`} className="relative mb-2">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-800 ring-2 ring-white">
              {avatarUrl
                ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white font-bold">{username[0]?.toUpperCase()}</div>
              }
            </div>
          </Link>

          {/* Like */}
          <button onClick={toggleLike} className="flex flex-col items-center gap-1">
            <Heart className={`w-8 h-8 drop-shadow-lg transition-transform active:scale-125 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            <span className="text-white text-xs font-semibold drop-shadow">{likeCount}</span>
          </button>

          {/* Comment */}
          <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
            <MessageCircle className="w-8 h-8 text-white drop-shadow-lg active:scale-110 transition-transform" />
            <span className="text-white text-xs font-semibold drop-shadow">{commentCount}</span>
          </button>

          {/* Repost */}
          <button onClick={toggleRepost} className="flex flex-col items-center gap-1">
            <Repeat2 className={`w-8 h-8 drop-shadow-lg transition-transform active:scale-110 ${reposted ? 'text-green-400' : 'text-white'}`} />
            <span className="text-white text-xs font-semibold drop-shadow">{repostCount}</span>
          </button>

          {/* Share */}
          <button onClick={share} className="flex flex-col items-center gap-1">
            <Share2 className="w-7 h-7 text-white drop-shadow-lg active:scale-110 transition-transform" />
            <span className="text-white text-xs font-semibold drop-shadow">Paylaş</span>
          </button>

          {/* More */}
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setShowMenu(m => !m) }}>
              <MoreHorizontal className="w-7 h-7 text-white drop-shadow-lg" />
            </button>
            {showMenu && (
              <div className="absolute right-8 bottom-0 bg-[#1a1a2e] border border-[#3a3a5c] rounded-xl shadow-2xl min-w-[150px] py-1 z-30"
                onClick={e => e.stopPropagation()}>
                {isOwner && (
                  <>
                    <button onClick={() => { setEditMode(true); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                      <Pencil className="w-4 h-4" /> Düzenle
                    </button>
                    <button onClick={() => { setShowMenu(false); onDelete?.(post.id) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" /> Sil
                    </button>
                  </>
                )}
                <button onClick={() => { share(); setShowMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                  <Share2 className="w-4 h-4" /> Paylaş
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Düzenleme modu overlay */}
        {editMode && (
          <div className="absolute inset-0 bg-black/80 z-30 flex items-end">
            <div className="w-full p-4 space-y-3">
              <input className="input text-sm w-full" placeholder="Açıklama..." value={editCaption}
                onChange={e => setEditCaption(e.target.value)} />
              <input className="input text-sm w-full" placeholder="GIF üzerine yazı (meme tarzı)..."
                value={editOverlay} onChange={e => setEditOverlay(e.target.value)} />
              {editOverlay && (
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={showOverlay} onChange={e => setShowOverlay(e.target.checked)} />
                  GIF üzerinde göster
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Kaydet
                </button>
                <button onClick={() => setEditMode(false)} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1">
                  <X className="w-3 h-3" /> İptal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
