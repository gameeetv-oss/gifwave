import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Loader2, ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 text-brand-400 font-bold text-3xl mb-2">
            <Waves className="w-8 h-8" />
            GifWave
          </div>
          <p className="text-gray-500">{t('forgotPassword.title')}</p>
        </div>

        {sent ? (
          <div className="card p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-white font-semibold">{t('forgotPassword.emailSent')}</p>
            <p className="text-gray-400 text-sm">
              <span className="text-brand-400 font-medium">{email}</span> {t('forgotPassword.emailSentDesc')}
            </p>
            <p className="text-gray-600 text-xs">{t('forgotPassword.checkSpam')}</p>
          </div>
        ) : (
          <div className="card p-6">
            <p className="text-gray-400 text-sm mb-4">
              {t('forgotPassword.description')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.email')}</label>
                <input className="input" type="email" placeholder={t('auth.emailPlaceholder')}
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('forgotPassword.sendLink')}
              </button>
            </form>
          </div>
        )}

        <div className="text-center mt-4">
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
