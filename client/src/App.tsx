import { Route, Routes } from 'react-router'
import './App.css'
import HomePage from './pages/home'
import RoomPage from './pages/room'
import NotFoundPage from './pages/not-found'

function App() {
  return (
    <Routes>
      <Route>
        <Route path='/' element={<HomePage />}></Route>
        <Route path='/:roomId' element={<RoomPage />}></Route>
        <Route path='*' element={<NotFoundPage />}></Route>
      </Route>
    </Routes>
  )
}

export default App
