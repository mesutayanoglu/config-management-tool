import { useState, useEffect, useCallback } from 'react'
import { credentialProfilesApi } from '../services/api'

export default function useCredentialProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { data } = await credentialProfilesApi.list()
      setProfiles(data)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const add = useCallback(async (profileData) => {
    const { data } = await credentialProfilesApi.create(profileData)
    setProfiles(prev => [...prev, data])
    return data
  }, [])

  const update = useCallback(async (id, profileData) => {
    const { data } = await credentialProfilesApi.update(id, profileData)
    setProfiles(prev => prev.map(p => p.id === id ? data : p))
    return data
  }, [])

  const remove = useCallback(async (id) => {
    await credentialProfilesApi.remove(id)
    setProfiles(prev => prev.filter(p => p.id !== id))
  }, [])

  return { profiles, loading, reload, add, update, remove }
}
