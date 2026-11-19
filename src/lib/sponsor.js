// Calcoli sugli sponsor. Li usano Rendiconto, pagina Sponsor ed export,
// così ogni pagina mostra gli stessi numeri.
import { euro } from './formato'

// Sponsor che contano nelle entrate previste
export const SPONSOR_CONTEGGIATI = ['Confermato', 'Incassato']

// Sponsor che hanno donato tramite F.I.Do: l'entrata è nella voce F.I.Do
// (categoria F.I.Do del movimento), non in quella Sponsor.
export const STATO_FIDO = 'Pagato tramite F.I.Do'

// Stati in cui lo sponsor ha pagato e ha un'entrata in cassa
export const STATI_PAGATI = ['Incassato', STATO_FIDO]

// Tutti gli stati, nell'ordine delle colonne della pagina Sponsor
export const STATI_SPONSOR = ['Prospect', 'In trattativa', 'Confermato', 'Incassato', STATO_FIDO, 'Perso']

export function pagato(s) {
  return STATI_PAGATI.includes(s.stato)
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function somma(elenco, f) {
  return elenco.reduce((t, s) => t + f(s), 0)
}

export function conteggiato(s) {
  return SPONSOR_CONTEGGIATI.includes(s.stato)
}

// Entrata in cassa di uno sponsor incassato: l'importo incassato, oppure
// quello promesso se l'incassato è vuoto (lo stesso fa il database).
export function importoIncasso(s) {
  const incassato = num(s.importo_incassato)
  return incassato > 0 ? incassato : num(s.importo_promesso)
}

// Quanto è arrivato da uno sponsor
export function incassatoDa(s) {
  return pagato(s) ? importoIncasso(s) : num(s.importo_incassato)
}

// Quanto manca da incassare: solo per i confermati
export function daIncassareDa(s) {
  return s.stato === 'Confermato'
    ? Math.max(num(s.importo_promesso) - num(s.importo_incassato), 0)
    : 0
}

// Quanto ci si aspetta da uno sponsor confermato o incassato:
// quello che è già arrivato più quello che manca
export function attesoDa(s) {
  return conteggiato(s) ? incassatoDa(s) + daIncassareDa(s) : 0
}

// Totali degli sponsor. Gli attesi sono i confermati più gli incassati;
// chi è in trattativa resta a parte e non entra nei conti.
export function riepilogoSponsor(sponsor) {
  const lista = sponsor || []
  const conteggiati = lista.filter(conteggiato)
  const inTrattativa = lista.filter(s => s.stato === 'In trattativa')
  const viaFido = lista.filter(s => s.stato === STATO_FIDO)
  return {
    attesi: somma(conteggiati, attesoDa),
    incassati: somma(conteggiati, incassatoDa),
    daIncassare: somma(conteggiati, daIncassareDa),
    promessi: somma(conteggiati, s => num(s.importo_promesso)),
    trattativa: somma(inTrattativa, s => num(s.importo_promesso)),
    // Già contati nella voce F.I.Do: qui solo per mostrarli
    fido: somma(viaFido, importoIncasso),
    nConteggiati: conteggiati.length,
    nTrattativa: inTrattativa.length,
    nFido: viaFido.length,
    nProspect: lista.filter(s => s.stato === 'Prospect').length,
  }
}

// Domanda di conferma prima di segnare uno sponsor come incassato
export function messaggioIncasso(s) {
  const nome = (s.nome || '').trim() || 'Lo sponsor'
  const importo = importoIncasso(s)
  if (importo <= 0) {
    return `${nome} non ha importi: risulterà incassato, ma in cassa non entra nulla. Confermi?`
  }
  const nota = num(s.importo_incassato) > 0
    ? ''
    : " È l'importo promesso: se è arrivata una cifra diversa, correggi l'importo incassato."
  return `${nome} passa a Incassato e in cassa entra ${euro(importo)}.${nota} Confermi?`
}

// Domanda di conferma quando uno sponsor che ha pagato cambia stato.
// scrittaAMano: l'entrata era un'entrata F.I.Do registrata a mano e poi collegata,
// quindi resta in cassa senza sponsor; altrimenti esce dalla cassa.
// Null se non c'è niente da chiedere.
export function messaggioUscitaCassa(s, nuovoStato, scrittaAMano = false) {
  if (!pagato(s) || STATI_PAGATI.includes(nuovoStato)) return null
  const nome = (s.nome || '').trim() || 'Lo sponsor'
  if (scrittaAMano) {
    return `${nome} passa a "${nuovoStato}": l'entrata F.I.Do di ${euro(importoIncasso(s))} ` +
      `resta in cassa, ma senza sponsor. Confermi?`
  }
  const voce = s.stato === STATO_FIDO ? 'F.I.Do' : 'Sponsor'
  return `${nome} passa a "${nuovoStato}": l'entrata di ${euro(importoIncasso(s))} ` +
    `(voce ${voce}) viene tolta dalla cassa. Confermi?`
}

// Domanda di conferma prima di eliminare uno sponsor
export function messaggioEliminaSponsor(s, scrittaAMano = false) {
  const nome = (s.nome || '').trim() || 'lo sponsor'
  if (scrittaAMano) {
    return `Eliminare ${nome}? La sua entrata F.I.Do di ${euro(importoIncasso(s))} resta in cassa, senza sponsor.`
  }
  if (pagato(s)) {
    return `Eliminare ${nome}? Anche la sua entrata di ${euro(importoIncasso(s))} viene tolta dalla cassa. Operazione irreversibile.`
  }
  return `Eliminare ${nome}? Operazione irreversibile.`
}
