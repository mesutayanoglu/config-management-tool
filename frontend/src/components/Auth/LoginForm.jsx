import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../services/api'
import useAuthStore from '../../store/authStore'

const CMT_LOGO = (
  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-md">
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  </div>
)

export default function LoginForm() {
  const [step, setStep] = useState('credentials') // 'credentials' | 'setup' | 'verify'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [tempToken, setTempToken] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const codeInputRef = useRef(null)

  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if ((step === 'verify' || step === 'setup') && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [step])

  function finishLogin(data) {
    setToken(data.access_token)
    setUser({ id: data.user.id, username: data.user.username, role: data.user.role })
    navigate('/')
  }

  async function handleCredentials(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login({ username, password })

      if (data.status === 'mfa_required') {
        setTempToken(data.temp_token)
        setStep('verify')
      } else if (data.status === 'mfa_setup_required') {
        setTempToken(data.temp_token)
        // Fetch QR code immediately
        const setupRes = await authApi.mfaSetup(data.temp_token)
        setQrDataUrl(setupRes.data.qr_data_url)
        setStep('setup')
      } else if (data.access_token) {
        finishLogin(data)
      }
    } catch {
      setError('Kullanıcı adı veya şifre hatalı.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.mfaVerify(tempToken, code)
      finishLogin(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Geçersiz doğrulama kodu.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnable(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.mfaEnable(tempToken, code)
      finishLogin(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Geçersiz doğrulama kodu.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  function handleCodeInput(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
  }

  if (step === 'verify') {
    return (
      <div className="w-80">
        <div className="flex flex-col items-center mb-8">
          {CMT_LOGO}
          <h1 className="text-xl font-semibold text-slate-800">İki Faktörlü Doğrulama</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Authenticator uygulamanızdaki 6 haneli kodu girin
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Doğrulama Kodu</label>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleCodeInput}
              required
              placeholder="000000"
              maxLength={6}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center tracking-[0.4em] text-lg font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </button>

          <p className="text-center text-xs text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => { setStep('credentials'); setCode(''); setError(''); setTempToken(null) }}
              className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
            >
              ← Geri dön
            </button>
          </p>
        </form>
      </div>
    )
  }

  if (step === 'setup') {
    return (
      <div className="w-80">
        <div className="flex flex-col items-center mb-6">
          {CMT_LOGO}
          <h1 className="text-xl font-semibold text-slate-800">MFA Kurulumu</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Hesabınızı güvenli hale getirmek için kimlik doğrulayıcı uygulaması kurun
          </p>
        </div>

        <form onSubmit={handleEnable} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Adım 1 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Adım 1 — Uygulamayı İndirin
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Telefonunuza{' '}
              <span className="font-medium text-slate-700">Google Authenticator</span>{' '}
              veya{' '}
              <span className="font-medium text-slate-700">Microsoft Authenticator</span>{' '}
              uygulamasını indirin.
            </p>
          </div>

          {/* Adım 2 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Adım 2 — QR Kodu Tarayın
            </p>
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="MFA QR Kodu"
                  className="w-44 h-44 rounded-lg border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="w-44 h-44 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <span className="text-xs text-slate-400">Yükleniyor...</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 text-center">
              QR kodu uygulamada "Hesap ekle" → "QR kodu tara" ile okutun
            </p>
          </div>

          {/* Adım 3 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Adım 3 — Kodu Doğrulayın
            </p>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleCodeInput}
              required
              placeholder="000000"
              maxLength={6}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center tracking-[0.4em] text-lg font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Doğrulanıyor...' : 'MFA\'yı Etkinleştir ve Giriş Yap'}
          </button>

          <p className="text-center text-xs text-slate-500">
            <button
              type="button"
              onClick={() => { setStep('credentials'); setCode(''); setError(''); setTempToken(null); setQrDataUrl(null) }}
              className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
            >
              ← Geri dön
            </button>
          </p>
        </form>
      </div>
    )
  }

  // step === 'credentials'
  return (
    <div className="w-80">
      <div className="flex flex-col items-center mb-8">
        {CMT_LOGO}
        <h1 className="text-xl font-semibold text-slate-800">Config<strong>Management</strong>Tool</h1>
        <p className="text-sm text-slate-500 mt-1">Hesabınıza giriş yapın</p>
      </div>

      <form onSubmit={handleCredentials} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Kullanıcı Adı</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>

        <p className="text-center text-xs text-slate-500 pt-1">
          <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
            Şifremi Unuttum
          </Link>
        </p>
      </form>
    </div>
  )
}
