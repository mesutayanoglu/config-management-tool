import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../services/api'
import useAuthStore from '../../store/authStore'

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login({ username, password })
      setToken(data.access_token)
      // user bilgisi login response'ından direkt gelir (role dahil)
      setUser({ id: data.user.id, username: data.user.username, role: data.user.role })
      navigate('/')
    } catch {
      setError('Kullanıcı adı veya şifre hatalı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-80">
      <h1 className="text-2xl font-bold text-gray-800 text-center">Giriş Yap</h1>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
      </button>
      <p className="text-center text-sm text-gray-500">
        <Link to="/forgot-password" className="text-blue-600 hover:underline">
          Şifremi Unuttum
        </Link>
      </p>
    </form>
  )
}
