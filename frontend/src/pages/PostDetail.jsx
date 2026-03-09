import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import GIFCard from '../components/GIFCard'
import { ArrowLeft } from 'lucide-react'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
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
      .select(`*, profiles(username, display_name, avatar_url, is_verified, show_online_status)`)
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
      <p className="text-lg">Bu gönderi bulunamadı.</p>
      <button onClick={() => navigate('/')} className="mt-4 btn-primary">Ana Sayfaya Dön</button>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>
      {post && (
        <GIFCard
          post={post}
          onLikeToggle={fetchPost}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
