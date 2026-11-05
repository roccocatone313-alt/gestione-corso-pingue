import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AuthProvider from './components/AuthProvider'
import SoloComitato from './components/SoloComitato'
import Dashboard from './pages/Dashboard'
import Inserisci from './pages/Inserisci'
import Admin from './pages/Admin'
import Sponsor from './pages/Sponsor'
import Budget from './pages/Budget'
import Esigenze from './pages/Esigenze'
import Rendiconto from './pages/Rendiconto'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="sponsor" element={<Sponsor />} />
            <Route path="budget" element={<Budget />} />
            <Route path="rendiconto" element={<Rendiconto />} />
            <Route path="esigenze" element={<Esigenze />} />
            <Route path="inserisci" element={<SoloComitato><Inserisci /></SoloComitato>} />
            <Route path="admin" element={<SoloComitato><Admin /></SoloComitato>} />
            <Route path="login" element={<Login />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
