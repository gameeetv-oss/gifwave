import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import GIFCard from './GIFCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBlock } from '../context/BlockContext'
import { useTranslation } from 'react-i18next'

const AD_EVERY = 5
const ANDROID_INTERSTITIAL_ID = 'ca-app-pub-4416578432335144/9595174249'

async function showInterstitialAd() {
  try {
    const platform = window.Capacitor?.getPlatform?.()
    if (platform !== 'android') return
    const adMobModule = await import(/* @vite-ignore */ '@capacitor-community/admob').catch(() => null)
    if (!adMobModule) return
    const { AdMob } = adMobModule
    await AdMob.prepareInterstitial({ adId: ANDROID_INTERSTITIAL_ID, isTesting: false })
    await AdMob.showInterstitial()
  } catch {}
}

const PAGE_SIZE = 10

export default function Feed({ mode = 'all' }) {
  const { user, isPremium } = useAuth()
  const { allBlockedIds } = useBlock()
  const { t } = useTranslation()
  const adCounterRef = useRef(0)
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
          .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified, show_online_status, is_premium, premium_until)')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
        data = postsData || []
      } else {
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified, show_online_status, is_premium, premium_until)')
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
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <p className="text-5xl mb-4">🎬</p>
        <p className="font-semibold text-white">{t('feed.noGifs')}</p>
        {mode === 'following' && <p className="text-sm mt-2 text-gray-400">{t('feed.followSomeone')}</p>}
      </div>
    )
  }

  return (
    <div
      className="h-screen overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {posts.map((post, index) => (
        <div key={post.id} className="h-screen snap-start snap-always flex-shrink-0"
          onFocus={() => {}}
          ref={el => {
            if (!el) return
            const observer = new IntersectionObserver(([entry]) => {
              if (entry.isIntersecting && !isPremium) {
                adCounterRef.current++
                if (adCounterRef.current % AD_EVERY === 0) showInterstitialAd()
              }
            }, { threshold: 0.8 })
            observer.observe(el)
          }}>
          <GIFCard post={post} />
        </div>
      ))}
      <div ref={ref} className="snap-start h-4" />
      {loading && (
        <div className="h-screen snap-start flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div className="h-screen snap-start flex items-center justify-center">
          <p className="text-gray-500 text-sm">{t('feed.allSeen')}</p>
        </div>
      )}
    </div>
  )
}
