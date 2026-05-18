import { useState, useCallback } from 'react'

const STORAGE_KEY = 'credential_profiles'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function persist(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

export default function useCredentialProfiles() {
  const [profiles, setProfiles] = useState(load)

  const add = useCallback((name, ssh_username, ssh_password) => {
    setProfiles(prev => {
      const next = [...prev, { id: crypto.randomUUID(), name, ssh_username, ssh_password }]
      persist(next)
      return next
    })
  }, [])

  const update = useCallback((id, data) => {
    setProfiles(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...data } : p)
      persist(next)
      return next
    })
  }, [])

  const remove = useCallback((id) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id)
      persist(next)
      return next
    })
  }, [])

  return { profiles, add, update, remove }
}
