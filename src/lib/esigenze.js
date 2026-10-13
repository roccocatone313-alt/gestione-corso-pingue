import { supabase } from './supabase'

const BUCKET = 'documenti-esigenze'

// ============================================
// CRUD ESIGENZE
// ============================================
export async function getEsigenze() {
  const { data, error } = await supabase
    .from('esigenze')
    .select('*')
    .order('ordine', { ascending: true })
    .order('id', { ascending: true })
  if (error) return { ok: false, errore: error.message, dati: [] }
  return { ok: true, dati: data || [] }
}

export async function creaEsigenza(titolo) {
  if (!titolo || !titolo.trim()) return { ok: false, errore: 'Titolo obbligatorio.' }
  const { data, error } = await supabase
    .from('esigenze')
    .insert({ titolo: titolo.trim(), ordine: 999 })
    .select()
    .single()
  if (error) return { ok: false, errore: error.message }
  return { ok: true, dati: data }
}

export async function aggiornaEsigenza(id, campi) {
  const { error } = await supabase.from('esigenze').update(campi).eq('id', id)
  if (error) return { ok: false, errore: error.message }
  return { ok: true }
}

export async function eliminaEsigenza(id) {
  const { error } = await supabase.from('esigenze').delete().eq('id', id)
  if (error) return { ok: false, errore: error.message }
  return { ok: true }
}

// ============================================
// CRUD SOTTOESIGENZE
// ============================================
export async function getSottoesigenze() {
  const { data, error } = await supabase
    .from('sottoesigenze')
    .select('*')
    .order('ordine', { ascending: true })
    .order('id', { ascending: true })
  if (error) return { ok: false, errore: error.message, dati: [] }
  return { ok: true, dati: data || [] }
}

export async function creaSottoesigenza(esigenzaId, titolo) {
  if (!titolo || !titolo.trim()) return { ok: false, errore: 'Titolo obbligatorio.' }
  const { data, error } = await supabase
    .from('sottoesigenze')
    .insert({ esigenza_id: esigenzaId, titolo: titolo.trim(), ordine: 999 })
    .select()
    .single()
  if (error) return { ok: false, errore: error.message }
  return { ok: true, dati: data }
}

export async function aggiornaSottoesigenza(id, campi) {
  const { error } = await supabase.from('sottoesigenze').update(campi).eq('id', id)
  if (error) return { ok: false, errore: error.message }
  return { ok: true }
}

export async function eliminaSottoesigenza(id) {
  const { error } = await supabase.from('sottoesigenze').delete().eq('id', id)
  if (error) return { ok: false, errore: error.message }
  return { ok: true }
}

// ============================================
// DOCUMENTI
// ============================================
function generaNomeFile(nomeOriginale) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const pulito = nomeOriginale
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-50)
  return `${timestamp}_${random}_${pulito}`
}

export async function caricaFileEsigenza(file, sottoesigenzaId) {
  if (!file) return { ok: false, errore: 'Nessun file selezionato.' }
  if (!sottoesigenzaId) return { ok: false, errore: 'Sottoesigenza mancante.' }

  const nomeStorage = `${sottoesigenzaId}/${generaNomeFile(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(nomeStorage, file, { cacheControl: '3600', upsert: false })

  if (uploadError) return { ok: false, errore: uploadError.message }

  const { data, error: dbError } = await supabase
    .from('documenti')
    .insert({
      sottoesigenza_id: sottoesigenzaId,
      nome_file: file.name,
      tipo: 'altro',
      storage_path: nomeStorage,
      dimensione: file.size,
      caricato_da: 'web',
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([nomeStorage])
    return { ok: false, errore: dbError.message }
  }

  return { ok: true, documento: data }
}

export async function getDocumentiSottoesigenze() {
  const { data, error } = await supabase
    .from('documenti')
    .select('*')
    .not('sottoesigenza_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) return { ok: false, errore: error.message, dati: [] }
  return { ok: true, dati: data || [] }
}

export function urlFileEsigenza(storagePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data?.publicUrl || ''
}

export async function eliminaFileEsigenza(documentoId, storagePath) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageError) return { ok: false, errore: storageError.message }
  const { error: dbError } = await supabase.from('documenti').delete().eq('id', documentoId)
  if (dbError) return { ok: false, errore: dbError.message }
  return { ok: true }
}

// ============================================
// PROMUOVI A BUDGET
// ============================================
export async function promuoviEsigenzaBudget(esigenza) {
  const { data, error } = await supabase
    .from('budget')
    .insert({
      voce: esigenza.titolo,
      categoria: 'Altro',
      preventivato: 0,
      cellula: 'Budget',
      stato: 'Pianificato',
      note: esigenza.descrizione || `Promossa da Esigenze #${esigenza.id}`,
    })
    .select()
    .single()
  if (error) return { ok: false, errore: error.message }
  return { ok: true, dati: data }
}

// ============================================
// UTILITY
// ============================================
export function formattaDimensione(byte) {
  if (!byte) return '—'
  const kb = byte / 1024
  if (kb < 1024) return kb.toFixed(0) + ' KB'
  return (kb / 1024).toFixed(2) + ' MB'
}

export function iconaFile(nome) {
  const ext = (nome || '').toLowerCase().split('.').pop()
  if (ext === 'pdf') return '📄'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return '🖼️'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  return '📎'
}