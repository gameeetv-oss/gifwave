import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: { background: '#1f1f2e', color: '#fff', border: '1px solid #3f3f5f' },
          success: { iconTheme: { primary: '#d946ef', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
