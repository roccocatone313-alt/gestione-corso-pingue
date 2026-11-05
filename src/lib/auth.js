import { createContext, useContext } from 'react'

// Stato dell'accesso, condiviso da tutto il sito (vedi components/AuthProvider.jsx).
export const AuthContext = createContext({
  pronto: false,
  utente: null,
  puoModificare: false,
  ricarica: async () => false,
  esci: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
