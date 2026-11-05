import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MACRO_SEZIONI, sezioneValida } from '../lib/macroSezioni'
import { dataMovimentoCollegato } from '../lib/dateCassa'
import CONFIG from '../data/rendiconto.json'

// Paganti e quota per allievo si cambiano in src/data/rendiconto.json

// Sponsor che contano nelle entrate previste
const SPONSOR_CONTEGGIATI = ['Confermato', 'Incassato']
// Sponsor mostrati in tabella, in quest'ordine
const SPONSOR_IN_TABELLA = ['Incassato', 'Confermato', 'In trattativa']

const COLORI_STATO = {
  'Pagato': 'bg-green-100 text-green-800',
  'Incassato': 'bg-green-100 text-green-800',
  'Completata': 'bg-green-100 text-green-800',
  'Ricevuto': 'bg-sky-100 text-sky-800',
  'Ordinato': 'bg-sky-100 text-sky-800',
  'Approvato': 'bg-sky-100 text-sky-800',
  'Confermato': 'bg-sky-100 text-sky-800',
  'Da approvare': 'bg-amber-100 text-amber-800',
  'In trattativa': 'bg-amber-100 text-amber-800',
  'Da fare': 'bg-amber-100 text-amber-800',
  'Pianificato': 'bg-gray-100 text-gray-700',
  'In corso': 'bg-gray-100 text-gray-700',
}

const STILE = `
.rendiconto .chiuso { display: none; }
@media print {
  nav, .no-print { display: none !important; }
  body { background: #ffffff !important; }
  main { max-width: none !important; padding: 0 !important; }
  .rendiconto { max-width: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rendiconto .chiuso { display: block !important; }
  .rendiconto .shadow-sm { box-shadow: none !important; border: 1px solid #e5e7eb; }
  .rendiconto .blocco { break-inside: avoid; }
  .rendiconto .overflow-x-auto { overflow: visible !important; }
  .rendiconto table { font-size: 11px; }
  @page { size: A4; margin: 12mm; }
}
`

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Formato italiano con il punto delle migliaia sempre presente
// (toLocaleString non lo mette sotto i 10.000: "1220,00" invece di "1.220,00").
function euro(n) {
  const v = num(n)
  const [intero, decimali] = Math.abs(v).toFixed(2).split('.')
  const segno = v < 0 && Math.abs(v) >= 0.005 ? '-' : ''
  return '€ ' + segno + intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimali
}

function dataIt(d) {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x.getTime())) return '—'
  return x.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dataOra(d) {
  if (!d) return ''
  return d.toLocaleString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function tronca(testo, max = 80) {
  const t = String(testo || '').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

// Classifica un'entrata di cassa in base alla categoria
function tipoEntrata(m) {
  const c = String(m.categoria || '').toLowerCase()
  if (c.includes('quot') || c.includes('alliev')) return 'quote'
  if (c.replace(/[^a-z]/g, '').includes('fido')) return 'fido'
  if (c === 'sponsor' || m.origine === 'sponsor') return 'sponsor'
  return 'altre'
}

function Badge({ stato }) {
  const cls = COLORI_STATO[stato] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {stato}
    </span>
  )
}

function Barra({ valore, massimo, colore = 'bg-green-500' }) {
  const pct = massimo > 0 ? Math.min((valore / massimo) * 100, 100) : 0
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${colore}`} style={{ width: pct + '%' }} />
    </div>
  )
}

const TONI = {
  neutro: { bordo: 'border-l-gray-300', valore: 'text-gray-900' },
  verde: { bordo: 'border-l-green-500', valore: 'text-green-700' },
  rosso: { bordo: 'border-l-red-500', valore: 'text-red-700' },
  blu: { bordo: 'border-l-sky-500', valore: 'text-sky-800' },
}

function Kpi({ label, valore, sotto, tono = 'neutro' }) {
  const t = TONI[tono] || TONI.neutro
  return (
    <div className={`blocco bg-white rounded-xl p-4 shadow-sm border-l-4 ${t.bordo}`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className={`text-xl md:text-2xl font-bold mt-1 tabular-nums ${t.valore}`}>{valore}</div>
      {sotto && <div className="text-xs text-gray-500 mt-1">{sotto}</div>}
    </div>
  )
}

function Titolo({ children, sotto }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-bold text-gray-900">{children}</h2>
      {sotto && <p className="text-sm text-gray-500">{sotto}</p>}
    </div>
  )
}

function FonteCard({ titolo, incassato, previsto, nota, colore }) {
  const haPrevisto = previsto != null && previsto > 0
  return (
    <div className="blocco bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${colore}`} />
        <span className="font-bold text-gray-900">{titolo}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-gray-900 tabular-nums">{euro(incassato)}</div>
      <div className="text-xs text-gray-500">
        {haPrevisto ? `incassati su ${euro(previsto)} previsti` : 'incassati'}
      </div>
      {haPrevisto && (
        <div className="mt-2">
          <Barra valore={incassato} massimo={previsto} colore={colore} />
        </div>
      )}
      {nota && <div className="text-xs text-gray-500 mt-2">{nota}</div>}
    </div>
  )
}

