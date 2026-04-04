import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Loader2, ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
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
          <p className="text-gray-500">Şifre Sıfırlama</p>
        </div>

        {sent ? (
          <div className="card p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-white font-semibold">Email gönderildi!</p>
            <p className="text-gray-400 text-sm">
              <span className="text-brand-400 font-medium">{email}</span> adresine şifre sıfırlama linki gönderdik. Gelen kutunu kontrol et.
            </p>
            <p className="text-gray-600 text-xs">Spam klasörünü de kontrol etmeyi unutma.</p>
          </div>
        ) : (
          <div className="card p-6">
            <p className="text-gray-400 text-sm mb-4">
              Email adresini gir, sana şifre sıfırlama linki gönderelim.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
                <input className="input" type="email" placeholder="email@örnek.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Link Gönder'}
              </button>
            </form>
          </div>
        )}

        <div className="text-center mt-4">
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  )
}
