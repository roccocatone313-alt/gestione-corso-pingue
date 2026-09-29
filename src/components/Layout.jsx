import { NavLink, Outlet } from 'react-router-dom'

function linkClass({ isActive }) {
  const base = 'px-3 py-2 rounded-lg text-sm font-semibold transition'
  return isActive
    ? base + ' bg-sky-500 text-white shadow-sm'
    : base + ' text-sky-800 hover:bg-sky-50'
}

export default function Layout() {
  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-sm sticky top-0 z-10 border-b-4 border-sky-500">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center text-white font-black text-sm">
              GVI
            </div>
            <div>
              <h1 className="font-bold text-lg text-sky-900 leading-tight">
                GRIFO VI
              </h1>
              <p className="text-xs text-gray-500 leading-tight">
                Gestione economica corso
              </p>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            <NavLink to="/" end className={linkClass}>Panoramica</NavLink>
            <NavLink to="/sponsor" className={linkClass}>Sponsor</NavLink>
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