import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import InfoBox from '../components/InfoBox'
import { dataMovimentoCollegato, oggiISO } from '../lib/dateCassa'
import { euro } from '../lib/formato'
import { useAuth } from '../lib/auth'
import { riepilogoSponsor, incassatoDa, messaggioIncasso } from '../lib/sponsor'

const COLONNE = [
  { stato: 'Prospect',      colore: 'bg-gray-50',   bordo: 'border-gray-300',  testo: 'text-gray-700',   totale: 'text-gray-800' },
  { stato: 'In trattativa', colore: 'bg-yellow-50', bordo: 'border-yellow-300',testo: 'text-yellow-800', totale: 'text-yellow-900' },
  { stato: 'Confermato',    colore: 'bg-blue-50',   bordo: 'border-blue-300',  testo: 'text-blue-800',   totale: 'text-blue-900' },
  { stato: 'Incassato',     colore: 'bg-green-50',  bordo: 'border-green-300', testo: 'text-green-800',  totale: 'text-green-900' },
  { stato: 'Perso',         colore: 'bg-red-50',    bordo: 'border-red-300',   testo: 'text-red-800',    totale: 'text-red-900' },
]

const STATI = COLONNE.map(c => c.stato)

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Totale({ titolo, valore, nota, bordo, testo }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${bordo}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{titolo}</div>
      <div className={`text-2xl font-bold mt-2 ${testo}`}>{euro(valore)}</div>
      <div className="text-xs text-gray-500 mt-1">{nota}</div>
    </div>
  )
}

// "1 sponsor confermato", "3 sponsor confermati"
function quanti(n, singolare, plurale) {
  if (n === 0) return 'nessuno'
  return `${n} sponsor ${n === 1 ? singolare : plurale}`
}

