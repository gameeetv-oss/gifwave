import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { Heart, MessageCircle, Share2, Repeat2, MoreHorizontal, Pencil, Check, X, Loader2, Trash2, BadgeCheck, Play, Pause, Music, ExternalLink, VolumeX, Volume2, Crown, Flag, Languages, Bookmark, Smile } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import toast from 'react-hot-toast'
import CommentModal from './CommentModal'
import ReportModal from './ReportModal'
import { playGlobalAudio, stopGlobalAudio, getCurrentUrl, isPlaying } from '../lib/globalAudio'
import { useTranslation } from 'react-i18next'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gifwave-backend.onrender.com'

export default function GIFCard({ post, onDelete }) {
  const { user, profile: myProfile } = useAuth()
  const { onlineUsers } = usePresence()
  const { t, i18n } = useTranslation()
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likeCount, setLikeCount] = useState(post.likes_count || 0)
  const [commentCount, setCommentCount] = useState(post.comments_count || 0)
  const [reposted, setReposted] = useState(post.user_reposted || false)
  const [repostCount, setRepostCount] = useState(post.reposts_count || 0)
  const [reactionCount, setReactionCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [collections, setCollections] = useState([])
  const [savedCollectionIds, setSavedCollectionIds] = useState(new Set())
  const [newColName, setNewColName] = useState('')
  const [creatingCol, setCreatingCol] = useState(false)
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption || '')
  const [editOverlay, setEditOverlay] = useState(() => {
    try { const p = JSON.parse(post.text_overlay || ''); return p.text || '' } catch { return post.text_overlay || '' }
  })
  const [showOverlay, setShowOverlay] = useState(post.show_overlay || false)
  const [saving, setSaving] = useState(false)
  const [currentPost, setCurrentPost] = useState(post)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translatedCaption, setTranslatedCaption] = useState(null)
  const [sourceLanguage, setSourceLanguage] = useState(null)
  const [showTranslated, setShowTranslated] = useState(false)

  useEffect(() => { setLiked(post.user_liked || false) }, [post.user_liked])
  useEffect(() => { setReposted(post.user_reposted || false) }, [post.user_reposted])

  useEffect(() => {
    supabase.from('reactions').select('id', { count: 'exact', head: true }).eq('post_id', post.id)
      .then(({ count }) => { if (count != null) setReactionCount(count) })
  }, [post.id])

  // ── Müzik ──────────────────────────────────────────────────
  // YouTube iframe yok: eski YouTube linkli postlar backend /music/proxy
  // üzerinden, diğerleri direkt URL ile HTML5 Audio (globalAudio) çalar.
  const { ref: musicRef, inView: musicInView } = useInView({ threshold: 0.6 })
  const ytMusicId = currentPost.music_url ? getYouTubeId(currentPost.music_url) : null
  const audioSrc = currentPost.music_url
    ? (ytMusicId ? `${BACKEND}/music/proxy?url=${encodeURIComponent(currentPost.music_url)}` : currentPost.music_url)
    : null
  const [musicTitle, setMusicTitle] = useState(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => {
    if (!ytMusicId) { setMusicTitle(null); return }
    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${ytMusicId}&format=json`)
      .then(r => r.json()).then(d => { if (d.title) setMusicTitle(d.title) }).catch(() => {})
  }, [ytMusicId])

  useEffect(() => {
    if (!audioSrc) return
    if (musicInView) {
      playGlobalAudio(audioSrc).then(() => {
        setAudioPlaying(true)
        setNeedsTap(false)
      }).catch(() => {
        setNeedsTap(true)
      })
    } else {
      if (getCurrentUrl() === audioSrc) {
        stopGlobalAudio()
        setAudioPlaying(false)
      }
    }
  }, [musicInView, audioSrc])

  useEffect(() => {
    if (!audioSrc) return
    const iv = setInterval(() => {
      setAudioPlaying(getCurrentUrl() === audioSrc && isPlaying())
    }, 500)
    return () => clearInterval(iv)
  }, [audioSrc])

  // İlk dokunuşla ses kilidi açılınca ekrandaki müziği hemen başlat
  useEffect(() => {
    if (!audioSrc) return
    function onUnlock() {
      if (!musicInView || isPlaying()) return
      playGlobalAudio(audioSrc).then(() => {
        setAudioPlaying(true)
        setNeedsTap(false)
      }).catch(() => {})
    }
    window.addEventListener('gifwave-audio-unlocked', onUnlock)
    return () => window.removeEventListener('gifwave-audio-unlocked', onUnlock)
  }, [musicInView, audioSrc])

  function toggleAudio() {
    if (!audioSrc) return
    if (audioPlaying) {
      stopGlobalAudio()
      setAudioPlaying(false)
    } else {
      playGlobalAudio(audioSrc).then(() => {
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
    if (!user) { toast.error(t('gifcard.loginToLike')); return }
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
    if (!user) { toast.error(t('gifcard.loginToRepost')); return }
    const newReposted = !reposted
    setReposted(newReposted)
    setRepostCount(n => newReposted ? n + 1 : Math.max(0, n - 1))
    if (newReposted) {
      const { error } = await supabase.from('reposts').insert({ user_id: user.id, post_id: post.id })
      if (error) { setReposted(false); setRepostCount(n => Math.max(0, n - 1)); return }
      if (post.user_id !== user.id) {
        supabase.from('notifications').insert({ user_id: post.user_id, type: 'repost', from_user_id: user.id, post_id: post.id })
      }
      toast.success(t('gifcard.reposted'))
    } else {
      await supabase.from('reposts').delete().eq('user_id', user.id).eq('post_id', post.id)
      toast(t('gifcard.repostRemoved'))
    }
  }

  async function saveEdit() {
    setSaving(true)
    const { data: updated, error } = await supabase.from('posts')
      .update({ caption: editCaption, text_overlay: editOverlay, show_overlay: showOverlay })
      .eq('id', post.id)
      .select('id')
      .single()
    if (!error && updated) {
      setCurrentPost(p => ({ ...p, caption: editCaption, text_overlay: editOverlay, show_overlay: showOverlay }))
      setEditMode(false)
      toast.success(t('gifcard.postUpdated'))
    } else toast.error(t('gifcard.updateError'))
    setSaving(false)
  }

  async function share() {
    const url = `${window.location.origin}/post/${post.id}`
    if (navigator.share) navigator.share({ title: currentPost.caption || 'GifWave', url })
    else { await navigator.clipboard.writeText(url); toast.success(t('gifcard.linkCopied')) }
  }

  async function translateCaption() {
    if (showTranslated) { setShowTranslated(false); return }
    if (translatedCaption) { setShowTranslated(true); return }
    setTranslating(true)
    try {
      const target = i18n.language?.split('-')[0] || 'tr'
      const res = await fetch(`${BACKEND}/translate?text=${encodeURIComponent(caption)}&target=${target}`)
      const data = await res.json()
      if (data.same_language) { toast(t('gifcard.alreadyInYourLanguage')); setTranslating(false); return }
      if (data.translated.trim().toLowerCase() === caption.trim().toLowerCase()) {
        toast(t('gifcard.alreadyInYourLanguage')); setTranslating(false); return
      }
      setTranslatedCaption(data.translated)
      setSourceLanguage(data.source && data.source !== 'und'
        ? (i18n.language?.startsWith('tr') ? data.source_name_tr : data.source_name_en)
        : null)
      setShowTranslated(true)
    } catch {
      toast.error(t('gifcard.translateError'))
    }
    setTranslating(false)
  }

  async function openSaveModal() {
    if (!user) { toast.error(t('collections.loginRequired')); return }
    setShowSaveModal(true)
    setLoadingCollections(true)
    const [colRes, itemRes] = await Promise.all([
      supabase.from('collections').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('collection_items').select('collection_id').eq('user_id', user.id).eq('post_id', post.id),
    ])
    setCollections(colRes.data || [])
    setSavedCollectionIds(new Set((itemRes.data || []).map(i => i.collection_id)))
    setLoadingCollections(false)
  }

  async function toggleSaveToCollection(collectionId) {
    if (!user) return
    if (savedCollectionIds.has(collectionId)) {
      await supabase.from('collection_items').delete()
        .eq('collection_id', collectionId).eq('post_id', post.id).eq('user_id', user.id)
      setSavedCollectionIds(s => { const n = new Set(s); n.delete(collectionId); return n })
      toast(t('collections.removed'))
    } else {
      await supabase.from('collection_items').insert({ collection_id: collectionId, post_id: post.id, user_id: user.id })
      setSavedCollectionIds(s => new Set([...s, collectionId]))
      toast.success(t('collections.saved'))
    }
  }

  async function createCollection() {
    if (!newColName.trim() || !user) return
    setCreatingCol(true)
    const { data, error } = await supabase.from('collections')
      .insert({ user_id: user.id, name: newColName.trim() })
      .select().single()
    if (!error && data) {
      setCollections(c => [data, ...c])
      setNewColName('')
      await supabase.from('collection_items').insert({ collection_id: data.id, post_id: post.id, user_id: user.id })
      setSavedCollectionIds(s => new Set([...s, data.id]))
      toast.success(t('collections.saved'))
    }
    setCreatingCol(false)
  }

  const isBookmarked = savedCollectionIds.size > 0

  function handleCommentClose(newCount) {
    setShowComments(false)
    if (typeof newCount === 'number') setCommentCount(newCount)
    supabase.from('reactions').select('id', { count: 'exact', head: true }).eq('post_id', post.id)
      .then(({ count }) => { if (count != null) setReactionCount(count) })
  }

  const caption = currentPost.caption || ''
  const isLongCaption = caption.length > 80

  // Otomatik çeviri: post ekrana gelince caption UI dilinden farklıysa çevir
  const autoTranslateRef = useRef(false)
  useEffect(() => {
    if (!musicInView || autoTranslateRef.current || !caption.trim() || caption.trim().length < 3) return
    autoTranslateRef.current = true
    ;(async () => {
      try {
        const target = i18n.language?.split('-')[0] || 'tr'
        const res = await fetch(`${BACKEND}/translate?text=${encodeURIComponent(caption)}&target=${target}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.same_language || !data.translated) return
        if (data.translated.trim().toLowerCase() === caption.trim().toLowerCase()) return
        setTranslatedCaption(data.translated)
        setSourceLanguage(data.source && data.source !== 'und'
          ? (i18n.language?.startsWith('tr') ? data.source_name_tr : data.source_name_en)
          : null)
        setShowTranslated(true)
      } catch {}
    })()
  }, [musicInView])

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
          onError={e => { e.currentTarget.style.opacity = '0.15'; e.currentTarget.src = '/gifwave_icon_1024.png' }}
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
        <div className="absolute left-4 right-20 z-10" style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom))' }}>
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
              {post.profiles?.is_premium && (!post.profiles?.premium_until || new Date(post.profiles.premium_until) > new Date()) && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
            </div>
          </Link>

          {caption && (
            <div className="mb-2">
              <p className="text-white text-sm leading-snug drop-shadow">
                {isLongCaption && !captionExpanded
                  ? (showTranslated ? translatedCaption : caption).slice(0, 80) + '...'
                  : (showTranslated ? translatedCaption : caption)}
                {currentPost.tags?.map(tag => (
                  <Link key={tag} to={`/explore?tag=${tag}`} className="text-brand-300 ml-1">#{tag}</Link>
                ))}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {isLongCaption && (
                  <button onClick={() => setCaptionExpanded(e => !e)} className="text-white/60 text-xs">
                    {captionExpanded ? t('gifcard.less') : t('gifcard.more')}
                  </button>
                )}
                <button onClick={translateCaption} disabled={translating}
                  className="flex items-center gap-1 text-white/50 text-xs hover:text-white/80 transition-colors">
                  {translating
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Languages className="w-3 h-3" />}
                  {showTranslated ? t('gifcard.seeOriginal') : t('gifcard.translate')}
                </button>
                {showTranslated && sourceLanguage && (
                  <span className="text-white/40 text-xs">{t('gifcard.translatedFrom', { lang: sourceLanguage })}</span>
                )}
              </div>
            </div>
          )}

          {/* Müzik */}
          {audioSrc && (
            <button onClick={toggleAudio}
              className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1.5 w-fit">
              {needsTap
                ? <VolumeX className="w-3.5 h-3.5 text-white animate-pulse" />
                : audioPlaying
                ? <Pause className="w-3.5 h-3.5 text-white" />
                : <Play className="w-3.5 h-3.5 text-white fill-white" />}
              <Music className={`w-3.5 h-3.5 text-white ${audioPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              <span className="text-white text-xs max-w-[160px] truncate">
                {needsTap ? t('gifcard.tapForSound') : musicTitle || (audioPlaying ? t('gifcard.playing') : t('gifcard.play'))}
              </span>
            </button>
          )}
        </div>

        {/* Sağ: aksiyon butonları dikey - TikTok stili */}
        <div className="absolute right-3 flex flex-col items-center gap-5 z-10" style={{ bottom: 'calc(8rem + env(safe-area-inset-bottom))' }}>
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

          {/* Reactions */}
          <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
            <Smile className="w-8 h-8 text-white drop-shadow-lg active:scale-110 transition-transform" />
            <span className="text-white text-xs font-semibold drop-shadow">{reactionCount > 0 ? reactionCount : t('reactions.react')}</span>
          </button>

          {/* Repost */}
          <button onClick={toggleRepost} className="flex flex-col items-center gap-1">
            <Repeat2 className={`w-8 h-8 drop-shadow-lg transition-transform active:scale-110 ${reposted ? 'text-green-400' : 'text-white'}`} />
            <span className="text-white text-xs font-semibold drop-shadow">{repostCount}</span>
          </button>

          {/* Share */}
          <button onClick={share} className="flex flex-col items-center gap-1">
            <Share2 className="w-7 h-7 text-white drop-shadow-lg active:scale-110 transition-transform" />
            <span className="text-white text-xs font-semibold drop-shadow">{t('gifcard.share')}</span>
          </button>

          {/* Bookmark */}
          <button onClick={openSaveModal} className="flex flex-col items-center gap-1">
            <Bookmark className={`w-7 h-7 drop-shadow-lg active:scale-110 transition-transform ${isBookmarked ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
            <span className="text-white text-xs font-semibold drop-shadow">{t('collections.save')}</span>
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
                      <Pencil className="w-4 h-4" /> {t('gifcard.edit')}
                    </button>
                    <button onClick={() => { setShowMenu(false); onDelete?.(post.id) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" /> {t('gifcard.delete')}
                    </button>
                  </>
                )}
                <button onClick={() => { share(); setShowMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                  <Share2 className="w-4 h-4" /> {t('gifcard.share')}
                </button>
                {!isOwner && (
                  <button onClick={() => { setShowMenu(false); setShowReport(true) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                    <Flag className="w-4 h-4" /> {t('gifcard.report')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Düzenleme modu overlay */}
        {editMode && (
          <div className="absolute inset-0 bg-black/80 z-30 flex items-end">
            <div className="w-full p-4 space-y-3">
              <input className="input text-sm w-full" placeholder={t('gifcard.captionPlaceholder')} value={editCaption}
                onChange={e => setEditCaption(e.target.value)} />
              <input className="input text-sm w-full" placeholder={t('gifcard.memeTextPlaceholder')}
                value={editOverlay} onChange={e => setEditOverlay(e.target.value)} />
              {editOverlay && (
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={showOverlay} onChange={e => setShowOverlay(e.target.checked)} />
                  {t('gifcard.showOnGif')}
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} {t('common.save')}
                </button>
                <button onClick={() => setEditMode(false)} className="btn-ghost text-sm px-4 py-2 flex items-center gap-1">
                  <X className="w-3 h-3" /> {t('common.cancel')}
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
      {showReport && (
        <ReportModal
          postId={currentPost.id}
          reportedUserId={currentPost.user_id}
          onClose={() => setShowReport(false)}
        />
      )}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowSaveModal(false)}>
          <div className="bg-[#1a1a2e] rounded-t-2xl w-full max-w-lg p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">{t('collections.save')}</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {loadingCollections ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {collections.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">{t('collections.noCollections')}</p>
                )}
                {collections.map(col => (
                  <button key={col.id} onClick={() => toggleSaveToCollection(col.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                      savedCollectionIds.has(col.id)
                        ? 'bg-brand-500/20 border border-brand-500/40'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}>
                    <span className="text-white text-sm font-medium">{col.name}</span>
                    {savedCollectionIds.has(col.id) && <Bookmark className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-[#2a2a3f] pt-4">
              <p className="text-gray-400 text-xs mb-2">{t('collections.newCollection')}</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[#0d0d1a] border border-[#3a3a5c] rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  placeholder={t('collections.namePlaceholder')}
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createCollection()}
                />
                <button onClick={createCollection} disabled={creatingCol || !newColName.trim()}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50">
                  {creatingCol ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  {t('collections.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
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
