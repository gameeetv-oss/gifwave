import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? t('auth.invalidCredentials') : error.message)
    } else {
      toast.success(t('auth.welcomeBack'))
      navigate('/')
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
          <p className="text-gray-500">{t('auth.gifWelcome')}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.email')}</label>
              <input className="input" type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.password')}</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('auth.loginBtn')}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-3">
          <Link to="/forgot-password" className="text-gray-400 hover:text-white transition-colors">{t('auth.forgotPasswordLink')}</Link>
        </p>
        <p className="text-center text-gray-500 text-sm mt-2">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">{t('auth.registerBtn')}</Link>
        </p>
      </div>
    </div>
  )
}
