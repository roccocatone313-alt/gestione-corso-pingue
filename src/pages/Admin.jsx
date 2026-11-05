import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import PagamentiAcquisto from '../components/PagamentiAcquisto'
import InfoBox from '../components/InfoBox'
import { esportaExcel, esportaPDF } from '../lib/export'
import { MACRO_SEZIONI } from '../lib/macroSezioni'
import { dataMovimentoCollegato, oggiISO } from '../lib/dateCassa'

const TABS = [
  { id: 'movimenti', label: 'Movimenti' },
  { id: 'sponsor',   label: 'Sponsor' },
  { id: 'acquisti',  label: 'Acquisti' },
]

const CATEGORIE      = ['Sponsor','Materiale','Trasporti','Eventi','Cancelleria','Rimborsi','Altro']
// Per i movimenti: quote degli allievi e soldi arrivati tramite F.I.Do
const CATEGORIE_MOVIMENTO = ['Quote allievi', 'F.I.Do', ...CATEGORIE]
const CELLULE        = ['Sponsor','Budget','Acquisti']
const STATI_SPONSOR  = ['Prospect','In trattativa','Confermato','Incassato','Perso']
const STATI_ACQUISTO = ['Da approvare','Approvato','Ordinato','Ricevuto','Pagato','Rifiutato']

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function badge(stato) {
  const map = {
    'Prospect':      'bg-gray-100 text-gray-700',
    'In trattativa': 'bg-yellow-100 text-yellow-800',
    'Confermato':    'bg-blue-100 text-blue-800',
    'Incassato':     'bg-green-100 text-green-800',
    'Perso':         'bg-red-100 text-red-800',
    'Da approvare':  'bg-orange-100 text-orange-800',
    'Approvato':     'bg-blue-100 text-blue-800',
    'Ordinato':      'bg-purple-100 text-purple-800',
    'Ricevuto':      'bg-green-100 text-green-800',
    'Pagato':        'bg-green-200 text-green-900',
    'Rifiutato':     'bg-red-100 text-red-800',
    'Da fare':       'bg-gray-100 text-gray-700',
    'In corso':      'bg-blue-100 text-blue-800',
    'Completata':    'bg-green-100 text-green-800',
    'Annullata':     'bg-red-100 text-red-800',
    'Pianificato':   'bg-gray-100 text-gray-700',
    'Completato':    'bg-green-100 text-green-800',
    'Annullato':     'bg-red-100 text-red-800',
  }
  const cls = map[stato] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {stato || '—'}
    </span>
  )
}

function etichettaOrigine(origine) {
  switch (origine) {
    case 'acquisto': return 'Acquisto'
    case 'sponsor':  return 'Sponsor'
    case 'scadenza': return 'Scadenza'
    default:         return null
  }
}

