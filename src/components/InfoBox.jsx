import { useState, useEffect } from 'react'

export default function InfoBox({ id, titolo, children }) {
  const [aperto, setAperto] = useState(false)

  useEffect(() => {
    const chiuso = localStorage.getItem('infobox-' + id)
    if (chiuso !== 'true') setAperto(true)
  }, [id])

  function chiudi() {
    setAperto(false)
    localStorage.setItem('infobox-' + id, 'true')
  }

  function riapri() {
    setAperto(true)
    localStorage.removeItem('infobox-' + id)
  }

  if (!aperto) {
    return (
      <button
        onClick={riapri}
        className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1"
      >
        ❓ Come funziona questa sezione
      </button>
    )
  }

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-sky-700 font-bold mb-2">
            {titolo}
          </div>
          <div className="text-sm text-gray-700 leading-relaxed space-y-1">
            {children}
          </div>
        </div>
        <button
          onClick={chiudi}
          className="text-sky-700 hover:text-sky-900 text-xl leading-none shrink-0"
          title="Chiudi (non la rivedrai più)"
        >
          ×
        </button>
      </div>
    </div>
  )
}