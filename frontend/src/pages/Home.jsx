import { useState } from 'react'
import Feed from '../components/Feed'
import { useTranslation } from 'react-i18next'

export default function Home() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('all')

  return (
    <div className="h-screen overflow-hidden relative bg-black">
      {/* Üstte overlay tab seçici */}
      <div className="absolute top-0 inset-x-0 z-20 flex justify-center pt-4 pb-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-6 pointer-events-auto">
          <button
            onClick={() => setTab('following')}
            className={`text-sm font-semibold transition-all pb-1 ${
              tab === 'following' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t('home.following')}
          </button>
          <button
            onClick={() => setTab('all')}
            className={`text-sm font-semibold transition-all pb-1 ${
              tab === 'all' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t('home.forYou')}
          </button>
        </div>
      </div>

      <Feed mode={tab} key={tab} />
    </div>
  )
}
