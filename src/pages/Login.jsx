import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'

function traduciErrore(messaggio) {
  const m = String(messaggio || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o password non corrette.'
  if (m.includes('email not confirmed')) return "L'email di questo account non è ancora confermata."
  if (m.includes('rate limit') || m.includes('too many')) return 'Troppi tentativi: riprova tra qualche minuto.'
  return 'Accesso non riuscito: ' + messaggio
}

export default function Login() {
  const { pronto, utente, puoModificare, ricarica, esci } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destinazione = location.state?.da || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState('')

  async function accedi(e) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setInvio(false)
      setErrore(traduciErrore(error.message))
      return
    }
    setPassword('')
    await ricarica()
    setInvio(false)
    navigate(destinazione, { replace: true })
  }

  if (!pronto) {
    return <div className="text-center text-gray-400 italic py-10">Caricamento...</div>
  }

  if (utente) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Accesso effettuato</h2>
        <p className="text-sm text-gray-700">Sei dentro come <strong>{utente.email}</strong>.</p>
        <p className={`text-sm rounded-lg px-3 py-2 ${puoModificare
          ? 'bg-green-50 text-green-800'
          : 'bg-amber-50 text-amber-900'}`}>
          {puoModificare
            ? 'Puoi modificare i dati del sito.'
            : 'Questo account può solo guardare: non è tra quelli del comitato autorizzati a modificare.'}
        </p>
        <button type="button" onClick={esci}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Esci
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={accedi} className="max-w-md mx-auto bg-white rounded-xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Accesso comitato</h2>
        <p className="text-sm text-gray-500">
          Serve solo per modificare i dati. Per guardare il sito non serve accedere.
        </p>
      </div>
      <label className="block">
        <span className="block text-xs font-semibold text-gray-600 mb-1">Email</span>
        <input type="email" required autoComplete="username" value={email}
               onChange={e => setEmail(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold text-gray-600 mb-1">Password</span>
        <input type="password" required autoComplete="current-password" value={password}
               onChange={e => setPassword(e.target.value)} className={inputClass} />
      </label>
      {errore && (
        <div className="px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-800">{errore}</div>
      )}
      <button disabled={invio}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition">
        {invio ? 'Accesso in corso...' : 'Accedi'}
      </button>
    </form>
  )
}
