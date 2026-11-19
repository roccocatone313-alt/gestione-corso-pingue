import { supabase } from './supabase'

export function oggiISO() {
  return new Date().toISOString().slice(0, 10)
}

// Data del movimento di cassa creato in automatico dal database
// (riferimento 'Acquisto #12' oppure 'Sponsor #3').
// Il trigger del database, quando si modifica un acquisto pagato o uno sponsor
// incassato senza data, rimette la data del movimento a oggi: passando questa
// data come data di pagamento/incasso la data originale resta com'era.
export async function dataMovimentoCollegato(riferimento) {
  const { data, error } = await supabase
    .from('movimenti')
    .select('data')
    .eq('riferimento', riferimento)
    .limit(1)
  if (error || !data || data.length === 0) return null
  return data[0].data || null
}

// True se l'entrata collegata allo sponsor era stata scritta a mano (entrata F.I.Do
// collegata con "Pagato tramite F.I.Do"): se lo sponsor viene scollegato o eliminato
// resta in cassa come entrata F.I.Do normale, invece di essere tolta.
export async function entrataScrittaAMano(sponsorId) {
  const { data, error } = await supabase
    .from('movimenti')
    .select('descrizione_originale')
    .eq('riferimento', 'Sponsor #' + sponsorId)
    .limit(1)
  if (error || !data || data.length === 0) return false
  return data[0].descrizione_originale !== null && data[0].descrizione_originale !== undefined
}
