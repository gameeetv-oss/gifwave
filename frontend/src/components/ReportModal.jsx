import { useState } from 'react'
import { X, Flag, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://gifwave-backend.onrender.com'

export default function ReportModal({ postId, reportedUserId, onClose }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)

  const REASONS = [
    t('report.reasons.spam'),
    t('report.reasons.inappropriate'),
    t('report.reasons.hate'),
    t('report.reasons.violence'),
    t('report.reasons.copyright'),
    t('report.reasons.child'),
    t('report.reasons.other'),
  ]

  async function handleSubmit() {
    if (!reason) { toast.error(t('report.selectReasonError')); return }
    if (!user) { toast.error(t('report.loginRequired')); return }
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${BACKEND}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          post_id: postId || null,
          reported_user_id: reportedUserId || null,
          reason,
          details: details.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('report.success'))
      onClose()
    } catch (e) {
      toast.error(t('report.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="card w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a3f]">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-400" />
            <h2 className="font-bold text-white">{postId ? t('report.title') : t('report.userTitle')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-400">{t('report.selectReason')}</p>
          {REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${reason === r ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 'bg-[#1a1a2e] border border-[#2a2a3f] text-gray-300 hover:border-gray-500'}`}>
              {r}
            </button>
          ))}

          <textarea
            className="input w-full text-sm resize-none mt-2"
            rows={3}
            placeholder={t('report.details')}
            value={details}
            onChange={e => setDetails(e.target.value)}
            maxLength={500}
          />

          <button onClick={handleSubmit} disabled={loading || !reason}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Flag className="w-4 h-4" /> {t('report.submit')}</>}
          </button>
          <p className="text-xs text-gray-500 text-center">
            {t('report.warning')}
          </p>
        </div>
      </div>
    </div>
  )
}
