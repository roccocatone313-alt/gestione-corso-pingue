import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AuthProvider from './components/AuthProvider'
import SoloComitato from './components/SoloComitato'
import Rendiconto from './pages/Rendiconto'
import Sponsor from './pages/Sponsor'
import Inserisci from './pages/Inserisci'
import Admin from './pages/Admin'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Rendiconto />} />
            <Route path="sponsor" element={<Sponsor />} />
            <Route path="inserisci" element={<SoloComitato><Inserisci /></SoloComitato>} />
            <Route path="admin" element={<SoloComitato><Admin /></SoloComitato>} />
            <Route path="login" element={<Login />} />
            {/* Vecchi indirizzi (/rendiconto, /budget, /esigenze...) tornano alla prima pagina */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
