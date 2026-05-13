import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { useLanguage } from '../../i18n'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { lang, toggle, t } = useLanguage()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-4">
      {/* Dil Değiştirici */}
      <div
        onClick={toggle}
        title={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
        className="flex items-center bg-gray-100 rounded-full p-0.5 cursor-pointer select-none"
      >
        <span className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${lang === 'tr' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
          TR
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${lang === 'en' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
          EN
        </span>
      </div>

      {user && (
        <span className="text-sm text-gray-600">
          {user.username}
          {user.is_admin && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">admin</span>
          )}
        </span>
      )}
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
      >
        {t('common.logout')}
      </button>
    </header>
  )
}
