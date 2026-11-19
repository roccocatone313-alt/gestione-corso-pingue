import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { euro, dataIt } from '../lib/formato'
import { oggiISO } from '../lib/dateCassa'
import { STATO_FIDO, importoIncasso } from '../lib/sponsor'

// Entrata F.I.Do inserita a mano (Inserisci → Movimento, categoria F.I.Do)
function eFido(m) {
  return String(m.categoria || '').toLowerCase().replace(/[^a-z]/g, '').includes('fido')
}

// Porta uno sponsor a "Pagato tramite F.I.Do".
// Se la donazione è già registrata a mano come entrata F.I.Do, la collega allo
// sponsor (niente doppioni); altrimenti crea l'entrata F.I.Do a suo nome.
// La parte nel database è la funzione collega_entrata_fido e il trigger sugli sponsor.
export default function SceltaFido({ sponsor, onChiudi, onFatto }) {
  const [entrate, setEntrate] = useState(null)
  const [scelta, setScelta] = useState(null)        // id del movimento oppure 'nuova'
  const [data, setData] = useState(sponsor.data_incasso || oggiISO())
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')

  const importoNuova = importoIncasso(sponsor)

  useEffect(() => {
    let attivo = true
    supabase
      .from('movimenti')
      .select('id, data, importo, categoria, descrizione')
      .eq('tipo', 'Entrata')
      .eq('origine', 'manuale')
      .order('data', { ascending: true })
      .then(({ data: righe, error }) => {
        if (!attivo) return
        if (error) { setErrore(error.message); setEntrate([]); return }
        const libere = (righe || []).filter(eFido)
        setEntrate(libere)
        if (libere.length === 0) setScelta('nuova')
      })
    return () => { attivo = false }
  }, [])

  async function conferma() {
    setErrore('')
    if (!scelta) { setErrore("Scegli l'entrata F.I.Do."); return }
    if (scelta === 'nuova' && importoNuova <= 0) {
      setErrore("Lo sponsor non ha importi: scrivi l'importo promesso o incassato e riprova.")
      return
    }
    if (scelta === 'nuova' && !data) { setErrore('Scegli la data della donazione.'); return }
    setSalvando(true)
    let error, righe
    if (scelta === 'nuova') {
      ({ data: righe, error } = await supabase
        .from('sponsor')
        .update({ stato: STATO_FIDO, data_incasso: data })
        .eq('id', sponsor.id)
        .select('id'))
      if (!error && (!righe || righe.length === 0)) {
        error = { message: 'Non salvato: solo il comitato può modificare gli sponsor.' }
      }
    } else {
      ({ error } = await supabase.rpc('collega_entrata_fido', {
        p_sponsor: sponsor.id,
        p_movimento: scelta,
      }))
    }
    setSalvando(false)
    if (error) { setErrore(error.message); return }
    const m = scelta === 'nuova' ? null : entrate.find(x => x.id === scelta)
    onFatto(m
      ? `${sponsor.nome}: collegato all'entrata F.I.Do del ${dataIt(m.data)} (${euro(m.importo)}).`
      : `${sponsor.nome}: registrata l'entrata F.I.Do di ${euro(importoNuova)}.`)
  }

  const nome = (sponsor.nome || '').trim() || 'Sponsor'

  return (
    <Modal titolo={`${nome}: pagato tramite F.I.Do`} onClose={onChiudi} onSave={conferma}
           salvando={salvando} etichettaSalva="Conferma">
      <p className="text-sm text-gray-600">
        La donazione va nella voce <strong>F.I.Do</strong> del Rendiconto, con il nome dello sponsor.
        Se l'hai già registrata a mano, sceglila qui sotto: così non viene contata due volte.
      </p>

      {entrate === null ? (
        <div className="text-sm text-gray-400 italic">Caricamento delle entrate F.I.Do...</div>
      ) : (
        <div className="space-y-2">
          {entrate.length > 0 && (
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Entrate F.I.Do registrate a mano
            </div>
          )}
          {entrate.map(m => (
            <label key={m.id}
                   className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                     scelta === m.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="entrata-fido" className="mt-1"
                     checked={scelta === m.id} onChange={() => setScelta(m.id)} />
              <span className="text-sm">
                <span className="font-semibold tabular-nums">{euro(m.importo)}</span>
                <span className="text-gray-500"> · {dataIt(m.data)}</span>
                <span className="block text-gray-600">
                  {(m.descrizione || '').trim() || <em className="text-gray-400">senza descrizione</em>}
                </span>
              </span>
            </label>
          ))}

          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                   scelta === 'nuova' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input type="radio" name="entrata-fido" className="mt-1"
                   checked={scelta === 'nuova'} onChange={() => setScelta('nuova')} />
            <span className="text-sm flex-1">
              <span className="font-semibold">Non è ancora registrata</span>
              <span className="block text-gray-600">
                Crea l'entrata F.I.Do di <strong>{euro(importoNuova)}</strong>
                {Number(sponsor.importo_incassato) > 0 ? ' (importo incassato)' : ' (importo promesso)'}.
              </span>
              {scelta === 'nuova' && (
                <span className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">Data della donazione</span>
                  <input type="date" value={data} onChange={e => setData(e.target.value)}
                         className="px-2 py-1 text-sm border border-gray-300 rounded" />
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      {errore && (
        <div className="px-3 py-2 rounded-lg text-sm border bg-red-50 border-red-200 text-red-800">{errore}</div>
      )}
    </Modal>
  )
}
