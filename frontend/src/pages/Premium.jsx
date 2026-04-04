import { useState } from 'react'
import { Crown, Check, Zap, Image, Upload, Star, X, Loader2, Gift } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// Ödeme linkleri — Whop/Shopier ürün ID'nizi buraya girin
const WHOP_LINK = 'https://whop.com/gifwave-premium'
const SHOPIER_LINK = 'https://www.shopier.com/gifwave-premium'
const PRICE_TRY = '49'

const BENEFITS = [
  { icon: Upload, text: 'Sınırsız günlük yükleme (ücretsiz: 5/gün)' },
  { icon: Image, text: 'Hareketli profil fotoğrafı (GIF avatar)' },
  { icon: Star, text: 'Altın Premium rozeti' },
  { icon: Zap, text: 'Reklamsız deneyim' },
  { icon: Crown, text: 'Öncelikli destek' },
]

export default function Premium({ onClose }) {
  const { user, profile, fetchProfile } = useAuth()
  const [tab, setTab] = useState('shopier')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const isPremium = profile?.is_premium && (!profile?.premium_until || new Date(profile.premium_until) > new Date())

  async function activateWithCode() {
    if (!code.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/premium/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), user_id: user.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Geçersiz kod')
      await fetchProfile(user.id)
      toast.success('Premium aktif!')
      onClose?.()
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function activateWithEmail() {
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/premium/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), user_id: user.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Ödeme bulunamadı')
      await fetchProfile(user.id)
      toast.success('Premium aktif!')
      onClose?.()
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-yellow-500/20 via-brand-500/10 to-transparent rounded-t-2xl">
          {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-yellow-400" />
            <div>
              <h2 className="font-black text-xl text-white">GifWave Premium</h2>
              <p className="text-yellow-400 text-sm font-semibold">Aylık ₺{PRICE_TRY}</p>
            </div>
          </div>
          {isPremium && (
            <div className="mt-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 text-sm font-semibold">Premium hesabın aktif!</span>
              {profile?.premium_until && (
                <span className="text-yellow-500 text-xs ml-auto">
                  {new Date(profile.premium_until).toLocaleDateString('tr-TR')} tarihine kadar
                </span>
              )}
            </div>
          )}
        </div>

        {/* Avantajlar */}
        <div className="px-6 py-4 space-y-2.5 border-b border-[#2a2a3f]">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-7 h-7 bg-yellow-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-yellow-400" />
              </div>
              <p className="text-sm text-gray-300">{text}</p>
              <Check className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />
            </div>
          ))}
        </div>

        {!isPremium && (
          <div className="p-5 space-y-4">
            {/* Ödeme seçenekleri tab */}
            <div className="flex rounded-xl overflow-hidden border border-[#3a3a5c]">
              {[
                { id: 'shopier', label: 'Shopier' },
                { id: 'whop', label: 'Whop' },
                { id: 'kod', label: 'Aktivasyon Kodu' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === id ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'shopier' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 text-center">Shopier ile güvenli ödeme yap, sonra e-posta adresinle aktif et.</p>
                <a href={SHOPIER_LINK} target="_blank" rel="noopener noreferrer"
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold">
                  <Crown className="w-4 h-4" /> Shopier'da Satın Al — ₺{PRICE_TRY}/ay
                </a>
                <div className="border-t border-[#2a2a3f] pt-3">
                  <p className="text-xs text-gray-500 mb-2">Ödeme sonrası kullandığın e-postayı gir:</p>
                  <div className="flex gap-2">
                    <input className="input flex-1 text-sm py-2" placeholder="ödeme e-postası..." value={email} onChange={e => setEmail(e.target.value)} />
                    <button onClick={activateWithEmail} disabled={loading || !email.trim()} className="btn-primary px-3 py-2 text-sm flex-shrink-0">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aktif Et'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'whop' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 text-center">Whop ile uluslararası kart ile ödeme yap.</p>
                <a href={WHOP_LINK} target="_blank" rel="noopener noreferrer"
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold">
                  <Crown className="w-4 h-4" /> Whop'ta Satın Al — ₺{PRICE_TRY}/ay
                </a>
                <div className="border-t border-[#2a2a3f] pt-3">
                  <p className="text-xs text-gray-500 mb-2">Ödeme sonrası kullandığın e-postayı gir:</p>
                  <div className="flex gap-2">
                    <input className="input flex-1 text-sm py-2" placeholder="ödeme e-postası..." value={email} onChange={e => setEmail(e.target.value)} />
                    <button onClick={activateWithEmail} disabled={loading || !email.trim()} className="btn-primary px-3 py-2 text-sm flex-shrink-0">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aktif Et'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'kod' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 text-center">Aldığın aktivasyon kodunu gir.</p>
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm py-2 font-mono tracking-wider uppercase"
                    placeholder="XXXX-XXXX-XXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
                  <button onClick={activateWithCode} disabled={loading || !code.trim()} className="btn-primary px-4 py-2 text-sm flex-shrink-0 flex items-center gap-1">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Gift className="w-4 h-4" /> Uygula</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
