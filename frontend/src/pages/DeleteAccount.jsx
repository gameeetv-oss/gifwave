import { useTranslation } from 'react-i18next'

export default function DeleteAccount() {
  const { t } = useTranslation()

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
    </div>
  )
}
