import { useState, useEffect } from 'react'
import { Search, TrendingUp, Hash, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Link, useSearchParams } from 'react-router-dom'
import GIFCard from '../components/GIFCard'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('tag') ? '#' + searchParams.get('tag') : '')
  const [tab, setTab] = useState(searchParams.get('tag') ? 'search' : 'trending')
  const [trendingGiphy, setTrendingGiphy] = useState([])
  const [trendingPosts, setTrendingPosts] = useState([])
  const [trendingTags, setTrendingTags] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTrending()
    loadTrendingTags()
    if (searchParams.get('tag')) {
      handleSearch('#' + searchParams.get('tag'))
    }
  }, [])

  async function loadTrending() {
    setLoading(true)
    try {
      const [postsRes, giphyRes] = await Promise.all([
        supabase.from('posts').select('*, profiles(username, avatar_url)')
          .order('likes_count', { ascending: false }).limit(20),
        fetch(`${BACKEND_URL}/giphy/trending`).then(r => r.json()).catch(() => ({ gifs: [] }))
      ])
      setTrendingPosts(postsRes.data || [])
      setTrendingGiphy(giphyRes.gifs || [])
    } finally {
      setLoading(false)
    }
  }

  async function loadTrendingTags() {
    // En çok kullanılan tag'ler
    const { data } = await supabase.from('posts').select('tags').not('tags', 'is', null)
    if (!data) return
    const tagCount = {}
    data.forEach(p => p.tags?.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1 }))
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 15)
    setTrendingTags(sorted)
  }

  async function handleSearch(q = query) {
    if (!q.trim()) return
    setLoading(true)
    setTab('search')
    try {
      if (q.startsWith('#')) {
        const tag = q.slice(1).trim()
        const { data } = await supabase
          .from('posts')
          .select('*, profiles(username, avatar_url)')
          .contains('tags', [tag])
          .order('created_at', { ascending: false })
        setSearchResults(data || [])
      } else {
        // Kullanıcı arama
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', `%${q}%`)
          .limit(20)
        setSearchResults(data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const isUserSearch = !query.startsWith('#')

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Arama */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Kullanıcı veya #tag ara..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button onClick={() => handleSearch()} className="btn-primary px-5">Ara</button>
      </div>

      {/* Trending tags */}
      {trendingTags.length > 0 && tab !== 'search' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {trendingTags.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => { setQuery('#' + tag); handleSearch('#' + tag) }}
              className="flex items-center gap-1 bg-[#1a1a2e] hover:bg-brand-500/20 border border-[#3a3a5c] hover:border-brand-500/50 rounded-full px-3 py-1.5 text-sm text-gray-300 hover:text-brand-300 transition-all"
            >
              <Hash className="w-3.5 h-3.5" />
              {tag}
              <span className="text-gray-600 text-xs">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab seçici */}
      {tab !== 'search' && (
        <div className="flex gap-2 mb-6">
          {[['trending', 'Trending', TrendingUp]].map(([id, label, Icon]) => (
            <div key={id} className="flex items-center gap-2 text-brand-400 font-semibold">
              <Icon className="w-5 h-5" />
              {label}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        </div>
      )}

      {!loading && tab === 'search' && (
        <div>
          {searchResults.length === 0 ? (
            <p className="text-center text-gray-500 py-16">Sonuç bulunamadı</p>
          ) : isUserSearch ? (
            <div className="space-y-3">
              {searchResults.map(u => (
                <Link key={u.id} to={`/profile/${u.username}`} className="card flex items-center gap-4 p-4 hover:border-brand-500/50 transition-all">
                  <div className="w-12 h-12 rounded-full bg-brand-800 flex items-center justify-center text-lg font-bold text-brand-200 overflow-hidden">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">@{u.username}</p>
                    <p className="text-gray-500 text-sm">{u.bio || 'GifWave kullanıcısı'}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map(post => <GIFCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'trending' && (
        <div className="space-y-8">
          {/* GIPHY Trending */}
          {trendingGiphy.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-400" /> GIPHY Trending
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {trendingGiphy.map(gif => (
                  <div key={gif.id} className="rounded-xl overflow-hidden bg-black/20 aspect-square">
                    <img src={gif.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Platform Trending */}
          {trendingPosts.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-300 mb-3">Popüler Postlar</h2>
              <div className="space-y-4">
                {trendingPosts.map(post => <GIFCard key={post.id} post={post} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
