import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Mostra la pagina solo a chi può modificare i dati
export default function SoloComitato({ children }) {
  const { pronto, utente, puoModificare } = useAuth()
  const location = useLocation()

  if (!pronto) {
    return <div className="text-center text-gray-400 italic py-10">Verifica dell'accesso...</div>
  }
  if (puoModificare) return children

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl p-6 shadow-sm text-center space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Riservato al comitato</h2>
      <p className="text-sm text-gray-600">
        {utente
          ? `L'account ${utente.email} può guardare il sito ma non modificare i dati.`
          : 'Questa pagina serve a modificare i dati: accedi con un account del comitato.'}
      </p>
      {!utente && (
        <Link to="/login" state={{ da: location.pathname }}
              className="inline-block px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600">
          Accedi
        </Link>
      )}
    </div>
  )
}
