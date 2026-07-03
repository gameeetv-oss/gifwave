import { useState, useRef, useEffect } from 'react'
import { X, Upload, Search, Video, Loader2, Check, Music, Trash2, Camera, Image, Type, Scissors, Play, Pause } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function TextOverlayEditor({ textOverlay, setTextOverlay, showTextOverlay, setShowTextOverlay,
  textSize, setTextSize, textColor, setTextColor, textPos, setTextPos, textBold, setTextBold,
  TEXT_COLORS, TEXT_POS_LABEL, t }) {
  return (
    <div className="space-y-2 bg-[#12121e] border border-[#2a2a3f] rounded-xl p-3">
      <div className="flex gap-2 items-center">
        <Type className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input className="input flex-1 text-sm py-1.5" placeholder={t('upload.addText')}
          value={textOverlay} onChange={e => { setTextOverlay(e.target.value); if (e.target.value) setShowTextOverlay(true) }} />
        {textOverlay && (
          <button onClick={() => setShowTextOverlay(s => !s)}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors flex-shrink-0 ${showTextOverlay ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-600 text-gray-500'}`}>
            {showTextOverlay ? t('upload.visible') : t('upload.hidden')}
          </button>
        )}
      </div>
      {textOverlay && (
        <>
          {/* Boyut */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10">{t('upload.size')}</span>
            <input type="range" min={14} max={52} value={textSize} onChange={e => setTextSize(+e.target.value)}
              className="flex-1 accent-brand-500 h-1" />
            <span className="text-xs text-gray-400 w-6 text-right">{textSize}</span>
            <button onClick={() => setTextBold(b => !b)}
              className={`text-xs px-2 py-0.5 rounded font-bold border transition-colors ${textBold ? 'border-brand-500 text-brand-400' : 'border-gray-600 text-gray-500'}`}>B</button>
          </div>
          {/* Renk */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10">{t('upload.color')}</span>
            <div className="flex gap-1.5">
              {TEXT_COLORS.map(c => (
                <button key={c} onClick={() => setTextColor(c)}
                  style={{ background: c }}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${textColor === c ? 'border-white scale-125' : 'border-transparent'}`} />
              ))}
            </div>
          </div>
          {/* Konum */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10">{t('upload.position')}</span>
            <div className="flex gap-1">
              {Object.entries(TEXT_POS_LABEL).map(([pos, label]) => (
                <button key={pos} onClick={() => setTextPos(pos)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${textPos === pos ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-600 text-gray-500 hover:border-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function OverlayPreview({ textOverlay, showTextOverlay, textSize, textColor, textPos, textBold }) {
  if (!textOverlay || !showTextOverlay) return null
  const pos = textPos === 'top' ? 'top-3' : textPos === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-3'
  return (
    <div className={`absolute inset-x-0 ${pos} text-center pointer-events-none px-3`}>
      <p style={{ fontSize: textSize, color: textColor, fontWeight: textBold ? 800 : 400,
        textShadow: '0 2px 8px rgba(0,0,0,0.9)', WebkitTextStroke: textBold ? '0.5px rgba(0,0,0,0.5)' : 'none' }}
        className="leading-tight">
        {textOverlay}
      </p>
    </div>
  )
}

export default function UploadModal({ onClose, onSuccess }) {
  const { user, isPremium } = useAuth()
  const { t } = useTranslation()
  const [tab, setTab] = useState('upload')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [musicFileName, setMusicFileName] = useState('')
  const [musicUploading, setMusicUploading] = useState(false)
  const [ytInput, setYtInput] = useState('')
  const musicFileRef = useRef()

  // Müzik kırpma
  const trimAudioRef = useRef(null)
  const trimTimerRef = useRef(null)
  const [musicDuration, setMusicDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimLen, setTrimLen] = useState(30)
  const [trimming, setTrimming] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const canTrim = musicUrl.includes('/storage/v1/object/public/music/')
  const [loading, setLoading] = useState(false)

  const fileRef = useRef()
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fileType, setFileType] = useState('gif')

  const [giphyQuery, setGiphyQuery] = useState('')
  const [giphyResults, setGiphyResults] = useState([])
  const [selectedGiphy, setSelectedGiphy] = useState(null)
  const [giphyLoading, setGiphyLoading] = useState(false)

  const videoRef2 = useRef()
  const [videoFile, setVideoFile] = useState(null)
  const [convertedGif, setConvertedGif] = useState(null)
  const [convertLoading, setConvertLoading] = useState(false)

  // Kamera: getUserMedia/MediaRecorder iOS WKWebView'da crash yapıyordu.
  // Native file input (capture) iOS'un kendi kamerasını açar — güvenilir yol.
  const cameraPhotoInputRef = useRef()
  const cameraVideoInputRef = useRef()
  const [cameraVideoFile, setCameraVideoFile] = useState(null)
  const [cameraConverted, setCameraConverted] = useState(null)
  const [cameraConvertLoading, setCameraConvertLoading] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [cameraMode, setCameraMode] = useState('video')

  const [textOverlay, setTextOverlay] = useState('')
  const [showTextOverlay, setShowTextOverlay] = useState(false)
  const [textSize, setTextSize] = useState(24)
  const [textColor, setTextColor] = useState('#ffffff')
  const [textPos, setTextPos] = useState('top')
  const [textBold, setTextBold] = useState(true)

  const TEXT_COLORS = ['#ffffff','#000000','#ffff00','#ff3b3b','#3bdfff','#3bff6e','#ff8c00','#ff3bff']
  const TEXT_POS_LABEL = {
    top: t('upload.posTop'),
    center: t('upload.posCenter'),
    bottom: t('upload.posBottom')
  }

  useEffect(() => {
    // Müzik değişince kırpma durumunu sıfırla ve süreyi öğren
    setMusicDuration(0); setTrimStart(0); setPreviewing(false)
    stopTrimPreview()
    if (!canTrim) return
    const a = new Audio(musicUrl)
    a.preload = 'metadata'
    a.onloadedmetadata = () => { if (isFinite(a.duration)) setMusicDuration(a.duration) }
    trimAudioRef.current = a
    return () => { a.src = ''; trimAudioRef.current = null }
  }, [musicUrl])

  function stopTrimPreview() {
    clearTimeout(trimTimerRef.current)
    if (trimAudioRef.current) trimAudioRef.current.pause()
    setPreviewing(false)
  }

  function previewTrim() {
    const a = trimAudioRef.current
    if (!a) return
    if (previewing) { stopTrimPreview(); return }
    a.currentTime = trimStart
    a.play().then(() => {
      setPreviewing(true)
      trimTimerRef.current = setTimeout(stopTrimPreview, trimLen * 1000)
    }).catch(() => {})
  }

  async function applyTrim() {
    if (!canTrim) return
    stopTrimPreview()
    setTrimming(true)
    try {
      const res = await fetch(`${BACKEND_URL}/music/trim?url=${encodeURIComponent(musicUrl)}&start=${trimStart.toFixed(1)}&duration=${trimLen}`,
        { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || t('upload.trimError'))
      }
      const data = await res.json()
      setMusicUrl(data.url)
      toast.success(t('upload.trimmed'))
    } catch (err) {
      toast.error(err.message || t('upload.trimError'))
    } finally { setTrimming(false) }
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const isGif = file.type === 'image/gif' || file.name.endsWith('.gif')
    const isImage = file.type.startsWith('image/')
    if (!isImage) { toast.error(t('upload.onlyImages')); return }
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setFileType(isGif ? 'gif' : 'image')
  }

  async function searchGiphy() {
    if (!giphyQuery.trim()) return
    setGiphyLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/giphy/search?q=${encodeURIComponent(giphyQuery)}`)
      const data = await res.json()
      setGiphyResults(data.gifs || [])
    } catch { toast.error(t('upload.giphyError')) }
    finally { setGiphyLoading(false) }
  }

  async function handleVideoConvert() {
    if (!videoFile) return
    setConvertLoading(true)
    try {
      const form = new FormData()
      form.append('file', videoFile)
      const res = await fetch(`${BACKEND_URL}/convert`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(t('upload.convertError'))
      const blob = await res.blob()
      setConvertedGif(URL.createObjectURL(blob))
      toast.success(t('upload.gifReady'))
    } catch (err) { toast.error(err.message) }
    finally { setConvertLoading(false) }
  }

  function handleCameraPhoto(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setCapturedPhoto({ blob: file, url: URL.createObjectURL(file) })
  }

  function handleCameraVideo(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { toast.error(t('upload.videoMaxSize')); return }
    setCameraVideoFile(file)
  }

  async function convertCameraVideo() {
    if (!cameraVideoFile) return
    setCameraConvertLoading(true)
    try {
      const form = new FormData()
      form.append('file', cameraVideoFile)
      const res = await fetch(`${BACKEND_URL}/convert`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(t('upload.convertError'))
      const blob = await res.blob()
      setCameraConverted(URL.createObjectURL(blob))
      toast.success(t('upload.gifReady'))
    } catch (err) { toast.error(err.message) }
    finally { setCameraConvertLoading(false) }
  }

  async function addYTMusic() {
    const trimmed = ytInput.trim()
    if (!trimmed) return
    try {
      const u = new URL(trimmed)
      const isYT = u.hostname.includes('youtube.com') || u.hostname === 'youtu.be' || u.hostname.includes('music.youtube.com')
      if (!isYT) { toast.error(t('upload.invalidYoutubeLink')); return }
    } catch { toast.error(t('upload.invalidUrl')); return }
    setMusicUploading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/music/extract?url=${encodeURIComponent(trimmed)}`, { method: 'POST' })
      if (!res.ok) throw new Error('extract_failed')
      const data = await res.json()
      setMusicUrl(data.url); setMusicFileName(data.title || t('gifcard.ytTitle'))
      toast.success(t('upload.musicAdded'))
    } catch {
      // Extract başarısız olsa da GIFCard artık YouTube linkini backend /music/proxy ile çalıyor
      setMusicUrl(trimmed); setMusicFileName(t('gifcard.ytTitle'))
      toast.success(t('upload.musicAdded'))
    } finally { setMusicUploading(false); setYtInput('') }
  }

  async function handleMusicSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')
    if (!isAudio && !isVideo) { toast.error(t('upload.audioFile')); return }
    if (file.size > 50 * 1024 * 1024) { toast.error(t('upload.maxAudioSize')); return }
    setMusicUploading(true)
    try {
      let uploadFile = file
      let uploadName = file.name
      let contentType = file.type

      if (isVideo) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${BACKEND_URL}/extract-audio`, { method: 'POST', body: form })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || t('upload.musicUploadError'))
        }
        const audioBlob = await res.blob()
        uploadFile = audioBlob
        uploadName = file.name.replace(/\.[^/.]+$/, '') + '.mp3'
        contentType = 'audio/mpeg'
      }

      const path = `${user.id}/${Date.now()}_${uploadName}`
      const { error } = await supabase.storage.from('music').upload(path, uploadFile, { contentType })
      if (error) { toast.error(t('upload.musicUploadError')); return }
      const { data: { publicUrl } } = supabase.storage.from('music').getPublicUrl(path)
      setMusicUrl(publicUrl); setMusicFileName(uploadName)
      toast.success(t('upload.musicUploaded'))
    } catch (err) {
      toast.error(err.message || t('upload.musicUploadError'))
    } finally { setMusicUploading(false) }
  }

  async function publish() {
    if (!user) return
    setLoading(true)
    try {
      if (!isPremium) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('created_at', today.toISOString())
        if ((count || 0) >= 5) {
          toast.error(t('upload.dailyLimit'))
          setLoading(false); return
        }
      }
      let gifUrl = null
      let source = 'upload'

      if (tab === 'upload') {
        if (!selectedFile) { toast.error(t('upload.selectFile')); setLoading(false); return }
        const ext = fileType === 'gif' ? 'gif' : selectedFile.name.split('.').pop() || 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('gifs').upload(path, selectedFile)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
        gifUrl = publicUrl
        source = fileType === 'gif' ? 'upload' : 'photo'
      } else if (tab === 'giphy') {
        if (!selectedGiphy) { toast.error(t('upload.selectGif')); setLoading(false); return }
        gifUrl = selectedGiphy; source = 'giphy'
      } else if (tab === 'convert') {
        if (!convertedGif) { toast.error(t('upload.convertFirst')); setLoading(false); return }
        const blob = await fetch(convertedGif).then(r => r.blob())
        const path = `${user.id}/${Date.now()}.gif`
        const { error: upErr } = await supabase.storage.from('gifs').upload(path, blob, { contentType: 'image/gif' })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
        gifUrl = publicUrl; source = 'converted'
      } else if (tab === 'camera') {
        if (capturedPhoto) {
          const photoType = capturedPhoto.blob.type || 'image/jpeg'
          const photoExt = photoType.includes('png') ? 'png' : photoType.includes('heic') ? 'heic' : 'jpg'
          const path = `${user.id}/${Date.now()}.${photoExt}`
          const { error: upErr } = await supabase.storage.from('gifs').upload(path, capturedPhoto.blob, { contentType: photoType })
          if (upErr) throw upErr
          const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
          gifUrl = publicUrl; source = 'photo'
        } else if (cameraConverted) {
          const blob = await fetch(cameraConverted).then(r => r.blob())
          const path = `${user.id}/${Date.now()}.gif`
          const { error: upErr } = await supabase.storage.from('gifs').upload(path, blob, { contentType: 'image/gif' })
          if (upErr) throw upErr
          const { data: { publicUrl } } = supabase.storage.from('gifs').getPublicUrl(path)
          gifUrl = publicUrl; source = 'camera'
        } else {
          toast.error(t('upload.takePicture')); setLoading(false); return
        }
      }

      const tagArr = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      const { error } = await supabase.from('posts').insert({
        user_id: user.id, gif_url: gifUrl, caption: caption.trim() || null,
        tags: tagArr, source, music_url: musicUrl.trim() || null,
        text_overlay: textOverlay.trim() ? JSON.stringify({ text: textOverlay.trim(), size: textSize, color: textColor, pos: textPos, bold: textBold }) : null,
        show_overlay: showTextOverlay && !!textOverlay.trim(),
        likes_count: 0, comments_count: 0
      })
      if (error) throw error
      toast.success(t('upload.shared'))
      onSuccess?.(); onClose()
    } catch (err) { toast.error(err.message || t('upload.uploadError')) }
    finally { setLoading(false) }
  }

  const tabs = [
    { id: 'upload', label: t('upload.uploadTab'), icon: Upload },
    { id: 'camera', label: t('upload.cameraTab'), icon: Camera },
    { id: 'giphy', label: t('upload.giphyTab'), icon: Search },
    { id: 'convert', label: t('upload.convertTab'), icon: Video },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3f]">
          <h2 className="font-bold text-lg">{t('upload.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a3f] overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-shrink-0 flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                tab === id ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Upload Tab */}
          {tab === 'upload' && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview" className="w-full rounded-xl max-h-60 object-contain bg-black/20" />
                  {fileType === 'image' && (
                    <div className="absolute top-2 left-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-white">
                      <Image className="w-3 h-3" /> {t('upload.photo')}
                    </div>
                  )}
                  <button onClick={() => { setPreview(null); setSelectedFile(null) }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#3a3a5c] rounded-xl p-12 text-center cursor-pointer hover:border-brand-500 transition-colors group">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Upload className="w-8 h-8 text-gray-500 group-hover:text-brand-400 transition-colors" />
                    <Image className="w-8 h-8 text-gray-500 group-hover:text-brand-400 transition-colors" />
                  </div>
                  <p className="text-gray-400 text-sm">{t('upload.gifOrPhoto')}</p>
                  <p className="text-gray-600 text-xs mt-1">{t('upload.maxSize')}</p>
                </div>
              )}
            </div>
          )}

          {/* Camera Tab — native iOS/Android kamera (input capture) */}
          {tab === 'camera' && (
            <div className="space-y-3">
              <input ref={cameraPhotoInputRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handleCameraPhoto} />
              <input ref={cameraVideoInputRef} type="file" accept="video/*" capture="environment"
                className="hidden" onChange={handleCameraVideo} />
              {!cameraVideoFile && !cameraConverted && !capturedPhoto && (
                <>
                  <div className="flex rounded-xl overflow-hidden border border-[#3a3a5c]">
                    <button onClick={() => setCameraMode('photo')}
                      className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${cameraMode === 'photo' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Image className="w-3.5 h-3.5" /> {t('upload.photo')}
                    </button>
                    <button onClick={() => setCameraMode('video')}
                      className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${cameraMode === 'video' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Video className="w-3.5 h-3.5" /> {t('upload.videoToGif')}
                    </button>
                  </div>
                  <div onClick={() => (cameraMode === 'photo' ? cameraPhotoInputRef : cameraVideoInputRef).current?.click()}
                    className="border-2 border-dashed border-[#3a3a5c] rounded-xl p-12 text-center cursor-pointer hover:border-brand-500 transition-colors group">
                    <Camera className="w-12 h-12 text-gray-500 mx-auto mb-3 group-hover:text-brand-400 transition-colors" />
                    <p className="text-gray-400 text-sm">{t('upload.openCamera')}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {cameraMode === 'photo' ? t('upload.takePhoto') : t('upload.videoToGif')}
                    </p>
                  </div>
                </>
              )}
              {capturedPhoto && (
                <div className="space-y-2">
                  <div className="relative">
                    <img src={capturedPhoto.url} alt="foto" className="w-full rounded-xl max-h-60 object-contain bg-black/20" />
                    <OverlayPreview textOverlay={textOverlay} showTextOverlay={showTextOverlay} textSize={textSize} textColor={textColor} textPos={textPos} textBold={textBold} />
                    <button onClick={() => { setCapturedPhoto(null); setTextOverlay(''); setShowTextOverlay(false) }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <TextOverlayEditor textOverlay={textOverlay} setTextOverlay={setTextOverlay}
                    showTextOverlay={showTextOverlay} setShowTextOverlay={setShowTextOverlay}
                    textSize={textSize} setTextSize={setTextSize}
                    textColor={textColor} setTextColor={setTextColor}
                    textPos={textPos} setTextPos={setTextPos}
                    textBold={textBold} setTextBold={setTextBold}
                    TEXT_COLORS={TEXT_COLORS} TEXT_POS_LABEL={TEXT_POS_LABEL} t={t} />
                </div>
              )}
              {cameraVideoFile && !cameraConverted && (
                <div className="space-y-2">
                  <div className="relative">
                    <video src={URL.createObjectURL(cameraVideoFile)} className="w-full rounded-xl max-h-60 bg-black/20" controls playsInline />
                    <button onClick={() => setCameraVideoFile(null)}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={convertCameraVideo} disabled={cameraConvertLoading}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                    {cameraConvertLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('upload.converting')}</>
                      : <><Video className="w-4 h-4" /> {t('upload.convertToGif')}</>}
                  </button>
                </div>
              )}
              {cameraConverted && (
                <div className="space-y-2">
                  <div className="relative">
                    <img src={cameraConverted} alt="camera gif" className="w-full rounded-xl max-h-60 object-contain bg-black/20" />
                    <OverlayPreview textOverlay={textOverlay} showTextOverlay={showTextOverlay} textSize={textSize} textColor={textColor} textPos={textPos} textBold={textBold} />
                    <button onClick={() => { setCameraConverted(null); setCameraVideoFile(null); setTextOverlay(''); setShowTextOverlay(false) }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <TextOverlayEditor textOverlay={textOverlay} setTextOverlay={setTextOverlay}
                    showTextOverlay={showTextOverlay} setShowTextOverlay={setShowTextOverlay}
                    textSize={textSize} setTextSize={setTextSize}
                    textColor={textColor} setTextColor={setTextColor}
                    textPos={textPos} setTextPos={setTextPos}
                    textBold={textBold} setTextBold={setTextBold}
                    TEXT_COLORS={TEXT_COLORS} TEXT_POS_LABEL={TEXT_POS_LABEL} t={t} />
                </div>
              )}
            </div>
          )}

          {/* GIPHY Tab */}
          {tab === 'giphy' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input className="input flex-1" placeholder={t('upload.searchGifPlaceholder')}
                  value={giphyQuery} onChange={e => setGiphyQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchGiphy()} />
                <button onClick={searchGiphy} className="btn-primary px-4" disabled={giphyLoading}>
                  {giphyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {giphyResults.map(gif => (
                  <div key={gif.id} onClick={() => setSelectedGiphy(gif.url)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedGiphy === gif.url ? 'border-brand-500' : 'border-transparent hover:border-brand-500/50'
                    }`}>
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
                <p className="text-center text-gray-500 text-sm py-6">{t('upload.searchGif')}</p>
              )}
            </div>
          )}

          {/* Convert Tab */}
          {tab === 'convert' && (
            <div>
              <input ref={videoRef2} type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files[0])} />
              {!convertedGif ? (
                <div className="space-y-3">
                  <div onClick={() => videoRef2.current?.click()}
                    className="border-2 border-dashed border-[#3a3a5c] rounded-xl p-10 text-center cursor-pointer hover:border-brand-500 transition-colors group">
                    <Video className="w-10 h-10 text-gray-500 mx-auto mb-3 group-hover:text-brand-400 transition-colors" />
                    <p className="text-gray-400 text-sm">{videoFile ? videoFile.name : t('upload.videoSelect')}</p>
                    <p className="text-gray-600 text-xs mt-1">{t('upload.videoMaxSize')}</p>
                  </div>
                  {videoFile && (
                    <button onClick={handleVideoConvert} disabled={convertLoading} className="btn-primary w-full">
                      {convertLoading
                        ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('upload.converting')}</span>
                        : t('upload.convertToGif')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <img src={convertedGif} alt="converted" className="w-full rounded-xl max-h-60 object-contain bg-black/20" />
                    <OverlayPreview textOverlay={textOverlay} showTextOverlay={showTextOverlay} textSize={textSize} textColor={textColor} textPos={textPos} textBold={textBold} />
                    <button onClick={() => { setConvertedGif(null); setVideoFile(null); setTextOverlay(''); setShowTextOverlay(false) }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <TextOverlayEditor textOverlay={textOverlay} setTextOverlay={setTextOverlay}
                    showTextOverlay={showTextOverlay} setShowTextOverlay={setShowTextOverlay}
                    textSize={textSize} setTextSize={setTextSize}
                    textColor={textColor} setTextColor={setTextColor}
                    textPos={textPos} setTextPos={setTextPos}
                    textBold={textBold} setTextBold={setTextBold}
                    TEXT_COLORS={TEXT_COLORS} TEXT_POS_LABEL={TEXT_POS_LABEL} t={t} />
                </div>
              )}
            </div>
          )}

          {/* Caption & Tags & Music */}
          <div className="space-y-3 pt-2">
            <input className="input" placeholder={t('upload.caption')} value={caption} onChange={e => setCaption(e.target.value)} />
            <input className="input" placeholder={t('upload.tags')} value={tags} onChange={e => setTags(e.target.value)} />
            <input ref={musicFileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleMusicSelect} />
            {musicFileName ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-[#1a1a2e] border border-brand-500/30 rounded-xl px-3 py-2">
                  <Music className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <p className="text-sm text-gray-300 flex-1 truncate">{musicFileName}</p>
                  <button onClick={() => { stopTrimPreview(); setMusicUrl(''); setMusicFileName('') }} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {canTrim && musicDuration > 16 && (
                  <div className="bg-[#12121e] border border-[#2a2a3f] rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400 flex-1">{t('upload.trimTitle')}</span>
                      {[15, 30].filter(l => musicDuration > l).map(l => (
                        <button key={l} onClick={() => { setTrimLen(l); if (trimStart > musicDuration - l) setTrimStart(Math.max(0, musicDuration - l)) }}
                          className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${trimLen === l ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-600 text-gray-500'}`}>
                          {l}s
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-9">{fmtTime(trimStart)}</span>
                      <input type="range" min={0} max={Math.max(0, musicDuration - trimLen)} step={0.5}
                        value={trimStart}
                        onChange={e => { setTrimStart(+e.target.value); stopTrimPreview() }}
                        className="flex-1 accent-brand-500 h-1" />
                      <span className="text-xs text-gray-500 w-9 text-right">{fmtTime(Math.min(musicDuration, trimStart + trimLen))}</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={previewTrim}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:border-brand-500 transition-colors">
                        {previewing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {previewing ? t('upload.stopPreview') : t('upload.previewTrim')}
                      </button>
                      <button type="button" onClick={applyTrim} disabled={trimming}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50">
                        {trimming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                        {trimming ? t('upload.trimming') : t('upload.applyTrim')}
                      </button>
                    </div>
                  </div>
                )}
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
                    {musicUploading ? t('upload.adding') : t('upload.addMusic')}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#2a2a3f]" />
                  <span className="text-xs text-gray-600">{t('upload.orText')}</span>
                  <div className="flex-1 h-px bg-[#2a2a3f]" />
                </div>
                <button type="button" onClick={() => musicFileRef.current?.click()} disabled={musicUploading}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border border-dashed border-[#3a3a5c] rounded-xl text-sm text-gray-500 hover:border-brand-500 hover:text-brand-400 transition-colors">
                  <Music className="w-4 h-4" /> {t('upload.uploadFile')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-[#2a2a3f]">
          <button onClick={publish} disabled={loading} className="btn-primary w-full py-3">
            {loading
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('upload.publishing')}</span>
              : t('upload.publish')}
          </button>
        </div>
      </div>
    </div>
  )
}
