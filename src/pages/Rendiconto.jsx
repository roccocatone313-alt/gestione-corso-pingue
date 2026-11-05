import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MACRO_DEFAULT = ['RECITA', 'SERATA DANZANTE', 'CATERING', 'SMALTIMENTO RIFIUTI', 'SPINGUINATURA', 'ALTRO']

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function SezioneCard({ nome, voci, spesoPerVoce }) {
  const [aperta, setAperta] = useState(false)
  const totPrev = voci.reduce((s, v) => s + (Number(v.preventivato) || 0), 0)
  const totSpeso = voci.reduce((s, v) => s + spesoPerVoce(v.voce), 0)
  const delta = totSpeso - totPrev

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <button
        onClick={() => setAperta(a => !a)}
        className="w-full p-5 flex items-center justify-between gap-4 hover:bg-gray-50 text-left flex-wrap"
      >
        <div className="flex-1 min-w-[140px]">
          <div className="text-lg font-bold text-gray-800">{nome}</div>
          <div className="text-xs text-gray-500">{voci.length} {voci.length === 1 ? 'voce' : 'voci'}</div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 uppercase">Preventivato</div>
            <div className="font-bold text-gray-700">{euro(totPrev)}</div>
          </div>
          <div>
            <div className="text-xs text-amber-700 uppercase">Speso</div>
            <div className="font-bold text-amber-700">{euro(totSpeso)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Delta</div>
            <div className={`font-bold ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {delta > 0 ? '+' : ''}{euro(delta)}
            </div>
          </div>
        </div>
        <span className="text-gray-400 text-xl">{aperta ? '▾' : '▸'}</span>
      </button>

      {aperta && (
        <div className="border-t border-gray-100 p-5 overflow-x-auto">
          {voci.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Nessuna voce in questa sezione.</div>
          ) : (
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b">
                  <th className="text-left py-2">Voce</th>
                  <th className="text-left py-2">Categoria</th>
                  <th className="text-right py-2">Preventivato</th>
                  <th className="text-right py-2">Speso</th>
                  <th className="text-right py-2">Delta</th>
                  <th className="text-left py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {voci.map(v => {
                  const sp = spesoPerVoce(v.voce)
                  const d = sp - (Number(v.preventivato) || 0)
                  return (
                    <tr key={v.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-800">{v.voce}</td>
                      <td className="py-2 text-gray-600">{v.categoria || '—'}</td>
                      <td className="py-2 text-right">{euro(v.preventivato)}</td>
                      <td className="py-2 text-right text-amber-700">{euro(sp)}</td>
                      <td className={`py-2 text-right font-semibold ${d > 0 ? 'text-red-600' : d < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {d > 0 ? '+' : ''}{euro(d)}
                      </td>
                      <td className="py-2 text-gray-500 text-xs">{v.note || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function Rendiconto() {
  const [budget, setBudget] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [config, setConfig] = useState({ macroSezioni: {}, patrimonio: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carica() {
      const [b, m, c] = await Promise.all([
        supabase.from('budget').select('*').order('voce'),
        supabase.from('movimenti').select('tipo, categoria, importo'),
        fetch('/data/rendiconto-config.json')
          .then(r => (r.ok ? r.json() : { macroSezioni: {}, patrimonio: [] }))
          .catch(() => ({ macroSezioni: {}, patrimonio: [] })),
      ])
      setBudget(b.data || [])
      setMovimenti(m.data || [])
      setConfig(c || { macroSezioni: {}, patrimonio: [] })
      setLoading(false)
    }
    carica()
  }, [])

  function spesoPerVoce(nomeVoce) {
    return movimenti
      .filter(m => m.tipo === 'Uscita' && m.categoria === nomeVoce)
      .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  }

  const entrate = movimenti.filter(m => m.tipo === 'Entrata').reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const uscite = movimenti.filter(m => m.tipo === 'Uscita').reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const saldo = entrate - uscite
  const totPrev = budget.reduce((s, v) => s + (Number(v.preventivato) || 0), 0)

  const macroSezioni = config.macroSezioni || {}
  const macroNomi = Object.keys(macroSezioni).length > 0 ? Object.keys(macroSezioni) : MACRO_DEFAULT

  const vociPerMacro = {}
  macroNomi.forEach(n => { vociPerMacro[n] = [] })
  budget.forEach(v => {
    const macro = macroSezioni[v.voce] || macroSezioni[String(v.id)] || 'ALTRO'
    if (!vociPerMacro[macro]) vociPerMacro[macro] = []
    vociPerMacro[macro].push(v)
  })

  const patrimonio = config.patrimonio || []

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-sky-500">
        <div className="text-xs uppercase tracking-wide text-gray-500">Saldo attuale</div>
        <div className={`text-3xl font-bold mt-2 ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {euro(saldo)}
        </div>
        <div className="flex gap-6 mt-3 text-sm text-gray-600 flex-wrap">
          <span>Entrate: <strong className="text-green-700">{euro(entrate)}</strong></span>
          <span>Uscite: <strong className="text-amber-700">{euro(uscite)}</strong></span>
          <span>Totale preventivato: <strong className="text-gray-700">{euro(totPrev)}</strong></span>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Patrimonio</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {patrimonio.length === 0 && (
            <div className="text-sm text-gray-400 italic">Nessuna voce di patrimonio configurata.</div>
          )}
          {patrimonio.map((p, i) => {
            const prev = Number(p.importoPrevisto) || 0
            const conf = Number(p.importoConfermato) || 0
            const pct = prev > 0 ? Math.min((conf / prev) * 100, 100) : 0
            return (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="font-bold text-gray-800">{p.voce}</div>
                {p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}
                <div className="mt-2 text-lg font-bold text-sky-700">
                  {euro(conf)}{' '}
                  <span className="text-xs text-gray-400 font-normal">/ {euro(prev)}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: pct + '%' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Spese per sezione</h2>
        {loading ? (
          <div className="text-center text-gray-400 italic py-10">Caricamento...</div>
        ) : (
          <div className="space-y-3">
            {macroNomi.map(nome => (
              <SezioneCard key={nome} nome={nome} voci={vociPerMacro[nome] || []} spesoPerVoce={spesoPerVoce} />
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-400 py-4">
        Totale preventivato: {euro(totPrev)} · Totale speso: {euro(uscite)} · Saldo: {euro(saldo)}
      </div>
    </div>
  )
}
