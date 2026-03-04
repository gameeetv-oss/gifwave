import { useState } from 'react'
import Feed from '../components/Feed'
import { Plus } from 'lucide-react'
import UploadModal from '../components/UploadModal'

export default function Home() {
  const [tab, setTab] = useState('all')
  const [showUpload, setShowUpload] = useState(false)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Tab seçici */}
      <div className="flex gap-2 mb-6 sticky top-20 z-10 bg-[#0a0a14]/90 backdrop-blur pb-2">
        {[['all', 'Tümü'], ['following', 'Takip Ettiklerim']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === id ? 'bg-brand-500 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Feed mode={tab} key={tab} />

      {/* FAB */}
      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg shadow-brand-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => setTab('all')} />}
    </div>
  )
}