export default function Sponsor() {
  const [sponsor, setSponsor] = useState([])
  const [loading, setLoading] = useState(true)
  const [draggedId, setDraggedId] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [msg, setMsg] = useState({ stato: null, testo: '' })

  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  // Chi non ha fatto l'accesso del comitato vede la pagina in sola lettura
  const { puoModificare } = useAuth()

  function mostraMsg(stato, testo) {
    setMsg({ stato, testo })
    setTimeout(() => setMsg({ stato: null, testo: '' }), 3500)
  }

  async function carica() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sponsor')
      .select('*')
      .order('id', { ascending: false })
    if (error) { mostraMsg('errore', error.message); setLoading(false); return }
    setSponsor(data || [])
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  function onDragStart(e, id) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }

  function onDragEnd() {
    setDraggedId(null)
    setDragOver(null)
  }

  function onDragOver(e, stato) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(stato)
  }

  function onDragLeave() {
    setDragOver(null)
  }

  async function onDrop(e, nuovoStato) {
    e.preventDefault()
    const id = draggedId || Number(e.dataTransfer.getData('text/plain'))
    setDragOver(null)
    setDraggedId(null)
    if (!id) return
    const s = sponsor.find(x => x.id === id)
    if (!s || s.stato === nuovoStato) return
    await cambiaStato(id, nuovoStato)
  }

  async function cambiaStato(id, nuovoStato) {
    if (nuovoStato === 'Incassato') {
      const ok = confirm(messaggioIncasso(sponsor.find(x => x.id === id) || {}))
      if (!ok) return
    }
    const campi = { stato: nuovoStato }
    // Senza data di incasso la metto a oggi: così le modifiche successive
    // non spostano la data del movimento di cassa.
    if (nuovoStato === 'Incassato') {
      const s = sponsor.find(x => x.id === id)
      if (s && !s.data_incasso) campi.data_incasso = oggiISO()
    }
    const { error } = await supabase.from('sponsor').update(campi).eq('id', id)
    if (error) { mostraMsg('errore', error.message); return }
    setSponsor(lista => lista.map(s => s.id === id ? { ...s, ...campi } : s))
    mostraMsg('ok', 'Stato aggiornato: ' + nuovoStato)
  }

  function nuovoSponsor() {
    setModal({
      dati: {
        nome: '', referente: '', email: '', telefono: '',
        importo_promesso: '', importo_incassato: '',
        stato: 'Prospect', data_accordo: '', data_incasso: '', note: '',
      }
    })
  }

  function apriModifica(s) {
    setModal({ dati: { ...s } })
  }

  function setCampo(campo, valore) {
    setModal(m => ({ ...m, dati: { ...m.dati, [campo]: valore } }))
  }

  async function salvaModal() {
    if (!modal) return
    const d = modal.dati
    if (!d.nome || !d.nome.trim()) { mostraMsg('errore', 'Nome obbligatorio.'); return }

    if (d.id && d.stato === 'Incassato') {
      const s = sponsor.find(x => x.id === d.id)
      if (s && s.stato !== 'Incassato') {
        const ok = confirm(messaggioIncasso(d))
        if (!ok) return
      }
    }
    if (!d.id && d.stato === 'Incassato') {
      const ok = confirm(messaggioIncasso(d))
      if (!ok) return
    }

    setSalvando(true)

    const payload = {
      nome: d.nome.trim(),
      referente: (d.referente || '').trim(),
      email: (d.email || '').trim(),
      telefono: (d.telefono || '').trim(),
      importo_promesso: d.importo_promesso === '' ? 0 : Number(d.importo_promesso),
      importo_incassato: d.importo_incassato === '' ? 0 : Number(d.importo_incassato),
      stato: d.stato || 'Prospect',
      data_accordo: d.data_accordo || null,
      data_incasso: d.data_incasso || null,
      note: (d.note || '').trim(),
    }

    // Sponsor incassato senza data: uso la data del movimento di cassa già
    // registrato (o oggi), così il database non la sposta.
    if (payload.stato === 'Incassato' && !payload.data_incasso) {
      payload.data_incasso = (d.id && await dataMovimentoCollegato('Sponsor #' + d.id)) || oggiISO()
    }

    let error
    if (d.id) {
      ({ error } = await supabase.from('sponsor').update(payload).eq('id', d.id))
    } else {
      ({ error } = await supabase.from('sponsor').insert({ ...payload, created_by: 'web' }))
    }

    setSalvando(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', d.id ? 'Sponsor aggiornato.' : 'Sponsor creato.')
    setModal(null)
    carica()
  }

  async function eliminaSponsor() {
    if (!modal || !modal.dati.id) return
    if (!confirm('Eliminare lo sponsor? Il movimento collegato (se esiste) verrà rimosso.')) return
    setSalvando(true)
    const { error } = await supabase.from('sponsor').delete().eq('id', modal.dati.id)
    setSalvando(false)
    if (error) { mostraMsg('errore', error.message); return }
    mostraMsg('ok', 'Sponsor eliminato.')
    setModal(null)
    carica()
  }

  // Stessi totali del Rendiconto (src/lib/sponsor.js)
  const totali = riepilogoSponsor(sponsor)

  return (
    <div className="space-y-4">
      <InfoBox id="sponsor" titolo="Sponsor — la pipeline dei finanziatori">
        <p>Tutti gli sponsor, dal primo contatto all'incasso.</p>
        <p>• <strong>Prospect</strong> — contattato</p>
        <p>• <strong>In trattativa</strong> — se ne sta parlando</p>
        <p>• <strong>Confermato</strong> — ha detto sì</p>
        <p>• <strong>Incassato</strong> — ha pagato, l'entrata è in cassa</p>
        <p>• <strong>Perso</strong> — non se ne fa nulla</p>
        {puoModificare && (
          <>
            <p><strong>Su desktop</strong> trascini le card da una colonna all'altra. <strong>Su mobile</strong> clicchi la card e cambi stato dal menu.</p>
            <p>Quando metti "Incassato", l'app registra da sola l'entrata in contabilità. Se l'importo incassato è vuoto, usa quello promesso.</p>
          </>
        )}
      </InfoBox>

      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Totale titolo="Attesi" valore={totali.attesi}
                  nota={quanti(totali.nConteggiati, 'confermato o incassato', 'confermati o incassati')}
                  bordo="border-sky-500" testo="text-sky-700" />
          <Totale titolo="Incassati" valore={totali.incassati}
                  nota="già arrivati"
                  bordo="border-green-500" testo="text-green-700" />
          <Totale titolo="Da incassare" valore={totali.daIncassare}
                  nota="dagli sponsor confermati"
                  bordo="border-amber-500" testo="text-amber-700" />
          <Totale titolo="In trattativa" valore={totali.trattativa}
                  nota={quanti(totali.nTrattativa, 'non conteggiato', 'non conteggiati')}
                  bordo="border-yellow-400" testo="text-gray-600" />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Stessi totali del Rendiconto: contano solo gli sponsor confermati e incassati.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Pipeline sponsor</h2>
          <p className="text-sm text-gray-500">
            {sponsor.length} sponsor in totale
            {puoModificare && ' — trascina le card su desktop, tocca la card su mobile per modificare'}
          </p>
        </div>
        {puoModificare && (
          <button
            onClick={nuovoSponsor}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            + Nuovo sponsor
          </button>
        )}
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

      {loading ? (
        <div className="text-center text-gray-400 italic py-10">Caricamento...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {COLONNE.map(col => {
            const cards = sponsor.filter(s => (s.stato || 'Prospect') === col.stato)
            const totProm = cards.reduce((sum, c) => sum + (Number(c.importo_promesso) || 0), 0)
            const totInc  = cards.reduce((sum, c) => sum + incassatoDa(c), 0)
            const isOver = dragOver === col.stato

            return (
              <div
                key={col.stato}
                onDragOver={puoModificare ? e => onDragOver(e, col.stato) : undefined}
                onDragLeave={puoModificare ? onDragLeave : undefined}
                onDrop={puoModificare ? e => onDrop(e, col.stato) : undefined}
                className={`rounded-xl border-2 ${col.bordo} ${col.colore} p-3 min-h-[200px] transition ${
                  isOver ? 'ring-4 ring-sky-300 scale-[1.01]' : ''
                }`}
              >
                <div className={`text-xs font-bold uppercase tracking-wide ${col.testo} mb-1`}>
                  {col.stato}
                </div>
                <div className={`text-xs ${col.testo} mb-3`}>
                  {cards.length} sponsor
                  {cards.length > 0 && (
                    <> — prom. {euro(totProm)} — inc. {euro(totInc)}</>
                  )}
                </div>

                <div className="space-y-2">
                  {cards.map(s => (
                    <div
                      key={s.id}
                      draggable={puoModificare}
                      onDragStart={puoModificare ? e => onDragStart(e, s.id) : undefined}
                      onDragEnd={puoModificare ? onDragEnd : undefined}
                      onClick={puoModificare ? () => apriModifica(s) : undefined}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 transition relative ${
                        puoModificare ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default'
                      } ${draggedId === s.id ? 'opacity-40' : ''}`}
                    >
                      {puoModificare && (
                        <span
                          className="absolute top-2 right-2 text-gray-300 hover:text-sky-500 text-xs"
                          title="Tocca per modificare"
                        >
                          ✎
                        </span>
                      )}
                      <div className="font-semibold text-sm text-gray-800 truncate pr-6">
                        {s.nome}
                      </div>
                      {s.referente && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {s.referente}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-gray-500">
                          Prom. {euro(s.importo_promesso)}
                        </span>
                        <span className="text-green-700 font-medium">
                          Inc. {euro(incassatoDa(s))}
                        </span>
                      </div>
                    </div>
                  ))}

                  {cards.length === 0 && (
                    <div className="text-center text-xs text-gray-400 italic py-4">
                      {isOver ? 'Rilascia qui' : 'Nessuno'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && puoModificare && (
        <Modal
          titolo={modal.dati.id ? 'Sponsor: ' + modal.dati.nome : 'Nuovo sponsor'}
          onClose={() => setModal(null)}
          onSave={salvaModal}
          salvando={salvando}
        >
          <Field label="Nome sponsor *">
            <input type="text" value={modal.dati.nome || ''}
                   onChange={e => setCampo('nome', e.target.value)}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referente">
              <input type="text" value={modal.dati.referente || ''}
                     onChange={e => setCampo('referente', e.target.value)}
                     className={inputClass} />
            </Field>
            <Field label="Telefono">
              <input type="text" value={modal.dati.telefono || ''}
                     onChange={e => setCampo('telefono', e.target.value)}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" value={modal.dati.email || ''}
                   onChange={e => setCampo('email', e.target.value)}
                   className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importo promesso (€)">
              <input type="number" step="0.01" min="0" value={modal.dati.importo_promesso ?? ''}
                     onChange={e => setCampo('importo_promesso', e.target.value)}
                     className={inputClass} />
            </Field>
            <Field label="Importo incassato (€)">
              <input type="number" step="0.01" min="0" value={modal.dati.importo_incassato ?? ''}
                     onChange={e => setCampo('importo_incassato', e.target.value)}
                     className={inputClass} />
              <span className="block text-[11px] text-gray-400 mt-1">
                Vuoto o zero: per un incassato vale l'importo promesso.
              </span>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stato">
              <select value={modal.dati.stato || 'Prospect'}
                      onChange={e => setCampo('stato', e.target.value)}
                      className={inputClass}>
                {STATI.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data accordo">
              <input type="date" value={modal.dati.data_accordo || ''}
                     onChange={e => setCampo('data_accordo', e.target.value)}
                     className={inputClass} />
            </Field>
          </div>
          <Field label="Data incasso">
            <input type="date" value={modal.dati.data_incasso || ''}
                   onChange={e => setCampo('data_incasso', e.target.value)}
                   className={inputClass} />
          </Field>
          <Field label="Note">
            <textarea rows={2} value={modal.dati.note || ''}
                      onChange={e => setCampo('note', e.target.value)}
                      className={inputClass} />
          </Field>

          {modal.dati.id && (
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={eliminaSponsor}
                disabled={salvando}
                className="text-sm text-red-700 hover:text-red-900 font-semibold disabled:opacity-50"
              >
                Elimina sponsor
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}