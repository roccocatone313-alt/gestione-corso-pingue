import { useState } from 'react'
import { supabase } from '../lib/supabase'
import InfoBox from '../components/InfoBox'
import { MACRO_SEZIONI } from '../lib/macroSezioni'

const TABS = [
  { id: 'movimento', label: 'Movimento' },
  { id: 'sponsor',   label: 'Sponsor' },
  { id: 'acquisto',  label: 'Acquisto' },
]

const CATEGORIE = ['Sponsor','Materiale','Trasporti','Eventi','Cancelleria','Rimborsi','Altro']
// Per i movimenti: quote degli allievi e soldi arrivati tramite F.I.Do
const CATEGORIE_MOVIMENTO = ['Quote allievi', 'F.I.Do', ...CATEGORIE]
const CELLULE   = ['Sponsor','Budget','Acquisti']
const STATI_SPONSOR  = ['Prospect','In trattativa','Confermato','Incassato','Perso']
const STATI_ACQUISTO = ['Da approvare','Approvato','Ordinato','Ricevuto','Pagato','Rifiutato']

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

  const [mov, setMov] = useState({
    data: oggi(), tipo: 'Entrata', importo: '', categoria: 'Sponsor',
    cellula: 'Sponsor', descrizione: '', riferimento: '',
    macro_sezione: 'ALTRO',
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
      macro_sezione: mov.tipo === 'Uscita' ? mov.macro_sezione : null,
      created_by: 'web',
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Movimento registrato.')
    setMov({ ...mov, importo: '', descrizione: '', riferimento: '' })
  }

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
      data_incasso: sp.data_incasso || (sp.stato === 'Incassato' ? oggi() : null),
      note: sp.note.trim(),
      created_by: 'web',
    })
    setInvio(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Sponsor registrato.')
    setSp({
      ...sp,
      nome: '', referente: '', email: '', telefono: '',
      importo_promesso: '', importo_incassato: '',
      data_accordo: '', data_incasso: '', note: '',
    })
  }

  const [ac, setAc] = useState({
    data_richiesta: oggi(), richiedente: '', descrizione: '', fornitore: '',
    categoria: 'Materiale', macro_sezione: 'ALTRO',
    importo_previsto: '', importo_effettivo: '',
    stato: 'Da approvare', data_ordine: '', data_pagamento: '', note: '',
    anticipo: '', data_anticipo: oggi(),
  })

  async function salvaAcquisto(e) {
    e.preventDefault()
    if (!ac.descrizione.trim()) { mostraMsg('errore', 'Descrizione obbligatoria.'); return }
    if (!ac.importo_previsto || Number(ac.importo_previsto) <= 0) {
      mostraMsg('errore', 'Importo previsto non valido.'); return
    }
    const totale = ac.importo_effettivo ? Number(ac.importo_effettivo) : Number(ac.importo_previsto)
    const anticipo = ac.anticipo ? Number(ac.anticipo) : 0
    if (anticipo < 0) { mostraMsg('errore', 'Anticipo non valido.'); return }
    if (anticipo > totale) {
      mostraMsg('errore', "L'anticipo non può superare l'importo dell'acquisto."); return
    }
    setInvio(true)
    const { data: nuovo, error } = await supabase.from('acquisti').insert({
      data_richiesta: ac.data_richiesta || null,
      richiedente: ac.richiedente.trim() || 'web',
      descrizione: ac.descrizione.trim(),
      fornitore: ac.fornitore.trim(),
      categoria: ac.categoria,
      importo_previsto: Number(ac.importo_previsto),
      importo_effettivo: ac.importo_effettivo ? Number(ac.importo_effettivo) : null,
      stato: ac.stato,
      data_ordine: ac.data_ordine || null,
      data_pagamento: ac.data_pagamento || (ac.stato === 'Pagato' ? oggi() : null),
      macro_sezione: ac.macro_sezione,
      note: ac.note.trim(),
      created_by: 'web',
    }).select('id').single()
    if (error) { setInvio(false); mostraMsg('errore', error.message); return }

    // Anticipo già pagato: diventa la prima rata (esce subito dalla cassa)
    if (anticipo > 0) {
      const { error: erroreAnticipo } = await supabase.from('pagamenti_acquisti').insert({
        acquisto_id: nuovo.id,
        data: ac.data_anticipo || oggi(),
        importo: anticipo,
        note: 'Anticipo',
      })
      if (erroreAnticipo) {
        setInvio(false)
        mostraMsg('errore', "Acquisto registrato, ma l'anticipo non è stato salvato (" +
          erroreAnticipo.message + '). Aggiungilo da Admin → Acquisti → Pagamenti.')
        return
      }
    }
    setInvio(false)
    mostraMsg('ok', anticipo > 0 ? 'Acquisto e anticipo registrati.' : 'Acquisto registrato.')
    setAc({
      ...ac,
      richiedente: '', descrizione: '', fornitore: '',
      importo_previsto: '', importo_effettivo: '',
      data_ordine: '', data_pagamento: '', note: '',
      anticipo: '', data_anticipo: oggi(),
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <InfoBox id="inserisci" titolo="Inserisci — registra tutto da qui">
        <p>Qui registri le novità, in 3 schede:</p>
        <p>• <strong>Movimento</strong> — soldi che entrano o escono senza un acquisto a monte (es. quote allievi, F.I.Do)</p>
        <p>• <strong>Sponsor</strong> — un nuovo possibile finanziatore</p>
        <p>• <strong>Acquisto</strong> — una spesa. Se hai già pagato un anticipo, indicalo qui; le rate successive le aggiungi da Admin → Acquisti → Pagamenti</p>
        <p>Quando un acquisto diventa "Pagato" o uno sponsor "Incassato", il movimento di cassa <strong>si crea da solo</strong>: non duplicarlo a mano.</p>
      </InfoBox>

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
                {CATEGORIE_MOVIMENTO.map(c => <option key={c}>{c}</option>)}
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
          {mov.tipo === 'Uscita' && (
            <Field label="Sezione del rendiconto">
              <select value={mov.macro_sezione}
                      onChange={e => setMov({ ...mov, macro_sezione: e.target.value })}
                      className={inputClass}>
                {MACRO_SEZIONI.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          )}
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
          <Field label="Categoria">
            <select value={ac.categoria}
                    onChange={e => setAc({ ...ac, categoria: e.target.value })}
                    className={inputClass}>
              {CATEGORIE.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Sezione del rendiconto">
            <select value={ac.macro_sezione}
                    onChange={e => setAc({ ...ac, macro_sezione: e.target.value })}
                    className={inputClass}>
              {MACRO_SEZIONI.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importo previsto (€) *">
              <input type="number" step="0.01" min="0.01" required value={ac.importo_previsto}
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
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <div className="text-xs font-semibold text-gray-600">
              Anticipo già pagato (facoltativo)
              <span className="block font-normal text-gray-500">
                Esce subito dalla cassa. Le rate successive le aggiungi da Admin → Acquisti → Pagamenti.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Importo anticipo (€)">
                <input type="number" step="0.01" min="0" value={ac.anticipo}
                       onChange={e => setAc({ ...ac, anticipo: e.target.value })}
                       className={inputClass} />
              </Field>
              <Field label="Data anticipo">
                <input type="date" value={ac.data_anticipo}
                       onChange={e => setAc({ ...ac, data_anticipo: e.target.value })}
                       className={inputClass} />
              </Field>
            </div>
          </div>
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
    </div>
  )
}