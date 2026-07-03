import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Kategori → feed'de boost edilecek tag listesi (TR + EN karşılıkları)
const CATEGORIES = [
  { id: 'comedy', emoji: '😂', tags: ['funny', 'meme', 'comedy', 'komedi', 'mizah', 'komik'] },
  { id: 'animals', emoji: '🐱', tags: ['cat', 'dog', 'animals', 'kedi', 'kopek', 'hayvan', 'pet'] },
  { id: 'sports', emoji: '⚽', tags: ['sports', 'spor', 'football', 'futbol', 'boxing', 'basketball', 'gym'] },
  { id: 'gaming', emoji: '🎮', tags: ['gaming', 'oyun', 'game', 'minecraft', 'gta', 'cs'] },
  { id: 'music', emoji: '🎵', tags: ['music', 'muzik', 'dance', 'dans', 'rap', 'pop'] },
  { id: 'movies', emoji: '🎬', tags: ['movie', 'film', 'dizi', 'anime', 'series', 'netflix'] },
  { id: 'nature', emoji: '🌿', tags: ['nature', 'doga', 'travel', 'gezi', 'manzara'] },
  { id: 'food', emoji: '🍕', tags: ['food', 'yemek', 'tarif', 'cooking'] },
  { id: 'cars', emoji: '🚗', tags: ['car', 'araba', 'cars', 'motor', 'drift'] },
  { id: 'fashion', emoji: '👗', tags: ['fashion', 'moda', 'style', 'stil'] },
  { id: 'art', emoji: '🎨', tags: ['art', 'sanat', 'design', 'tasarim', 'cizim'] },
  { id: 'tech', emoji: '💻', tags: ['tech', 'teknoloji', 'coding', 'yazilim', 'ai'] },
]

export function shouldShowInterestPicker() {
  try {
    return !localStorage.getItem('gifwave_interests') && !localStorage.getItem('gifwave_interests_skipped')
  } catch { return false }
}

export default function InterestPicker({ onClose }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(new Set())

  function toggle(id) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function save() {
    const tags = CATEGORIES.filter(c => selected.has(c.id)).flatMap(c => c.tags)
    try { localStorage.setItem('gifwave_interests', JSON.stringify(tags)) } catch {}
    onClose(true)
  }

  function skip() {
    try { localStorage.setItem('gifwave_interests_skipped', '1') } catch {}
    onClose(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-md max-h-[85vh] flex flex-col animate-slide-up"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-5 pt-5 pb-3 text-center">
          <Sparkles className="w-8 h-8 text-brand-400 mx-auto mb-2" />
          <h2 className="font-bold text-lg text-white">{t('interests.title')}</h2>
          <p className="text-gray-400 text-sm mt-1">{t('interests.subtitle')}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => toggle(c.id)}
                className={`relative rounded-xl border px-2 py-3 flex flex-col items-center gap-1 transition-all ${
                  selected.has(c.id)
                    ? 'border-brand-500 bg-brand-500/15 scale-[1.02]'
                    : 'border-[#2a2a3f] bg-[#12121e] hover:border-gray-500'
                }`}>
                <span className="text-2xl">{c.emoji}</span>
                <span className={`text-xs font-medium ${selected.has(c.id) ? 'text-brand-300' : 'text-gray-400'}`}>
                  {t(`interests.${c.id}`)}
                </span>
                {selected.has(c.id) && (
                  <span className="absolute top-1 right-1 bg-brand-500 rounded-full p-0.5">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 space-y-2">
          <button onClick={save} disabled={selected.size === 0}
            className="btn-primary w-full py-3 disabled:opacity-40">
            {selected.size > 0 ? t('interests.save', { count: selected.size }) : t('interests.pickAtLeastOne')}
          </button>
          <button onClick={skip} className="w-full text-gray-500 text-sm py-1 hover:text-gray-300 transition-colors">
            {t('interests.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
