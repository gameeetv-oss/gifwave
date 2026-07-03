import { supabase } from './supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://gifwave-backend.onrender.com'
const ONESIGNAL_APP_ID = '01232159-2752-4de3-86d7-d27b36674497'

function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
}

let _initialized = false

// OneSignal SDK'yı başlat (sadece native) ve kullanıcıyı external_id ile bağla
export async function initPush(userId) {
  if (!isNative()) return
  try {
    const mod = await import('onesignal-cordova-plugin')
    const OneSignal = mod.default || mod.OneSignal || window.plugins?.OneSignal
    if (!OneSignal) return
    if (!_initialized) {
      OneSignal.initialize(ONESIGNAL_APP_ID)
      OneSignal.Notifications.requestPermission(true).catch(() => {})
      _initialized = true
    }
    if (userId) OneSignal.login(String(userId))
  } catch (e) {
    console.warn('[push] init error', e)
  }
}

export async function logoutPush() {
  if (!isNative() || !_initialized) return
  try {
    const mod = await import('onesignal-cordova-plugin')
    const OneSignal = mod.default || mod.OneSignal
    OneSignal?.logout()
  } catch {}
}

// Karşı tarafa push bildirimi tetikle (backend JWT doğrulaması yapar) — fire & forget
export async function notifyPush(type, toUserId, postId = null) {
  try {
    if (!toUserId) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    fetch(`${BACKEND_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ to_user_id: toUserId, type, post_id: postId }),
    }).catch(() => {})
  } catch {}
}
