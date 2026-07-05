// iOS WKWebView ses motoru.
// KRİTİK: iOS'ta her yeni Audio() nesnesi ayrı kilit ister. Bu yüzden TEK bir
// kalıcı <audio> elementi yaratıp ilk dokunuşta açıyoruz (unlock), sonra sadece
// .src'sini değiştirip tekrar tekrar kullanıyoruz. Yeni nesne yaratmıyoruz —
// böylece kaydırdıkça müzik gecikmeden/kendiliğinden çalıyor.

let _audio = null
let _currentUrl = null
let _onPlay = null
let _onStop = null
let _unlocked = false
let _wasPlayingBeforeHide = false
let _pendingUrl = null // kilit açılmadan çalma istenirse burada bekler
const _prefetched = new Set()

const SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function _ensureEl() {
  if (_audio) return _audio
  const a = new Audio()
  a.loop = true
  a.volume = 1
  a.playsInline = true
  a.preload = 'auto'
  a.addEventListener('playing', () => _updateSession(true))
  a.addEventListener('pause', () => _updateSession(false))
  _audio = a
  return a
}

function _updateSession(playing) {
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused' } catch {}
  }
}

// İlk dokunuşta TEK kalıcı elementi user-gesture içinde çalıştırıp kilidini aç
async function _unlockAudio() {
  if (_unlocked) return
  try {
    // Web Audio context da aç (bazı iOS sürümleri için)
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) { const ctx = new Ctx(); await ctx.resume().catch(() => {}) }

    const a = _ensureEl()
    a.muted = true
    a.src = SILENT
    await a.play().catch(() => {})
    a.pause()
    a.muted = false
    a.currentTime = 0
    _unlocked = true
    window.dispatchEvent(new Event('gifwave-audio-unlocked'))
    // Kilit açılmadan önce çalınmak istenen müzik varsa şimdi başlat
    if (_pendingUrl) { const u = _pendingUrl; _pendingUrl = null; playGlobalAudio(u).catch(() => {}) }
  } catch (e) {}
}

;['touchstart', 'touchend', 'click'].forEach(ev =>
  document.addEventListener(ev, _unlockAudio, { once: false, passive: true })
)

// MediaSession: Denetim Merkezi play/pause butonları gerçekten çalışsın
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', () => { _audio && _audio.play().catch(() => {}) })
    navigator.mediaSession.setActionHandler('pause', () => { _audio && _audio.pause() })
  } catch {}
}

// Arka plana geçince duraklat, öne gelince devam ettir
document.addEventListener('visibilitychange', () => {
  if (!_audio) return
  if (document.hidden) {
    _wasPlayingBeforeHide = !_audio.paused
    _audio.pause()
  } else if (_wasPlayingBeforeHide) {
    _audio.play().catch(() => {})
  }
})

export function onMusicChange(playFn, stopFn) {
  _onPlay = playFn
  _onStop = stopFn
}

// Bir sonraki postun sesini önden ısıt (CDN/proxy cache) → kaydırınca anında çalar
export function prefetchAudio(url) {
  if (!url || _prefetched.has(url)) return
  _prefetched.add(url)
  try { fetch(url, { headers: { Range: 'bytes=0-1' } }).catch(() => {}) } catch {}
}

export async function playGlobalAudio(url) {
  if (!url) return
  if (_currentUrl === url && _audio && !_audio.paused) return

  // Kilit henüz açık değilse: beklet, ilk dokunuşta otomatik başlayacak
  if (!_unlocked) { _pendingUrl = url; return }

  const a = _ensureEl()
  _currentUrl = url
  if (a.src !== url) { a.src = url }
  try { a.currentTime = 0 } catch {}

  await a.play()
  // play() beklerken arka plana geçildiyse çalmaya başlama
  if (document.hidden) {
    a.pause()
    _wasPlayingBeforeHide = true
    return
  }
  _onPlay?.(url)
}

export function stopGlobalAudio() {
  // Elementi YOK ETME — kilidini koru, sadece durdur (tekrar kullanacağız)
  if (_audio) {
    _audio.pause()
    try { _audio.removeAttribute('src'); _audio.load() } catch {}
  }
  _currentUrl = null
  _pendingUrl = null
  _wasPlayingBeforeHide = false
  _onStop?.()
}

export function getCurrentUrl() { return _currentUrl }
export function isPlaying() { return !!_audio && !_audio.paused }
