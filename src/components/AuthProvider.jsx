import { useCallback, useEffect, useState } from 'react'
import { supabase, impostaPermessoModifica } from '../lib/supabase'
import { AuthContext } from '../lib/auth'

export default function AuthProvider({ children }) {
  const [stato, setStato] = useState({ pronto: false, utente: null, puoModificare: false })

  // Legge l'utente e chiede al database se può modificare (tabella "editori")
  const aggiorna = useCallback(async session => {
    const utente = session?.user ?? null
    let puoModificare = false
    if (utente) {
      const { data, error } = await supabase.rpc('puo_modificare')
      puoModificare = !error && data === true
    }
    impostaPermessoModifica(puoModificare)
    setStato({ pronto: true, utente, puoModificare })
    return puoModificare
  }, [])

  const ricarica = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return aggiorna(data.session)
  }, [aggiorna])

  useEffect(() => {
    ricarica()
    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'TOKEN_REFRESHED') return
      // Fuori dal callback: Supabase sconsiglia altre chiamate al suo interno
      setTimeout(() => { aggiorna(session) }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [aggiorna, ricarica])

  const esci = useCallback(async () => {
    await supabase.auth.signOut()
    impostaPermessoModifica(false)
    setStato({ pronto: true, utente: null, puoModificare: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...stato, ricarica, esci }}>
      {children}
    </AuthContext.Provider>
  )
}
