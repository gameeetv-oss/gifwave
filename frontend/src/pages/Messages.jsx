import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Send, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Messages() {
  const { userId } = useParams()
  const { user, profile: myProfile } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null) // { profile, messages }
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef()
  const channelRef = useRef()

  useEffect(() => {
    if (!user) return
    loadConversations()
  }, [user])

  useEffect(() => {
    if (!userId || !user) return
    openConversation(userId)
  }, [userId, user])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages])

  async function loadConversations() {
    setLoading(true)
    // Gönderilen ve alınan son mesajları çek
    const { data: sent } = await supabase.from('messages')
      .select('*, receiver:profiles!messages_receiver_id_fkey(id, username, display_name, avatar_url)')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
    const { data: received } = await supabase.from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url)')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })

    // Konuşmaları gruplat
    const convMap = {}
    for (const m of (sent || [])) {
      const otherId = m.receiver_id
      if (!convMap[otherId]) convMap[otherId] = { profile: m.receiver, lastMsg: m, unread: 0 }
    }
    for (const m of (received || [])) {
      const otherId = m.sender_id
      if (!convMap[otherId]) convMap[otherId] = { profile: m.sender, lastMsg: m, unread: 0 }
      else if (new Date(m.created_at) > new Date(convMap[otherId].lastMsg.created_at)) convMap[otherId].lastMsg = m
      if (!m.read) convMap[otherId].unread++
    }
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)))
    setLoading(false)
  }

  async function openConversation(otherUserId) {
    // Profili yükle
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', otherUserId).maybeSingle()
    if (!prof) { toast.error('Kullanıcı bulunamadı'); return }

    // Mesajları yükle
    const { data: msgs } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setActiveConv({ profile: prof, messages: msgs || [] })

    // Okundu olarak işaretle
    await supabase.from('messages').update({ read: true })
      .eq('sender_id', otherUserId).eq('receiver_id', user.id).eq('read', false)

    // Realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel(`dm-${user.id}-${otherUserId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, async (payload) => {
        if (payload.new.sender_id === otherUserId) {
          setActiveConv(c => c ? { ...c, messages: [...c.messages, payload.new] } : c)
          await supabase.from('messages').update({ read: true }).eq('id', payload.new.id)
        }
      })
      .subscribe()
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim() || !activeConv) return
    setSending(true)
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeConv.profile.id,
      text: text.trim()
    }).select().single()
    if (!error) {
      setActiveConv(c => ({ ...c, messages: [...c.messages, data] }))
      setText('')
    } else toast.error('Mesaj gönderilemedi')
    setSending(false)
  }

  function selectConv(conv) {
    navigate(`/messages/${conv.profile.id}`)
  }

  if (!user) return <div className="flex justify-center py-20 text-gray-500">Giriş yapman lazım.</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="card overflow-hidden flex" style={{ height: 'calc(100vh - 120px)' }}>
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
            {conversations.map(conv => (
              <button key={conv.profile.id} onClick={() => selectConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${activeConv?.profile.id === conv.profile.id ? 'bg-brand-500/10' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-brand-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-brand-200">
                  {conv.profile.avatar_url
                    ? <img src={conv.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : conv.profile.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{conv.profile.display_name || conv.profile.username}</p>
                    {conv.unread > 0 && (
                      <span className="bg-brand-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{conv.lastMsg.text}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sağ: Aktif Konuşma */}
        {activeConv ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a3f]">
              <button onClick={() => { setActiveConv(null); navigate('/messages') }}
                className="md:hidden text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Link to={`/profile/${activeConv.profile.username}`} className="flex items-center gap-3 hover:opacity-80">
                <div className="w-8 h-8 rounded-full bg-brand-800 overflow-hidden flex items-center justify-center text-xs font-bold text-brand-200">
                  {activeConv.profile.avatar_url
                    ? <img src={activeConv.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : activeConv.profile.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{activeConv.profile.display_name || activeConv.profile.username}</p>
                  <p className="text-xs text-gray-500">@{activeConv.profile.username}</p>
                </div>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {activeConv.messages.map(msg => {
                const isMe = msg.sender_id === user.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                      isMe ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-[#2a2a3f] text-gray-200 rounded-bl-sm'
                    }`}>
                      <p>{msg.text}</p>
                      <p className={`text-xs mt-0.5 ${isMe ? 'text-brand-200' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

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
