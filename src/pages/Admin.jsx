import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { esportaExcel, esportaPDF } from '../lib/export'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts'

const COLORI = ['#0ea5e9','#38a169','#d69e2e','#e53e3e','#805ad5',
                '#dd6b20','#319795','#d53f8c','#718096','#2c5282']

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function Card({ label, value, sub, color = 'gray' }) {
  const palette = {
    gray:  { border: 'border-l-gray-300', value: 'text-gray-800' },
    green: { border: 'border-l-green-500', value: 'text-green-700' },
    red:   { border: 'border-l-red-500',   value: 'text-red-700' },
    blue:  { border: 'border-l-sky-500',   value: 'text-sky-700' },
    amber: { border: 'border-l-amber-500', value: 'text-amber-700' },
  }[color]
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${palette.border}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-2 ${palette.value}`}>{value}</div>
      {sub && <div className="text-sm text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(null)
  const [raw, setRaw] = useState(null)

  useEffect(() => {
    async function carica() {
      const [mov, sp, acq, bud, scad] = await Promise.all([
        supabase.from('movimenti').select('*'),
        supabase.from('sponsor').select('*'),
        supabase.from('acquisti').select('*'),
        supabase.from('budget').select('*'),
        supabase.from('scadenze').select('*'),
      ])
      const err = mov.error || sp.error || acq.error || bud.error || scad.error
      if (err) { setErrore(err.message); return }

      const movimenti = mov.data || []
      const sponsor = sp.data || []
      const acquisti = acq.data || []
      const budget = bud.data || []
      const scadenze = scad.data || []

      setRaw({ movimenti, sponsor, acquisti, budget, scadenze })

      let entrate = 0, uscite = 0
      movimenti.forEach(m => {
        if (m.tipo === 'Entrata') entrate += Number(m.importo) || 0
        else if (m.tipo === 'Uscita') uscite += Number(m.importo) || 0
      })

      const preventivato = budget.reduce((s, b) => s + (Number(b.preventivato) || 0), 0)
      const sponsorPromesso = sponsor.reduce((s, x) => s + (Number(x.importo_promesso) || 0), 0)
      const sponsorIncassato = sponsor.reduce((s, x) => s + (Number(x.importo_incassato) || 0), 0)

      const acquistiAperti = acquisti.filter(a =>
        a.stato && a.stato !== 'Pagato' && a.stato !== 'Rifiutato'
      )
      const acquistiDaPagare = acquistiAperti.reduce(
        (s, a) => s + (Number(a.importo_effettivo) || Number(a.importo_previsto) || 0), 0
      )

      const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
      const fra30 = new Date(oggi); fra30.setDate(fra30.getDate() + 30)
      let scadenzeProssime = 0, scadenzeScadute = 0
      scadenze.forEach(s => {
        if (s.stato === 'Completata' || s.stato === 'Annullata') return
        const d = new Date(s.data)
        if (isNaN(d.getTime())) return
        if (d < oggi) scadenzeScadute++
        else if (d <= fra30) scadenzeProssime++
      })

      const ultimi = [...movimenti]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 5)

      // Grafico 1: entrate/uscite per mese
      const oggiMese = new Date()
      const perMese = {}
      const ordineMesi = []
      const nomiMesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
      for (let i = 11; i >= 0; i--) {
        const d = new Date(oggiMese.getFullYear(), oggiMese.getMonth() - i, 1)
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        const label = nomiMesi[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)
        perMese[key] = { mese: label, Entrate: 0, Uscite: 0 }
        ordineMesi.push(key)
      }
      movimenti.forEach(m => {
        const d = new Date(m.data)
        if (isNaN(d.getTime())) return
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        if (!perMese[key]) return
        if (m.tipo === 'Entrata') perMese[key].Entrate += Number(m.importo) || 0
        else if (m.tipo === 'Uscita') perMese[key].Uscite += Number(m.importo) || 0
      })
      const datiMesi = ordineMesi.map(k => perMese[k])

      // Grafico 2: sponsor per stato
      const perStato = {}
      sponsor.forEach(s => {
        if (!s.nome) return
        const stato = s.stato || 'Prospect'
        perStato[stato] = (perStato[stato] || 0) + (Number(s.importo_promesso) || 0)
      })
      const datiSponsor = Object.entries(perStato).map(([name, value]) => ({ name, value }))

      // Grafico 3: uscite per categoria
      const perCategoria = {}
      movimenti.forEach(m => {
        if (m.tipo !== 'Uscita') return
        const cat = m.categoria || 'Altro'
        perCategoria[cat] = (perCategoria[cat] || 0) + (Number(m.importo) || 0)
      })
      const datiCategorie = Object.entries(perCategoria).map(([name, value]) => ({ name, value }))

      setDati({
        saldo: entrate - uscite,
        entrate, uscite,
        preventivato,
        residuo: preventivato - uscite,
        sponsorPromesso, sponsorIncassato,
        sponsorMancante: sponsorPromesso - sponsorIncassato,
        acquistiDaPagare,
        acquistiNumero: acquistiAperti.length,
        scadenzeProssime, scadenzeScadute,
        ultimi,
        datiMesi,
        datiSponsor,
        datiCategorie,
      })
    }
    carica()
  }, [])

  if (errore) {
    return <div className="bg-red-50 text-red-800 p-4 rounded-lg">Errore: {errore}</div>
  }
  if (!dati) {
    return <div className="text-center text-gray-500 p-10">Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      {/* Intestazione con pulsanti export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Panoramica</h2>
          <p className="text-sm text-gray-500">Situazione economica del corso in tempo reale</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => raw && esportaExcel(raw)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            📥 Esporta Excel
          </button>
          <button
            onClick={() => raw && esportaPDF(raw)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            📄 Esporta PDF
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Saldo attuale" value={euro(dati.saldo)} sub="Entrate meno uscite"
              color={dati.saldo >= 0 ? 'green' : 'red'} />
        <Card label="Entrate totali" value={euro(dati.entrate)} color="green" />
        <Card label="Uscite totali"  value={euro(dati.uscite)}  color="red" />
        <Card label="Budget residuo" value={euro(dati.residuo)}
              sub={`su ${euro(dati.preventivato)} preventivati`}
              color={dati.residuo >= 0 ? 'green' : 'red'} />
        <Card label="Sponsor incassati" value={euro(dati.sponsorIncassato)}
              sub={`su ${euro(dati.sponsorPromesso)} promessi`} color="blue" />
        <Card label="Sponsor da incassare" value={euro(dati.sponsorMancante)}
              color={dati.sponsorMancante > 0 ? 'amber' : 'green'} />
        <Card label="Acquisti da pagare" value={euro(dati.acquistiDaPagare)}
              sub={`${dati.acquistiNumero} voci aperte`}
              color={dati.acquistiDaPagare > 0 ? 'amber' : 'green'} />
        <Card label="Scadenze" value={dati.scadenzeProssime + dati.scadenzeScadute}
              sub={dati.scadenzeScadute > 0 ? `${dati.scadenzeScadute} scadute` : 'nessuna scaduta'}
              color={dati.scadenzeScadute > 0 ? 'red' : dati.scadenzeProssime > 0 ? 'amber' : 'green'} />
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Entrate e uscite per mese (ultimi 12 mesi)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dati.datiMesi}>
              <XAxis dataKey="mese" fontSize={12} stroke="#718096" />
              <YAxis fontSize={12} stroke="#718096"
                     tickFormatter={v => '€' + v} />
              <Tooltip formatter={v => euro(v)} />
              <Legend />
              <Bar dataKey="Entrate" fill="#38a169" radius={[4,4,0,0]} />
              <Bar dataKey="Uscite"  fill="#e53e3e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Sponsor per stato (promesso)
          </h3>
          {dati.datiSponsor.length === 0 ? (
            <div className="text-center text-gray-400 italic py-10">
              Nessuno sponsor registrato.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={dati.datiSponsor} dataKey="value" nameKey="name"
                     cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                  {dati.datiSponsor.map((_, i) => (
                    <Cell key={i} fill={COLORI[i % COLORI.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => euro(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Uscite per categoria
          </h3>
          {dati.datiCategorie.length === 0 ? (
            <div className="text-center text-gray-400 italic py-10">
              Nessuna uscita registrata.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={dati.datiCategorie} dataKey="value" nameKey="name"
                     cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                  {dati.datiCategorie.map((_, i) => (
                    <Cell key={i} fill={COLORI[i % COLORI.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => euro(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ultimi movimenti */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">
          Ultimi movimenti
        </h2>
        {dati.ultimi.length === 0 ? (
          <div className="text-center text-gray-400 italic py-6">Nessun movimento registrato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Descrizione</th>
                  <th className="py-2 px-3 text-right">Importo</th>
                </tr>
              </thead>
              <tbody>
                {dati.ultimi.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 px-3">{m.data}</td>
                    <td className="py-2 px-3">{m.tipo}</td>
                    <td className="py-2 px-3">{m.descrizione || '—'}</td>
                    <td className={`py-2 px-3 text-right font-medium ${
                      m.tipo === 'Entrata' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {euro(m.importo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}