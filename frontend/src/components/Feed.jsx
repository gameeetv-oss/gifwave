import { useState, useEffect, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import GIFCard from './GIFCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 10

export default function Feed({ mode = 'all' }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const { ref, inView } = useInView({ threshold: 0.1 })

  const loadPosts = useCallback(async (pageNum) => {
    if (loading) return
    setLoading(true)
    try {
      let data = []

      if (mode === 'following' && user) {
        const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
        const ids = follows?.map(f => f.following_id) || []
        if (ids.length === 0) { setHasMore(false); setLoading(false); return }
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url)')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
        data = postsData || []
      } else {
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url)')
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
        data = postsData || []
      }

      // Beğeni ve repost durumu
      if (user && data.length > 0) {
        const postIds = data.map(p => p.id)
        const [likeRes, repostRes] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', postIds)
        ])
        const likedIds = new Set(likeRes.data?.map(l => l.post_id))
        const repostedIds = new Set(repostRes.data?.map(r => r.post_id))
        data = data.map(p => ({ ...p, user_liked: likedIds.has(p.id), user_reposted: repostedIds.has(p.id) }))
      }

      setPosts(prev => pageNum === 0 ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [mode, user])

  useEffect(() => {
    setPosts([])
    setPage(0)
    setHasMore(true)
    loadPosts(0)
  }, [mode])

  useEffect(() => {
    if (inView && hasMore && !loading && page > 0) loadPosts(page)
  }, [inView])

  useEffect(() => {
    if (page > 0) loadPosts(page)
  }, [page])

  if (posts.length === 0 && !loading) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-4xl mb-3">🎬</p>
        <p className="font-medium">Henüz GIF yok</p>
        {mode === 'following' && <p className="text-sm mt-1">Birilerini takip et!</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {posts.map(post => <GIFCard key={post.id} post={post} />)}
      <div ref={ref} className="h-4" onClick={() => { if (!loading && hasMore) setPage(p => p + 1) }} />
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!hasMore && posts.length > 0 && <p className="text-center text-gray-600 text-sm py-8">Hepsini gördün!</p>}
    </div>
  )
}