function Copertura({ spese, parti, mancano }) {
  const entrate = parti.reduce((t, p) => t + p.valore, 0)
  const base = Math.max(spese, entrate) || 1
  return (
    <div>
      <div className="flex h-7 w-full rounded-lg overflow-hidden bg-gray-100">
        {parti.filter(p => p.valore > 0).map(p => (
          <div key={p.nome} className={`${p.colore} h-full`}
               style={{ width: (p.valore / base) * 100 + '%' }}
               title={`${p.nome}: ${euro(p.valore)}`} />
        ))}
        {mancano > 0 && (
          <div className="h-full bg-red-100"
               style={{
                 width: (mancano / base) * 100 + '%',
                 backgroundImage: 'repeating-linear-gradient(45deg, rgba(220,38,38,0.35) 0 6px, transparent 6px 12px)',
               }}
               title={`Mancano: ${euro(mancano)}`} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm">
        {parti.filter(p => p.sempre || p.valore > 0).map(p => (
          <span key={p.nome} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-sm ${p.colore}`} />
            <span className="text-gray-600">{p.nome}</span>
            <strong className="tabular-nums text-gray-900">{euro(p.valore)}</strong>
          </span>
        ))}
        {mancano > 0 && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-300" />
            <span className="text-gray-600">Mancano</span>
            <strong className="tabular-nums text-red-700">{euro(mancano)}</strong>
          </span>
        )}
      </div>
    </div>
  )
}

function SezioneCard({ sezione, aperta, onToggle, modifica, onSposta, salvando }) {
  const { nome, voci, totale, pagato, daPagare, daApprovare } = sezione
  return (
    <div className="blocco bg-white rounded-xl shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle}
              className="w-full text-left p-5 hover:bg-gray-50 transition">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-[160px] flex-1">
            <div className="font-bold text-gray-900 tracking-wide">{nome}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {voci.length === 0
                ? 'Nessuna spesa'
                : `${voci.length} ${voci.length === 1 ? 'voce' : 'voci'}`}
              {daApprovare > 0 && ` · ${euro(daApprovare)} da approvare`}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right tabular-nums">
            <div>
              <div className="text-[11px] uppercase text-gray-500">Totale</div>
              <div className="font-bold text-gray-900">{euro(totale)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-gray-500">Pagato</div>
              <div className="font-bold text-green-700">{euro(pagato)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-gray-500">Da pagare</div>
              <div className="font-bold text-amber-700">{euro(daPagare)}</div>
            </div>
          </div>
          <span className="no-print text-gray-400 text-lg w-4">{aperta ? '▾' : '▸'}</span>
        </div>
        {totale > 0 && (
          <div className="mt-3">
            <Barra valore={pagato} massimo={totale} />
          </div>
        )}
      </button>

      <div className={aperta ? '' : 'chiuso'}>
        {voci.length === 0 ? (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400 italic">
            Nessuna spesa in questa sezione.
          </div>
        ) : (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Voce</th>
                  <th className="text-left px-4 py-2">Fornitore</th>
                  <th className="text-left px-4 py-2">Stato</th>
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-right px-4 py-2">Importo</th>
                  <th className="text-right px-4 py-2">Pagato</th>
                  {modifica && <th className="text-left px-4 py-2 no-print">Sezione</th>}
                </tr>
              </thead>
              <tbody>
                {voci.map(v => (
                  <tr key={v.chiave} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-2 font-medium text-gray-900" title={v.descrizione}>
                      {tronca(v.descrizione)}
                      {v.tabella === 'budget' && (
                        <span className="ml-2 text-[10px] uppercase text-gray-400">budget</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{v.fornitore || '—'}</td>
                    <td className="px-4 py-2"><Badge stato={v.stato} /></td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{dataIt(v.data)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{euro(v.importo)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-700">
                      {v.pagato > 0 ? euro(v.pagato) : '—'}
                    </td>
                    {modifica && (
                      <td className="px-4 py-2 no-print">
                        <select value={v.sezione}
                                disabled={salvando === v.chiave}
                                onChange={e => onSposta(v, e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30">
                          {MACRO_SEZIONI.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr className="border-t border-gray-200">
                  <td className="px-4 py-2" colSpan={4}>Totale {nome}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{euro(totale)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-700">{euro(pagato)}</td>
                  {modifica && <td className="no-print" />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function calcola(dati) {
  const { movimenti, acquisti, sponsor, budget, scadenze } = dati

  // --- Cassa ---
  let entrate = 0
  let uscite = 0
  const entratePer = { quote: 0, fido: 0, sponsor: 0, altre: 0 }
  for (const m of movimenti) {
    const imp = num(m.importo)
    if (m.tipo === 'Entrata') {
      entrate += imp
      entratePer[tipoEntrata(m)] += imp
    } else if (m.tipo === 'Uscita') {
      uscite += imp
    }
  }
  const saldo = entrate - uscite

  // --- Spese: acquisti, voci di budget pianificate, uscite registrate a mano ---
  const voci = []
  for (const a of acquisti) {
    if (a.stato === 'Rifiutato') continue
    const haEffettivo = a.importo_effettivo !== null && a.importo_effettivo !== undefined && a.importo_effettivo !== ''
    const importo = haEffettivo ? num(a.importo_effettivo) : num(a.importo_previsto)
    voci.push({
      chiave: 'acquisti-' + a.id,
      tabella: 'acquisti',
      id: a.id,
      descrizione: a.descrizione || 'Acquisto #' + a.id,
      fornitore: a.fornitore || '',
      stato: a.stato || 'Da approvare',
      importo,
      pagato: a.stato === 'Pagato' ? importo : 0,
      data: a.data_pagamento || a.data_ordine || a.data_richiesta || null,
      sezione: sezioneValida(a.macro_sezione),
      grezzo: a,
    })
  }
  for (const b of budget) {
    const stato = b.stato || 'Pianificato'
    if (stato !== 'Pianificato' && stato !== 'In corso') continue
    const importo = num(b.preventivato)
    if (importo <= 0) continue
    voci.push({
      chiave: 'budget-' + b.id,
      tabella: 'budget',
      id: b.id,
      descrizione: b.voce || 'Voce di budget',
      fornitore: b.fornitore_previsto || '',
      stato,
      importo,
      pagato: 0,
      data: b.data_prevista || null,
      sezione: sezioneValida(b.macro_sezione),
      grezzo: b,
    })
  }
  for (const m of movimenti) {
    if (m.tipo !== 'Uscita' || m.origine === 'acquisto') continue
    const importo = num(m.importo)
    voci.push({
      chiave: 'movimenti-' + m.id,
      tabella: 'movimenti',
      id: m.id,
      descrizione: m.descrizione || m.riferimento || 'Uscita',
      fornitore: '',
      stato: 'Pagato',
      importo,
      pagato: importo,
      data: m.data,
      sezione: sezioneValida(m.macro_sezione),
      grezzo: m,
    })
  }

  const sezioni = MACRO_SEZIONI.map(nome => {
    const lista = voci
      .filter(v => v.sezione === nome)
      .sort((x, y) => y.importo - x.importo)
    const totale = lista.reduce((t, v) => t + v.importo, 0)
    const pagato = lista.reduce((t, v) => t + v.pagato, 0)
    const daApprovare = lista
      .filter(v => v.stato === 'Da approvare')
      .reduce((t, v) => t + v.importo, 0)
    return { nome, voci: lista, totale, pagato, daPagare: totale - pagato, daApprovare }
  })
  const spesePreviste = sezioni.reduce((t, s) => t + s.totale, 0)
  const spesePagate = sezioni.reduce((t, s) => t + s.pagato, 0)
  const speseDaApprovare = sezioni.reduce((t, s) => t + s.daApprovare, 0)
  const differenzaCassa = uscite - spesePagate

  // --- Sponsor ---
  const sponsorLista = sponsor
    .filter(s => SPONSOR_IN_TABELLA.includes(s.stato))
    .sort((x, y) =>
      SPONSOR_IN_TABELLA.indexOf(x.stato) - SPONSOR_IN_TABELLA.indexOf(y.stato) ||
      num(y.importo_promesso) - num(x.importo_promesso))
  const conteggiati = sponsor.filter(s => SPONSOR_CONTEGGIATI.includes(s.stato))
  const sponsorAttesi = conteggiati
    .reduce((t, s) => t + Math.max(num(s.importo_promesso), num(s.importo_incassato)), 0)
  const sponsorIncassati = sponsor.reduce((t, s) => t + num(s.importo_incassato), 0)
  const sponsorDaIncassare = sponsor
    .filter(s => s.stato === 'Confermato')
    .reduce((t, s) => t + Math.max(num(s.importo_promesso) - num(s.importo_incassato), 0), 0)
  const sponsorPromessi = sponsorLista.reduce((t, s) => t + num(s.importo_promesso), 0)
  const sponsorTrattativa = sponsor
    .filter(s => s.stato === 'In trattativa')
    .reduce((t, s) => t + num(s.importo_promesso), 0)
  const nProspect = sponsor.filter(s => s.stato === 'Prospect').length

  // --- Quote allievi ---
  const paganti = num(CONFIG.paganti)
  const quota = num(CONFIG.quotaPerAllievo)
  const quotePreviste = paganti * quota
  const quoteIncassate = entratePer.quote
  const quoteAttese = Math.max(quotePreviste, quoteIncassate)

  // --- Previsione ---
  const entratePreviste = sponsorAttesi + quoteAttese + entratePer.fido + entratePer.altre
  const risultato = entratePreviste - spesePreviste
  const daCoprireConQuote = spesePreviste - sponsorAttesi - entratePer.fido - entratePer.altre
  const quotaPareggio = paganti > 0 ? Math.max(daCoprireConQuote, 0) / paganti : 0

  // --- Registro di cassa con saldo progressivo ---
  const sezionePerAcquisto = new Map(acquisti.map(a => [String(a.id), sezioneValida(a.macro_sezione)]))
  function voceMovimento(m) {
    if (m.tipo === 'Entrata') {
      const t = tipoEntrata(m)
      if (t === 'quote') return 'Quote allievi'
      if (t === 'fido') return 'F.I.Do'
      if (t === 'sponsor') return 'Sponsor'
      return m.categoria || 'Altre entrate'
    }
    const r = /^Acquisto #(\d+)$/.exec(String(m.riferimento || '').trim())
    if (r && sezionePerAcquisto.has(r[1])) return sezionePerAcquisto.get(r[1])
    return sezioneValida(m.macro_sezione)
  }
  let progressivo = 0
  const registro = movimenti.map(m => {
    const imp = num(m.importo)
    progressivo += m.tipo === 'Entrata' ? imp : -imp
    return { ...m, voce: voceMovimento(m), saldoProgressivo: progressivo }
  })

  const scadenzeAperte = scadenze.filter(s => s.stato !== 'Completata' && s.stato !== 'Annullata')

  return {
    entrate, uscite, saldo, entratePer,
    sezioni, spesePreviste, spesePagate, speseDaApprovare, differenzaCassa,
    sponsorLista, sponsorAttesi, sponsorIncassati, sponsorDaIncassare, sponsorPromessi,
    sponsorTrattativa, nProspect, nSponsor: conteggiati.length,
    paganti, quota, quotePreviste, quoteIncassate, quoteAttese,
    entratePreviste, risultato, quotaPareggio,
    registro, scadenzeAperte,
  }
}

export default function Rendiconto() {
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(null)
  const [aggiornato, setAggiornato] = useState(null)
  const [aperte, setAperte] = useState({})
  const [registroAperto, setRegistroAperto] = useState(false)
  const [modifica, setModifica] = useState(false)
  const [salvando, setSalvando] = useState(null)
  const [msg, setMsg] = useState(null)

  async function carica() {
    setErrore(null)
    const [mov, acq, sp, bud, scad] = await Promise.all([
      supabase.from('movimenti').select('*')
        .order('data', { ascending: true }).order('id', { ascending: true }),
      supabase.from('acquisti').select('*'),
      supabase.from('sponsor').select('*'),
      supabase.from('budget').select('*'),
      supabase.from('scadenze').select('*').order('data', { ascending: true }),
    ])
    const err = mov.error || acq.error || sp.error || bud.error || scad.error
    if (err) { setErrore(err.message); return }
    setDati({
      movimenti: mov.data || [],
      acquisti: acq.data || [],
      sponsor: sp.data || [],
      budget: bud.data || [],
      scadenze: scad.data || [],
    })
    setAggiornato(new Date())
  }

  useEffect(() => { carica() }, [])

  const c = useMemo(() => (dati ? calcola(dati) : null), [dati])

  function mostra(stato, testo) {
    setMsg({ stato, testo })
    setTimeout(() => setMsg(null), 3500)
  }

  function toggle(nome) {
    setAperte(a => ({ ...a, [nome]: !a[nome] }))
  }

  const tutteAperte = MACRO_SEZIONI.every(n => aperte[n])

  function impostaTutte(valore) {
    setAperte(Object.fromEntries(MACRO_SEZIONI.map(n => [n, valore])))
  }

  function attivaModifica() {
    if (!modifica) impostaTutte(true)
    setModifica(!modifica)
  }

  async function sposta(voce, nuova) {
    if (!nuova || nuova === voce.sezione) return
    setSalvando(voce.chiave)
    const campi = { macro_sezione: nuova }
    // Acquisto già pagato senza data di pagamento: riporto la data del movimento
    // di cassa, altrimenti il database la sposterebbe a oggi.
    if (voce.tabella === 'acquisti' && voce.grezzo.stato === 'Pagato' && !voce.grezzo.data_pagamento) {
      const data = await dataMovimentoCollegato('Acquisto #' + voce.id)
      if (data) campi.data_pagamento = data
    }
    const { error } = await supabase.from(voce.tabella).update(campi).eq('id', voce.id)
    setSalvando(null)
    if (error) { mostra('errore', 'Spostamento non salvato: ' + error.message); return }
    setDati(d => ({
      ...d,
      [voce.tabella]: d[voce.tabella].map(r => (r.id === voce.id ? { ...r, ...campi } : r)),
    }))
    mostra('ok', `"${tronca(voce.descrizione, 40)}" spostata in ${nuova}`)
  }

  if (errore) {
    return (
      <div className="max-w-xl mx-auto bg-red-50 border border-red-200 text-red-800 rounded-xl p-5 text-sm">
        Errore nel caricamento dei dati: {errore}
        <button type="button" onClick={carica} className="block mt-3 font-semibold underline">Riprova</button>
      </div>
    )
  }

  if (!c) {
    return <div className="text-center text-gray-400 italic py-10">Caricamento del rendiconto...</div>
  }

  const mancano = Math.max(-c.risultato, 0)

  return (
    <div className="rendiconto space-y-6 max-w-5xl mx-auto">
      <style>{STILE}</style>

      {/* Intestazione */}
      <header className="blocco bg-white rounded-xl p-6 shadow-sm border-t-4 border-sky-500 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-sky-700 font-bold">{CONFIG.organizzatore}</div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-1">Rendiconto economico</h1>
          <div className="text-gray-700 font-medium">{CONFIG.titolo}</div>
          <div className="text-xs text-gray-500 mt-2">Situazione al {dataOra(aggiornato)}</div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={carica}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">
            Aggiorna
          </button>
          <button type="button" onClick={() => window.print()}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-sky-500 text-white hover:bg-sky-600">
            Stampa / PDF
          </button>
          <button type="button" onClick={attivaModifica}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${modifica
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {modifica ? 'Fine spostamento' : 'Sposta spese'}
          </button>
        </div>
      </header>

      {msg && (
        <div className={`no-print px-4 py-2 rounded-lg text-sm ${msg.stato === 'ok'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.testo}
        </div>
      )}

      {/* 1. Sintesi */}
      <section>
        <Titolo>Sintesi</Titolo>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Saldo di cassa" valore={euro(c.saldo)}
               tono={c.saldo >= 0 ? 'verde' : 'rosso'}
               sotto={`Entrate ${euro(c.entrate)} · uscite ${euro(c.uscite)}`} />
          <Kpi label="Spese previste" valore={euro(c.spesePreviste)} tono="blu"
               sotto={`Pagate ${euro(c.spesePagate)} · da pagare ${euro(c.spesePreviste - c.spesePagate)}`} />
          <Kpi label="Entrate previste" valore={euro(c.entratePreviste)} tono="blu"
               sotto={`Già incassate ${euro(c.entrate)}`} />
          <Kpi label={c.risultato >= 0 ? 'Avanzo previsto' : 'Disavanzo previsto'}
               valore={euro(c.risultato)}
               tono={c.risultato >= 0 ? 'verde' : 'rosso'}
               sotto="Entrate previste meno spese previste" />
        </div>
      </section>

      {/* 2. Copertura */}
      <section className="blocco bg-white rounded-xl p-6 shadow-sm">
        <Titolo sotto={`Spese previste ${euro(c.spesePreviste)}: quanto è coperto dalle entrate previste.`}>
          Copertura delle spese
        </Titolo>
        <Copertura
          spese={c.spesePreviste}
          mancano={mancano}
          parti={[
            { nome: 'Sponsor', valore: c.sponsorAttesi, colore: 'bg-sky-600', sempre: true },
            { nome: 'Quote allievi', valore: c.quoteAttese, colore: 'bg-sky-300', sempre: true },
            { nome: 'F.I.Do', valore: c.entratePer.fido, colore: 'bg-teal-500', sempre: true },
            { nome: 'Altre entrate', valore: c.entratePer.altre, colore: 'bg-indigo-400' },
          ]}
        />
        {c.paganti > 0 && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${c.quotaPareggio > c.quota
            ? 'bg-red-50 text-red-900'
            : 'bg-green-50 text-green-900'}`}>
            {c.quotaPareggio > c.quota ? (
              <>
                Per coprire tutte le spese previste servono <strong>{euro(c.quotaPareggio)}</strong> a
                testa ({c.paganti} paganti). La quota attuale è {euro(c.quota)}: mancano{' '}
                <strong>{euro(c.quotaPareggio - c.quota)}</strong> a testa.
              </>
            ) : (
              <>Con la quota attuale di {euro(c.quota)} a testa le entrate previste coprono tutte le spese previste.</>
            )}
          </div>
        )}
      </section>

      {/* 3. Fonti di finanziamento */}
      <section>
        <Titolo sotto="Da dove arrivano i soldi: quanto è già entrato e quanto è previsto.">
          Fonti di finanziamento
        </Titolo>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FonteCard titolo="Quote allievi" colore="bg-sky-300"
                     incassato={c.quoteIncassate} previsto={c.quotePreviste}
                     nota={`${c.paganti} paganti × ${euro(c.quota)}`} />
          <FonteCard titolo="Sponsor" colore="bg-sky-600"
                     incassato={c.sponsorIncassati} previsto={c.sponsorAttesi}
                     nota={`${c.nSponsor} sponsor confermati · da incassare ${euro(c.sponsorDaIncassare)}`} />
          <FonteCard titolo="F.I.Do" colore="bg-teal-500"
                     incassato={c.entratePer.fido} previsto={null}
                     nota="Fondazione Italiana per il Dono" />
        </div>
        {(c.entratePer.altre > 0 || c.sponsorTrattativa > 0) && (
          <div className="mt-3 text-sm text-gray-600 space-y-1">
            {c.entratePer.altre > 0 && (
              <div>Altre entrate registrate: <strong>{euro(c.entratePer.altre)}</strong></div>
            )}
            {c.sponsorTrattativa > 0 && (
              <div>Sponsor in trattativa, non conteggiati: <strong>{euro(c.sponsorTrattativa)}</strong></div>
            )}
          </div>
        )}
      </section>

      {/* 4. Spese per sezione */}
      <section>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Spese per sezione</h2>
            <p className="text-sm text-gray-500">
              Totale {euro(c.spesePreviste)} · pagato {euro(c.spesePagate)}
              {c.speseDaApprovare > 0 && ` · da approvare ${euro(c.speseDaApprovare)}`}
            </p>
          </div>
          <button type="button" onClick={() => impostaTutte(!tutteAperte)}
                  className="no-print text-sm font-semibold text-sky-700 hover:underline">
            {tutteAperte ? 'Chiudi tutte' : 'Apri tutte'}
          </button>
        </div>
        {modifica && (
          <div className="no-print mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            Usa il menu nella colonna "Sezione" per spostare una spesa. Il cambio si salva subito.
          </div>
        )}
        <div className="space-y-3">
          {c.sezioni.map(s => (
            <SezioneCard key={s.nome} sezione={s}
                         aperta={!!aperte[s.nome]}
                         onToggle={() => toggle(s.nome)}
                         modifica={modifica}
                         onSposta={sposta}
                         salvando={salvando} />
          ))}
        </div>
      </section>

      {/* 5. Sponsor */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 pt-5">
          <Titolo sotto={`Attesi ${euro(c.sponsorAttesi)} · incassati ${euro(c.sponsorIncassati)} · da incassare ${euro(c.sponsorDaIncassare)}`}>
            Sponsor
          </Titolo>
        </div>
        {c.sponsorLista.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-gray-400 italic">Nessuno sponsor confermato.</div>
        ) : (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Sponsor</th>
                  <th className="text-left px-4 py-2">Stato</th>
                  <th className="text-right px-4 py-2">Promesso</th>
                  <th className="text-right px-4 py-2">Incassato</th>
                  <th className="text-right px-4 py-2">Da incassare</th>
                  <th className="text-left px-4 py-2">Accordo</th>
                  <th className="text-left px-4 py-2">Data incasso</th>
                </tr>
              </thead>
              <tbody>
                {c.sponsorLista.map(s => {
                  const daIncassare = s.stato === 'Confermato'
                    ? Math.max(num(s.importo_promesso) - num(s.importo_incassato), 0)
                    : 0
                  return (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900">{s.nome}</td>
                      <td className="px-4 py-2"><Badge stato={s.stato} /></td>
                      <td className="px-4 py-2 text-right tabular-nums">{euro(s.importo_promesso)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-green-700">{euro(s.importo_incassato)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-700">
                        {daIncassare > 0 ? euro(daIncassare) : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{dataIt(s.data_accordo)}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{dataIt(s.data_incasso)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr className="border-t border-gray-200">
                  <td className="px-4 py-2" colSpan={2}>Totale</td>
                  <td className="px-4 py-2 text-right tabular-nums">{euro(c.sponsorPromessi)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-700">{euro(c.sponsorIncassati)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-700">{euro(c.sponsorDaIncassare)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {c.nProspect > 0 && (
          <div className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100">
            Altri {c.nProspect} contatti in corso, non conteggiati.
          </div>
        )}
      </section>

      {/* 6. Registro di cassa */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button type="button" onClick={() => setRegistroAperto(a => !a)}
                className="w-full text-left p-5 flex items-center justify-between gap-3 hover:bg-gray-50 transition">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registro di cassa</h2>
            <p className="text-sm text-gray-500">
              {c.registro.length} movimenti · saldo {euro(c.saldo)}
            </p>
          </div>
          <span className="no-print text-gray-400 text-lg">{registroAperto ? '▾' : '▸'}</span>
        </button>
        <div className={registroAperto ? '' : 'chiuso'}>
          {c.registro.length === 0 ? (
            <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400 italic">
              Nessun movimento registrato.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-left px-4 py-2">Descrizione</th>
                    <th className="text-left px-4 py-2">Voce</th>
                    <th className="text-right px-4 py-2">Entrata</th>
                    <th className="text-right px-4 py-2">Uscita</th>
                    <th className="text-right px-4 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {c.registro.map(m => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{dataIt(m.data)}</td>
                      <td className="px-4 py-2 text-gray-900" title={m.descrizione || ''}>
                        {tronca(m.descrizione || m.riferimento || '—', 70)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{m.voce}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-green-700">
                        {m.tipo === 'Entrata' ? euro(m.importo) : ''}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-700">
                        {m.tipo === 'Uscita' ? euro(m.importo) : ''}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-semibold ${m.saldoProgressivo >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                        {euro(m.saldoProgressivo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 7. Scadenze aperte (solo se ce ne sono) */}
      {c.scadenzeAperte.length > 0 && (
        <section className="blocco bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 pt-5">
            <Titolo sotto="Pagamenti e incassi ancora da completare.">Prossime scadenze</Titolo>
          </div>
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-left px-4 py-2">Descrizione</th>
                  <th className="text-left px-4 py-2">Tipo</th>
                  <th className="text-right px-4 py-2">Importo</th>
                  <th className="text-left px-4 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {c.scadenzeAperte.map(s => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{dataIt(s.data)}</td>
                    <td className="px-4 py-2 text-gray-900">{tronca(s.descrizione, 70)}</td>
                    <td className="px-4 py-2 text-gray-600">{s.tipo || '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.importo ? euro(s.importo) : '—'}</td>
                    <td className="px-4 py-2"><Badge stato={s.stato || 'Da fare'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 8. Note */}
      <section className="blocco bg-white rounded-xl p-5 shadow-sm text-xs text-gray-500 space-y-1">
        <div className="font-semibold text-gray-700 uppercase tracking-wide mb-1">Come sono calcolati i numeri</div>
        <p><strong>Saldo di cassa</strong>: tutte le entrate meno tutte le uscite registrate.</p>
        <p>
          <strong>Spese previste</strong>: tutti gli acquisti non rifiutati (importo effettivo se presente,
          altrimenti quello previsto), le voci di budget pianificate e le uscite registrate a mano.
          Comprendono anche le spese ancora da approvare.
        </p>
        <p>
          <strong>Entrate previste</strong>: sponsor confermati o incassati, quote allievi
          ({c.paganti} × {euro(c.quota)}), importi F.I.Do e altre entrate registrate.
        </p>
        <p>
          <strong>Quota per pareggiare</strong>: spese previste meno sponsor, F.I.Do e altre entrate,
          divise per {c.paganti} paganti.
        </p>
        {Math.abs(c.differenzaCassa) > 0.009 && (
          <p className="text-amber-700">
            <strong>Controllo</strong>: le uscite di cassa ({euro(c.uscite)}) non coincidono con le spese
            pagate ({euro(c.spesePagate)}). Differenza: {euro(c.differenzaCassa)}.
          </p>
        )}
        <p>Dati letti in tempo reale dal database del comitato.</p>
      </section>
    </div>
  )
}
