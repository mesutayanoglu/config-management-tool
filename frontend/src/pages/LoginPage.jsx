import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import LoginForm from '../components/Auth/LoginForm'
import Toast from '../components/Toast'

export default function LoginPage() {
  const location = useLocation()
  const [showResetToast, setShowResetToast] = useState(location.state?.resetSuccess === true)

  useEffect(() => {
    if (location.state?.resetSuccess) {
      window.history.replaceState({}, document.title)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white px-10 py-10 rounded-2xl shadow-modal border border-slate-100">
        <LoginForm />
      </div>
      {showResetToast && (
        <Toast
          message="Şifreniz sıfırlanmıştır."
          position="center"
          onClose={() => setShowResetToast(false)}
        />
      )}
    </div>
  )
}
