import { useEffect, useState } from 'react'
import { X, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function CommentModal({ post, onClose }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadComments()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!fk_comments_profiles(username, display_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function submit(e) {
    e.preventDefault()
    if (!user) { toast.error('Giriş yapman lazım'); return }
    if (!text.trim()) return
    setLoading(true)
    const { error } = await supabase.from('comments').insert({ user_id: user.id, post_id: post.id, text: text.trim() })
    if (!error) {
      await supabase.from('posts').update({ comments_count: (post.comments_count || 0) + 1 }).eq('id', post.id)
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({ user_id: post.user_id, type: 'comment', from_user_id: user.id, post_id: post.id })
      }
      setText('')
      loadComments()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[80vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3f]">
          <h3 className="font-semibold">Yorumlar</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {comments.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">İlk yorumu sen yap!</p>}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-800 flex-shrink-0 flex items-center justify-center text-xs font-bold text-brand-200 overflow-hidden">
                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : c.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm">
                  <span className="font-semibold text-brand-400">{c.profiles?.display_name || c.profiles?.username}</span>
                  {' '}<span className="text-gray-300">{c.text}</span>
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{new Date(c.created_at).toLocaleString('tr-TR')}</p>
              </div>
            </div>
          ))}
        </div>
        {user && (
          <form onSubmit={submit} className="px-4 py-3 border-t border-[#2a2a3f] flex gap-2">
            <input className="input flex-1 text-sm py-2" placeholder="Yorum yaz..." value={text}
              onChange={e => setText(e.target.value)} disabled={loading} />
            <button type="submit" disabled={loading || !text.trim()} className="btn-primary px-3 py-2">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
