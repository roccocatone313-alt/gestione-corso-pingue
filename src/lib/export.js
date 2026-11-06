import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { euro } from './formato'
import { riepilogoSponsor, incassatoDa } from './sponsor'

// ============================================
// Utility
// ============================================

function oggiISO() {
  return new Date().toISOString().slice(0, 10)
}

function ratePerAcquisto(pagamenti) {
  const somme = new Map()
  for (const p of pagamenti || []) {
    somme.set(p.acquisto_id, (somme.get(p.acquisto_id) || 0) + (Number(p.importo) || 0))
  }
  return somme
}

// ============================================
// EXPORT EXCEL
// ============================================
// dati = { movimenti: [...], sponsor: [...], acquisti: [...], pagamenti: [...] }
export function esportaExcel(dati) {
  const wb = XLSX.utils.book_new()
  const rate = ratePerAcquisto(dati.pagamenti)
  const descrizioneAcquisto = new Map((dati.acquisti || []).map(a => [a.id, a.descrizione || '']))

  // --- Movimenti ---
  const movRows = (dati.movimenti || []).map(m => ({
    ID: m.id,
    Data: m.data || '',
    Tipo: m.tipo || '',
    Categoria: m.categoria || '',
    Cellula: m.cellula || '',
    Descrizione: m.descrizione || '',
    Riferimento: m.riferimento || '',
    Origine: m.origine || 'manuale',
    Importo: Number(m.importo) || 0,
    'Inserito da': m.created_by || '',
  }))
  const wsMov = XLSX.utils.json_to_sheet(movRows)
  XLSX.utils.book_append_sheet(wb, wsMov, 'Movimenti')

  // --- Sponsor ---
  const spRows = (dati.sponsor || []).map(s => ({
    ID: s.id,
    Nome: s.nome || '',
    Referente: s.referente || '',
    Email: s.email || '',
    Telefono: s.telefono || '',
    'Importo promesso': Number(s.importo_promesso) || 0,
    'Importo incassato': incassatoDa(s),
    Stato: s.stato || '',
    'Data accordo': s.data_accordo || '',
    'Data incasso': s.data_incasso || '',
    Note: s.note || '',
  }))
  const wsSp = XLSX.utils.json_to_sheet(spRows)
  XLSX.utils.book_append_sheet(wb, wsSp, 'Sponsor')

  // --- Acquisti ---
  const acRows = (dati.acquisti || []).map(a => ({
    ID: a.id,
    Descrizione: a.descrizione || '',
    Fornitore: a.fornitore || '',
    Categoria: a.categoria || '',
    Richiedente: a.richiedente || '',
    'Data richiesta': a.data_richiesta || '',
    'Importo previsto': Number(a.importo_previsto) || 0,
    'Importo effettivo': Number(a.importo_effettivo) || 0,
    'Pagato con rate': rate.get(a.id) || 0,
    Stato: a.stato || '',
    Sezione: a.macro_sezione || 'ALTRO',
    'Data ordine': a.data_ordine || '',
    'Data pagamento': a.data_pagamento || '',
    Note: a.note || '',
  }))
  const wsAc = XLSX.utils.json_to_sheet(acRows)
  XLSX.utils.book_append_sheet(wb, wsAc, 'Acquisti')

  // --- Rate degli acquisti ---
  const rateRows = (dati.pagamenti || []).map(p => ({
    'ID acquisto': p.acquisto_id,
    Acquisto: descrizioneAcquisto.get(p.acquisto_id) || '',
    Data: p.data || '',
    Importo: Number(p.importo) || 0,
    Note: p.note || '',
  }))
  const wsRate = XLSX.utils.json_to_sheet(rateRows)
  XLSX.utils.book_append_sheet(wb, wsRate, 'Rate')

  // --- Riepilogo ---
  const totEntrate = (dati.movimenti || [])
    .filter(m => m.tipo === 'Entrata')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const totUscite = (dati.movimenti || [])
    .filter(m => m.tipo === 'Uscita')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)

  // Totali sponsor: gli stessi del Rendiconto
  const sp = riepilogoSponsor(dati.sponsor)
  const riepilogoRows = [
    { Voce: 'Entrate totali', Valore: totEntrate },
    { Voce: 'Uscite totali', Valore: totUscite },
    { Voce: 'Saldo', Valore: totEntrate - totUscite },
    { Voce: 'Sponsor attesi (confermati e incassati)', Valore: sp.attesi },
    { Voce: 'Sponsor incassati', Valore: sp.incassati },
    { Voce: 'Sponsor da incassare', Valore: sp.daIncassare },
    { Voce: 'Sponsor in trattativa (non conteggiati)', Valore: sp.trattativa },
  ]
  const wsRiep = XLSX.utils.json_to_sheet(riepilogoRows)
  XLSX.utils.book_append_sheet(wb, wsRiep, 'Riepilogo')

  // Scarica
  const nome = `GRIFO_VI_Report_${oggiISO()}.xlsx`
  XLSX.writeFile(wb, nome)
}

