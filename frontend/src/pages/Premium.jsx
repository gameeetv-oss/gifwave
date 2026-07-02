import { useState } from 'react'
import { Crown, Check, Zap, Image, Upload, Star, X, Loader2, Gift, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePurchases } from '../hooks/usePurchases'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const WHOP_LINK = 'https://whop.com/gifwave/gifwave-premium'
const PRICE_TRY = '49'

export default function Premium({ onClose }) {
  const { user, profile, fetchProfile } = useAuth()
  const { t } = useTranslation()
  const [tab, setTab] = useState('pay')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [webLoading, setWebLoading] = useState(false)

  const { isNative, offering, initialized, loading: rcLoading, purchasePremium, restorePurchases } = usePurchases(user?.id)

  const isPremium = profile?.is_premium && (!profile?.premium_until || new Date(profile.premium_until) > new Date())
  const price = offering?.availablePackages?.[0]?.product?.priceString || `₺${PRICE_TRY}/ay`

  const BENEFITS = [
    { icon: Upload, text: t('premium.benefits.unlimitedUpload') },
    { icon: Image, text: t('premium.benefits.gifAvatar') },
    { icon: Star, text: t('premium.benefits.badge') },
    { icon: Zap, text: t('premium.benefits.noAds') },
    { icon: Crown, text: t('premium.benefits.support') },
  ]

  async function handleNativePurchase() {
    try {
      const result = await purchasePremium()
      if (result) {
        await fetchProfile(user.id)
        toast.success(t('premium.purchaseSuccess'))
        onClose?.()
      }
    } catch (e) {
      toast.error(e.message || t('premium.purchaseFailed'))
    }
  }

  async function handleRestore() {
    if (!window.confirm(t('premium.restoreConfirm', { defaultValue: 'Geçmiş satın almalarınızı geri yüklemek istediğinize emin misiniz?' }))) return
    try {
      const result = await restorePurchases()
      if (result) {
        await fetchProfile(user.id)
        toast.success(t('premium.restoreSuccess'))
        onClose?.()
      } else {
        toast.error(t('premium.restoreFailed'))
      }
    } catch (e) {
      toast.error(t('premium.restoreError'))
    }
  }

  async function activateWithCode() {
    if (!code.trim()) return
    setWebLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/premium/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), user_id: user.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || t('premium.invalidCode'))
      await fetchProfile(user.id)
      toast.success(t('premium.codeActivated'))
      onClose?.()
    } catch (err) { toast.error(err.message) }
    finally { setWebLoading(false) }
  }

  async function activateWithEmail() {
    if (!email.trim()) return
    setWebLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/premium/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), user_id: user.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || t('premium.paymentNotFound'))
      await fetchProfile(user.id)
      toast.success(t('premium.codeActivated'))
      onClose?.()
    } catch (err) { toast.error(err.message) }
    finally { setWebLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-yellow-500/20 via-brand-500/10 to-transparent rounded-t-2xl">
          <div className="absolute top-4 right-4 flex items-center gap-3">
            {!isPremium && (
              <button onClick={handleRestore} title={t('premium.restore')}
                className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-yellow-400" />
            <div>
              <h2 className="font-black text-xl text-white">{t('premium.title')}</h2>
              <p className="text-yellow-400 text-sm font-semibold">{t('premium.monthlyPrice', { price })}</p>
            </div>
          </div>
          {isPremium && (
            <div className="mt-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 text-sm font-semibold">{t('premium.active')}</span>
              {profile?.premium_until && (
                <span className="text-yellow-500 text-xs ml-auto">
                  {t('premium.validUntil', { date: new Date(profile.premium_until).toLocaleDateString('tr-TR') })}
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

            {/* === NATIVE (iOS/Android): IAP only — promo code activation removed for Apple 3.1.1 compliance === */}
            {isNative ? (
              <div className="space-y-3">
                {!initialized && !rcLoading && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    {t('premium.storeLoading')}
                  </div>
                )}
                {initialized && !offering && (
                  <div className="text-xs text-yellow-400 text-center bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    {t('premium.storeUnavailable')}
                  </div>
                )}
                <button
                  onClick={handleNativePurchase}
                  disabled={rcLoading || !initialized || !offering}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ touchAction: 'manipulation' }}>
                  {rcLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Crown className="w-4 h-4" /> {t('premium.subscribe')} — {price}</>}
                </button>
              </div>

            ) : (
              /* === WEB: Whop + Aktivasyon Kodu === */
              <>
                <div className="flex rounded-xl overflow-hidden border border-[#3a3a5c]">
                  {[
                    { id: 'pay', label: t('premium.whopTab') },
                    { id: 'kod', label: t('premium.codeTab') },
                  ].map(({ id, label }) => (
                    <button key={id} onClick={() => setTab(id)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === id ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'pay' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 text-center">{t('premium.payWithCard')}</p>
                    <a href={WHOP_LINK} target="_blank" rel="noopener noreferrer"
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold">
                      <Crown className="w-4 h-4" /> {t('premium.buyNow', { price: PRICE_TRY })}
                    </a>
                    <div className="border-t border-[#2a2a3f] pt-3">
                      <p className="text-xs text-gray-500 mb-2">{t('premium.enterEmailAfterPayment')}</p>
                      <div className="flex gap-2">
                        <input className="input flex-1 text-sm py-2" placeholder={t('premium.paymentEmailPlaceholder')}
                          value={email} onChange={e => setEmail(e.target.value)} />
                        <button onClick={activateWithEmail} disabled={webLoading || !email.trim()}
                          className="btn-primary px-3 py-2 text-sm flex-shrink-0">
                          {webLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('premium.activate')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'kod' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 text-center">{t('premium.enterCode')}</p>
                    <div className="flex gap-2">
                      <input className="input flex-1 text-sm py-2 font-mono tracking-wider uppercase"
                        placeholder={t('premium.codePlaceholder')} value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())} />
                      <button onClick={activateWithCode} disabled={webLoading || !code.trim()}
                        className="btn-primary px-4 py-2 text-sm flex-shrink-0 flex items-center gap-1">
                        {webLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Gift className="w-4 h-4" /> {t('premium.apply')}</>}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
