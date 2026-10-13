import { supabase } from './supabase'

const BUCKET = 'documenti-budget'

// ============================================
// Utility: genera un nome file univoco
// ============================================
function generaNomeFile(nomeOriginale) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  // Sanitizza il nome: elimina caratteri strani, mantieni estensione
  const pulito = nomeOriginale
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-50) // max 50 caratteri
  return `${timestamp}_${random}_${pulito}`
}

// ============================================
// Upload di un file
// ============================================
export async function caricaFile(file, budgetId, tipo = 'altro') {
  if (!file) return { ok: false, errore: 'Nessun file selezionato.' }
  if (!budgetId) return { ok: false, errore: 'Budget ID mancante.' }

  const nomeStorage = `${budgetId}/${generaNomeFile(file.name)}`

  // 1. Upload del file nel bucket
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(nomeStorage, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return { ok: false, errore: uploadError.message }
  }

  // 2. Inserisci il record nella tabella documenti
  const { data, error: dbError } = await supabase
    .from('documenti')
    .insert({
      budget_id: budgetId,
      nome_file: file.name,
      tipo: tipo,
      storage_path: nomeStorage,
      dimensione: file.size,
      caricato_da: 'web',
    })
    .select()
    .single()

  if (dbError) {
    // Se il record DB fallisce, elimina il file caricato
    await supabase.storage.from(BUCKET).remove([nomeStorage])
    return { ok: false, errore: dbError.message }
  }

  return { ok: true, documento: data }
}

// ============================================
// Ottieni URL pubblico di un file
// ============================================
export function urlFile(storagePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data?.publicUrl || ''
}

// ============================================
// Elimina un file (record + storage)
// ============================================
export async function eliminaFile(documentoId, storagePath) {
  if (!documentoId || !storagePath) {
    return { ok: false, errore: 'Dati mancanti.' }
  }

  // 1. Elimina il file dallo storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (storageError) {
    return { ok: false, errore: storageError.message }
  }

  // 2. Elimina il record dal database
  const { error: dbError } = await supabase
    .from('documenti')
    .delete()
    .eq('id', documentoId)

  if (dbError) {
    return { ok: false, errore: dbError.message }
  }

  return { ok: true }
}

// ============================================
// Ottieni tutti i documenti di una voce di budget
// ============================================
export async function getDocumentiBudget(budgetId) {
  if (!budgetId) return []

  const { data, error } = await supabase
    .from('documenti')
    .select('*')
    .eq('budget_id', budgetId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

// ============================================
// Utility: formatta la dimensione file
// ============================================
export function formattaDimensione(byte) {
  if (!byte) return '—'
  const kb = byte / 1024
  if (kb < 1024) return kb.toFixed(0) + ' KB'
  return (kb / 1024).toFixed(2) + ' MB'
}

// ============================================
// Utility: restituisce l'icona in base al tipo MIME
// ============================================
export function iconaFile(nome) {
  const ext = (nome || '').toLowerCase().split('.').pop()
  if (ext === 'pdf') return '📄'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return '🖼️'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  return '📎'
}