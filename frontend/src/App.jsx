import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { initPush, logoutPush } from './lib/push'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PresenceProvider } from './context/PresenceContext'
import { BlockProvider } from './context/BlockContext'
import Navbar from './components/Navbar'
const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const Profile = lazy(() => import('./pages/Profile'))
const Upload = lazy(() => import('./pages/Upload'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Messages = lazy(() => import('./pages/Messages'))
const Inbox = lazy(() => import('./pages/Inbox'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Premium = lazy(() => import('./pages/Premium'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const Terms = lazy(() => import('./pages/Terms'))
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'))
const ChildSafety = lazy(() => import('./pages/ChildSafety'))
const Collections = lazy(() => import('./pages/Collections'))

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a14]" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  return user ? children : <Navigate to="/login" />
}

// Ana akış ve tek gönderi sayfası tam ekrandır, güvenli alanı kendileri yönetir;
// diğer tüm sayfalara üstten çentik/Dynamic Island payı verilir.
function AppRoutes() {
  const { pathname } = useLocation()
  const fullScreen = pathname === '/' || pathname.startsWith('/post/')
  return (
    <>
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <div className={fullScreen ? '' : 'safe-top'}>
        <Routes>
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/explore" element={<div className="pb-nav"><Explore /></div>} />
          <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
          <Route path="/inbox" element={<PrivateRoute><div className="pb-nav"><Inbox /></div></PrivateRoute>} />
          <Route path="/inbox/:userId" element={<PrivateRoute><div className="pb-nav"><Inbox /></div></PrivateRoute>} />
          <Route path="/messages" element={<Navigate to="/inbox" />} />
          <Route path="/messages/:userId" element={<PrivateRoute><div className="pb-nav"><Messages /></div></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><div className="pb-nav"><Notifications /></div></PrivateRoute>} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/premium" element={<PrivateRoute><div className="pb-nav"><Premium /></div></PrivateRoute>} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/child-safety" element={<ChildSafety />} />
          <Route path="/collections" element={<PrivateRoute><div className="pb-nav"><Collections /></div></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </div>
      </Suspense>
    </>
  )
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function BackendWarmup() {
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`).catch(() => {})
  }, [])
  return null
}

function PushSetup() {
  const { user } = useAuth()
  useEffect(() => {
    if (user?.id) initPush(user.id)
    else logoutPush()
  }, [user?.id])
  return null
}

function DeepLinkHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    let cleanup = () => {}
    async function setup() {
      try {
        const { App: CapApp } = await import('@capacitor/app')
        const handle = await CapApp.addListener('appUrlOpen', async (event) => {
          const url = event.url
          if (url.includes('type=recovery') || url.includes('reset-password')) {
            const hash = url.includes('#') ? url.split('#')[1] : ''
            if (hash) {
              const params = new URLSearchParams(hash)
              const accessToken = params.get('access_token')
              const refreshToken = params.get('refresh_token')
              if (accessToken && refreshToken) {
                await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
              }
            }
            navigate('/reset-password')
          }
        })
        cleanup = () => handle.remove()
      } catch {}
    }
    setup()
    return () => cleanup()
  }, [navigate])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <BlockProvider>
          <BackendWarmup />
          <PushSetup />
          <DeepLinkHandler />
          <AppRoutes />
        </BlockProvider>
      </PresenceProvider>
    </AuthProvider>
  )
}
