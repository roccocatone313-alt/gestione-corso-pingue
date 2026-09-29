import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'movimento', label: 'Movimento' },
  { id: 'sponsor',   label: 'Sponsor' },
  { id: 'acquisto',  label: 'Acquisto' },
  { id: 'scadenza',  label: 'Scadenza' },
  { id: 'budget',    label: 'Budget' },
]

const CATEGORIE = ['Sponsor','Materiale','Trasporti','Eventi','Cancelleria','Rimborsi','Altro']
const CELLULE   = ['Sponsor','Budget','Acquisti']
const STATI_SPONSOR  = ['Prospect','In trattativa','Confermato','Incassato','Perso']
const STATI_ACQUISTO = ['Da approvare','Approvato','Ordinato','Ricevuto','Pagato','Rifiutato']
const TIPI_SCADENZA  = ['Pagamento','Incasso','Contratto','Rinnovo','Rimborso','Altro']
const STATI_SCADENZA = ['Da fare','In corso','Completata','Annullata']

function oggi() {
  return new Date().toISOString().slice(0, 10)
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'

function Msg({ stato, testo }) {
  if (!stato) return null
  const cls = stato === 'ok'
    ? 'bg-green-50 border border-green-200 text-green-800'
    : 'bg-red-50 border border-red-200 text-red-800'
  return <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${cls}`}>{testo}</div>
}

export default function Inserisci() {
  const [tab, setTab] = useState('movimento')
  const [msg, setMsg] = useState({ stato: null, testo: '' })
  const [invio, setInvio] = useState(false)

  const mostraMsg = (stato, testo) => {
    setMsg({ stato, testo })
    setTimeout(() => setMsg({ stato: null, testo: '' }), 4000)
  }

  // MOVIMENTO
  const [mov, setMov] = useState({
    data: oggi(), tipo: 'Entrata', importo: '', categoria: 'Sponsor',
    cellula: 'Sponsor', descrizione: '', riferimento: '',
  })

  async function salvaMovimento(e) {
    e.preventDefault()
    setInvio(true)
    const { error } = await supabase.from('movimenti').insert({
      data: mov.data,
      tipo: mov.tipo,
      importo: Number(mov.importo),
      categoria: mov.categoria,
      cellula: mov.cellula,
      descrizione: mov.descrizione,
      riferimento: mov.riferimento,
      created_by: 'web',
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Movimento registrato.')
    setMov({ ...mov, importo: '', descrizione: '', riferimento: '' })
  }

  // SPONSOR
  const [sp, setSp] = useState({
    nome: '', referente: '', email: '', telefono: '',
    importo_promesso: '', importo_incassato: '',
    stato: 'Prospect', data_accordo: '', data_incasso: '', note: '',
  })

  async function salvaSponsor(e) {
    e.preventDefault()
    if (!sp.nome.trim()) { mostraMsg('errore', 'Nome sponsor obbligatorio.'); return }
    setInvio(true)
    const { error } = await supabase.from('sponsor').insert({
      nome: sp.nome.trim(),
      referente: sp.referente.trim(),
      email: sp.email.trim(),
      telefono: sp.telefono.trim(),
      importo_promesso: Number(sp.importo_promesso) || 0,
      importo_incassato: Number(sp.importo_incassato) || 0,
      stato: sp.stato,
      data_accordo: sp.data_accordo || null,
      data_incasso: sp.data_incasso || null,
      note: sp.note.trim(),
      created_by: 'web',
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Sponsor registrato.')
    setSp({
      nome: '', referente: '', email: '', telefono: '',
      importo_promesso: '', importo_incassato: '',
      stato: 'Prospect', data_accordo: '', data_incasso: '', note: '',
    })
  }

  // ACQUISTO
  const [ac, setAc] = useState({
    data_richiesta: oggi(), richiedente: '', descrizione: '', fornitore: '',
    importo_previsto: '', importo_effettivo: '',
    stato: 'Da approvare', data_ordine: '', data_pagamento: '', note: '',
  })

  async function salvaAcquisto(e) {
    e.preventDefault()
    if (!ac.descrizione.trim()) { mostraMsg('errore', 'Descrizione obbligatoria.'); return }
    if (!ac.importo_previsto || Number(ac.importo_previsto) <= 0) {
      mostraMsg('errore', 'Importo previsto non valido.'); return
    }
    setInvio(true)
    const { error } = await supabase.from('acquisti').insert({
      data_richiesta: ac.data_richiesta || null,
      richiedente: ac.richiedente.trim() || 'web',
      descrizione: ac.descrizione.trim(),
      fornitore: ac.fornitore.trim(),
      importo_previsto: Number(ac.importo_previsto),
      importo_effettivo: ac.importo_effettivo ? Number(ac.importo_effettivo) : null,
      stato: ac.stato,
      data_ordine: ac.data_ordine || null,
      data_pagamento: ac.data_pagamento || null,
      note: ac.note.trim(),
      created_by: 'web',
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Acquisto registrato.')
    setAc({
      data_richiesta: oggi(), richiedente: '', descrizione: '', fornitore: '',
      importo_previsto: '', importo_effettivo: '',
      stato: 'Da approvare', data_ordine: '', data_pagamento: '', note: '',
    })
  }

  // SCADENZA
  const [sc, setSc] = useState({
    data: oggi(), tipo: 'Pagamento', descrizione: '',
    importo: '', responsabile: '', stato: 'Da fare', note: '',
  })

  async function salvaScadenza(e) {
    e.preventDefault()
    if (!sc.descrizione.trim()) { mostraMsg('errore', 'Descrizione obbligatoria.'); return }
    setInvio(true)
    const { error } = await supabase.from('scadenze').insert({
      data: sc.data,
      tipo: sc.tipo,
      descrizione: sc.descrizione.trim(),
      importo: sc.importo ? Number(sc.importo) : null,
      responsabile: sc.responsabile.trim(),
      stato: sc.stato,
      note: sc.note.trim(),
      created_by: 'web',
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Scadenza registrata.')
    setSc({
      data: oggi(), tipo: 'Pagamento', descrizione: '',
      importo: '', responsabile: '', stato: 'Da fare', note: '',
    })
  }

  // BUDGET
  const [bud, setBud] = useState({
    voce: '', categoria: 'Materiale', preventivato: '', note: '',
  })

  async function salvaBudget(e) {
    e.preventDefault()
    if (!bud.voce.trim()) { mostraMsg('errore', 'Voce obbligatoria.'); return }
    if (!bud.preventivato || Number(bud.preventivato) <= 0) {
      mostraMsg('errore', 'Preventivato non valido.'); return
    }
    setInvio(true)
    const { error } = await supabase.from('budget').insert({
      voce: bud.voce.trim(),
      categoria: bud.categoria,
      preventivato: Number(bud.preventivato),
      note: bud.note.trim(),
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Voce di budget registrata.')
    setBud({ voce: '', categoria: 'Materiale', preventivato: '', note: '' })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-xl p-2 shadow-sm flex flex-wrap gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[90px] px-3 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-sky-500 text-white'
                : 'text-sky-800 hover:bg-sky-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg.stato && <Msg stato={msg.stato} testo={msg.testo} />}

      {/* MOVIMENTO */}
      {tab === 'movimento' && (
        <form onSubmit={salvaMovimento} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Nuovo movimento
          </h2>
          <Field label="Data">
            <input type="date" required value={mov.data}
                   onChange={e => setMov({ ...mov, data: e.target.value })}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={mov.tipo}
                      onChange={e => setMov({ ...mov, tipo: e.target.value })}
                      className={inputClass}>
                <option>Entrata</option>
                <option>Uscita</option>
              </select>
            </Field>
            <Field label="Importo (€)">
              <input type="number" step="0.01" min="0" required
                     value={mov.importo}
                     onChange={e => setMov({ ...mov, importo: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select value={mov.categoria}
                      onChange={e => setMov({ ...mov, categoria: e.target.value })}
                      className={inputClass}>
                {CATEGORIE.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Cellula">
              <select value={mov.cellula}
                      onChange={e => setMov({ ...mov, cellula: e.target.value })}
                      className={inputClass}>
                {CELLULE.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descrizione">
            <textarea rows={2} value={mov.descrizione}
                      onChange={e => setMov({ ...mov, descrizione: e.target.value })}
                      placeholder="Es. quota iscrizione torneo"
                      className={inputClass} />
          </Field>
          <Field label="Riferimento (opzionale)">
            <input type="text" value={mov.riferimento}
                   onChange={e => setMov({ ...mov, riferimento: e.target.value })}
                   placeholder="Es. numero fattura"
                   className={inputClass} />
          </Field>
          <button disabled={invio}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition">
            {invio ? 'Salvataggio...' : 'Registra movimento'}
          </button>
        </form>
      )}

      {/* SPONSOR */}
      {tab === 'sponsor' && (
        <form onSubmit={salvaSponsor} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Nuovo sponsor
          </h2>
          <Field label="Nome sponsor *">
            <input type="text" required value={sp.nome}
                   onChange={e => setSp({ ...sp, nome: e.target.value })}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referente">
              <input type="text" value={sp.referente}
                     onChange={e => setSp({ ...sp, referente: e.target.value })}
                     className={inputClass} />
            </Field>
            <Field label="Telefono">
              <input type="text" value={sp.telefono}
                     onChange={e => setSp({ ...sp, telefono: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" value={sp.email}
                   onChange={e => setSp({ ...sp, email: e.target.value })}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importo promesso (€)">
              <input type="number" step="0.01" min="0" value={sp.importo_promesso}
                     onChange={e => setSp({ ...sp, importo_promesso: e.target.value })}
                     className={inputClass} />
            </Field>
            <Field label="Importo incassato (€)">
              <input type="number" step="0.01" min="0" value={sp.importo_incassato}
                     onChange={e => setSp({ ...sp, importo_incassato: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stato">
              <select value={sp.stato}
                      onChange={e => setSp({ ...sp, stato: e.target.value })}
                      className={inputClass}>
                {STATI_SPONSOR.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data accordo">
              <input type="date" value={sp.data_accordo}
                     onChange={e => setSp({ ...sp, data_accordo: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Data incasso">
            <input type="date" value={sp.data_incasso}
                   onChange={e => setSp({ ...sp, data_incasso: e.target.value })}
                   className={inputClass} />
          </Field>
          <Field label="Note">
            <textarea rows={2} value={sp.note}
                      onChange={e => setSp({ ...sp, note: e.target.value })}
                      className={inputClass} />
          </Field>
          <button disabled={invio}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition">
            {invio ? 'Salvataggio...' : 'Registra sponsor'}
          </button>
        </form>
      )}

      {/* ACQUISTO */}
      {tab === 'acquisto' && (
        <form onSubmit={salvaAcquisto} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Nuovo acquisto
          </h2>
          <Field label="Descrizione *">
            <input type="text" required value={ac.descrizione}
                   onChange={e => setAc({ ...ac, descrizione: e.target.value })}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data richiesta">
              <input type="date" value={ac.data_richiesta}
                     onChange={e => setAc({ ...ac, data_richiesta: e.target.value })}
                     className={inputClass} />
            </Field>
            <Field label="Richiedente">
              <input type="text" value={ac.richiedente}
                     onChange={e => setAc({ ...ac, richiedente: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Fornitore">
            <input type="text" value={ac.fornitore}
                   onChange={e => setAc({ ...ac, fornitore: e.target.value })}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importo previsto (€) *">
              <input type="number" step="0.01" min="0" required value={ac.importo_previsto}
                     onChange={e => setAc({ ...ac, importo_previsto: e.target.value })}
                     className={inputClass} />
            </Field>
            <Field label="Importo effettivo (€)">
              <input type="number" step="0.01" min="0" value={ac.importo_effettivo}
                     onChange={e => setAc({ ...ac, importo_effettivo: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stato">
              <select value={ac.stato}
                      onChange={e => setAc({ ...ac, stato: e.target.value })}
                      className={inputClass}>
                {STATI_ACQUISTO.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data ordine">
              <input type="date" value={ac.data_ordine}
                     onChange={e => setAc({ ...ac, data_ordine: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Data pagamento">
            <input type="date" value={ac.data_pagamento}
                   onChange={e => setAc({ ...ac, data_pagamento: e.target.value })}
                   className={inputClass} />
          </Field>
          <Field label="Note">
            <textarea rows={2} value={ac.note}
                      onChange={e => setAc({ ...ac, note: e.target.value })}
                      className={inputClass} />
          </Field>
          <button disabled={invio}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition">
            {invio ? 'Salvataggio...' : 'Registra acquisto'}
          </button>
        </form>
      )}

      {/* SCADENZA */}
      {tab === 'scadenza' && (
        <form onSubmit={salvaScadenza} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Nuova scadenza
          </h2>
          <Field label="Data *">
            <input type="date" required value={sc.data}
                   onChange={e => setSc({ ...sc, data: e.target.value })}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={sc.tipo}
                      onChange={e => setSc({ ...sc, tipo: e.target.value })}
                      className={inputClass}>
                {TIPI_SCADENZA.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Stato">
              <select value={sc.stato}
                      onChange={e => setSc({ ...sc, stato: e.target.value })}
                      className={inputClass}>
                {STATI_SCADENZA.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descrizione *">
            <input type="text" required value={sc.descrizione}
                   onChange={e => setSc({ ...sc, descrizione: e.target.value })}
                   placeholder="Es. saldo fornitore palloni"
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importo (€)">
              <input type="number" step="0.01" min="0" value={sc.importo}
                     onChange={e => setSc({ ...sc, importo: e.target.value })}
                     className={inputClass} />
            </Field>
            <Field label="Responsabile">
              <input type="text" value={sc.responsabile}
                     onChange={e => setSc({ ...sc, responsabile: e.target.value })}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Note">
            <textarea rows={2} value={sc.note}
                      onChange={e => setSc({ ...sc, note: e.target.value })}
                      className={inputClass} />
          </Field>
          <button disabled={invio}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition">
            {invio ? 'Salvataggio...' : 'Registra scadenza'}
          </button>
        </form>
      )}

      {/* BUDGET */}
      {tab === 'budget' && (
        <form onSubmit={salvaBudget} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Nuova voce di budget
          </h2>
          <Field label="Voce *">
            <input type="text" required value={bud.voce}
                   onChange={e => setBud({ ...bud, voce: e.target.value })}
                   placeholder="Es. Materiale sportivo"
                   className={inputClass} />
          </Field>
          <Field label="Categoria">
            <select value={bud.categoria}
                    onChange={e => setBud({ ...bud, categoria: e.target.value })}
                    className={inputClass}>
              {CATEGORIE.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Preventivato (€) *">
            <input type="number" step="0.01" min="0" required value={bud.preventivato}
                   onChange={e => setBud({ ...bud, preventivato: e.target.value })}
                   className={inputClass} />
          </Field>
          <Field label="Note">
            <textarea rows={2} value={bud.note}
                      onChange={e => setBud({ ...bud, note: e.target.value })}
                      className={inputClass} />
          </Field>
          <button disabled={invio}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition">
            {invio ? 'Salvataggio...' : 'Registra voce di budget'}
          </button>
        </form>
      )}
    </div>
  )
}