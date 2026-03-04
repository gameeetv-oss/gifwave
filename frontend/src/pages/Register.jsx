import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Waves, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (username.length < 3) { toast.error('Kullanıcı adı en az 3 karakter'); return }
    if (password.length < 6) { toast.error('Şifre en az 6 karakter'); return }

    // Kullanıcı adı müsait mi kontrol et
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).single()
    if (existing) { toast.error('Bu kullanıcı adı alınmış'); return }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Profil oluştur
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        followers_count: 0,
        following_count: 0
      })
    }

    toast.success('Hesap oluşturuldu! Giriş yap.')
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
          <p className="text-gray-500">GIF paylaşmanın yeni yolu</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Kullanıcı Adı</label>
              <input className="input" placeholder="johndoe" value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
              <input className="input" type="email" placeholder="email@örnek.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Şifre</label>
              <input className="input" type="password" placeholder="min 6 karakter" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Kayıt Ol'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          Hesabın var mı?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Giriş Yap</Link>
        </p>
      </div>
    </div>
  )
}
