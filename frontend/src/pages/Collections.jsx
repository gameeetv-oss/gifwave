import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { Loader2, FolderOpen, Trash2, ArrowLeft } from 'lucide-react'
import GIFCard from '../components/GIFCard'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function Collections() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCollection, setActiveCollection] = useState(null)
  const [collectionPosts, setCollectionPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  useEffect(() => {
    if (!user) return
    loadCollections()
  }, [user])

  async function loadCollections() {
    setLoading(true)
    const { data: cols } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!cols) { setLoading(false); return }

    const counts = await Promise.all(
      cols.map(c =>
        supabase.from('collection_items').select('id', { count: 'exact', head: true }).eq('collection_id', c.id)
      )
    )

    setCollections(cols.map((c, i) => ({ ...c, gif_count: counts[i].count || 0 })))
    setLoading(false)
  }

  async function openCollection(col) {
    setActiveCollection(col)
    setLoadingPosts(true)
    const { data: items } = await supabase
      .from('collection_items')
      .select('post_id, added_at')
      .eq('collection_id', col.id)
      .order('added_at', { ascending: false })

    if (!items || items.length === 0) { setCollectionPosts([]); setLoadingPosts(false); return }

    const postIds = items.map(i => i.post_id)
    const { data: posts } = await supabase
      .from('posts')
      .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url, is_verified, is_premium, premium_until)')
      .in('id', postIds)

    if (user && posts && posts.length > 0) {
      const [likeRes, repostRes] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      ])
      const likedIds = new Set((likeRes.data || []).map(l => l.post_id))
      const repostedIds = new Set((repostRes.data || []).map(r => r.post_id))
      const ordered = postIds
        .map(id => posts.find(p => p.id === id))
        .filter(Boolean)
        .map(p => ({ ...p, user_liked: likedIds.has(p.id), user_reposted: repostedIds.has(p.id) }))
      setCollectionPosts(ordered)
    } else {
      setCollectionPosts(posts || [])
    }
    setLoadingPosts(false)
  }

  async function deleteCollection(col) {
    if (!window.confirm(t('collections.deleteConfirm'))) return
    await supabase.from('collections').delete().eq('id', col.id).eq('user_id', user.id)
    setCollections(c => c.filter(x => x.id !== col.id))
    if (activeCollection?.id === col.id) setActiveCollection(null)
    toast.success(t('collections.removed'))
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-400 gap-3">
        <FolderOpen className="w-16 h-16 text-gray-600" />
        <p>{t('collections.loginRequired')}</p>
      </div>
    )
  }

  if (activeCollection) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setActiveCollection(null)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{t('collections.backToCollections')}</span>
          </button>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-2xl">{activeCollection.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('collections.gifCount', { count: collectionPosts.length })}</p>
          </div>
          <button onClick={() => deleteCollection(activeCollection)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-xl transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {loadingPosts ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
        ) : collectionPosts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-sm">{t('collections.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {collectionPosts.map(post => (
              <div key={post.id} className="relative h-[500px] rounded-2xl overflow-hidden">
                <GIFCard post={post} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <h1 className="text-white font-bold text-2xl mb-6">{t('collections.title')}</h1>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-sm">{t('collections.noCollections')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {collections.map(col => (
            <div key={col.id} className="relative group">
              <button onClick={() => openCollection(col)}
                className="w-full bg-[#1a1a2e] border border-[#2a2a3f] rounded-2xl p-4 text-left hover:border-brand-500/50 hover:bg-[#1e1e38] transition-all">
                <FolderOpen className="w-8 h-8 text-brand-400 mb-3" />
                <p className="text-white font-semibold text-sm truncate">{col.name}</p>
                <p className="text-gray-500 text-xs mt-1">{t('collections.gifCount', { count: col.gif_count })}</p>
              </button>
              <button onClick={e => { e.stopPropagation(); deleteCollection(col) }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
