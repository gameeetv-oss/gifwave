import { useState } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import CommentModal from './CommentModal'

export default function GIFCard({ post, onLikeToggle }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likeCount, setLikeCount] = useState(post.likes_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  async function toggleLike() {
    if (!user) { toast.error('Beğenmek için giriş yap'); return }
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(n => newLiked ? n + 1 : n - 1)

    if (newLiked) {
      await supabase.from('likes').insert({ user_id: user.id, post_id: post.id })
      // Bildirim gönder (kendi postuna değilse)
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          type: 'like',
          from_user_id: user.id,
          post_id: post.id
        })
      }
    } else {
      await supabase.from('likes').delete()
        .eq('user_id', user.id).eq('post_id', post.id)
    }
    onLikeToggle?.()
  }

  async function share() {
    const url = `${window.location.origin}/post/${post.id}`
    if (navigator.share) {
      navigator.share({ title: post.caption || 'GifWave', url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link kopyalandı!')
    }
  }

  const avatarUrl = post.profiles?.avatar_url
  const username = post.profiles?.username || 'anonim'
  const timeAgo = formatTime(post.created_at)

  return (
    <>
      <article className="card animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Link to={`/profile/${username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-800 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-brand-200 text-sm font-bold">
                  {username[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm text-white">@{username}</p>
              <p className="text-xs text-gray-500">{timeAgo}</p>
            </div>
          </Link>
          <button className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="px-4 pb-3 text-sm text-gray-300">
            {post.caption}
            {post.tags?.map(tag => (
              <Link key={tag} to={`/explore?tag=${tag}`} className="text-brand-400 ml-1">#{tag}</Link>
            ))}
          </p>
        )}

        {/* GIF */}
        <div className="relative bg-black/30 min-h-[200px] flex items-center justify-center">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={post.gif_url}
            alt={post.caption || 'GIF'}
            className={`w-full max-h-[500px] object-contain transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-3 py-3">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              liked ? 'text-red-400 bg-red-500/10' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.comments_count || 0}</span>
          </button>

          <button
            onClick={share}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all ml-auto"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </article>

      {showComments && (
        <CommentModal post={post} onClose={() => setShowComments(false)} />
      )}
    </>
  )
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
