import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import {
  getEsigenze, creaEsigenza, aggiornaEsigenza, eliminaEsigenza,
  getSottoesigenze, creaSottoesigenza, aggiornaSottoesigenza, eliminaSottoesigenza,
  caricaFileEsigenza, getDocumentiSottoesigenze, urlFileEsigenza,
  eliminaFileEsigenza, promuoviEsigenzaBudget,
  formattaDimensione, iconaFile,
} from '../lib/esigenze'

export default function Esigenze() {
  const [esigenze, setEsigenze] = useState([])
  const [sotto, setSotto] = useState([])
  const [documenti, setDocumenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ stato: null, testo: '' })

  const [aperte, setAperte] = useState({}) // { esigenzaId: true/false }
  const [modalNuova, setModalNuova] = useState(null)
  const [modalRinomina, setModalRinomina] = useState(null)
  const [modalNuovaSotto, setModalNuovaSotto] = useState(null)
  const [modalRinominaSotto, setModalRinominaSotto] = useState(null)
  const [uploadModal, setUploadModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [caricando, setCaricando] = useState(false)

  function mostraMsg(stato, testo) {
    setMsg({ stato, testo })
    setTimeout(() => setMsg({ stato: null, testo: '' }), 3500)
  }

  async function carica() {
    setLoading(true)
    const [e, s, d] = await Promise.all([
      getEsigenze(),
      getSottoesigenze(),
      getDocumentiSottoesigenze(),
    ])
    setEsigenze(e.dati)
    setSotto(s.dati)
    setDocumenti(d.dati)
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  function toggleAperta(id) {
    setAperte(a => ({ ...a, [id]: !a[id] }))
  }

  // ============================
  // Esigenze
  // ============================
  async function salvaNuovaEsigenza(titolo) {
    setSalvando(true)
    const r = await creaEsigenza(titolo)
    setSalvando(false)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Esigenza creata.')
    setModalNuova(null)
    carica()
  }

  async function salvaRinomina() {
    setSalvando(true)
    const r = await aggiornaEsigenza(modalRinomina.dati.id, { titolo: modalRinomina.dati.titolo })
    setSalvando(false)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Esigenza aggiornata.')
    setModalRinomina(null)
    carica()
  }

  async function cancellaEsigenza(e) {
    if (!confirm(`Eliminare "${e.titolo}"? Verranno eliminate anche tutte le sotto-voci e i file collegati.`)) return
    const r = await eliminaEsigenza(e.id)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Esigenza eliminata.')
    carica()
  }

  async function promuovi(e) {
    if (!confirm(`Promuovere "${e.titolo}" a voce di budget? Potrai poi inserire l'importo da Admin → Budget.`)) return
    const r = await promuoviEsigenzaBudget(e)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Promossa a Budget.')
  }

  // ============================
  // Sottoesigenze
  // ============================
  async function salvaNuovaSotto(titolo) {
    setSalvando(true)
    const r = await creaSottoesigenza(modalNuovaSotto.esigenzaId, titolo)
    setSalvando(false)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Sotto-esigenza aggiunta.')
    setModalNuovaSotto(null)
    carica()
  }

  async function salvaRinominaSotto() {
    setSalvando(true)
    const r = await aggiornaSottoesigenza(modalRinominaSotto.dati.id, { titolo: modalRinominaSotto.dati.titolo })
    setSalvando(false)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Sotto-esigenza aggiornata.')
    setModalRinominaSotto(null)
    carica()
  }

  async function cancellaSotto(s) {
    if (!confirm(`Eliminare "${s.titolo}"? Verranno eliminati anche i file collegati.`)) return
    const r = await eliminaSottoesigenza(s.id)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'Sotto-esigenza eliminata.')
    carica()
  }

  // ============================
  // Upload file
  // ============================
  async function eseguiUpload() {
    if (!uploadModal || !uploadModal.file) {
      mostraMsg('errore', 'Seleziona un file.')
      return
    }
    setCaricando(true)
    const r = await caricaFileEsigenza(uploadModal.file, uploadModal.sottoesigenzaId)
    setCaricando(false)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'File caricato.')
    setUploadModal(null)
    carica()
  }

  async function eliminaDoc(doc) {
    if (!confirm(`Eliminare "${doc.nome_file}"?`)) return
    const r = await eliminaFileEsigenza(doc.id, doc.storage_path)
    if (!r.ok) { mostraMsg('errore', r.errore); return }
    mostraMsg('ok', 'File eliminato.')
    carica()
  }

  function docsDiSotto(sottoId) {
    return documenti.filter(d => d.sottoesigenza_id === sottoId)
  }

  return (
    <div className="space-y-4">
      {/* Intestazione */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Esigenze</h2>
          <p className="text-sm text-gray-500">
            Raccolta di tutte le richieste e necessità del corso, con documenti allegati
          </p>
        </div>
        <button
          onClick={() => setModalNuova({ titolo: '' })}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg shadow-sm"
        >
          + Nuova esigenza
        </button>
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

      {/* Lista */}
      {loading ? (
        <div className="text-center text-gray-400 italic py-10">Caricamento...</div>
      ) : esigenze.length === 0 ? (
        <div className="bg-white rounded-xl p-10 shadow-sm text-center text-gray-400 italic">
          Nessuna esigenza. Clicca <strong>+ Nuova esigenza</strong> per iniziare.
        </div>
      ) : (
        <div className="space-y-3">
          {esigenze.map(e => {
            const figlie = sotto.filter(s => s.esigenza_id === e.id)
            const isOpen = !!aperte[e.id]
            const totFile = figlie.reduce((sum, s) => sum + docsDiSotto(s.id).length, 0)

            return (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header esigenza */}
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                     onClick={() => toggleAperta(e.id)}>
                  <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold shrink-0">
                    {figlie.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800">{e.titolo}</div>
                    <div className="text-xs text-gray-500">
                      {figlie.length} {figlie.length === 1 ? 'sotto-voce' : 'sotto-voci'}
                      {totFile > 0 && <> · {totFile} {totFile === 1 ? 'file' : 'file'}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={ev => ev.stopPropagation()}>
                    <button
                      onClick={() => setModalRinomina({ dati: { ...e } })}
                      title="Rinomina"
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => promuovi(e)}
                      title="Promuovi a voce di budget"
                      className="p-2 hover:bg-amber-100 rounded-lg text-amber-700 text-sm"
                    >
                      ↑€
                    </button>
                    <button
                      onClick={() => cancellaEsigenza(e)}
                      title="Elimina"
                      className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </div>
                </div>

                {/* Body esigenza */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-2">
                    {figlie.length === 0 && (
                      <div className="text-sm text-gray-400 italic py-2">
                        Nessuna sotto-voce. Aggiungine una qui sotto.
                      </div>
                    )}

                    {figlie.map(s => {
                      const d = docsDiSotto(s.id)
                      return (
                        <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-gray-800">{s.titolo}</div>
                              {d.length > 0 && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {d.length} {d.length === 1 ? 'file' : 'file'}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setUploadModal({ sottoesigenzaId: s.id, file: null, titolo: s.titolo })}
                                title="Carica file"
                                className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 font-semibold"
                              >
                                📎 Carica
                              </button>
                              <button
                                onClick={() => setModalRinominaSotto({ dati: { ...s } })}
                                title="Rinomina"
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => cancellaSotto(s)}
                                title="Elimina"
                                className="p-1.5 hover:bg-red-100 rounded-lg text-red-600"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* File allegati */}
                          {d.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                              {d.map(doc => (
                                <div key={doc.id} className="flex items-center gap-2 text-sm">
                                  <span className="shrink-0">{iconaFile(doc.nome_file)}</span>
                                  <a
                                    href={urlFileEsigenza(doc.storage_path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 min-w-0 truncate text-sky-700 hover:text-sky-900"
                                  >
                                    {doc.nome_file}
                                  </a>
                                  <span className="text-xs text-gray-400 shrink-0">
                                    {formattaDimensione(doc.dimensione)}
                                  </span>
                                  <button
                                    onClick={() => eliminaDoc(doc)}
                                    className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded hover:bg-red-200 font-semibold shrink-0"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <button
                      onClick={() => setModalNuovaSotto({ esigenzaId: e.id, titolo: '' })}
                      className="w-full py-2 text-sm font-semibold text-sky-700 bg-white border border-dashed border-sky-300 rounded-lg hover:bg-sky-50"
                    >
                      + Aggiungi sotto-voce
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODALE NUOVA ESIGENZA */}
      {modalNuova && (
        <Modal
          titolo="Nuova esigenza"
          onClose={() => setModalNuova(null)}
          onSave={() => salvaNuovaEsigenza(modalNuova.titolo)}
          salvando={salvando}
        >
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Titolo *</span>
            <input
              type="text"
              autoFocus
              value={modalNuova.titolo}
              onChange={e => setModalNuova({ ...modalNuova, titolo: e.target.value })}
              placeholder="Es. Recita, Tecnica, Cena..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </label>
        </Modal>
      )}

      {/* MODALE RINOMINA ESIGENZA */}
      {modalRinomina && (
        <Modal
          titolo="Rinomina esigenza"
          onClose={() => setModalRinomina(null)}
          onSave={salvaRinomina}
          salvando={salvando}
        >
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Titolo</span>
            <input
              type="text"
              autoFocus
              value={modalRinomina.dati.titolo}
              onChange={e => setModalRinomina({ dati: { ...modalRinomina.dati, titolo: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </label>
        </Modal>
      )}

      {/* MODALE NUOVA SOTTOESIGENZA */}
      {modalNuovaSotto && (
        <Modal
          titolo="Nuova sotto-esigenza"
          onClose={() => setModalNuovaSotto(null)}
          onSave={() => salvaNuovaSotto(modalNuovaSotto.titolo)}
          salvando={salvando}
        >
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Titolo *</span>
            <input
              type="text"
              autoFocus
              value={modalNuovaSotto.titolo}
              onChange={e => setModalNuovaSotto({ ...modalNuovaSotto, titolo: e.target.value })}
              placeholder="Es. Scenografie, Costumi, Materiali..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </label>
        </Modal>
      )}

      {/* MODALE RINOMINA SOTTOESIGENZA */}
      {modalRinominaSotto && (
        <Modal
          titolo="Rinomina sotto-esigenza"
          onClose={() => setModalRinominaSotto(null)}
          onSave={salvaRinominaSotto}
          salvando={salvando}
        >
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Titolo</span>
            <input
              type="text"
              autoFocus
              value={modalRinominaSotto.dati.titolo}
              onChange={e => setModalRinominaSotto({ dati: { ...modalRinominaSotto.dati, titolo: e.target.value } })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </label>
        </Modal>
      )}

      {/* MODALE UPLOAD */}
      {uploadModal && (
        <Modal
          titolo={`Carica file — ${uploadModal.titolo}`}
          onClose={() => setUploadModal(null)}
          onSave={eseguiUpload}
          salvando={caricando}
        >
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">File *</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.heic"
              onChange={e => setUploadModal({ ...uploadModal, file: e.target.files?.[0] || null })}
              className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-800 hover:file:bg-sky-200"
            />
          </label>
          {uploadModal.file && (
            <div className="text-xs text-gray-500">
              Selezionato: <strong>{uploadModal.file.name}</strong>{' '}
              ({formattaDimensione(uploadModal.file.size)})
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