import { useState } from 'react'
import { MessageSquare, Bell } from 'lucide-react'
import Messages from './Messages'
import Notifications from './Notifications'
import { useTranslation } from 'react-i18next'

export default function Inbox() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('messages')

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Tab başlık */}
      <div className="sticky top-0 z-10 bg-[#0a0a14]/95 backdrop-blur border-b border-[#2a2a3f] flex">
        <button
          onClick={() => setTab('messages')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            tab === 'messages' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {t('inbox.messages')}
        </button>
        <button
          onClick={() => setTab('notifications')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            tab === 'notifications' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Bell className="w-4 h-4" />
          {t('inbox.notifications')}
        </button>
      </div>

      <div className="flex-1">
        {tab === 'messages' ? <Messages /> : <Notifications />}
      </div>
    </div>
  )
}
