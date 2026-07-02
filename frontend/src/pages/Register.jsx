import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function Register() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (username.length < 3) { toast.error(t('auth.usernameTooShort')); return }
    if (password.length < 6) { toast.error(t('auth.passwordTooShort')); return }

    if (!birthDate) { toast.error(t('auth.birthDateRequired')); return }
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    if (age < 18) {
      toast.error(t('auth.ageTooYoung'))
      return
    }

    setLoading(true)

    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) { toast.error(t('auth.usernameTaken')); setLoading(false); return }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }

    if (data.user) {
      let profileError = null
      for (let i = 0; i < 3; i++) {
        const { error: pErr } = await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          display_name: '',
          bio: '',
          followers_count: 0,
          following_count: 0
        })
        profileError = pErr
        if (!pErr) break
        await new Promise(r => setTimeout(r, 500))
      }
      if (profileError) toast.error(t('auth.profileCreateFailed'))
    }

    toast.success(t('auth.accountCreated'))
    navigate('/login')
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
          <p className="text-gray-500">{t('auth.gifNewWay')}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.username')}</label>
              <input className="input" placeholder="johndoe" value={username}
                onChange={e => setUsername(e.target.value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.email')}</label>
              <input className="input" type="email" placeholder={t('auth.emailPlaceholder')} value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.password')}</label>
              <input className="input" type="password" placeholder={t('auth.minChars')} value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">{t('auth.birthDate')}</label>
              <input className="input" type="date" value={birthDate}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                onChange={e => setBirthDate(e.target.value)} required />
              <p className="text-xs text-gray-600 mt-1">{t('auth.ageWarning')}</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('auth.registerBtn')}
            </button>
          </form>
          <p className="text-xs text-gray-600 text-center mt-4">
            {t('auth.termsAgree')}{' '}
            <Link to="/terms" className="text-brand-400">{t('auth.terms')}</Link>{' '}
            {t('auth.and')}{' '}
            <Link to="/privacy" className="text-brand-400">{t('auth.privacy')}</Link>{' '}
            {t('auth.accepted')}
          </p>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">{t('auth.loginBtn')}</Link>
        </p>
      </div>
    </div>
  )
}
