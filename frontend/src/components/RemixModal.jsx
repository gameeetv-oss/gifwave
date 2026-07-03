import { useState } from 'react'
import { X, Music, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// Başkasının GIF'ini kendi müziğinle yeniden paylaş (duet/remix)
export default function RemixModal({ post, onClose }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [caption, setCaption] = useState('')
  const [ytInput, setYtInput] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [musicFileName, setMusicFileName] = useState('')
  const [musicUploading, setMusicUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const originalUsername = post.profiles?.username || 'anonim'

  async function addYTMusic() {
    const trimmed = ytInput.trim()
    if (!trimmed) return
    setMusicUploading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/music/extract?url=${encodeURIComponent(trimmed)}`, { method: 'POST' })
      if (!res.ok) throw new Error('extract_failed')
      const data = await res.json()
      setMusicUrl(data.url); setMusicFileName(data.title || t('gifcard.ytTitle'))
      toast.success(t('upload.musicAdded'))
    } catch {
      setMusicUrl(trimmed); setMusicFileName(t('gifcard.ytTitle'))
      toast.success(t('upload.musicAdded'))
    } finally { setMusicUploading(false); setYtInput('') }
  }

  async function handleMusicFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('audio/')) { if (file) toast.error(t('upload.audioFile')); return }
    if (file.size > 50 * 1024 * 1024) { toast.error(t('upload.maxAudioSize')); return }
    setMusicUploading(true)
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('music').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('music').getPublicUrl(path)
      setMusicUrl(publicUrl); setMusicFileName(file.name)
      toast.success(t('upload.musicUploaded'))
    } catch { toast.error(t('upload.musicUploadError')) }
    finally { setMusicUploading(false) }
  }

  async function publish() {
    if (!user) return
    if (!musicUrl) { toast.error(t('remix.pickMusic')); return }
    setPublishing(true)
    try {
      const attribution = `🎵 remix: @${originalUsername}`
      const finalCaption = caption.trim() ? `${caption.trim()} · ${attribution}` : attribution
      const tagArr = [...new Set([...(post.tags || []), 'remix'])]
      const { error } = await supabase.from('posts').insert({
        user_id: user.id, gif_url: post.gif_url, caption: finalCaption,
        tags: tagArr, source: 'remix', music_url: musicUrl,
        likes_count: 0, comments_count: 0,
      })
      if (error) throw error
      if (post.user_id !== user.id) {
        supabase.from('notifications').insert({ user_id: post.user_id, type: 'repost', from_user_id: user.id, post_id: post.id })
      }
      toast.success(t('remix.shared'))
      onClose()
    } catch (err) { toast.error(err.message || t('upload.uploadError')) }
    finally { setPublishing(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3f]">
          <h2 className="font-bold text-lg">{t('remix.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="relative">
            <img src={post.gif_url} alt="" className="w-full rounded-xl max-h-52 object-contain bg-black/20" />
            <span className="absolute bottom-2 left-2 bg-black/60 rounded-full px-2 py-0.5 text-xs text-white">
              @{originalUsername}
            </span>
          </div>
          <p className="text-xs text-gray-500">{t('remix.desc', { username: originalUsername })}</p>

          {musicFileName ? (
            <div className="flex items-center gap-3 bg-[#1a1a2e] border border-brand-500/30 rounded-xl px-3 py-2">
              <Music className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <p className="text-sm text-gray-300 flex-1 truncate">{musicFileName}</p>
              <button onClick={() => { setMusicUrl(''); setMusicFileName('') }} className="text-gray-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder={t('upload.ytPlaceholder')}
                  value={ytInput} onChange={e => setYtInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addYTMusic()} />
                <button type="button" onClick={addYTMusic} disabled={!ytInput.trim() || musicUploading}
                  className="btn-primary px-3 py-2 text-sm flex-shrink-0 flex items-center gap-1.5">
                  {musicUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                </button>
              </div>
              <label className="w-full flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border border-dashed border-[#3a3a5c] rounded-xl text-sm text-gray-500 hover:border-brand-500 hover:text-brand-400 transition-colors cursor-pointer">
                <Music className="w-4 h-4" /> {t('upload.uploadFile')}
                <input type="file" accept="audio/*" className="hidden" onChange={handleMusicFile} />
              </label>
            </div>
          )}

          <input className="input w-full" placeholder={t('upload.caption')}
            value={caption} onChange={e => setCaption(e.target.value)} />
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-[#2a2a3f]">
          <button onClick={publish} disabled={publishing || !musicUrl} className="btn-primary w-full py-3 disabled:opacity-50">
            {publishing
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('upload.publishing')}</span>
              : t('remix.publish')}
          </button>
        </div>
      </div>
    </div>
  )
}
