import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://gifwave-backend.onrender.com'

export default function DeleteAccount() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function executeDeleteAccount() {
    setShowConfirm(false)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('profile.loginRequired')); setLoading(false); return }
      await supabase.from('posts').delete().eq('user_id', user.id)
      await supabase.from('likes').delete().eq('user_id', user.id)
      await supabase.from('reposts').delete().eq('user_id', user.id)
      await supabase.from('follows').delete().eq('follower_id', user.id)
      await supabase.from('follows').delete().eq('following_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      const res = await fetch(`${BACKEND_URL}/user`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('delete failed')
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch {
      toast.error(t('profile.deleteAccountError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full">
        <h1 className="text-3xl font-bold text-brand-400 mb-2">GifWave</h1>
        <h2 className="text-xl font-semibold mb-6">{t('deleteAccount.title')}</h2>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">{t('deleteAccount.howToTitle')}</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
            <li>{t('deleteAccount.step1')}</li>
            <li dangerouslySetInnerHTML={{ __html: t('deleteAccount.step2') }} />
            <li dangerouslySetInnerHTML={{ __html: t('deleteAccount.step3') }} />
            <li dangerouslySetInnerHTML={{ __html: t('deleteAccount.step4') }} />
            <li>{t('deleteAccount.step5')}</li>
          </ol>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">{t('deleteAccount.deletedDataTitle')}</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
            <li>{t('deleteAccount.data1')}</li>
            <li>{t('deleteAccount.data2')}</li>
            <li>{t('deleteAccount.data3')}</li>
            <li>{t('deleteAccount.data4')}</li>
            <li>{t('deleteAccount.data5')}</li>
          </ul>
          <p className="text-gray-500 text-xs mt-3">
            {t('deleteAccount.dataNote')}
          </p>
        </div>

        {user && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-6 mb-6">
            <h3 className="font-semibold text-lg mb-2 text-red-400">{t('profile.deleteAccount')}</h3>
            <p className="text-gray-400 text-sm mb-4">{t('profile.deleteAccountConfirm')}</p>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t('profile.deleteAccount')}
            </button>
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-2">{t('deleteAccount.helpTitle')}</h3>
          <p className="text-gray-300 text-sm">
            {t('deleteAccount.helpDesc')}{' '}
            <a href="mailto:support@gifwave.app" className="text-brand-400 underline">
              support@gifwave.app
            </a>.
          </p>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title={t('profile.deleteAccount')}
          message={t('profile.deleteAccountConfirm') + ' ' + t('profile.deleteAccountConfirm2')}
          confirmLabel={t('profile.deleteAccount')}
          danger
          onConfirm={executeDeleteAccount}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
