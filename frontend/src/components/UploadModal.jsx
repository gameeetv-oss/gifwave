import { useState, useRef } from 'react'
import { X, Upload, Search, Video, Loader2, Check, Music, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function UploadModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('upload') // upload | giphy | convert
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [musicFileName, setMusicFileName] = useState('')
  const [musicUploading, setMusicUploading] = useState(false)
  const [ytInput, setYtInput] = useState('')
  const musicFileRef = useRef()
  const [loading, setLoading] = useState(false)

  // Upload tab
  const fileRef = useRef()
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)

  // GIPHY tab
  const [giphyQuery, setGiphyQuery] = useState('')
  const [giphyResults, setGiphyResults] = useState([])
  const [selectedGiphy, setSelectedGiphy] = useState(null)
  const [giphyLoading, setGiphyLoading] = useState(false)

  // Convert tab
  const videoRef = useRef()
  const [videoFile, setVideoFile] = useState(null)
  const [convertedGif, setConvertedGif] = useState(null)
  const [convertLoading, setConvertLoading] = useState(false)

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/gif') && !file.name.endsWith('.gif')) {
      toast.error('Sadece GIF dosyaları kabul edilir')
      return
    }
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function searchGiphy() {
    if (!giphyQuery.trim()) return
    setGiphyLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/giphy/search?q=${encodeURIComponent(giphyQuery)}`)
      const data = await res.json()
      setGiphyResults(data.gifs || [])
    } catch {
      toast.error('GIPHY arama hatası')
    } finally {
      setGiphyLoading(false)
    }
  }

  async function handleVideoConvert() {
    if (!videoFile) return
    setConvertLoading(true)
    try {
      const form = new FormData()
      form.append('file', videoFile)
      const res = await fetch(`${BACKEND_URL}/convert`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Dönüştürme hatası')
      const blob = await res.blob()
      setConvertedGif(URL.createObjectURL(blob))
      toast.success('GIF hazır!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConvertLoading(false)
    }
  }

  async function extractYTMusic() {
    if (!ytInput.trim()) return
    setMusicUploading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/music/extract?url=${encodeURIComponent(ytInput.trim())}`, { method: 'POST' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Hata') }
      const { url, title } = await res.json()
      setMusicUrl(url)
      setMusicFileName(title)
      setYtInput('')
      toast.success('Müzik çıkarıldı!')
    } catch (err) {
      toast.error(err.message || 'Müzik çıkarılamadı')
    } finally {
      setMusicUploading(false)
    }
  }

  async function handleMusicSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) { toast.error('Ses dosyası seçmelisin (mp3, ogg, wav...)'); return }
    if (file.size > 15 * 1024 * 1024) { toast.error('Maks 15MB'); return }
    setMusicUploading(true)
    const path = `${user.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('music').upload(path, file, { contentType: file.type })
    if (error) { toast.error('Müzik yükleme hatası'); setMusicUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('music').getPublicUrl(path)
    setMusicUrl(publicUrl)
    setMusicFileName(file.name)
    setMusicUploading(false)
    toast.success('Müzik yüklendi!')
  }

  async function publish() {
    if (!user) return
    setLoading(true)
    try {
      let gifUrl = null
      let source = 'upload'

      if (tab === 'upload') {
        if (!selectedFile) { toast.error('Bir GIF seç'); setLoading(false); return }
        const path = `${user.id}/${Date.now()}.gif`
        const { error: upErr } = await supabase.storage.from('gifs').upload(path, selectedFile)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
        gifUrl = publicUrl
      } else if (tab === 'giphy') {
        if (!selectedGiphy) { toast.error('Bir GIF seç'); setLoading(false); return }
        gifUrl = selectedGiphy
        source = 'giphy'
      } else if (tab === 'convert') {
        if (!convertedGif) { toast.error('Önce dönüştür'); setLoading(false); return }
        // Blob'u Supabase'e yükle
        const blob = await fetch(convertedGif).then(r => r.blob())
        const path = `${user.id}/${Date.now()}.gif`
        const { error: upErr } = await supabase.storage.from('gifs').upload(path, blob, { contentType: 'image/gif' })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
        gifUrl = publicUrl
        source = 'converted'
      }

      const tagArr = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        gif_url: gifUrl,
        caption: caption.trim() || null,
        tags: tagArr,
        source,
        music_url: musicUrl.trim() || null,
        likes_count: 0,
        comments_count: 0
      })
      if (error) throw error

      toast.success('GIF paylaşıldı!')
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'upload', label: 'Yükle', icon: Upload },
    { id: 'giphy', label: 'GIPHY Ara', icon: Search },
    { id: 'convert', label: 'Video→GIF', icon: Video },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3f]">
          <h2 className="font-bold text-lg">GIF Paylaş</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a3f]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                tab === id ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Upload Tab */}
          {tab === 'upload' && (
            <div>
              <input ref={fileRef} type="file" accept=".gif,image/gif" className="hidden" onChange={handleFileSelect} />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview" className="w-full rounded-xl max-h-60 object-contain bg-black/20" />
                  <button onClick={() => { setPreview(null); setSelectedFile(null) }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#3a3a5c] rounded-xl p-12 text-center cursor-pointer hover:border-brand-500 transition-colors group"
                >
                  <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3 group-hover:text-brand-400 transition-colors" />
                  <p className="text-gray-400 text-sm">GIF dosyasını seç veya sürükle</p>
                  <p className="text-gray-600 text-xs mt-1">Maks 10MB</p>
                </div>
              )}
            </div>
          )}

          {/* GIPHY Tab */}
          {tab === 'giphy' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  className="input flex-1"
                  placeholder="GIF ara..."
                  value={giphyQuery}
                  onChange={e => setGiphyQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchGiphy()}
                />
                <button onClick={searchGiphy} className="btn-primary px-4" disabled={giphyLoading}>
                  {giphyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {giphyResults.map(gif => (
                  <div
                    key={gif.id}
                    onClick={() => setSelectedGiphy(gif.url)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedGiphy === gif.url ? 'border-brand-500' : 'border-transparent hover:border-brand-500/50'
                    }`}
                  >
                    <img src={gif.preview} alt="" className="w-full h-28 object-cover" />
                    {selectedGiphy === gif.url && (
                      <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-brand-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {giphyResults.length === 0 && !giphyLoading && (
                <p className="text-center text-gray-500 text-sm py-6">Arama yap veya trending GIF'leri gör</p>
              )}
            </div>
          )}

          {/* Convert Tab */}
          {tab === 'convert' && (
            <div>
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files[0])} />
              {!convertedGif ? (
                <div className="space-y-3">
                  <div
                    onClick={() => videoRef.current?.click()}
                    className="border-2 border-dashed border-[#3a3a5c] rounded-xl p-10 text-center cursor-pointer hover:border-brand-500 transition-colors group"
                  >
                    <Video className="w-10 h-10 text-gray-500 mx-auto mb-3 group-hover:text-brand-400 transition-colors" />
                    <p className="text-gray-400 text-sm">{videoFile ? videoFile.name : 'Video seç (mp4, webm, mov)'}</p>
                    <p className="text-gray-600 text-xs mt-1">Maks 50MB</p>
                  </div>
                  {videoFile && (
                    <button onClick={handleVideoConvert} disabled={convertLoading} className="btn-primary w-full">
                      {convertLoading ? (
                        <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Dönüştürülüyor...</span>
                      ) : 'GIF\'e Dönüştür'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <img src={convertedGif} alt="converted" className="w-full rounded-xl max-h-60 object-contain bg-black/20" />
                  <button onClick={() => { setConvertedGif(null); setVideoFile(null) }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Caption & Tags & Music */}
          <div className="space-y-3 pt-2">
            <input className="input" placeholder="Açıklama yaz..." value={caption} onChange={e => setCaption(e.target.value)} />
            <input className="input" placeholder="Tag'ler (virgülle ayır: komedi, meme, ...)" value={tags} onChange={e => setTags(e.target.value)} />
            <input ref={musicFileRef} type="file" accept="audio/*" className="hidden" onChange={handleMusicSelect} />
            {musicFileName ? (
              <div className="flex items-center gap-3 bg-[#1a1a2e] border border-brand-500/30 rounded-xl px-3 py-2">
                <Music className="w-4 h-4 text-brand-400 flex-shrink-0" />
                <p className="text-sm text-gray-300 flex-1 truncate">{musicFileName}</p>
                <button onClick={() => { setMusicUrl(''); setMusicFileName('') }} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="YouTube linki yapıştır..."
                    value={ytInput}
                    onChange={e => setYtInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && extractYTMusic()}
                  />
                  <button type="button" onClick={extractYTMusic}
                    disabled={musicUploading || !ytInput.trim()}
                    className="btn-primary px-3 py-2 text-sm flex-shrink-0 flex items-center gap-1.5">
                    {musicUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                    {musicUploading ? 'Çıkarılıyor...' : 'Çıkar'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#2a2a3f]" />
                  <span className="text-xs text-gray-600">veya</span>
                  <div className="flex-1 h-px bg-[#2a2a3f]" />
                </div>
                <button type="button" onClick={() => musicFileRef.current?.click()} disabled={musicUploading}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border border-dashed border-[#3a3a5c] rounded-xl text-sm text-gray-500 hover:border-brand-500 hover:text-brand-400 transition-colors">
                  <Music className="w-4 h-4" />
                  MP3 / OGG / WAV dosyası yükle
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-[#2a2a3f]">
          <button onClick={publish} disabled={loading} className="btn-primary w-full py-3">
            {loading ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Paylaşılıyor...</span>
            ) : 'Paylaş'}
          </button>
        </div>
      </div>
    </div>
  )
}
