import { useTranslation } from 'react-i18next'

export default function ConfirmModal({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="card w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white text-lg">{title}</h3>
        {message && <p className="text-gray-400 text-sm leading-relaxed">{message}</p>}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">
            {cancelLabel || t('common.cancel')}
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'btn-primary'}`}>
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
