import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

function linkClass({ isActive }) {
  const base = 'px-3 py-2 rounded-lg text-sm font-semibold transition'
  return isActive
    ? base + ' bg-sky-500 text-white shadow-sm'
    : base + ' text-sky-800 hover:bg-sky-50'
}

export default function Layout() {
  const { utente, puoModificare, esci } = useAuth()

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
          <div className="flex gap-1 flex-wrap items-center">
            <NavLink to="/" end className={linkClass}>Panoramica</NavLink>
            <NavLink to="/sponsor" className={linkClass}>Sponsor</NavLink>
            <NavLink to="/budget" className={linkClass}>Budget</NavLink>
            <NavLink to="/rendiconto" className={linkClass}>Rendiconto</NavLink>
            <NavLink to="/esigenze" className={linkClass}>Esigenze</NavLink>
            {puoModificare && (
              <>
                <NavLink to="/inserisci" className={linkClass}>Inserisci</NavLink>
                <NavLink to="/admin" className={linkClass}>Admin</NavLink>
              </>
            )}
            {utente ? (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
                <span className="text-xs text-gray-500 max-w-[160px] truncate" title={utente.email}>
                  {utente.email}
                </span>
                <button type="button" onClick={esci}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition">
                  Esci
                </button>
              </div>
            ) : (
              <NavLink to="/login" className={linkClass}>Accedi</NavLink>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
