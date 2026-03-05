import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import GIFCard from './GIFCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBlock } from '../context/BlockContext'

const PAGE_SIZE = 10

export default function Feed({ mode = 'all' }) {
  const { user } = useAuth()
  const { allBlockedIds } = useBlock()
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(0)
  const loadingRef = useRef(false)
  const { ref, inView } = useInView({ threshold: 0.1 })

  async function loadPosts(pageNum, reset = false) {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      let data = []

      if (mode === 'following' && user) {
        const { data: follows } = await supabase
          .from('follows').select('following_id').eq('follower_id', user.id)
        const ids = follows?.map(f => f.following_id) || []
        if (ids.length === 0) { setHasMore(false); return }
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified, show_online_status)')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
        data = postsData || []
      } else {
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified, show_online_status)')
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
        data = postsData || []
      }

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

      // Engellenen kullanıcıların postlarını filtrele
      if (allBlockedIds.size > 0) data = data.filter(p => !allBlockedIds.has(p.user_id))

      setPosts(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
      if (data.length === PAGE_SIZE) pageRef.current = pageNum + 1
    } catch (err) {
      console.error('Feed error:', err)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    pageRef.current = 0
    setPosts([])
    setHasMore(true)
    loadPosts(0, true)
  }, [mode, user?.id])

  useEffect(() => {
    if (inView && hasMore && !loadingRef.current) {
      loadPosts(pageRef.current)
    }
  }, [inView])

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
      <div ref={ref} className="h-8" />
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <p className="text-center text-gray-600 text-sm py-8">Hepsini gördün!</p>
      )}
    </div>
  )
}
