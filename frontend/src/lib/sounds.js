// Kaydedilen sesler ve "bu sesi kullan" akışı.
// Kaynak: Supabase `saved_sounds` tablosu (hesaba bağlı). Cihazdaki kopya (localStorage)
// yalnızca hızlı gösterim ve çevrimdışı yedek içindir; tablo henüz yoksa sessizce yalnız cihazda çalışır.
import { supabase } from './supabase'

const keyFor = userId => `gifwave_saved_sounds_${userId || 'anon'}`

export function getSavedSounds(userId) {
  try { return JSON.parse(localStorage.getItem(keyFor(userId)) || '[]') } catch { return [] }
}

function setLocal(userId, list) {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(list.slice(0, 100))) } catch {}
  window.dispatchEvent(new CustomEvent('gifwave-saved-sounds-changed'))
}

export function isSoundSaved(url, userId) {
  return getSavedSounds(userId).some(s => s.url === url)
}

// Hesaptaki kayıtları indir; cihazda kalmış (henüz gönderilmemiş) kayıtları hesaba yükle.
export async function syncSavedSounds(userId) {
  if (!userId) return
  const { data, error } = await supabase.from('saved_sounds')
    .select('url, title, from_username, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) {
    // Tablo yoksa / ağ hatası: cihazdaki liste kalsın; eski sürümün kayıtlarını bu hesaba taşı
    try {
      const legacy = JSON.parse(localStorage.getItem('gifwave_saved_sounds') || '[]')
      if (legacy.length) {
        const mine = getSavedSounds(userId)
        const have = new Set(mine.map(s => s.url))
        setLocal(userId, [...mine, ...legacy.filter(s => s?.url && !have.has(s.url))])
        localStorage.removeItem('gifwave_saved_sounds')
      }
    } catch {}
    return
  }
  const remote = (data || []).map(r => ({ url: r.url, title: r.title || '', from: r.from_username || '', savedAt: Date.parse(r.created_at) || 0 }))
  const remoteUrls = new Set(remote.map(r => r.url))
  // Eski sürümde hesaba bağlı olmadan kaydedilenleri de taşı
  let legacy = []
  try { legacy = JSON.parse(localStorage.getItem('gifwave_saved_sounds') || '[]') } catch {}
  const localOnly = [...getSavedSounds(userId), ...legacy].filter(s => s?.url && !remoteUrls.has(s.url))
  if (localOnly.length) {
    await supabase.from('saved_sounds').upsert(
      localOnly.map(s => ({ user_id: userId, url: s.url, title: s.title || null, from_username: s.from || null })),
      { onConflict: 'user_id,url', ignoreDuplicates: true })
    try { localStorage.removeItem('gifwave_saved_sounds') } catch {}
  }
  setLocal(userId, [...localOnly, ...remote])
}

// Kaydeder ya da kayıtlıysa kaldırır; yeni durumu döndürür (true = kayıtlı)
export function toggleSavedSound(sound, userId) {
  const list = getSavedSounds(userId)
  const i = list.findIndex(s => s.url === sound.url)
  if (i >= 0) {
    list.splice(i, 1)
    if (userId) supabase.from('saved_sounds').delete().eq('user_id', userId).eq('url', sound.url).then(() => {}, () => {})
  } else {
    list.unshift({ url: sound.url, title: sound.title || '', from: sound.from || '', savedAt: Date.now() })
    if (userId) supabase.from('saved_sounds')
      .upsert({ user_id: userId, url: sound.url, title: sound.title || null, from_username: sound.from || null },
        { onConflict: 'user_id,url', ignoreDuplicates: true }).then(() => {}, () => {})
  }
  setLocal(userId, list)
  return i < 0
}

// Paylaşım penceresini bu ses seçili olarak açar (Navbar dinler)
export function useSoundInNewPost(sound) {
  window.dispatchEvent(new CustomEvent('gifwave-use-sound', { detail: sound }))
}
