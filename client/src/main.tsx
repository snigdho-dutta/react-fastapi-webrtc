import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SocketIOContextProvider from './context/socketio.tsx'
import { BrowserRouter } from 'react-router'
import IOClientProvider from './context/io-client.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SocketIOContextProvider>
        <IOClientProvider>
          <App />
        </IOClientProvider>
      </SocketIOContextProvider>
    </BrowserRouter>
  </StrictMode>
)
