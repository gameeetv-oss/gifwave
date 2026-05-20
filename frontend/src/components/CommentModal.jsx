import { useEffect, useState, useRef } from 'react'
import { X, Send, Heart, CornerDownRight, BadgeCheck, Trash2, Pencil, Check, Film, Loader2, Smile } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBlock } from '../context/BlockContext'
import { usePresence } from '../context/PresenceContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function CommentModal({ post, onClose }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { allBlockedIds } = useBlock()
  const { onlineUsers } = usePresence()
  const { t } = useTranslation()
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(post.comments_count || 0)
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [myLikes, setMyLikes] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [ownerSettings, setOwnerSettings] = useState(null)
  const [isFollowingOwner, setIsFollowingOwner] = useState(false)

  // Reactions
  const [reactions, setReactions] = useState([])
  const [myReaction, setMyReaction] = useState(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [reactionQuery, setReactionQuery] = useState('')
  const [reactionResults, setReactionResults] = useState([])
  const [reactionSearchLoading, setReactionSearchLoading] = useState(false)

  useEffect(() => {
    loadComments()
    loadOwnerSettings()
    loadReactions()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function loadOwnerSettings() {
    const { data: sett } = await supabase.from('user_settings').select('who_can_comment,who_can_reply').eq('user_id', post.user_id).maybeSingle()
    setOwnerSettings(sett || { who_can_comment: 'all', who_can_reply: 'all' })
    if (user && user.id !== post.user_id && sett?.who_can_comment === 'followers') {
      const { data: f } = await supabase.from('follows').select('status').eq('follower_id', user.id).eq('following_id', post.user_id).maybeSingle()
      setIsFollowingOwner(f?.status === 'accepted')
    }
  }

  async function loadReactions() {
    const { data } = await supabase
      .from('reactions')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    const rows = data || []
    if (rows.length > 0) {
      const ids = [...new Set(rows.map(r => r.user_id))]
      const { data: profs } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids)
      const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]))
      rows.forEach(r => { r.profiles = profMap[r.user_id] || null })
    }
    setReactions(rows)
    if (user) {
      const mine = rows.find(r => r.user_id === user.id)
      setMyReaction(mine || null)
    }
  }

  async function searchReactionGif() {
    if (!reactionQuery.trim()) return
    setReactionSearchLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/giphy/search?q=${encodeURIComponent(reactionQuery)}&limit=12`)
      const data = await res.json()
      setReactionResults(data.gifs || [])
    } catch { toast.error(t('comments.gifSearchError')) }
    finally { setReactionSearchLoading(false) }
  }

  async function toggleReaction(gifUrl, gifPreview) {
    if (!user) { toast.error(t('reactions.loginRequired')); return }
    try {
      // always delete any existing DB reaction first (handles stale state)
      const { data: existingArr } = await supabase
        .from('reactions').select('id,gif_url').eq('post_id', post.id).eq('user_id', user.id)
      const existing = existingArr?.[0] || myReaction || reactions.find(r => r.user_id === user.id)
      if (existing) {
        await supabase.from('reactions').delete().eq('id', existing.id)
        setMyReaction(null)
        setReactions(rs => rs.filter(r => r.id !== existing.id))
        if (gifUrl === existing.gif_url) {
          setShowReactionPicker(false)
          setReactionResults([])
          setReactionQuery('')
          return
        }
      }
      const { data, error } = await supabase.from('reactions').insert({
        post_id: post.id,
        user_id: user.id,
        gif_url: gifUrl,
        gif_preview: gifPreview || gifUrl
      }).select('*').single()
      if (error) throw error
      const newReaction = {
        ...data,
        profiles: { username: profile?.username, display_name: profile?.display_name, avatar_url: profile?.avatar_url }
      }
      setMyReaction(newReaction)
      setReactions(rs => [...rs, newReaction])
    } catch (err) {
      toast.error('Tepki eklenemedi')
    } finally {
      setShowReactionPicker(false)
      setReactionResults([])
      setReactionQuery('')
    }
  }

  const isPostOwner = user?.id === post.user_id
  function canComment() {
    if (isPostOwner) return true
    if (!user) return false
    const wcc = ownerSettings?.who_can_comment || 'all'
    if (wcc === 'none') return false
    if (wcc === 'followers') return isFollowingOwner
    return true
  }
  function canReply() {
    if (isPostOwner) return true
    if (!user) return false
    const wcr = ownerSettings?.who_can_reply || 'all'
    if (wcr === 'none') return false
    if (wcr === 'followers') return isFollowingOwner
    return true
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!fk_comments_profiles(username, display_name, avatar_url, is_verified, show_online_status)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    const all = data || []
    setComments(all)
    setCount(all.filter(c => !c.parent_id).length + all.filter(c => c.parent_id).length)

    if (user && all.length > 0) {
      const ids = all.map(c => c.id)
      const { data: lk } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', ids)
      setMyLikes(new Set((lk || []).map(l => l.comment_id)))
    }
    return all.length
  }

  async function searchGif() {
    if (!gifQuery.trim()) return
    setGifLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/giphy/search?q=${encodeURIComponent(gifQuery)}`)
      const data = await res.json()
      setGifResults(data.gifs || [])
    } catch { toast.error(t('comments.gifSearchError')) }
    finally { setGifLoading(false) }
  }

  async function sendGifComment(gifUrl) {
    if (!user) return
    setShowGifPicker(false)
    setGifResults([]); setGifQuery('')
    setLoading(true)
    const { error } = await supabase.from('comments').insert({
      user_id: user.id, post_id: post.id, text: gifUrl
    })
    if (!error) { await loadComments() }
    setLoading(false)
  }

  async function submit(e) {
    e.preventDefault()
    if (!user) { toast.error(t('comments.loginRequired')); return }
    if (!text.trim()) return
    setLoading(true)
    const { error } = await supabase.from('comments').insert({
      user_id: user.id, post_id: post.id, text: text.trim()
    })
    if (!error) {
      if (post.user_id !== user.id) {
        supabase.from('notifications').insert({
          user_id: post.user_id, type: 'comment', from_user_id: user.id, post_id: post.id
        })
      }
      setText('')
      await loadComments()
    }
    setLoading(false)
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!user || !replyTo || !replyText.trim()) return
    setReplyLoading(true)
    const { error } = await supabase.from('comments').insert({
      user_id: user.id, post_id: post.id, text: replyText.trim(), parent_id: replyTo.id
    })
    if (!error) {
      setReplyTo(null)
      setReplyText('')
      await loadComments()
    }
    setReplyLoading(false)
  }

  async function saveEdit(commentId) {
    if (!editText.trim()) return
    const { error } = await supabase.from('comments').update({ text: editText.trim() }).eq('id', commentId).eq('user_id', user.id)
    if (!error) {
      setComments(cs => cs.map(c => c.id === commentId ? { ...c, text: editText.trim() } : c))
      setEditingId(null)
    }
  }

  async function deleteComment(commentId) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id)
    if (!error) {
      setComments(cs => cs.filter(c => c.id !== commentId && c.parent_id !== commentId))
      setCount(n => Math.max(0, n - 1))
    }
  }

  async function toggleCommentLike(commentId) {
    if (!user) { toast.error(t('comments.loginRequired')); return }
    const isLiked = myLikes.has(commentId)
    if (isLiked) {
      await supabase.from('comment_likes').delete().eq('user_id', user.id).eq('comment_id', commentId)
      setMyLikes(s => { const n = new Set(s); n.delete(commentId); return n })
      setComments(cs => cs.map(c => c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) - 1) } : c))
    } else {
      const { error } = await supabase.from('comment_likes').insert({ user_id: user.id, comment_id: commentId })
      if (!error) {
        setMyLikes(s => new Set([...s, commentId]))
        setComments(cs => cs.map(c => c.id === commentId ? { ...c, likes_count: (c.likes_count || 0) + 1 } : c))
      }
    }
  }

  const visible = comments.filter(c => !allBlockedIds.has(c.user_id))
  const topComments = visible.filter(c => !c.parent_id)
  const getReplies = (parentId) => visible.filter(c => c.parent_id === parentId)

  function CommentItem({ c, isReply }) {
    return (
      <div className={`flex gap-3 ${isReply ? 'ml-10 mt-1.5' : ''}`}>
        <div className="relative flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-brand-800 flex items-center justify-center text-xs font-bold text-brand-200 overflow-hidden">
            {c.profiles?.avatar_url
              ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
              : c.profiles?.username?.[0]?.toUpperCase()}
          </div>
          {onlineUsers.has(c.user_id) && c.profiles?.show_online_status !== false && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border-2 border-[#12121e]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editingId === c.id ? (
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1 text-xs py-1.5"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null) }}
                autoFocus
              />
              <button onClick={() => saveEdit(c.id)} className="text-brand-400 hover:text-brand-300">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div>
              <span className="inline-flex items-center gap-0.5 font-semibold text-brand-400 text-sm">
                {c.profiles?.display_name || c.profiles?.username}
                {c.profiles?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
              </span>
              {c.text?.startsWith('http') && (c.text.includes('.gif') || c.text.includes('giphy')) ? (
                <img src={c.text} alt="gif" className="mt-1.5 rounded-lg max-h-32 max-w-[200px] object-contain" />
              ) : (
                <p className="text-sm text-gray-300">{c.text}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-gray-600">{new Date(c.created_at).toLocaleString('tr-TR')}</p>
            <button
              onClick={() => toggleCommentLike(c.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${myLikes.has(c.id) ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}`}>
              <Heart className={`w-3 h-3 ${myLikes.has(c.id) ? 'fill-current' : ''}`} />
              {c.likes_count > 0 && c.likes_count}
            </button>
            {!isReply && canReply() && (
              <button
                onClick={() => setReplyTo(r => r?.id === c.id ? null : { id: c.id, username: c.profiles?.username })}
                className="text-xs text-gray-600 hover:text-brand-400 transition-colors flex items-center gap-1">
                <CornerDownRight className="w-3 h-3" /> {t('comments.reply')}
              </button>
            )}
            {user?.id === c.user_id && (
              <>
                <button
                  onClick={() => { setEditingId(c.id); setEditText(c.text); setReplyTo(null) }}
                  className="text-xs text-gray-600 hover:text-brand-400 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
          {/* Reply input */}
          {replyTo?.id === c.id && (
            <form onSubmit={submitReply} className="flex gap-2 mt-2">
              <input
                className="input flex-1 text-xs py-1.5"
                placeholder={t('comments.replyPlaceholder', { username: replyTo.username })}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                disabled={replyLoading}
                autoFocus
              />
              <button type="submit" disabled={replyLoading || !replyText.trim()} className="btn-primary px-2 py-1">
                <Send className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => onClose(count)}>
      <div className="card w-full max-w-lg max-h-[80vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3f]">
          <h3 className="font-semibold">{t('comments.title')} {count > 0 && <span className="text-brand-400 text-sm">({count})</span>}</h3>
          <button onClick={() => onClose(count)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reactions strip */}
        {(reactions.length > 0 || user) && (
          <div className="px-4 py-2 border-b border-[#2a2a3f] flex items-center gap-2 flex-wrap">
            {reactions.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  if (r.user_id === user?.id) {
                    toggleReaction(r.gif_url, r.gif_preview)
                  } else if (r.profiles?.username) {
                    onClose(count)
                    navigate(`/profile/${r.profiles.username}`)
                  }
                }}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden transition-all active:scale-90 ${r.user_id === user?.id ? 'ring-2 ring-brand-400' : 'opacity-80 hover:opacity-100'}`}
                style={{ width: 64, height: 72 }}>
                <img src={r.gif_preview || r.gif_url} alt="reaction" className="w-full object-cover" style={{ height: 52 }} />
                <div className="w-full bg-black/70 text-center px-0.5" style={{ height: 20 }}>
                  <span className="text-white leading-none block truncate" style={{ fontSize: 9 }}>
                    {r.profiles?.display_name || r.profiles?.username || '?'}
                  </span>
                </div>
              </button>
            ))}
            {user && (
              <button
                onClick={() => { setShowReactionPicker(s => !s); setShowGifPicker(false) }}
                title={myReaction ? t('reactions.removeReaction') : t('reactions.addReaction')}
                className={`w-[60px] h-[60px] flex flex-col items-center justify-center rounded-lg border transition-colors flex-shrink-0 text-xs gap-1 ${showReactionPicker ? 'border-brand-400 text-brand-400 bg-brand-500/10' : 'border-[#2a2a3f] text-gray-500 hover:border-brand-400 hover:text-brand-400'}`}>
                <Smile className="w-5 h-5" />
                <span>{t('reactions.react')}</span>
              </button>
            )}
          </div>
        )}

        {/* Reaction GIF picker */}
        {showReactionPicker && (
          <div className="px-4 pt-3 pb-2 space-y-2 border-b border-[#2a2a3f]" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm py-1.5"
                placeholder={t('reactions.searchPlaceholder')}
                value={reactionQuery}
                onChange={e => setReactionQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchReactionGif()}
                autoFocus
              />
              <button onClick={searchReactionGif} disabled={reactionSearchLoading} className="btn-primary px-3 py-1.5">
                {reactionSearchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('comments.search')}
              </button>
            </div>
            {reactionResults.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {reactionResults.map(gif => (
                  <img
                    key={gif.id}
                    src={gif.preview}
                    alt=""
                    onClick={(e) => { e.stopPropagation(); toggleReaction(gif.url, gif.preview) }}
                    className="w-full h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {topComments.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">{t('comments.firstComment')}</p>}
          {topComments.map(c => (
            <div key={c.id}>
              <CommentItem c={c} isReply={false} />
              {getReplies(c.id).map(r => (
                <CommentItem key={r.id} c={r} isReply={true} />
              ))}
            </div>
          ))}
        </div>

        {user && !canComment() && (
          <div className="border-t border-[#2a2a3f] px-4 py-3 text-center text-xs text-gray-500">
            {ownerSettings?.who_can_comment === 'none'
              ? t('comments.commentsClosed')
              : t('comments.followRequired')}
          </div>
        )}
        {canComment() && (
          <div className="border-t border-[#2a2a3f]">
            {/* GIF picker */}
            {showGifPicker && (
              <div className="px-4 pt-3 pb-2 space-y-2">
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm py-1.5" placeholder={t('comments.searchGif')}
                    value={gifQuery} onChange={e => setGifQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchGif()} autoFocus />
                  <button onClick={searchGif} disabled={gifLoading} className="btn-primary px-3 py-1.5">
                    {gifLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('comments.search')}
                  </button>
                </div>
                {gifResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {gifResults.map(gif => (
                      <img key={gif.id} src={gif.preview} alt="" onClick={() => sendGifComment(gif.url)}
                        className="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" />
                    ))}
                  </div>
                )}
              </div>
            )}
            <form onSubmit={submit} className="px-4 py-3 flex gap-2">
              <button type="button" onClick={() => setShowGifPicker(s => !s)}
                className={`p-2 rounded-xl transition-colors flex-shrink-0 ${showGifPicker ? 'text-brand-400 bg-brand-500/10' : 'text-gray-500 hover:text-brand-400 hover:bg-brand-500/10'}`}>
                <Film className="w-5 h-5" />
              </button>
              <input className="input flex-1 text-sm py-2" placeholder={t('comments.placeholder')}
                value={text} onChange={e => setText(e.target.value)} disabled={loading} />
              <button type="submit" disabled={loading || !text.trim()} className="btn-primary px-3 py-2">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
