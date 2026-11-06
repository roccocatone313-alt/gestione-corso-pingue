import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { oggiISO } from '../lib/dateCassa'
import { euro, dataIt } from '../lib/formato'

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'

// Rate (pagamenti parziali) di un acquisto.
// Ogni rata esce subito dalla cassa; quando l'acquisto diventa "Pagato"
// il database registra il saldo = totale meno rate.
export default function PagamentiAcquisto({ acquisto, rate, onClose, onCambiato }) {
  const haEffettivo = acquisto.importo_effettivo !== null && acquisto.importo_effettivo !== undefined && acquisto.importo_effettivo !== ''
  const totale = Number(haEffettivo ? acquisto.importo_effettivo : acquisto.importo_previsto) || 0
  const pagateRate = rate.reduce((s, r) => s + (Number(r.importo) || 0), 0)
  const saldato = acquisto.stato === 'Pagato'
  const annullato = acquisto.stato === 'Rifiutato'
  const residuo = Math.max(totale - pagateRate, 0)

  const [nuova, setNuova] = useState({ data: oggiISO(), importo: '', note: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function aggiungi(e) {
    e.preventDefault()
    setMsg(null)
    const importo = Number(nuova.importo)
    if (!importo || importo <= 0) { setMsg({ ok: false, testo: 'Importo non valido.' }); return }
    if (pagateRate + importo > totale + 0.005) {
      setMsg({ ok: false, testo: `Supera l'importo dell'acquisto: restano da pagare ${euro(residuo)}.` })
      return
    }
    setSalvando(true)
    const { error } = await supabase.from('pagamenti_acquisti').insert({
      acquisto_id: acquisto.id,
      data: nuova.data || oggiISO(),
      importo,
      note: nuova.note.trim() || null,
    })
    setSalvando(false)
    if (error) { setMsg({ ok: false, testo: error.message }); return }
    setNuova({ data: oggiISO(), importo: '', note: '' })
    setMsg({ ok: true, testo: 'Rata registrata: è già uscita dalla cassa.' })
    onCambiato()
  }

  async function elimina(r) {
    if (!confirm(`Cancellare la rata del ${dataIt(r.data)} da ${euro(r.importo)}? Verrà tolto anche il movimento di cassa collegato.`)) return
    setMsg(null)
    setSalvando(true)
    const { error } = await supabase.from('pagamenti_acquisti').delete().eq('id', r.id)
    setSalvando(false)
    if (error) { setMsg({ ok: false, testo: error.message }); return }
    setMsg({ ok: true, testo: 'Rata cancellata.' })
    onCambiato()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">Pagamenti</h2>
            <p className="text-xs text-gray-500">{acquisto.descrizione}</p>
          </div>
          <button type="button" onClick={onClose}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] uppercase text-gray-500">Totale</div>
              <div className="font-bold text-gray-900">{euro(totale)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] uppercase text-gray-500">Rate pagate</div>
              <div className="font-bold text-green-700">{euro(pagateRate)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-[11px] uppercase text-gray-500">Da pagare</div>
              <div className="font-bold text-amber-700">{saldato ? 'Saldato' : euro(residuo)}</div>
            </div>
          </div>

          {saldato && (
            <p className="text-xs text-gray-500">
              L'acquisto è segnato "Pagato": in cassa il saldo vale il totale meno le rate.
            </p>
          )}
          {annullato && pagateRate > 0 && (
            <p className="text-xs text-gray-500">
              L'acquisto è annullato: le rate già pagate restano come spesa.
            </p>
          )}

          {rate.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Nessuna rata registrata.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                  <th className="py-2">Data</th>
                  <th className="py-2 text-right">Importo</th>
                  <th className="py-2 pl-3">Nota</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rate.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 whitespace-nowrap">{dataIt(r.data)}</td>
                    <td className="py-2 text-right font-medium">{euro(r.importo)}</td>
                    <td className="py-2 pl-3 text-gray-600">{r.note || '—'}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => elimina(r)} disabled={salvando}
                              className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 font-semibold">
                        Cancella
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={aggiungi} className="rounded-lg border border-gray-200 p-3 space-y-3">
            <div className="text-xs font-semibold text-gray-600">Aggiungi una rata</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-600 mb-1">Data</span>
                <input type="date" required value={nuova.data}
                       onChange={e => setNuova({ ...nuova, data: e.target.value })} className={inputClass} />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-600 mb-1">Importo (€)</span>
                <input type="number" step="0.01" min="0.01" required value={nuova.importo}
                       onChange={e => setNuova({ ...nuova, importo: e.target.value })} className={inputClass} />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Nota (facoltativa)</span>
              <input type="text" value={nuova.note} placeholder="Es. anticipo, seconda rata"
                     onChange={e => setNuova({ ...nuova, note: e.target.value })} className={inputClass} />
            </label>
            <button disabled={salvando}
                    className="w-full py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg">
              {salvando ? 'Salvataggio...' : 'Aggiungi rata'}
            </button>
          </form>

          {msg && (
            <div className={`px-3 py-2 rounded-lg text-sm border ${msg.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'}`}>
              {msg.testo}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