// ============================================
// EXPORT PDF
// ============================================
export function esportaPDF(dati) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ratePdf = ratePerAcquisto(dati.pagamenti)

  // Titolo
  doc.setFontSize(20)
  doc.setTextColor(14, 165, 233)  // sky-500
  doc.text('GRIFO VI', 14, 18)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text('Report gestione economica corso', 14, 25)
  doc.setFontSize(9)
  doc.text('Generato il ' + new Date().toLocaleDateString('it-IT'), 14, 30)

  // Riepilogo
  const totEntrate = (dati.movimenti || [])
    .filter(m => m.tipo === 'Entrata')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const totUscite = (dati.movimenti || [])
    .filter(m => m.tipo === 'Uscita')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const saldo = totEntrate - totUscite
  // Totali sponsor: gli stessi del Rendiconto
  const sp = riepilogoSponsor(dati.sponsor)

  autoTable(doc, {
    startY: 36,
    head: [['Voce', 'Valore']],
    body: [
      ['Entrate totali', euro(totEntrate)],
      ['Uscite totali', euro(totUscite)],
      ['Saldo', euro(saldo)],
      ['Sponsor attesi (confermati e incassati)', euro(sp.attesi)],
      ['Sponsor incassati', euro(sp.incassati)],
      ['Sponsor da incassare', euro(sp.daIncassare)],
      ['Sponsor in trattativa (non conteggiati)', euro(sp.trattativa)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [14, 165, 233], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  })

  // Movimenti
  if ((dati.movimenti || []).length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo']],
      body: (dati.movimenti || []).map(m => [
        m.data || '',
        m.tipo || '',
        m.categoria || '',
        (m.descrizione || '').slice(0, 40),
        euro(m.importo),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [14, 165, 233], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      theme: 'striped',
      didDrawPage: () => {
        doc.setFontSize(10)
        doc.setTextColor(50, 50, 50)
        doc.text('Movimenti', 14, 12)
      },
    })
  }

  // Sponsor
  if ((dati.sponsor || []).length) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setTextColor(14, 165, 233)
    doc.text('Sponsor', 14, 18)
    autoTable(doc, {
      startY: 22,
      head: [['Nome', 'Referente', 'Stato', 'Promesso', 'Incassato']],
      body: (dati.sponsor || []).map(s => [
        (s.nome || '').slice(0, 30),
        (s.referente || '').slice(0, 25),
        s.stato || '',
        euro(s.importo_promesso),
        euro(incassatoDa(s)),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [14, 165, 233], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    })
  }

  // Acquisti
  if ((dati.acquisti || []).length) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setTextColor(14, 165, 233)
    doc.text('Acquisti', 14, 18)
    autoTable(doc, {
      startY: 22,
      head: [['Descrizione', 'Sezione', 'Stato', 'Importo', 'Rate pagate']],
      body: (dati.acquisti || []).map(a => [
        (a.descrizione || '').slice(0, 30),
        a.macro_sezione || 'ALTRO',
        a.stato || '',
        euro(a.importo_effettivo || a.importo_previsto),
        euro(ratePdf.get(a.id) || 0),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [14, 165, 233], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    })
  }

  const nome = `GRIFO_VI_Report_${oggiISO()}.pdf`
  doc.save(nome)
}