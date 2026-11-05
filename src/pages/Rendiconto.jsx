import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MACRO_ORDINE = [
  'RECITA', 'SERATA DANZANTE', 'CATERING',
  'SMALTIMENTO RIFIUTI', 'SPINGUINATURA', 'ALTRO',
]

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function deltaClass(d) {
  if (d > 0.005) return 'text-red-700'
  if (d < -0.005) return 'text-green-700'
  return 'text-gray-500'
}

function isFido(nome) {
  return /fido/i.test(nome || '')
}

export default function Rendiconto() {
  const [budget, setBudget] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [sponsor, setSponsor] = useState([])
  const [loading, setLoading] = useState(true)
  const [aperte, setAperte] = useState({})

  useEffect(() => {
    async function carica() {
      setLoading(true)
      const [b, m, sp] = await Promise.all([
        supabase.from('budget').select('*'),
        supabase.from('movimenti').select('*'),
        supabase.from('sponsor').select('*'),
      ])
      setBudget(b.data || [])
      setMovimenti(m.data || [])
      setSponsor(sp.data || [])
      setLoading(false)
    }
    carica()
  }, [])

  function spesoPerVoce(nomeVoce) {
    return movimenti
      .filter(m => m.tipo === 'Uscita' && m.categoria === nomeVoce)
      .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  }

  function sezioneDi(b) {
    const v = (b.macro_sezione || '').toUpperCase().trim()
    if (v && MACRO_ORDINE.includes(v) && v !== 'ALTRO') return v
    return 'ALTRO'
  }

  const gruppi = {}
  for (const s of MACRO_ORDINE) gruppi[s] = []
  for (const b of budget) gruppi[sezioneDi(b)].push(b)

  const totPreventivo = budget.reduce((s, b) => s + (Number(b.preventivato) || 0), 0)
  const totSpeso = budget.reduce((s, b) => s + spesoPerVoce(b.voce), 0)
  const saldo = totPreventivo - totSpeso

  const entrateAllievi = movimenti
    .filter(m => m.tipo === 'Entrata' && m.categoria !== 'Sponsor')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)

  const sponsorFido = sponsor.filter(s => isFido(s.nome))
  const sponsorNoFido = sponsor.filter(s => !isFido(s.nome))

  const patrimonio = [
    {
      voce: 'Soldi allievi',
      importoPrevisto: null,
      importoConfermato: entrateAllievi,
      note: 'Entrate in movimenti con categoria diversa da "Sponsor"',
    },
    {
      voce: 'Sponsor',
      importoPrevisto: sponsorNoFido.reduce((s, x) => s + (Number(x.importo_promesso) || 0), 0),
      importoConfermato: sponsorNoFido.reduce((s, x) => s + (Number(x.importo_incassato) || 0), 0),
      note: 'Dalla tabella sponsor (escluso FIDO)',
    },
    {
      voce: 'FIDO (Fondazione Italiana per il Dono)',
      importoPrevisto: sponsorFido.reduce((s, x) => s + (Number(x.importo_promesso) || 0), 0),
      importoConfermato: sponsorFido.reduce((s, x) => s + (Number(x.importo_incassato) || 0), 0),
      note: sponsorFido.length === 0
        ? 'Nessuno sponsor con "FIDO" nel nome: registralo nella pagina Sponsor'
        : 'Sponsor con "FIDO" nel nome',
    },
  ]

  function toggle(s) {
    setAperte(a => ({ ...a, [s]: !a[s] }))
  }

  if (loading) {
    return <div className="text-center text-gray-400 italic py-10">Caricamento...</div>
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">Saldo attuale</div>
        <div className={`text-3xl font-bold mt-1 ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {euro(saldo)}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div className="text-xs text-gray-500 uppercase">Totale preventivato</div>
            <div className="font-bold text-sky-700">{euro(totPreventivo)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Totale speso</div>
            <div className="font-bold text-amber-700">{euro(totSpeso)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Patrimonio</h3>
        <div className="space-y-3">
          {patrimonio.map(p => {
            const prev = Number(p.importoPrevisto) || 0
            const conf = Number(p.importoConfermato) || 0
            const hasPrev = p.importoPrevisto !== null && prev > 0
            const pct = hasPrev ? Math.min((conf / prev) * 100, 100) : 0
            return (
              <div key={p.voce}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-800">{p.voce}</span>
                  <span className="text-gray-600">
                    {hasPrev ? `${euro(conf)} / ${euro(prev)}` : euro(conf)}
                  </span>
                </div>
                {hasPrev && (
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-sky-500" style={{ width: pct + '%' }} />
                  </div>
                )}
                {p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        {MACRO_ORDINE.map(s => {
          const voci = gruppi[s]
          const prevSez = voci.reduce((s2, b) => s2 + (Number(b.preventivato) || 0), 0)
          const spesoSez = voci.reduce((s2, b) => s2 + spesoPerVoce(b.voce), 0)
          const delta = spesoSez - prevSez
          const isAperta = !!aperte[s]
          return (
            <div key={s} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggle(s)}
                className="w-full text-left p-5 flex items-center justify-between gap-3 hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800">{s}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {voci.length} {voci.length === 1 ? 'voce' : 'voci'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase">Speso / Previsto</div>
                  <div className="font-bold text-gray-800">
                    {euro(spesoSez)} <span className="text-gray-400">/ {euro(prevSez)}</span>
                  </div>
                  <div className={`text-xs font-semibold ${deltaClass(delta)}`}>
                    Delta: {euro(delta)}
                  </div>
                </div>
                <div className={`text-gray-400 transition-transform ${isAperta ? 'rotate-180' : ''}`}>▾</div>
              </button>

              {isAperta && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  {voci.length === 0 ? (
                    <div className="p-5 text-sm text-gray-400 italic">Nessuna voce in questa sezione.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-2">Voce</th>
                          <th className="text-right px-4 py-2">Preventivo</th>
                          <th className="text-right px-4 py-2">Speso</th>
                          <th className="text-right px-4 py-2">Delta</th>
                          <th className="text-left px-4 py-2">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {voci.map(b => {
                          const sp = spesoPerVoce(b.voce)
                          const d = sp - (Number(b.preventivato) || 0)
                          return (
                            <tr key={b.id} className="border-t border-gray-100">
                              <td className="px-4 py-2 font-medium text-gray-800">{b.voce}</td>
                              <td className="px-4 py-2 text-right">{euro(b.preventivato)}</td>
                              <td className="px-4 py-2 text-right">{euro(sp)}</td>
                              <td className={`px-4 py-2 text-right font-semibold ${deltaClass(d)}`}>{euro(d)}</td>
                              <td className="px-4 py-2 text-gray-500 text-xs">{b.note || ''}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td className="px-4 py-2">Totale {s}</td>
                          <td className="px-4 py-2 text-right">{euro(prevSez)}</td>
                          <td className="px-4 py-2 text-right">{euro(spesoSez)}</td>
                          <td className={`px-4 py-2 text-right ${deltaClass(delta)}`}>{euro(delta)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-center text-xs text-gray-400 py-4">
        Dati calcolati automaticamente dalle tabelle Supabase
      </div>
    </div>
  )
}
