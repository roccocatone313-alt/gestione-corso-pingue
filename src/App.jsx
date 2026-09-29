import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inserisci from './pages/Inserisci'
import Admin from './pages/Admin'
import Sponsor from './pages/Sponsor'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="inserisci" element={<Inserisci />} />
          <Route path="sponsor" element={<Sponsor />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}