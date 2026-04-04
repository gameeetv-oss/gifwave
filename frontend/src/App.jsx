import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PresenceProvider } from './context/PresenceContext'
import { BlockProvider } from './context/BlockContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Profile from './pages/Profile'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Register from './pages/Register'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import PostDetail from './pages/PostDetail'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className={isHome ? 'h-screen overflow-hidden' : 'min-h-screen pb-16'}>
      <Navbar />
      <Routes>
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
        <Route path="/messages/:userId" element={<PrivateRoute><Messages /></PrivateRoute>} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <BlockProvider>
          <AppRoutes />
        </BlockProvider>
      </PresenceProvider>
    </AuthProvider>
  )
}
