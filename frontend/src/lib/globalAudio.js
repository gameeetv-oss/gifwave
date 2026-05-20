let _audio = null
let _currentUrl = null
let _onPlay = null
let _onStop = null
let _unlocked = false

async function _unlockAudio() {
  if (_unlocked) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
    await ctx.resume()
    // Silent HTML5 audio unlock
    const a = document.createElement('audio')
    a.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    a.volume = 0
    await a.play().catch(() => {})
    _unlocked = true
  } catch (e) {}
}

// İlk dokunuşta unlock
;['touchstart', 'touchend', 'click'].forEach(ev =>
  document.addEventListener(ev, _unlockAudio, { once: false, passive: true })
)

export function onMusicChange(playFn, stopFn) {
  _onPlay = playFn
  _onStop = stopFn
}

export async function playGlobalAudio(url) {
  if (!url) return
  if (_currentUrl === url && _audio && !_audio.paused) return

  await _unlockAudio()

  if (_audio) {
    _audio.pause()
    _audio.src = ''
    _audio = null
  }

  _currentUrl = url
  const a = new Audio(url)
  a.loop = true
  a.volume = 1
  a.playsInline = true
  _audio = a

  await a.play()
  _onPlay?.(url)
}

export function stopGlobalAudio() {
  if (_audio) {
    _audio.pause()
    _audio.src = ''
    _audio = null
  }
  _currentUrl = null
  _onStop?.()
}

export function getCurrentUrl() { return _currentUrl }
export function isPlaying() { return !!_audio && !_audio.paused }