export default function Admin() {
  const [tab, setTab] = useState('movimenti')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ stato: null, testo: '' })

  const [movimenti, setMovimenti] = useState([])
  const [sponsor, setSponsor] = useState([])
  const [acquisti, setAcquisti] = useState([])
  const [pagamenti, setPagamenti] = useState([])
  const [pagamentiDi, setPagamentiDi] = useState(null)

  const [filtro, setFiltro] = useState('')
  const [filtroStato, setFiltroStato] = useState('')

  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function mostraMsg(stato, testo) {
    setMsg({ stato, testo })
    setTimeout(() => setMsg({ stato: null, testo: '' }), 3500)
  }

  async function caricaTutto() {
    setLoading(true)
    const [a, b, c, d] = await Promise.all([
      supabase.from('movimenti').select('*').order('data', { ascending: false }),
      supabase.from('sponsor').select('*').order('id', { ascending: false }),
      supabase.from('acquisti').select('*').order('id', { ascending: false }),
      supabase.from('pagamenti_acquisti').select('*').order('data', { ascending: true }),
    ])
    setMovimenti(a.data || [])
    setSponsor(b.data || [])
    setAcquisti(c.data || [])
    setPagamenti(d.data || [])
    setLoading(false)
  }

  useEffect(() => { caricaTutto() }, [])
  useEffect(() => { setFiltro(''); setFiltroStato('') }, [tab])

  function handleExportExcel() {
    esportaExcel({ movimenti, sponsor, acquisti, pagamenti })
  }
  function handleExportPDF() {
    esportaPDF({ movimenti, sponsor, acquisti, pagamenti })
  }

  async function elimina(tipo, id) {
    const conRate = tipo === 'acquisti' && pagamenti.some(p => p.acquisto_id === id)
    const domanda = conRate
      ? "Eliminare l'acquisto? Verranno cancellate anche le sue rate e i movimenti di cassa collegati. Operazione irreversibile."
      : 'Eliminare questa voce? Operazione irreversibile.'
    if (!confirm(domanda)) return
    const { error } = await supabase.from(tipo).delete().eq('id', id)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Eliminato.')
    caricaTutto()
  }

  async function cambiaStato(tipo, id, campo, valore) {
    let messaggioConferma = null
    if (tipo === 'acquisti' && valore === 'Pagato') {
      messaggioConferma = 'Impostare come "Pagato" creerà automaticamente il movimento di Uscita del saldo (totale meno le rate già pagate). Confermi?'
    } else if (tipo === 'sponsor' && valore === 'Incassato') {
      messaggioConferma = 'Impostare come "Incassato" creerà automaticamente un movimento Entrata. Confermi?'
    }
    if (messaggioConferma && !confirm(messaggioConferma)) return

    const campi = { [campo]: valore }
    // Data di pagamento/incasso mancante: la metto a oggi, così le modifiche
    // successive non spostano la data del movimento di cassa.
    if (tipo === 'acquisti' && valore === 'Pagato') {
      const r = acquisti.find(x => x.id === id)
      if (r && !r.data_pagamento) campi.data_pagamento = oggiISO()
    }
    if (tipo === 'sponsor' && valore === 'Incassato') {
      const r = sponsor.find(x => x.id === id)
      if (r && !r.data_incasso) campi.data_incasso = oggiISO()
    }

    const { error } = await supabase.from(tipo).update(campi).eq('id', id)
    if (error) { mostraMsg('errore', error.message); return }
    caricaTutto()
  }

  async function salvaModifica() {
    if (!modal) return
    setSalvando(true)
    const { tipo, dati } = modal
    const id = dati.id
    const payload = { ...dati }
    delete payload.id
    delete payload.created_at
    delete payload.origine

    Object.keys(payload).forEach(k => {
      if (payload[k] === '') payload[k] = null
    })

    // Acquisto pagato / sponsor incassato senza data: uso la data del movimento
    // di cassa già registrato (o oggi), così il database non la sposta.
    if (tipo === 'acquisti' && payload.stato === 'Pagato' && !payload.data_pagamento) {
      payload.data_pagamento = (await dataMovimentoCollegato('Acquisto #' + id)) || oggiISO()
    }
    if (tipo === 'sponsor' && payload.stato === 'Incassato' && !payload.data_incasso) {
      payload.data_incasso = (await dataMovimentoCollegato('Sponsor #' + id)) || oggiISO()
    }

    const { error } = await supabase.from(tipo).update(payload).eq('id', id)
    setSalvando(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Modifica salvata.')
    setModal(null)
    caricaTutto()
  }

  function setCampo(campo, valore) {
    setModal(m => ({ ...m, dati: { ...m.dati, [campo]: valore } }))
  }

  function filtraLista(lista, campiRicerca) {
    let out = lista
    if (filtroStato) {
      out = out.filter(x => x.stato === filtroStato)
    }
    if (filtro.trim()) {
      const q = filtro.toLowerCase()
      out = out.filter(x =>
        campiRicerca.some(c => String(x[c] || '').toLowerCase().includes(q))
      )
    }
    return out
  }

  return (
    <div className="space-y-4">
      <InfoBox id="admin" titolo="Admin — pannello di controllo">
        <p>Qui gestisci <strong>tutto</strong>: 3 schede (Movimenti, Sponsor, Acquisti).</p>
        <p>• <strong>Cerca</strong> con la barra in alto</p>
        <p>• <strong>Filtra per stato</strong> con il menu a tendina</p>
        <p>• <strong>Modifica</strong> o <strong>Elimina</strong> ogni riga</p>
        <p>• <strong>Cambia stato</strong> al volo (es. da "Approvato" a "Pagato")</p>
        <p>Negli acquisti, il pulsante <strong>Pagamenti</strong> registra anticipi e rate: ogni rata esce subito dalla cassa e, quando l'acquisto diventa "Pagato", il saldo è il totale meno le rate.</p>
        <p>I movimenti con badge <strong>auto</strong> sono generati da acquisti (rate e saldo) o sponsor. Non si possono modificare da qui: modifica l'acquisto o lo sponsor.</p>
        <p>In alto a destra esporti tutto in <strong>Excel o PDF</strong>.</p>
      </InfoBox>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Amministrazione</h2>
          <p className="text-sm text-gray-500">Gestione completa di tutti i dati del corso</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            📥 Esporta Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            📄 Esporta PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-2 shadow-sm flex flex-wrap gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[90px] px-3 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.id ? 'bg-sky-500 text-white' : 'text-sky-800 hover:bg-sky-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg.stato && (
        <div className={`px-3 py-2 rounded-lg text-sm border ${
          msg.stato === 'ok'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {msg.testo}
        </div>
      )}

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            placeholder="Cerca..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className={inputClass + ' flex-1 min-w-[180px]'}
          />
          {['sponsor', 'acquisti'].includes(tab) && (
            <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
                    className={inputClass + ' w-auto'}>
              <option value="">Tutti gli stati</option>
              {tab === 'sponsor'   && STATI_SPONSOR.map(s => <option key={s}>{s}</option>)}
              {tab === 'acquisti'  && STATI_ACQUISTO.map(s => <option key={s}>{s}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 italic py-8">Caricamento...</div>
        ) : (
          <>
            {tab === 'movimenti' && (() => {
              const lista = filtraLista(movimenti, ['descrizione', 'categoria', 'cellula', 'riferimento'])
              if (!lista.length) return <div className="text-center text-gray-400 italic py-8">Nessun movimento.</div>
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                        <th className="py-2 px-2">ID</th>
                        <th className="py-2 px-2">Data</th>
                        <th className="py-2 px-2">Tipo</th>
                        <th className="py-2 px-2">Categoria</th>
                        <th className="py-2 px-2">Descrizione</th>
                        <th className="py-2 px-2">Origine</th>
                        <th className="py-2 px-2 text-right">Importo</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(m => {
                        const isAuto = m.origine && m.origine !== 'manuale'
                        const etichetta = etichettaOrigine(m.origine)
                        return (
                          <tr key={m.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 px-2 text-gray-400">#{m.id}</td>
                            <td className="py-2 px-2">{m.data}</td>
                            <td className="py-2 px-2">{m.tipo}</td>
                            <td className="py-2 px-2">{m.categoria}</td>
                            <td className="py-2 px-2">{m.descrizione || '—'}</td>
                            <td className="py-2 px-2">
                              {isAuto ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                                  auto · {etichetta}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">manuale</span>
                              )}
                            </td>
                            <td className={`py-2 px-2 text-right font-medium ${
                              m.tipo === 'Entrata' ? 'text-green-700' : 'text-red-700'
                            }`}>{euro(m.importo)}</td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">
                              {isAuto ? (
                                <span className="text-xs text-gray-500 italic">
                                  🔒 Gestito da {etichetta}
                                </span>
                              ) : (
                                <>
                                  <button onClick={() => setModal({ tipo: 'movimenti', dati: { ...m } })}
                                          className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded mr-1 hover:bg-blue-200 font-semibold">
                                    Modifica
                                  </button>
                                  <button onClick={() => elimina('movimenti', m.id)}
                                          className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 font-semibold">
                                    Elimina
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {tab === 'sponsor' && (() => {
              const lista = filtraLista(sponsor, ['nome', 'referente'])
              if (!lista.length) return <div className="text-center text-gray-400 italic py-8">Nessuno sponsor.</div>
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                        <th className="py-2 px-2">Nome</th>
                        <th className="py-2 px-2">Referente</th>
                        <th className="py-2 px-2 text-right">Promesso</th>
                        <th className="py-2 px-2 text-right">Incassato</th>
                        <th className="py-2 px-2">Stato</th>
                        <th className="py-2 px-2">Cambia</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(s => (
                        <tr key={s.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 px-2 font-medium">{s.nome}</td>
                          <td className="py-2 px-2">{s.referente || '—'}</td>
                          <td className="py-2 px-2 text-right">{euro(s.importo_promesso)}</td>
                          <td className="py-2 px-2 text-right text-green-700">{euro(s.importo_incassato)}</td>
                          <td className="py-2 px-2">{badge(s.stato)}</td>
                          <td className="py-2 px-2">
                            <select value={s.stato || 'Prospect'}
                                    onChange={e => cambiaStato('sponsor', s.id, 'stato', e.target.value)}
                                    className="text-xs px-2 py-1 border border-gray-200 rounded">
                              {STATI_SPONSOR.map(x => <option key={x}>{x}</option>)}
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <button onClick={() => setModal({ tipo: 'sponsor', dati: { ...s } })}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded mr-1 hover:bg-blue-200 font-semibold">
                              Modifica
                            </button>
                            <button onClick={() => elimina('sponsor', s.id)}
                                    className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 font-semibold">
                              Elimina
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {tab === 'acquisti' && (() => {
              const lista = filtraLista(acquisti, ['descrizione', 'fornitore', 'categoria'])
              if (!lista.length) return <div className="text-center text-gray-400 italic py-8">Nessun acquisto.</div>
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                        <th className="py-2 px-2">Descrizione</th>
                        <th className="py-2 px-2">Fornitore</th>
                        <th className="py-2 px-2">Categoria</th>
                        <th className="py-2 px-2 text-right">Previsto</th>
                        <th className="py-2 px-2 text-right">Effettivo</th>
                        <th className="py-2 px-2 text-right">Pagato</th>
                        <th className="py-2 px-2">Stato</th>
                        <th className="py-2 px-2">Cambia</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(a => {
                        const rateAcq = pagamenti.filter(p => p.acquisto_id === a.id)
                        const sommaRate = rateAcq.reduce((t, p) => t + (Number(p.importo) || 0), 0)
                        const totale = Number(a.importo_effettivo || a.importo_previsto) || 0
                        const pagato = a.stato === 'Pagato' ? Math.max(totale, sommaRate) : sommaRate
                        const inParte = a.stato !== 'Pagato' && a.stato !== 'Rifiutato' && sommaRate > 0
                        return (
                          <tr key={a.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 px-2 font-medium">{a.descrizione}</td>
                            <td className="py-2 px-2">{a.fornitore || '—'}</td>
                            <td className="py-2 px-2">
                              {a.categoria ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                  {a.categoria}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right">{euro(a.importo_previsto)}</td>
                            <td className="py-2 px-2 text-right">
                              {a.importo_effettivo ? euro(a.importo_effettivo) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {pagato > 0 ? euro(pagato) : '—'}
                              {inParte && (
                                <div className="text-[11px] text-amber-700 font-semibold whitespace-nowrap">
                                  in parte · mancano {euro(Math.max(totale - sommaRate, 0))}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2">{badge(a.stato)}</td>
                            <td className="py-2 px-2">
                              <select value={a.stato || 'Da approvare'}
                                      onChange={e => cambiaStato('acquisti', a.id, 'stato', e.target.value)}
                                      className="text-xs px-2 py-1 border border-gray-200 rounded">
                                {STATI_ACQUISTO.map(x => <option key={x}>{x}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">
                              <button onClick={() => setPagamentiDi(a.id)}
                                      className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded mr-1 hover:bg-emerald-200 font-semibold">
                                Pagamenti{rateAcq.length > 0 ? ` (${rateAcq.length})` : ''}
                              </button>
                              <button onClick={() => setModal({ tipo: 'acquisti', dati: { ...a } })}
                                      className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded mr-1 hover:bg-blue-200 font-semibold">
                                Modifica
                              </button>
                              <button onClick={() => elimina('acquisti', a.id)}
                                      className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 font-semibold">
                                Elimina
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}

          </>
        )}
      </div>

      {modal && (
        <Modal
          titolo={
            (modal.tipo === 'movimenti' ? 'Movimento'
              : modal.tipo === 'sponsor' ? 'Sponsor'
              : 'Acquisto') + ' #' + modal.dati.id
          }
          onClose={() => setModal(null)}
          onSave={salvaModifica}
          salvando={salvando}
        >
          {modal.tipo === 'movimenti' && (
            <>
              <Field label="Data">
                <input type="date" value={modal.dati.data || ''}
                       onChange={e => setCampo('data', e.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <select value={modal.dati.tipo || 'Entrata'}
                          onChange={e => setCampo('tipo', e.target.value)} className={inputClass}>
                    <option>Entrata</option>
                    <option>Uscita</option>
                  </select>
                </Field>
                <Field label="Importo (€)">
                  <input type="number" step="0.01" value={modal.dati.importo || ''}
                         onChange={e => setCampo('importo', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <select value={modal.dati.categoria || ''}
                          onChange={e => setCampo('categoria', e.target.value)} className={inputClass}>
                    {CATEGORIE_MOVIMENTO.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Cellula">
                  <select value={modal.dati.cellula || ''}
                          onChange={e => setCampo('cellula', e.target.value)} className={inputClass}>
                    {CELLULE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              {modal.dati.tipo === 'Uscita' && (
                <Field label="Sezione del rendiconto">
                  <select value={modal.dati.macro_sezione || 'ALTRO'}
                          onChange={e => setCampo('macro_sezione', e.target.value)} className={inputClass}>
                    {MACRO_SEZIONI.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Descrizione">
                <textarea rows={2} value={modal.dati.descrizione || ''}
                          onChange={e => setCampo('descrizione', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Riferimento">
                <input type="text" value={modal.dati.riferimento || ''}
                       onChange={e => setCampo('riferimento', e.target.value)} className={inputClass} />
              </Field>
            </>
          )}

          {modal.tipo === 'sponsor' && (
            <>
              <Field label="Nome">
                <input type="text" value={modal.dati.nome || ''}
                       onChange={e => setCampo('nome', e.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Referente">
                  <input type="text" value={modal.dati.referente || ''}
                         onChange={e => setCampo('referente', e.target.value)} className={inputClass} />
                </Field>
                <Field label="Telefono">
                  <input type="text" value={modal.dati.telefono || ''}
                         onChange={e => setCampo('telefono', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Email">
                <input type="email" value={modal.dati.email || ''}
                       onChange={e => setCampo('email', e.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Importo promesso">
                  <input type="number" step="0.01" value={modal.dati.importo_promesso || ''}
                         onChange={e => setCampo('importo_promesso', e.target.value)} className={inputClass} />
                </Field>
                <Field label="Importo incassato">
                  <input type="number" step="0.01" value={modal.dati.importo_incassato || ''}
                         onChange={e => setCampo('importo_incassato', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stato">
                  <select value={modal.dati.stato || 'Prospect'}
                          onChange={e => setCampo('stato', e.target.value)} className={inputClass}>
                    {STATI_SPONSOR.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Data accordo">
                  <input type="date" value={modal.dati.data_accordo || ''}
                         onChange={e => setCampo('data_accordo', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Data incasso">
                <input type="date" value={modal.dati.data_incasso || ''}
                       onChange={e => setCampo('data_incasso', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Note">
                <textarea rows={2} value={modal.dati.note || ''}
                          onChange={e => setCampo('note', e.target.value)} className={inputClass} />
              </Field>
            </>
          )}

          {modal.tipo === 'acquisti' && (
            <>
              <Field label="Descrizione">
                <input type="text" value={modal.dati.descrizione || ''}
                       onChange={e => setCampo('descrizione', e.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data richiesta">
                  <input type="date" value={modal.dati.data_richiesta || ''}
                         onChange={e => setCampo('data_richiesta', e.target.value)} className={inputClass} />
                </Field>
                <Field label="Richiedente">
                  <input type="text" value={modal.dati.richiedente || ''}
                         onChange={e => setCampo('richiedente', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Fornitore">
                <input type="text" value={modal.dati.fornitore || ''}
                       onChange={e => setCampo('fornitore', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Categoria">
                <select value={modal.dati.categoria || 'Materiale'}
                        onChange={e => setCampo('categoria', e.target.value)} className={inputClass}>
                  {CATEGORIE.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Sezione del rendiconto">
                <select value={modal.dati.macro_sezione || 'ALTRO'}
                        onChange={e => setCampo('macro_sezione', e.target.value)} className={inputClass}>
                  {MACRO_SEZIONI.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Importo previsto">
                  <input type="number" step="0.01" value={modal.dati.importo_previsto || ''}
                         onChange={e => setCampo('importo_previsto', e.target.value)} className={inputClass} />
                </Field>
                <Field label="Importo effettivo">
                  <input type="number" step="0.01" value={modal.dati.importo_effettivo || ''}
                         onChange={e => setCampo('importo_effettivo', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stato">
                  <select value={modal.dati.stato || 'Da approvare'}
                          onChange={e => setCampo('stato', e.target.value)} className={inputClass}>
                    {STATI_ACQUISTO.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Data ordine">
                  <input type="date" value={modal.dati.data_ordine || ''}
                         onChange={e => setCampo('data_ordine', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Data pagamento">
                <input type="date" value={modal.dati.data_pagamento || ''}
                       onChange={e => setCampo('data_pagamento', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Note">
                <textarea rows={2} value={modal.dati.note || ''}
                          onChange={e => setCampo('note', e.target.value)} className={inputClass} />
              </Field>
            </>
          )}

        </Modal>
      )}

      {pagamentiDi && (() => {
        const a = acquisti.find(x => x.id === pagamentiDi)
        if (!a) return null
        const rateAcq = pagamenti
          .filter(p => p.acquisto_id === a.id)
          .sort((x, y) => String(x.data).localeCompare(String(y.data)) || x.id - y.id)
        return (
          <PagamentiAcquisto acquisto={a} rate={rateAcq}
                             onClose={() => setPagamentiDi(null)}
                             onCambiato={caricaTutto} />
        )
      })()}
    </div>
  )
}