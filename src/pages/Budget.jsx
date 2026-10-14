import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import InfoBox from '../components/InfoBox'
import {
  caricaFile, urlFile, eliminaFile, getDocumentiBudget,
  formattaDimensione, iconaFile
} from '../lib/storage'

const CELLULE   = ['Sponsor', 'Budget', 'Acquisti']
const CATEGORIE = ['Sponsor','Materiale','Trasporti','Eventi','Cancelleria','Rimborsi','Altro']
const STATI     = ['Pianificato', 'In corso', 'Completato', 'Annullato']
const TIPI_DOC  = ['fattura', 'preventivo', 'ricevuta', 'contratto', 'altro']

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

function badgeStato(stato) {
  const map = {
    'Pianificato': 'bg-gray-100 text-gray-700',
    'In corso':    'bg-blue-100 text-blue-800',
    'Completato':  'bg-green-100 text-green-800',
    'Annullato':   'bg-red-100 text-red-800',
  }
  const cls = map[stato] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {stato || '—'}
    </span>
  )
}

function BarraAvanzamento({ preventivato, speso }) {
  const prev = Number(preventivato) || 0
  const sp = Number(speso) || 0
  const pct = prev > 0 ? Math.min((sp / prev) * 100, 100) : 0
  const pctReale = prev > 0 ? (sp / prev) * 100 : 0

  let colore = 'bg-green-500'
  if (pctReale >= 100) colore = 'bg-red-500'
  else if (pctReale >= 70) colore = 'bg-amber-500'

  return (
    <div className="space-y-1">
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colore} transition-all duration-300`}
          style={{ width: pct + '%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{pctReale.toFixed(0)}% utilizzato</span>
        <span>{euro(sp)} / {euro(prev)}</span>
      </div>
    </div>
  )
}

export default function Budget() {
  const [budget, setBudget] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [documenti, setDocumenti] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ stato: null, testo: '' })

  const [tab, setTab] = useState('Tutte')
  const [filtroStato, setFiltroStato] = useState('')

  const [modal, setModal] = useState(null)
  const [uploadModal, setUploadModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [caricandoFile, setCaricandoFile] = useState(false)

  function mostraMsg(stato, testo) {
    setMsg({ stato, testo })
    setTimeout(() => setMsg({ stato: null, testo: '' }), 3500)
  }

  async function carica() {
    setLoading(true)
    const [b, m] = await Promise.all([
      supabase.from('budget').select('*').order('voce'),
      supabase.from('movimenti').select('tipo, categoria, importo').eq('tipo', 'Uscita'),
    ])
    if (b.error) { mostraMsg('errore', b.error.message); setLoading(false); return }
    setBudget(b.data || [])
    setMovimenti(m.data || [])

    const mappa = {}
    for (const voce of (b.data || [])) {
      mappa[voce.id] = await getDocumentiBudget(voce.id)
    }
    setDocumenti(mappa)
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  function spesoPerVoce(nomeVoce) {
    return movimenti
      .filter(m => m.categoria === nomeVoce)
      .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  }

  function apriModifica(voce) {
    setModal({ dati: { ...voce } })
  }

  function nuovaVoce() {
    setModal({
      dati: {
        voce: '', categoria: 'Materiale', preventivato: '',
        cellula: 'Budget', fornitore_previsto: '',
        data_prevista: '', stato: 'Pianificato', note: '',
      }
    })
  }

  function setCampo(campo, valore) {
    setModal(m => ({ ...m, dati: { ...m.dati, [campo]: valore } }))
  }

  async function salvaModifica() {
    if (!modal) return
    const d = modal.dati
    if (!d.voce || !d.voce.trim()) { mostraMsg('errore', 'Voce obbligatoria.'); return }
    if (!d.preventivato || Number(d.preventivato) <= 0) {
      mostraMsg('errore', 'Preventivato non valido.'); return
    }

    setSalvando(true)
    const payload = {
      voce: d.voce.trim(),
      categoria: d.categoria,
      preventivato: Number(d.preventivato),
      cellula: d.cellula,
      fornitore_previsto: (d.fornitore_previsto || '').trim() || null,
      data_prevista: d.data_prevista || null,
      stato: d.stato,
      note: (d.note || '').trim() || null,
    }

    let error
    if (d.id) {
      ({ error } = await supabase.from('budget').update(payload).eq('id', d.id))
    } else {
      ({ error } = await supabase.from('budget').insert(payload))
    }

    setSalvando(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', d.id ? 'Voce aggiornata.' : 'Voce creata.')
    setModal(null)
    carica()
  }

  async function eliminaVoce() {
    if (!modal || !modal.dati.id) return
    if (!confirm('Eliminare questa voce di budget? Anche i documenti collegati verranno rimossi.')) return
    setSalvando(true)
    const { error } = await supabase.from('budget').delete().eq('id', modal.dati.id)
    setSalvando(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Voce eliminata.')
    setModal(null)
    carica()
  }

  function apriUpload(budgetId) {
    setUploadModal({ budgetId, tipo: 'fattura', file: null })
  }

  async function eseguiUpload() {
    if (!uploadModal || !uploadModal.file) {
      mostraMsg('errore', 'Seleziona un file.')
      return
    }
    setCaricandoFile(true)
    const r = await caricaFile(uploadModal.file, uploadModal.budgetId, uploadModal.tipo)
    setCaricandoFile(false)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Documento caricato.')
    setUploadModal(null)
    carica()
  }

  async function eliminaDocumento(doc) {
    if (!confirm('Eliminare il documento "' + doc.nome_file + '"?')) return
    const r = await eliminaFile(doc.id, doc.storage_path)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Documento eliminato.')
    carica()
  }

  const listaFiltrata = budget.filter(b => {
    if (tab !== 'Tutte' && b.cellula !== tab) return false
    if (filtroStato && b.stato !== filtroStato) return false
    return true
  })

  const totPreventivato = budget.reduce((s, b) => s + (Number(b.preventivato) || 0), 0)
  const totSpeso = movimenti.reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const totDisponibile = totPreventivato - totSpeso

  return (
    <div className="space-y-4">
      <InfoBox id="budget" titolo="Budget — il piano ufficiale delle spese">
        <p>Qui ci sono le voci <strong>approvate</strong>. Ogni voce ha:</p>
        <p>• <strong>Preventivato</strong>: quanto hai deciso di spendere (lo scrivi tu)</p>
        <p>• <strong>Speso</strong>: quanto hai speso davvero (si calcola da solo dai movimenti)</p>
        <p>• <strong>Disponibile</strong>: la differenza</p>
        <p>La barra colorata mostra l'avanzamento: verde ok, gialla attenzione, rossa hai sforato.</p>
        <p>I tab in alto filtrano per cellula. Puoi caricare <strong>fatture e preventivi</strong> da ogni voce.</p>
      </InfoBox>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Rendiconto Budget</h2>
          <p className="text-sm text-gray-500">
            Voci di spesa previste per ogni cellula, con avanzamento e documenti
          </p>
        </div>
        <button
          onClick={nuovaVoce}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg shadow-sm"
        >
          + Nuova voce
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-sky-500">
          <div className="text-xs uppercase tracking-wide text-gray-500">Totale preventivato</div>
          <div className="text-2xl font-bold text-sky-700 mt-2">{euro(totPreventivato)}</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-amber-500">
          <div className="text-xs uppercase tracking-wide text-gray-500">Totale speso</div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{euro(totSpeso)}</div>
        </div>
        <div className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${
          totDisponibile >= 0 ? 'border-green-500' : 'border-red-500'
        }`}>
          <div className="text-xs uppercase tracking-wide text-gray-500">Disponibile</div>
          <div className={`text-2xl font-bold mt-2 ${
            totDisponibile >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>{euro(totDisponibile)}</div>
        </div>
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

      <div className="bg-white rounded-xl p-2 shadow-sm flex flex-wrap gap-1">
        {['Tutte', ...CELLULE].map(c => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`flex-1 min-w-[90px] px-3 py-2 rounded-lg text-sm font-semibold transition ${
              tab === c ? 'bg-sky-500 text-white' : 'text-sky-800 hover:bg-sky-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">Filtra:</span>
        <button
          onClick={() => setFiltroStato('')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold ${
            filtroStato === '' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tutti
        </button>
        {STATI.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStato(s)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
              filtroStato === s ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 italic py-10">Caricamento...</div>
      ) : listaFiltrata.length === 0 ? (
        <div className="bg-white rounded-xl p-10 shadow-sm text-center text-gray-400 italic">
          Nessuna voce di budget per questa cellula.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listaFiltrata.map(b => {
            const speso = spesoPerVoce(b.voce)
            const disponibile = (Number(b.preventivato) || 0) - speso
            const nDocs = (documenti[b.id] || []).length

            return (
              <div key={b.id} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 truncate">{b.voce}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {b.categoria} · cellula {b.cellula || 'Budget'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {badgeStato(b.stato)}
                    <button
                      onClick={() => apriModifica(b)}
                      className="text-xs px-2 py-1 bg-sky-100 text-sky-800 rounded hover:bg-sky-200 font-semibold"
                    >
                      Apri
                    </button>
                  </div>
                </div>

                {(b.fornitore_previsto || b.data_prevista) && (
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {b.fornitore_previsto && (
                      <span>🏢 {b.fornitore_previsto}</span>
                    )}
                    {b.data_prevista && (
                      <span>📅 {new Date(b.data_prevista).toLocaleDateString('it-IT')}</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500 uppercase">Preventivato</div>
                    <div className="font-bold text-gray-700 text-sm">{euro(b.preventivato)}</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <div className="text-xs text-amber-700 uppercase">Speso</div>
                    <div className="font-bold text-amber-700 text-sm">{euro(speso)}</div>
                  </div>
                  <div className={`rounded-lg p-2 ${
                    disponibile >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className={`text-xs uppercase ${
                      disponibile >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>Disponibile</div>
                    <div className={`font-bold text-sm ${
                      disponibile >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>{euro(disponibile)}</div>
                  </div>
                </div>

                <BarraAvanzamento preventivato={b.preventivato} speso={speso} />

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    onClick={() => apriUpload(b.id)}
                    className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 font-semibold"
                  >
                    📎 Carica documento
                  </button>
                  <span className="text-xs text-gray-500">
                    {nDocs} {nDocs === 1 ? 'documento' : 'documenti'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal
          titolo={modal.dati.id ? 'Voce: ' + modal.dati.voce : 'Nuova voce di budget'}
          onClose={() => setModal(null)}
          onSave={salvaModifica}
          salvando={salvando}
        >
          <Field label="Voce *">
            <input type="text" value={modal.dati.voce || ''}
                   onChange={e => setCampo('voce', e.target.value)}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select value={modal.dati.categoria || 'Materiale'}
                      onChange={e => setCampo('categoria', e.target.value)}
                      className={inputClass}>
                {CATEGORIE.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Cellula">
              <select value={modal.dati.cellula || 'Budget'}
                      onChange={e => setCampo('cellula', e.target.value)}
                      className={inputClass}>
                {CELLULE.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Preventivato (€) *">
            <input type="number" step="0.01" min="0.01" value={modal.dati.preventivato || ''}
                   onChange={e => setCampo('preventivato', e.target.value)}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fornitore previsto">
              <input type="text" value={modal.dati.fornitore_previsto || ''}
                     onChange={e => setCampo('fornitore_previsto', e.target.value)}
                     placeholder="Es. Decathlon"
                     className={inputClass} />
            </Field>
            <Field label="Data prevista">
              <input type="date" value={modal.dati.data_prevista || ''}
                     onChange={e => setCampo('data_prevista', e.target.value)}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Stato">
            <select value={modal.dati.stato || 'Pianificato'}
                    onChange={e => setCampo('stato', e.target.value)}
                    className={inputClass}>
              {STATI.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Note">
            <textarea rows={2} value={modal.dati.note || ''}
                      onChange={e => setCampo('note', e.target.value)}
                      className={inputClass} />
          </Field>

          {modal.dati.id && (
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Documenti collegati
              </div>
              {(documenti[modal.dati.id] || []).length === 0 ? (
                <div className="text-xs text-gray-400 italic">
                  Nessun documento. Usa il pulsante 📎 nella card per caricarne uno.
                </div>
              ) : (
                <div className="space-y-2">
                  {(documenti[modal.dati.id] || []).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                      <a
                        href={urlFile(doc.storage_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-sky-700 hover:text-sky-900 truncate flex-1"
                      >
                        <span>{iconaFile(doc.nome_file)}</span>
                        <span className="truncate">{doc.nome_file}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formattaDimensione(doc.dimensione)}
                        </span>
                      </a>
                      <button
                        onClick={() => eliminaDocumento(doc)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 font-semibold shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {modal.dati.id && (
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={eliminaVoce}
                disabled={salvando}
                className="text-sm text-red-700 hover:text-red-900 font-semibold disabled:opacity-50"
              >
                Elimina voce
              </button>
            </div>
          )}
        </Modal>
      )}

      {uploadModal && (
        <Modal
          titolo="Carica documento"
          onClose={() => setUploadModal(null)}
          onSave={eseguiUpload}
          salvando={caricandoFile}
        >
          <Field label="Tipo di documento">
            <select value={uploadModal.tipo}
                    onChange={e => setUploadModal({ ...uploadModal, tipo: e.target.value })}
                    className={inputClass}>
              {TIPI_DOC.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="File *">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.heic"
              onChange={e => setUploadModal({ ...uploadModal, file: e.target.files?.[0] || null })}
              className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-800 hover:file:bg-sky-200"
            />
          </Field>

          {uploadModal.file && (
            <div className="text-xs text-gray-500">
              Selezionato: <strong>{uploadModal.file.name}</strong>
              {' '}({formattaDimensione(uploadModal.file.size)})
            </div>
          )}

          <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            Formati accettati: PDF, JPG, PNG, DOC, XLS, CSV. Max consigliato: 10 MB.
          </p>
        </Modal>
      )}
    </div>
  )
}