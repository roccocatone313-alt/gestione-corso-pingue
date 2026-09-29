import { NavLink, Outlet } from 'react-router-dom'

function linkClass({ isActive }) {
  const base = 'px-3 py-2 rounded-lg text-sm font-semibold transition'
  return isActive
    ? base + ' bg-blue-600 text-white'
    : base + ' text-gray-600 hover:bg-gray-100'
}

export default function Layout() {
  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-bold text-lg text-gray-800">Gestione Corso</h1>
          <div className="flex gap-1">
            <NavLink to="/" end className={linkClass}>Panoramica</NavLink>
            <NavLink to="/inserisci" className={linkClass}>Inserisci</NavLink>
            <NavLink to="/admin" className={linkClass}>Admin</NavLink>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}