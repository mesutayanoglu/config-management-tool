import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { useLanguage } from '../../i18n'
import { authApi } from '../../services/api'

const ROLE_BADGE = {
  super_administrator: { label: 'super admin', cls: 'bg-red-100 text-red-700' },
  admin: { label: 'admin', cls: 'bg-blue-100 text-blue-700' },
  read_only: { label: 'read only', cls: 'bg-slate-100 text-slate-600' },
}

const PAGE_TITLE_KEY = {
  '/': 'nav.dashboard',
  '/devices': 'nav.devices',
  '/configs': 'nav.configs',
  '/schedulers': 'nav.schedulers',
  '/organizations': 'nav.locations',
  '/settings': 'nav.settings',
}

export default function Navbar() {
  const { user, logout, setUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, toggle, t } = useLanguage()
  const [showProfile, setShowProfile] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const badge = user?.role ? ROLE_BADGE[user.role] : null
  const pageTitle = t(PAGE_TITLE_KEY[location.pathname] || 'nav.dashboard')
  const userInitial = user?.username?.charAt(0).toUpperCase() || '?'

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      {/* Page title */}
      <h2 className="text-sm font-semibold text-slate-800">{pageTitle}</h2>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <div
          onClick={toggle}
          title={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
          className="flex items-center bg-slate-100 rounded-full p-0.5 cursor-pointer select-none"
        >
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${lang === 'tr' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            TR
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${lang === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            EN
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* User info + avatar */}
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-800 leading-none">{user.username}</p>
              {badge && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowProfile(true)}
              title={t('navbar.editProfile')}
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              {userInitial}
            </button>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={t('common.logout')}
          className="text-slate-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onProfileSaved={(updated) => setUser({ ...user, username: updated.username })}
          t={t}
        />
      )}
    </header>
  )
}

function ProfileModal({ user, onClose, onProfileSaved, t }) {
  const [profile, setProfile] = useState({ username: user?.username || '', email: '' })
  const [profileMsg, setProfileMsg] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)
  const [savingPwd, setSavingPwd] = useState(false)

  const isSuperAdmin = user?.role === 'super_administrator'

  useEffect(() => {
    authApi.getMe().then(({ data }) => {
      setProfile({ username: data.username, email: data.email || '' })
    }).catch(() => {})
  }, [])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      await authApi.updateProfile(user.id, { username: profile.username, email: profile.email })
      onProfileSaved({ username: profile.username })
      setProfileMsg({ type: 'success', text: t('navbar.profile.saveOk') })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || t('navbar.profile.saveFail') })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSavePwd(e) {
    e.preventDefault()
    if (pwdForm.new_password !== pwdForm.confirm) {
      setPwdMsg({ type: 'error', text: t('navbar.profile.pwdMismatch') })
      return
    }
    setSavingPwd(true)
    setPwdMsg(null)
    try {
      const body = { new_password: pwdForm.new_password }
      if (!isSuperAdmin) body.current_password = pwdForm.current_password
      await authApi.updatePassword(user.id, body)
      setPwdMsg({ type: 'success', text: t('navbar.profile.pwdOk') })
      setPwdForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.detail || t('navbar.profile.pwdFail') })
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{t('navbar.profile.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Profil Bilgileri */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              {t('navbar.profile.profileSection')}
            </p>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.admin.username')}</label>
                <input
                  type="text"
                  value={profile.username}
                  onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.admin.email')}</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  placeholder={t('common.optional')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {profileMsg && (
                <p className={`text-xs ${profileMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {profileMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingProfile ? t('common.saving') : t('common.save')}
              </button>
            </form>
          </div>

          <hr className="border-gray-100" />

          {/* Şifre Değiştir */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              {t('navbar.profile.passwordSection')}
            </p>
            {isSuperAdmin && (
              <p className="text-xs text-gray-400 mb-3">{t('navbar.profile.superAdminNote')}</p>
            )}
            <form onSubmit={handleSavePwd} className="space-y-3">
              {!isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('navbar.profile.currentPwd')}</label>
                  <input
                    type="password"
                    value={pwdForm.current_password}
                    onChange={(e) => setPwdForm((p) => ({ ...p, current_password: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('navbar.profile.newPwd')}</label>
                <input
                  type="password"
                  value={pwdForm.new_password}
                  onChange={(e) => setPwdForm((p) => ({ ...p, new_password: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('navbar.profile.confirmPwd')}</label>
                <input
                  type="password"
                  value={pwdForm.confirm}
                  onChange={(e) => setPwdForm((p) => ({ ...p, confirm: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {pwdMsg && (
                <p className={`text-xs ${pwdMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {pwdMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={savingPwd}
                className="w-full bg-gray-800 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                {savingPwd ? t('common.saving') : t('navbar.profile.passwordSection')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
