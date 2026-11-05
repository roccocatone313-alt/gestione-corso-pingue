// Sezioni del Rendiconto, nell'ordine in cui compaiono nella pagina.
// Per aggiungerne una: scrivi il nome qui sotto, prima di 'ALTRO'.
// Vale per tutto il sito (Rendiconto, Budget, Inserisci, Admin).
export const MACRO_SEZIONI = [
  'RECITA',
  'SERATA DANZANTE',
  'CATERING',
  'SMALTIMENTO RIFIUTI',
  'SPINGUINATURA',
  'ALTRO',
]

// Riporta il valore salvato nel database a una sezione valida.
// Vuoto o sconosciuto = ALTRO.
export function sezioneValida(valore) {
  const v = String(valore || '').toUpperCase().trim()
  return MACRO_SEZIONI.includes(v) ? v : 'ALTRO'
}
