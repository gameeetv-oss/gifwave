import { useEffect, useState } from 'react'
import { X, Send, Heart, CornerDownRight, BadgeCheck, Trash2, Pencil, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBlock } from '../context/BlockContext'
import { usePresence } from '../context/PresenceContext'
import toast from 'react-hot-toast'

export default function CommentModal({ post, onClose }) {
  const { user } = useAuth()
  const { allBlockedIds } = useBlock()
  const { onlineUsers } = usePresence()
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(post.comments_count || 0)
  const [replyTo, setReplyTo] = useState(null) // { id, username }
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [myLikes, setMyLikes] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    loadComments()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!fk_comments_profiles(username, display_name, avatar_url, is_verified, show_online_status)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    const all = data || []
    setComments(all)
    setCount(all.filter(c => !c.parent_id).length + all.filter(c => c.parent_id).length)

    // kendi beğenilerimi yükle
    if (user && all.length > 0) {
      const ids = all.map(c => c.id)
      const { data: lk } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', ids)
      setMyLikes(new Set((lk || []).map(l => l.comment_id)))
    }
    return all.length
  }

  async function submit(e) {
    e.preventDefault()
    if (!user) { toast.error('Giriş yapman lazım'); return }
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
    if (!user) { toast.error('Giriş yapman lazım'); return }
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
            <p className="text-sm">
              <span className="inline-flex items-center gap-0.5 font-semibold text-brand-400">
                {c.profiles?.display_name || c.profiles?.username}
                {c.profiles?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
              </span>
              {' '}<span className="text-gray-300">{c.text}</span>
            </p>
          )}
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-gray-600">{new Date(c.created_at).toLocaleString('tr-TR')}</p>
            <button
              onClick={() => toggleCommentLike(c.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${myLikes.has(c.id) ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}`}>
              <Heart className={`w-3 h-3 ${myLikes.has(c.id) ? 'fill-current' : ''}`} />
              {c.likes_count > 0 && c.likes_count}
            </button>
            {!isReply && user && (
              <button
                onClick={() => setReplyTo(r => r?.id === c.id ? null : { id: c.id, username: c.profiles?.username })}
                className="text-xs text-gray-600 hover:text-brand-400 transition-colors flex items-center gap-1">
                <CornerDownRight className="w-3 h-3" /> Yanıtla
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
                placeholder={`@${replyTo.username} yanıtla...`}
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
          <h3 className="font-semibold">Yorumlar {count > 0 && <span className="text-brand-400 text-sm">({count})</span>}</h3>
          <button onClick={() => onClose(count)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {topComments.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">İlk yorumu sen yap!</p>}
          {topComments.map(c => (
            <div key={c.id}>
              <CommentItem c={c} isReply={false} />
              {getReplies(c.id).map(r => (
                <CommentItem key={r.id} c={r} isReply={true} />
              ))}
            </div>
          ))}
        </div>

        {user && (
          <form onSubmit={submit} className="px-4 py-3 border-t border-[#2a2a3f] flex gap-2">
            <input className="input flex-1 text-sm py-2" placeholder="Yorum yaz..."
              value={text} onChange={e => setText(e.target.value)} disabled={loading} />
            <button type="submit" disabled={loading || !text.trim()} className="btn-primary px-3 py-2">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
