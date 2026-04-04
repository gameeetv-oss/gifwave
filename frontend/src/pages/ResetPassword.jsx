import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase, hash'teki token'ı otomatik yakalar
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Şifreler eşleşmiyor'); return }
    if (password.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Şifren güncellendi!')
      navigate('/')
    }
    setLoading(false)
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400 mx-auto" />
          <p className="text-gray-400 text-sm">Doğrulanıyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 text-brand-400 font-bold text-3xl mb-2">
            <Waves className="w-8 h-8" />
            GifWave
          </div>
          <p className="text-gray-500">Yeni Şifre Belirle</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Yeni Şifre</label>
              <div className="relative">
                <input className="input pr-10" type={showPw ? 'text' : 'password'}
                  placeholder="En az 6 karakter" value={password}
                  onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Şifre Tekrar</label>
              <input className="input" type={showPw ? 'text' : 'password'}
                placeholder="Şifreyi tekrar gir" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Şifremi Güncelle'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
