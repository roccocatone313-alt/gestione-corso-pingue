// Formati usati in tutto il sito (pagine ed export PDF).

// Importi in euro con il punto delle migliaia sempre presente: € 1.220,00
// (toLocaleString in italiano non lo mette sotto i 10.000 e scrive "1220,00").
export function euro(n) {
  const v = Number(n)
  const valore = Number.isFinite(v) ? v : 0
  const [intero, decimali] = Math.abs(valore).toFixed(2).split('.')
  const segno = valore < 0 && Math.abs(valore) >= 0.005 ? '-' : ''
  return '€ ' + segno + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimali
}

// Date nel formato 05/11/2026 ('—' se mancano)
export function dataIt(d) {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x.getTime())) return '—'
  return x.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
