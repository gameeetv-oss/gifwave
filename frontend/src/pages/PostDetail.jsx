import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import GIFCard from '../components/GIFCard'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchPost()
  }, [id, user?.id])

  async function fetchPost() {
    setLoading(true)
    const query = supabase
      .from('posts')
      .select(`*, profiles(username, display_name, avatar_url, is_verified, show_online_status, is_premium, premium_until)`)
      .eq('id', id)
      .single()

    const { data, error } = await query
    if (error || !data) { setNotFound(true); setLoading(false); return }

    let liked = false, reposted = false
    if (user) {
      const [{ data: l }, { data: r }] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
        supabase.from('reposts').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
      ])
      liked = !!l
      reposted = !!r
    }

    setPost({ ...data, user_liked: liked, user_reposted: reposted })
    setLoading(false)
  }

  async function handleDelete(postId) {
    await supabase.from('posts').delete().eq('id', postId)
    navigate('/')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center text-gray-400">
      <p className="text-lg">{t('postDetail.notFound')}</p>
      <button onClick={() => navigate('/')} className="mt-4 btn-primary">{t('postDetail.backToHome')}</button>
    </div>
  )

  return (
    <div className="relative h-screen bg-black overflow-hidden">
      {post && (
        <GIFCard
          post={post}
          onLikeToggle={fetchPost}
          onDelete={handleDelete}
        />
      )}
      <button onClick={() => navigate(-1)}
        className="absolute left-3 z-30 flex items-center gap-1.5 text-white/90 text-sm bg-black/40 backdrop-blur rounded-full px-3 py-1.5"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <ArrowLeft className="w-4 h-4" /> {t('postDetail.back')}
      </button>
    </div>
  )
}
