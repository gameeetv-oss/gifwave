import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import { useBlock } from '../context/BlockContext'
import { Send, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

// ✓ / ✓✓ bileşeni
function Ticks({ msg, isPartnerOnline, partnerAllowsReceipts }) {
  const isRead = msg.read && partnerAllowsReceipts !== false
  if (isRead) return <span className="text-blue-300 text-xs">✓✓</span>
  if (isPartnerOnline) return <span className="text-gray-400 text-xs">✓✓</span>
  return <span className="text-gray-600 text-xs">✓</span>
}

export default function Messages() {
  const { userId } = useParams()
  const { user } = useAuth()
  const { onlineUsers } = usePresence()
  const { blockedIds, blockedByIds, allBlockedIds } = useBlock()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null) // { profile, messages }
  const [partnerSettings, setPartnerSettings] = useState({ show_read_receipts: true })
  const [mySettings, setMySettings] = useState({ show_read_receipts: true })
  const [showReceiptsMenu, setShowReceiptsMenu] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const bottomRef = useRef()
  const channelRef = useRef()
  const myReceiptsRef = useRef(true)

  useEffect(() => { myReceiptsRef.current = mySettings.show_read_receipts }, [mySettings.show_read_receipts])

  useEffect(() => {
    if (!user) return
    loadConversations()
    loadMySettings()
  }, [user])

  useEffect(() => {
    if (!userId || !user) return
    openConversation(userId)
  }, [userId, user])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages?.length])

  async function loadMySettings() {
    const { data } = await supabase.from('user_settings')
      .select('show_read_receipts').eq('user_id', user.id).maybeSingle()
    const val = data?.show_read_receipts ?? true
    setMySettings({ show_read_receipts: val })
    myReceiptsRef.current = val
  }

  async function toggleReadReceipts() {
    const newVal = !mySettings.show_read_receipts
    setMySettings({ show_read_receipts: newVal })
    myReceiptsRef.current = newVal
    await supabase.from('user_settings').upsert({ user_id: user.id, show_read_receipts: newVal })
    toast.success(newVal ? 'Okundu bilgisi açıldı' : 'Okundu bilgisi kapatıldı')
    setShowReceiptsMenu(false)
  }

  async function loadConversations() {
    setLoading(true)
    const [sentRes, receivedRes] = await Promise.all([
      supabase.from('messages')
        .select('*, receiver:profiles!messages_receiver_id_fkey(id, username, display_name, avatar_url)')
        .eq('sender_id', user.id).order('created_at', { ascending: false }),
      supabase.from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url)')
        .eq('receiver_id', user.id).order('created_at', { ascending: false }),
    ])

    const convMap = {}
    for (const m of (sentRes.data || [])) {
      const id = m.receiver_id
      if (!convMap[id] || new Date(m.created_at) > new Date(convMap[id].lastMsg.created_at))
        convMap[id] = { profile: m.receiver, lastMsg: m, unread: convMap[id]?.unread || 0 }
    }
    for (const m of (receivedRes.data || [])) {
      const id = m.sender_id
      if (!convMap[id]) convMap[id] = { profile: m.sender, lastMsg: m, unread: 0 }
      else if (new Date(m.created_at) > new Date(convMap[id].lastMsg.created_at)) convMap[id].lastMsg = m
      if (!m.read) convMap[id].unread++
    }
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)))
    setLoading(false)
  }

  async function openConversation(otherUserId) {
    const [profRes, msgsRes, settRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', otherUserId).maybeSingle(),
      supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true }),
      supabase.from('user_settings').select('show_read_receipts').eq('user_id', otherUserId).maybeSingle(),
    ])

    if (!profRes.data) { toast.error('Kullanıcı bulunamadı'); return }
    setActiveConv({ profile: profRes.data, messages: msgsRes.data || [] })
    setPartnerSettings({ show_read_receipts: settRes.data?.show_read_receipts ?? true })

    // Gelen mesajları okundu yap (eğer benim ayarım açıksa)
    if (myReceiptsRef.current) {
      await supabase.from('messages').update({ read: true })
        .eq('sender_id', otherUserId).eq('receiver_id', user.id).eq('read', false)
    }

    // Realtime: yeni mesaj + read güncellemesi
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel(`dm-${[user.id, otherUserId].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, async (payload) => {
        if (payload.new.sender_id !== otherUserId) return
        setActiveConv(c => c ? { ...c, messages: [...c.messages, payload.new] } : c)
        if (myReceiptsRef.current) {
          await supabase.from('messages').update({ read: true }).eq('id', payload.new.id)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.read) {
          setActiveConv(c => c ? {
            ...c,
            messages: c.messages.map(m => m.id === payload.new.id ? { ...m, read: true } : m)
          } : c)
        }
      })
      .subscribe()
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim() || !activeConv || sending) return
    setSending(true)
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeConv.profile.id,
      text: text.trim(),
    }).select().single()

    if (!error) {
      setActiveConv(c => ({ ...c, messages: [...c.messages, data] }))
      setText('')
      // DM bildirimi (karşı taraf offline ise)
      if (!onlineUsers.has(activeConv.profile.id)) {
        supabase.from('notifications').insert({
          user_id: activeConv.profile.id, type: 'dm', from_user_id: user.id
        })
      }
    } else toast.error('Mesaj gönderilemedi')
    setSending(false)
  }

  const isPartnerOnline = activeConv ? onlineUsers.has(activeConv.profile.id) : false
  const isConvBlocked = activeConv ? allBlockedIds.has(activeConv.profile.id) : false
  const iBlockedThem = activeConv ? blockedIds.has(activeConv.profile.id) : false

  if (!user) return <div className="flex justify-center py-20 text-gray-500">Giriş yapman lazım.</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="card overflow-hidden flex" style={{ height: 'calc(100vh - 120px)' }}
        onClick={() => setShowReceiptsMenu(false)}>

        {/* Sol: Konuşmalar */}
        <div className={`w-full md:w-72 border-r border-[#2a2a3f] flex flex-col flex-shrink-0 ${activeConv ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 py-3 border-b border-[#2a2a3f]">
            <h2 className="font-semibold">Mesajlar</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>}
            {!loading && conversations.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Henüz mesajın yok.</p>
            )}
            {conversations.map(conv => {
              const isOnline = onlineUsers.has(conv.profile?.id)
              return (
                <button key={conv.profile?.id} onClick={() => navigate(`/messages/${conv.profile.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${activeConv?.profile.id === conv.profile?.id ? 'bg-brand-500/10' : ''}`}>
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-brand-800 overflow-hidden flex items-center justify-center text-sm font-bold text-brand-200">
                      {conv.profile?.avatar_url
                        ? <img src={conv.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : conv.profile?.username?.[0]?.toUpperCase()}
                    </div>
                    {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0a0a14]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{conv.profile?.display_name || conv.profile?.username}</p>
                      {conv.unread > 0 && (
                        <span className="bg-brand-500 text-white text-xs rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center flex-shrink-0">
                          {conv.unread > 9 ? '9+' : conv.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMsg.text}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sağ: Aktif Konuşma */}
        {activeConv ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a3f]">
              <button onClick={() => { setActiveConv(null); navigate('/messages') }}
                className="md:hidden text-gray-400 hover:text-white flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Link to={`/profile/${activeConv.profile.username}`} className="flex items-center gap-3 hover:opacity-80 flex-1 min-w-0">
                <div className="relative w-9 h-9 flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-brand-800 overflow-hidden flex items-center justify-center text-xs font-bold text-brand-200">
                    {activeConv.profile.avatar_url
                      ? <img src={activeConv.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : activeConv.profile.username?.[0]?.toUpperCase()}
                  </div>
                  {isPartnerOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0a0a14]" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{activeConv.profile.display_name || activeConv.profile.username}</p>
                  <p className="text-xs">
                    {isPartnerOnline
                      ? <span className="text-green-400">● Aktif</span>
                      : <span className="text-gray-500">@{activeConv.profile.username}</span>}
                  </p>
                </div>
              </Link>

              {/* Okundu bilgisi ayarı */}
              <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowReceiptsMenu(m => !m)}
                  className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"
                  title="Okundu bilgisi">
                  {mySettings.show_read_receipts ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                {showReceiptsMenu && (
                  <div className="absolute right-0 top-9 bg-[#1a1a2e] border border-[#3a3a5c] rounded-xl shadow-xl z-30 w-56 p-3">
                    <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Okundu Bilgisi</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-300">{mySettings.show_read_receipts ? 'Açık' : 'Kapalı'}</p>
                      <button onClick={toggleReadReceipts}
                        className={`relative w-10 h-5 rounded-full transition-colors ${mySettings.show_read_receipts ? 'bg-brand-500' : 'bg-gray-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${mySettings.show_read_receipts ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">Kapalıyken kimse mesajlarını okuyup okumadığını göremez.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {activeConv.messages.map(msg => {
                const isMe = msg.sender_id === user.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                      isMe ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-[#2a2a3f] text-gray-200 rounded-bl-sm'
                    }`}>
                      <p className="break-words">{msg.text}</p>
                      <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                        <span className={`text-xs ${isMe ? 'text-brand-200' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <Ticks
                            msg={msg}
                            isPartnerOnline={isPartnerOnline}
                            partnerAllowsReceipts={partnerSettings.show_read_receipts}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input veya engel uyarısı */}
            {isConvBlocked ? (
              <div className="px-4 py-4 border-t border-[#2a2a3f] text-center text-sm text-gray-500">
                {iBlockedThem
                  ? <span>Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.</span>
                  : <span>Bu kullanıcı tarafından engellendiniz.</span>}
              </div>
            ) : (
              <form onSubmit={sendMessage} className="px-4 py-3 border-t border-[#2a2a3f] flex gap-2">
                <input
                  className="input flex-1 text-sm py-2"
                  placeholder="Mesaj yaz..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-3 py-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center text-gray-500 flex-col gap-2">
            <p className="text-3xl">💬</p>
            <p className="text-sm">Bir konuşma seç</p>
          </div>
        )}
      </div>
    </div>
  )
}
