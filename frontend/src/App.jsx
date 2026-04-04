import { Routes, Route, Navigate } from 'react-router-dom'
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
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import Inbox from './pages/Inbox'
import PostDetail from './pages/PostDetail'
import Premium from './pages/Premium'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/explore" element={<div className="pb-16"><Explore /></div>} />
        <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
        <Route path="/inbox" element={<PrivateRoute><div className="pb-16"><Inbox /></div></PrivateRoute>} />
        <Route path="/inbox/:userId" element={<PrivateRoute><div className="pb-16"><Inbox /></div></PrivateRoute>} />
        <Route path="/messages" element={<Navigate to="/inbox" />} />
        <Route path="/messages/:userId" element={<PrivateRoute><div className="pb-16"><Messages /></div></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><div className="pb-16"><Notifications /></div></PrivateRoute>} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/premium" element={<PrivateRoute><div className="pb-16"><Premium /></div></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
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
