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
