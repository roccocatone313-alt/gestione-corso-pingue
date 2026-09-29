import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ============================================
// Utility
// ============================================

function oggiISO() {
  return new Date().toISOString().slice(0, 10)
}

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

// ============================================
// EXPORT EXCEL
// ============================================
// dati = { movimenti: [...], sponsor: [...], acquisti: [...], budget: [...], scadenze: [...] }
export function esportaExcel(dati) {
  const wb = XLSX.utils.book_new()

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
    'Importo incassato': Number(s.importo_incassato) || 0,
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
    Stato: a.stato || '',
    'Data ordine': a.data_ordine || '',
    'Data pagamento': a.data_pagamento || '',
    Note: a.note || '',
  }))
  const wsAc = XLSX.utils.json_to_sheet(acRows)
  XLSX.utils.book_append_sheet(wb, wsAc, 'Acquisti')

  // --- Budget (con consuntivo calcolato dai movimenti) ---
  const budgetRows = (dati.budget || []).map(b => {
    const consuntivo = (dati.movimenti || [])
      .filter(m => m.tipo === 'Uscita' && m.categoria === b.voce)
      .reduce((s, m) => s + (Number(m.importo) || 0), 0)
    return {
      Voce: b.voce || '',
      Categoria: b.categoria || '',
      Preventivato: Number(b.preventivato) || 0,
      Consuntivo: consuntivo,
      Disponibile: (Number(b.preventivato) || 0) - consuntivo,
      Note: b.note || '',
    }
  })
  const wsBud = XLSX.utils.json_to_sheet(budgetRows)
  XLSX.utils.book_append_sheet(wb, wsBud, 'Budget')

  // --- Scadenze ---
  const scRows = (dati.scadenze || []).map(s => ({
    ID: s.id,
    Data: s.data || '',
    Tipo: s.tipo || '',
    Descrizione: s.descrizione || '',
    Categoria: s.categoria || '',
    Importo: Number(s.importo) || 0,
    Responsabile: s.responsabile || '',
    Stato: s.stato || '',
    Note: s.note || '',
  }))
  const wsSc = XLSX.utils.json_to_sheet(scRows)
  XLSX.utils.book_append_sheet(wb, wsSc, 'Scadenze')

  // --- Riepilogo ---
  const totEntrate = (dati.movimenti || [])
    .filter(m => m.tipo === 'Entrata')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)
  const totUscite = (dati.movimenti || [])
    .filter(m => m.tipo === 'Uscita')
    .reduce((s, m) => s + (Number(m.importo) || 0), 0)

  const riepilogoRows = [
    { Voce: 'Entrate totali', Valore: totEntrate },
    { Voce: 'Uscite totali', Valore: totUscite },
    { Voce: 'Saldo', Valore: totEntrate - totUscite },
    { Voce: 'Sponsor promesso', Valore: (dati.sponsor || []).reduce((s, x) => s + (Number(x.importo_promesso) || 0), 0) },
    { Voce: 'Sponsor incassato', Valore: (dati.sponsor || []).reduce((s, x) => s + (Number(x.importo_incassato) || 0), 0) },
    { Voce: 'Budget preventivato', Valore: (dati.budget || []).reduce((s, x) => s + (Number(x.preventivato) || 0), 0) },
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
  const spProm = (dati.sponsor || []).reduce((s, x) => s + (Number(x.importo_promesso) || 0), 0)
  const spInc  = (dati.sponsor || []).reduce((s, x) => s + (Number(x.importo_incassato) || 0), 0)
  const budPrev = (dati.budget || []).reduce((s, x) => s + (Number(x.preventivato) || 0), 0)

  autoTable(doc, {
    startY: 36,
    head: [['Voce', 'Valore']],
    body: [
      ['Entrate totali', euro(totEntrate)],
      ['Uscite totali', euro(totUscite)],
      ['Saldo', euro(saldo)],
      ['Sponsor promesso', euro(spProm)],
      ['Sponsor incassato', euro(spInc)],
      ['Sponsor da incassare', euro(spProm - spInc)],
      ['Budget preventivato', euro(budPrev)],
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
        euro(s.importo_incassato),
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
      head: [['Descrizione', 'Fornitore', 'Categoria', 'Stato', 'Previsto']],
      body: (dati.acquisti || []).map(a => [
        (a.descrizione || '').slice(0, 30),
        (a.fornitore || '').slice(0, 20),
        a.categoria || '',
        a.stato || '',
        euro(a.importo_previsto),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [14, 165, 233], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    })
  }

  // Budget
  if ((dati.budget || []).length) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setTextColor(14, 165, 233)
    doc.text('Budget', 14, 18)
    const budgetBody = (dati.budget || []).map(b => {
      const consuntivo = (dati.movimenti || [])
        .filter(m => m.tipo === 'Uscita' && m.categoria === b.voce)
        .reduce((s, m) => s + (Number(m.importo) || 0), 0)
      const disp = (Number(b.preventivato) || 0) - consuntivo
      return [
        (b.voce || '').slice(0, 25),
        b.categoria || '',
        euro(b.preventivato),
        euro(consuntivo),
        euro(disp),
      ]
    })
    autoTable(doc, {
      startY: 22,
      head: [['Voce', 'Categoria', 'Preventivato', 'Consuntivo', 'Disponibile']],
      body: budgetBody,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [14, 165, 233], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      theme: 'striped',
    })
  }

  // Scadenze
  if ((dati.scadenze || []).length) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setTextColor(14, 165, 233)
    doc.text('Scadenze', 14, 18)
    autoTable(doc, {
      startY: 22,
      head: [['Data', 'Tipo', 'Descrizione', 'Responsabile', 'Stato']],
      body: (dati.scadenze || []).map(s => [
        s.data || '',
        s.tipo || '',
        (s.descrizione || '').slice(0, 30),
        (s.responsabile || '').slice(0, 20),
        s.stato || '',
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