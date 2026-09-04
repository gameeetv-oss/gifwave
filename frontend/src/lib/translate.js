// Çeviri önbelleği: aynı metin ikinci kez çevrilmez. Feed yüklenirken caption'lar
// önden çevrilip buraya cache'lenir; GIFCard o posta gelince sonuç ANINDA hazır olur.

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gifwave-backend.onrender.com'
const _cache = new Map() // key: `${target}:${text}` -> Promise<result|null>

export function translateText(text, target) {
  const t = (text || '').trim()
  const lang = (target || 'tr').split('-')[0]
  if (!t || t.length < 2) return Promise.resolve(null)
  const key = `${lang}:${t}`
  if (_cache.has(key)) return _cache.get(key)

  const p = fetch(`${BACKEND}/translate?text=${encodeURIComponent(t)}&target=${lang}`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      // Güvenlik ağı: backend eski/hatalı ise MyMemory kota uyarısını caption olarak GÖSTERME
      const tr = (data?.translated || '').toUpperCase()
      if (tr.includes('MYMEMORY WARNING') || tr.includes('USED ALL AVAILABLE') || tr.includes('INVALID LANGUAGE PAIR')) {
        _cache.delete(key) // cache'leme ki kota resetlenince tekrar denesin
        return null
      }
      return data
    })
    .catch(() => null)
  _cache.set(key, p)
  return p
}

// Feed yüklenince çağrılır: verilen postların caption'larını arka planda önden çevir
export function prewarmTranslations(posts, target) {
  if (!Array.isArray(posts)) return
  for (const p of posts) {
    if (p?.caption) translateText(p.caption, target)
  }
}
