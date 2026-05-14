import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      isSuperAdmin: () => get().user?.role === 'super_administrator',
      isReadOnly: () => get().user?.role === 'read_only',
    }),
    { name: 'auth-storage' }
  )
)

export default useAuthStore
