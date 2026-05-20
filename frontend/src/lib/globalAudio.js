let _audio = null
let _currentUrl = null
let _onPlay = null
let _onStop = null

export function onMusicChange(playFn, stopFn) {
  _onPlay = playFn
  _onStop = stopFn
}

export async function playGlobalAudio(url) {
  if (!url) return
  if (_currentUrl === url && _audio && !_audio.paused) return

  if (_audio) {
    _audio.pause()
    _audio.src = ''
    _audio = null
  }

  _currentUrl = url
  const a = new Audio(url)
  a.loop = true
  a.volume = 1
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
