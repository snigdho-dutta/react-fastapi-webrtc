import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SocketIOContextProvider from './context/socketio.tsx'
import { BrowserRouter } from 'react-router'
import IOClientProvider from './context/io-client.tsx'
import { Toaster } from './components/ui/sonner.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SocketIOContextProvider>
        <IOClientProvider>
          <App />
          <Toaster />
        </IOClientProvider>
      </SocketIOContextProvider>
    </BrowserRouter>
  </StrictMode>
)
