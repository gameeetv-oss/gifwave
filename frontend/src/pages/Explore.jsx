import { useState, useEffect, useRef } from 'react'
import { Search, TrendingUp, Hash, Loader2, Repeat2, Pencil, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import GIFCard from '../components/GIFCard'
import toast from 'react-hot-toast'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function Explore() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('tag') ? '#' + searchParams.get('tag') : '')
  const [tab, setTab] = useState('trending')
  const [trendingGiphy, setTrendingGiphy] = useState([])
  const [trendingPosts, setTrendingPosts] = useState([])
  const [trendingTags, setTrendingTags] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [giphyResults, setGiphyResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [giphyLoading, setGiphyLoading] = useState(false)
  const [editGif, setEditGif] = useState(null) // { url, title } — "Ekle ve Düzenle" modali
  const [editCaption, setEditCaption] = useState('')
  const [editOverlay, setEditOverlay] = useState('')
  const [editShowOverlay, setEditShowOverlay] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const searchInputRef = useRef()

  useEffect(() => {
    loadTrending()
    loadTrendingTags()
  }, [])

  async function loadTrending() {
    setLoading(true)
    const [postsRes, giphyRes] = await Promise.all([
      supabase.from('posts')
        .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url)')
        .order('likes_count', { ascending: false })
        .limit(10),
      fetch(`${BACKEND_URL}/giphy/trending`).then(r => r.json()).catch(() => ({ gifs: [] }))
    ])
    setTrendingPosts(postsRes.data || [])
    setTrendingGiphy(giphyRes.gifs || [])
    setLoading(false)
  }

  async function loadTrendingTags() {
    const { data } = await supabase.from('posts').select('tags').not('tags', 'is', null)
    if (!data) return
    const tagCount = {}
    data.forEach(p => p.tags?.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1 }))
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12)
    setTrendingTags(sorted)
  }

  async function handleSearch(q = query) {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setGiphyLoading(true)
    setTab('search')

    // Platform araması
    if (trimmed.startsWith('#')) {
      const tag = trimmed.slice(1)
      const { data } = await supabase
        .from('posts')
        .select('*, profiles!fk_posts_profiles(username, display_name, avatar_url)')
        .contains('tags', [tag])
        .order('created_at', { ascending: false })
      setSearchResults(data || [])
    } else {
      const { data } = await supabase.from('profiles').select('*').ilike('username', `%${trimmed}%`).limit(20)
      setSearchResults(data || [])
    }
    setLoading(false)

    // GIPHY araması (eş zamanlı)
    fetch(`${BACKEND_URL}/giphy/search?q=${encodeURIComponent(trimmed.replace(/^#/, ''))}`)
      .then(r => r.json())
      .then(d => setGiphyResults(d.gifs || []))
      .catch(() => {})
      .finally(() => setGiphyLoading(false))
  }

  async function repostGiphy(gif) {
    if (!user) { toast.error('Giriş yap'); return }
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      gif_url: gif.url,
      caption: gif.title || null,
      tags: [],
      source: 'giphy',
      likes_count: 0,
      comments_count: 0
    })
    if (!error) toast.success('GIF profiline eklendi!')
    else toast.error('Hata oluştu')
  }

  function openEditModal(gif) {
    if (!user) { toast.error('Giriş yap'); return }
    setEditGif(gif)
    setEditCaption(gif.title || '')
    setEditOverlay('')
    setEditShowOverlay(false)
  }

  async function saveEditPost() {
    if (!editGif) return
    setEditSaving(true)
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      gif_url: editGif.url,
      caption: editCaption || null,
      text_overlay: editOverlay || null,
      show_overlay: editOverlay ? editShowOverlay : false,
      tags: [],
      source: 'giphy',
      likes_count: 0,
      comments_count: 0
    })
    setEditSaving(false)
    if (!error) {
      toast.success('GIF paylaşıldı!')
      setEditGif(null)
    } else {
      toast.error('Hata oluştu')
    }
  }

  const isUserSearch = tab === 'search' && !query.startsWith('#')

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Ekle ve Düzenle Modali */}
      {editGif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setEditGif(null)}>
          <div className="bg-[#1a1a2e] border border-[#3a3a5c] rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">GIF Düzenle & Paylaş</h2>
              <button onClick={() => setEditGif(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* GIF Önizleme */}
            <div className="relative rounded-xl overflow-hidden bg-black/30">
              <img src={editGif.url} alt={editGif.title} className="w-full max-h-64 object-contain" />
              {editOverlay && editShowOverlay && (
                <div className="absolute bottom-0 inset-x-0 bg-black/70 px-4 py-3 text-center">
                  <p className="text-white font-bold text-lg leading-tight" style={{ textShadow: '2px 2px 4px black' }}>
                    {editOverlay}
                  </p>
                </div>
              )}
            </div>

            {/* Açıklama */}
            <input
              className="input text-sm"
              placeholder="Açıklama (opsiyonel)..."
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
            />

            {/* Meme yazısı */}
            <input
              className="input text-sm"
              placeholder="GIF üzerine yazı (meme tarzı)..."
              value={editOverlay}
              onChange={e => setEditOverlay(e.target.value)}
            />
            {editOverlay && (
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={editShowOverlay} onChange={e => setEditShowOverlay(e.target.checked)} />
                GIF üzerinde göster
              </label>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={saveEditPost} disabled={editSaving}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Paylaş
              </button>
              <button onClick={() => setEditGif(null)} className="btn-ghost px-4">İptal</button>
            </div>
          </div>
        </div>
      )}
      {/* Arama */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            ref={searchInputRef}
            className="input pl-9"
            placeholder="GIF ara (GIPHY), kullanıcı veya #tag..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button onClick={() => handleSearch()} className="btn-primary px-5">Ara</button>
      </div>

      {/* Trend tag'ler */}
      {trendingTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {trendingTags.map(([tag, count]) => (
            <button key={tag}
              onClick={() => { setQuery('#' + tag); handleSearch('#' + tag) }}
              className="flex items-center gap-1 bg-[#1a1a2e] hover:bg-brand-500/20 border border-[#3a3a5c] hover:border-brand-500/50 rounded-full px-3 py-1.5 text-sm text-gray-300 hover:text-brand-300 transition-all">
              <Hash className="w-3.5 h-3.5" />{tag}
              <span className="text-gray-600 text-xs">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search sonuçları */}
      {tab === 'search' && (
        <div className="space-y-8">
          {/* GIPHY sonuçları */}
          {(giphyLoading || giphyResults.length > 0) && (
            <div>
              <h2 className="font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-brand-400" /> GIPHY Sonuçları
              </h2>
              {giphyLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {giphyResults.map(gif => (
                    <div key={gif.id} className="relative group rounded-xl overflow-hidden bg-black/20 aspect-square">
                      <img src={gif.preview} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <p className="text-xs text-white text-center line-clamp-2">{gif.title}</p>
                        <button onClick={() => repostGiphy(gif)}
                          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors w-full justify-center">
                          <Repeat2 className="w-3.5 h-3.5" /> Profilime Ekle
                        </button>
                        <button onClick={() => openEditModal(gif)}
                          className="flex items-center gap-1.5 bg-[#2a2a4a] hover:bg-[#3a3a5c] border border-[#3a3a5c] text-white text-xs px-3 py-1.5 rounded-lg transition-colors w-full justify-center">
                          <Pencil className="w-3.5 h-3.5" /> Ekle ve Düzenle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Platform sonuçları */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
          ) : searchResults.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-300 mb-3">
                {isUserSearch ? 'Kullanıcılar' : 'Platform Gönderileri'}
              </h2>
              {isUserSearch ? (
                <div className="space-y-3">
                  {searchResults.map(u => (
                    <Link key={u.id} to={`/profile/${u.username}`}
                      className="card flex items-center gap-4 p-4 hover:border-brand-500/50 transition-all">
                      <div className="w-12 h-12 rounded-full bg-brand-800 flex items-center justify-center text-lg font-bold text-brand-200 overflow-hidden flex-shrink-0">
                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{u.display_name || u.username}</p>
                        <p className="text-gray-500 text-sm">@{u.username}</p>
                        {u.bio && <p className="text-gray-600 text-xs mt-0.5 line-clamp-1">{u.bio}</p>}
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
        </div>
      )}

      {/* Trending */}
      {tab === 'trending' && (
        <div className="space-y-8">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
          ) : (
            <>
              {trendingGiphy.length > 0 && (
                <div>
                  <h2 className="font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-400" /> GIPHY Trending
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {trendingGiphy.map(gif => (
                      <div key={gif.id} className="relative group rounded-xl overflow-hidden bg-black/20 aspect-square">
                        <img src={gif.preview} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                          <button onClick={() => repostGiphy(gif)}
                            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors w-full justify-center">
                            <Repeat2 className="w-3.5 h-3.5" /> Ekle
                          </button>
                          <button onClick={() => openEditModal(gif)}
                            className="flex items-center gap-1.5 bg-[#2a2a4a] hover:bg-[#3a3a5c] border border-[#3a3a5c] text-white text-xs px-3 py-1.5 rounded-lg transition-colors w-full justify-center">
                            <Pencil className="w-3.5 h-3.5" /> Ekle ve Düzenle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trendingPosts.length > 0 && (
                <div>
                  <h2 className="font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-400" /> Popüler Gönderiler
                  </h2>
                  <div className="space-y-4">
                    {trendingPosts.map(post => <GIFCard key={post.id} post={post} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
