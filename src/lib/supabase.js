import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

// --- Permesso di modifica ---
// Il blocco vero è nel database: le regole RLS fanno modificare solo chi ha
// fatto l'accesso con un'email della tabella "editori".
// Qui fermiamo le modifiche già nel sito, così chi non ha fatto l'accesso vede
// un messaggio chiaro invece di un salvataggio che il database poi ignora.
let puoModificare = false

export function impostaPermessoModifica(valore) {
  puoModificare = !!valore
}

const MESSAGGIO_BLOCCO = 'Solo il comitato può modificare i dati: accedi dal menu in alto.'

// Finta richiesta che accetta qualsiasi .eq(), .select(), .single()...
// e restituisce sempre l'errore di permesso.
function richiestaBloccata() {
  const risposta = {
    data: null,
    error: { message: MESSAGGIO_BLOCCO },
    count: null,
    status: 401,
    statusText: 'Unauthorized',
  }
  const catena = new Proxy(function () {}, {
    get(_bersaglio, prop) {
      if (prop === 'then') return (ok, ko) => Promise.resolve(risposta).then(ok, ko)
      if (prop === 'catch') return ko => Promise.resolve(risposta).catch(ko)
      if (prop === 'finally') return fn => Promise.resolve(risposta).finally(fn)
      return () => catena
    },
    apply() {
      return catena
    },
  })
  return catena
}

const fromOriginale = supabase.from.bind(supabase)

supabase.from = tabella => {
  const richiesta = fromOriginale(tabella)
  if (puoModificare) return richiesta
  for (const metodo of ['insert', 'update', 'upsert', 'delete']) {
    richiesta[metodo] = () => richiestaBloccata()
  }
  return richiesta
}
