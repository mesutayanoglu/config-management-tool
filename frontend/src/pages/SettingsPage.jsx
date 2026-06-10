import { useEffect, useState } from 'react'
import { settingsApi, authApi, credentialProfilesApi } from '../services/api'
import { useLanguage } from '../i18n'
import useAuthStore from '../store/authStore'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'

export default function SettingsPage() {
  const { t } = useLanguage()
  const { isSuperAdmin, isReadOnly } = useAuthStore()
  const [form, setForm] = useState({ github_token: '', github_repo: '' })
  const [saved, setSaved] = useState(null)
  const [toast, setToast] = useState(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [repoInfo, setRepoInfo] = useState(null)
  const [showAdminCreate, setShowAdminCreate] = useState(false)
  const [showProfileCreate, setShowProfileCreate] = useState(false)

  const isConnected = saved?.github_token === '***' && saved?.github_repo

  useEffect(() => {
    settingsApi.get().then(({ data }) => {
      setSaved(data)
      setForm({ github_token: '', github_repo: data.github_repo || '' })
    }).catch(() => {})

    if (!isReadOnly()) {
      settingsApi.testGithub().then(({ data }) => {
        setRepoInfo(data)
        setTestResult('ok')
      }).catch(() => {
        setRepoInfo(null)
      })
    }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.save(form)
      const { data } = await settingsApi.get()
      setSaved(data)
      setHasSaved(true)
      setTestResult(null)
      setRepoInfo(null)
      setForm((p) => ({ ...p, github_token: '' }))
      setToast({ message: t('settings.toast.saved'), type: 'success' })
    } catch {
      setToast({ message: t('settings.toast.saveFail'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await settingsApi.testGithub()
      setRepoInfo(data)
      setTestResult('ok')
      setHasSaved(false)
      setToast({ message: `${t('settings.toast.connOk')} ${data.repo}`, type: 'success' })
    } catch {
      setRepoInfo(null)
      setTestResult('fail')
      setToast({ message: t('settings.toast.connFail'), type: 'error' })
    } finally {
      setTesting(false)
    }
  }

  const connStatus =
    testResult === 'ok' ? 'connected'
    : testResult === 'fail' ? 'error'
    : isConnected ? 'connected'
    : 'none'

  const connPill =
    connStatus === 'connected' ? { color: 'green', label: t('settings.connected') }
    : connStatus === 'error' ? { color: 'red', label: t('settings.error') }
    : { color: 'gray', label: t('settings.noConn') }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 pb-5 border-b border-gray-200">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sistem yapılandırması ve yönetim ayarları</p>
        </div>
      </div>

      {/* ── Section 1: Integrations ── */}
      <SectionCard
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        }
        title={t('settings.sectionIntegrations')}
        description="Harici servis bağlantıları ve API entegrasyonları"
      >
        <div className="p-6">
          {/* GitHub sub-header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-gray-900 flex items-center justify-center flex-shrink-0">
                <GitHubIcon className="w-4 h-4 fill-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{t('settings.githubConn')}</p>
                <p className="text-xs text-gray-400 mt-0.5">Config yedeklemesi için GitHub repository bağlantısı</p>
              </div>
            </div>
            <StatusPill color={connPill.color} label={connPill.label} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Setup Steps */}
            <div className="space-y-6">
              <Step n={1} done={isConnected} title={t('settings.step1Title')}>
                <p className="text-xs text-gray-500 leading-relaxed mt-1.5">
                  {t('settings.step1Desc')}
                  <br />
                  {t('settings.step1Perm')}{' '}
                  <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">
                    Contents — Read and Write
                  </span>
                </p>
              </Step>

              <Step n={2} done={hasSaved} title={t('settings.step2Title')}>
                <form onSubmit={handleSave} className="space-y-3 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.tokenLabel')}</label>
                    <input
                      type="password"
                      value={form.github_token}
                      onChange={(e) => { setForm((p) => ({ ...p, github_token: e.target.value })); setHasSaved(false) }}
                      placeholder={saved?.github_token === '***' ? t('settings.tokenPlaceholder') : 'ghp_xxxxxxxxxxxx'}
                      disabled={isReadOnly()}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.repoLabel')}</label>
                    <input
                      type="text"
                      value={form.github_repo}
                      onChange={(e) => { setForm((p) => ({ ...p, github_repo: e.target.value })); setHasSaved(false) }}
                      placeholder="username/config-backups"
                      disabled={isReadOnly()}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">{t('settings.repoHint')}</p>
                  </div>
                  {!isReadOnly() && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? t('common.saving') : t('common.save')}
                    </button>
                  )}
                </form>
              </Step>

              <Step n={3} done={testResult === 'ok'} fail={testResult === 'fail'} title={t('settings.step3Title')}>
                <p className="text-xs text-gray-500 mt-1.5 mb-3">
                  {hasSaved
                    ? t('settings.step3Saved')
                    : !isConnected
                    ? t('settings.step3NoConn')
                    : t('settings.step3HasConn')}
                </p>
                {!isReadOnly() && (
                  <>
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing || (!hasSaved && !isConnected)}
                      className="w-full border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {testing ? t('settings.testing') : t('settings.testBtn')}
                    </button>
                    {!hasSaved && !isConnected && (
                      <p className="text-xs text-amber-600 mt-2">{t('settings.savePre')}</p>
                    )}
                  </>
                )}
              </Step>
            </div>

            {/* Connected Account Panel */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {t('settings.connectedAccounts')}
              </p>
              {repoInfo ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                        <GitHubIcon className="w-5 h-5 fill-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-800 truncate">{repoInfo.repo}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${repoInfo.private ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                            {repoInfo.private ? t('settings.private') : t('settings.public')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{t('settings.repoDesc')}</p>
                        <a
                          href={`https://github.com/${repoInfo.repo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-0.5"
                        >
                          {t('settings.viewOnGithub')}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        <span className="text-xs text-green-600 font-medium">{t('settings.active')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-y divide-gray-100">
                    <InfoTile label={t('settings.tilePlatform')} value="GitHub" />
                    <InfoTile label={t('settings.tileStatus')} value={t('settings.connected')} valueClass="text-green-600" />
                    <InfoTile label={t('settings.tileRepo')} value={repoInfo.private ? t('settings.private') : t('settings.public')} />
                    <InfoTile label={t('settings.tileUsage')} value={t('settings.tileUsageVal')} />
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <GitHubIcon className="w-5 h-5 fill-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">{t('settings.noAccount')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('settings.noAccountHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Email / SMTP ── */}
      {!isReadOnly() && (
        <SectionCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          title={t('settings.sectionEmail')}
          description="Şifre sıfırlama ve sistem bildirimleri için giden e-posta yapılandırması"
        >
          <SmtpSection setToast={setToast} t={t} />
        </SectionCard>
      )}

      {/* ── Section 3: Notifications ── */}
      {!isReadOnly() && (
        <SectionCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
          title={t('settings.sectionNotifications')}
          description={t('settings.notify.description')}
        >
          <NotificationsSection setToast={setToast} t={t} />
        </SectionCard>
      )}

      {/* ── Section 4: Credential Profiles ── */}
      {!isReadOnly() && (
        <SectionCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          }
          title={t('credProfiles.title')}
          description={t('credProfiles.sectionDesc')}
          action={
            <button
              onClick={() => setShowProfileCreate(v => !v)}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                showProfileCreate
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showProfileCreate ? t('common.cancel') : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('credProfiles.addNew')}
                </>
              )}
            </button>
          }
        >
          <CredentialProfilesSection
            setToast={setToast}
            t={t}
            showCreate={showProfileCreate}
            setShowCreate={setShowProfileCreate}
          />
        </SectionCard>
      )}

      {/* ── Section 5: Administrators ── */}
      {!isReadOnly() && (
        <SectionCard
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
          title={t('settings.sectionAdministrators')}
          description="Kullanıcı hesapları ve erişim rol yönetimi"
          action={isSuperAdmin() && (
            <button
              onClick={() => setShowAdminCreate((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                showAdminCreate
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showAdminCreate ? t('common.cancel') : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('settings.admin.addUser')}
                </>
              )}
            </button>
          )}
        >
          <AdministratorsSection setToast={setToast} t={t} canManage={isSuperAdmin()} showCreate={showAdminCreate} setShowCreate={setShowAdminCreate} />
        </SectionCard>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ──────────────────────────────────────────────
// Section Card Wrapper
// ──────────────────────────────────────────────

function SectionCard({ icon, title, description, action, children }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md border border-gray-200 bg-white flex items-center justify-center flex-shrink-0 text-gray-500">
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ──────────────────────────────────────────────
// SMTP Section
// ──────────────────────────────────────────────

function SmtpSection({ setToast, t }) {
  const { user: currentUser } = useAuthStore()
  const [form, setForm] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
  })
  const [savedSmtp, setSavedSmtp] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isConfigured = !!(savedSmtp?.smtp_host && savedSmtp?.smtp_from)

  useEffect(() => {
    settingsApi.getSmtp().then(({ data }) => {
      setSavedSmtp(data)
      setForm({
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_password: '',
        smtp_from: data.smtp_from || '',
      })
    }).catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.saveSmtp(form)
      const { data } = await settingsApi.getSmtp()
      setSavedSmtp(data)
      setForm((p) => ({ ...p, smtp_password: '' }))
      setToast({ message: t('settings.smtp.toast.saved'), type: 'success' })
    } catch {
      setToast({ message: t('settings.smtp.toast.saveFail'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const { data } = await settingsApi.testSmtp()
      setToast({ message: `${t('settings.smtp.toast.testOk')} → ${data.sent_to}`, type: 'success' })
    } catch (err) {
      const detail = err.response?.data?.detail || t('settings.smtp.toast.testFail')
      setToast({ message: detail, type: 'error' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">{t('settings.smtp.subtitle')}</p>
            {isConfigured ? (
              <StatusPill color="green" label={t('settings.smtp.configured')} />
            ) : (
              <StatusPill color="gray" label={t('settings.smtp.notConfigured')} />
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.smtp.host')}</label>
                <input
                  type="text"
                  value={form.smtp_host}
                  onChange={(e) => setForm((p) => ({ ...p, smtp_host: e.target.value }))}
                  placeholder={t('settings.smtp.hostPlaceholder')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.smtp.port')}</label>
                <input
                  type="number"
                  value={form.smtp_port}
                  onChange={(e) => setForm((p) => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.smtp.user')}</label>
              <input
                type="text"
                value={form.smtp_user}
                onChange={(e) => setForm((p) => ({ ...p, smtp_user: e.target.value }))}
                placeholder={t('settings.smtp.userPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.smtp.password')}</label>
              <input
                type="password"
                value={form.smtp_password}
                onChange={(e) => setForm((p) => ({ ...p, smtp_password: e.target.value }))}
                placeholder={savedSmtp?.smtp_password === '***' ? t('settings.smtp.passwordPlaceholder') : ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.smtp.from')}</label>
              <input
                type="email"
                value={form.smtp_from}
                onChange={(e) => setForm((p) => ({ ...p, smtp_from: e.target.value }))}
                placeholder={t('settings.smtp.fromPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Row */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !isConfigured}
                className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {testing ? t('settings.smtp.testing') : t('settings.smtp.testBtn')}
              </button>
            </div>

            <p className="text-xs text-gray-400">{t('settings.smtp.testNote')}</p>
          </form>
        </div>

        {/* Gmail Guide Column */}
        <div className="lg:pt-9">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-blue-700">{t('settings.smtp.gmailTitle')}</p>
            </div>
            <ol className="text-xs text-blue-600 space-y-1.5 mb-3">
              <li>{t('settings.smtp.gmailStep1')}</li>
              <li>{t('settings.smtp.gmailStep2')}</li>
              <li>{t('settings.smtp.gmailStep3')}</li>
            </ol>
            <div className="bg-blue-100 rounded-md px-3 py-2 font-mono text-xs text-blue-800 space-y-0.5">
              <p>{t('settings.smtp.gmailHost')}</p>
              <p>{t('settings.smtp.gmailPort')}</p>
              <p>{t('settings.smtp.gmailUser')}</p>
              <p>{t('settings.smtp.gmailPass')}</p>
              <p>{t('settings.smtp.gmailFrom')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Administrators Section
// ──────────────────────────────────────────────

const ROLES = ['super_administrator', 'admin', 'read_only']

const ROLE_BADGE_CLS = {
  super_administrator: 'bg-red-100 text-red-700',
  admin: 'bg-blue-100 text-blue-700',
  read_only: 'bg-gray-100 text-gray-600',
}

function NotificationsSection({ setToast, t }) {
  const [form, setForm] = useState({ enabled: false, emails: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.getNotifications().then(({ data }) => {
      setForm({ enabled: data.enabled, emails: data.emails || '' })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.saveNotifications({ enabled: form.enabled, emails: form.emails })
      setToast({ message: t('settings.notify.saveOk'), type: 'success' })
    } catch {
      setToast({ message: t('settings.notify.saveFail'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 px-6 py-6">{t('common.loading')}</p>

  return (
    <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{t('settings.notify.enabled')}</p>
        </div>
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, enabled: !p.enabled }))}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            form.enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              form.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Email adresleri */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('settings.notify.emails')}
        </label>
        <input
          type="text"
          value={form.emails}
          onChange={e => setForm(p => ({ ...p, emails: e.target.value }))}
          placeholder={t('settings.notify.emailsPlaceholder')}
          disabled={!form.enabled}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:bg-gray-50"
        />
        <p className="text-xs text-gray-400 mt-1">{t('settings.notify.emailsHint')}</p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="text-sm bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}


function AdministratorsSection({ setToast, t, canManage, showCreate, setShowCreate }) {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createForm, setCreateForm] = useState({ username: '', password: '', email: '', role: 'admin' })
  const [creating, setCreating] = useState(false)
  const [passwordModal, setPasswordModal] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [resettingMfaId, setResettingMfaId] = useState(null)

  async function loadUsers() {
    try {
      const { data } = await authApi.listUsers()
      setUsers(data)
    } catch {
      setToast({ message: t('settings.admin.loadError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      await authApi.createUser(createForm)
      setToast({ message: t('settings.admin.createOk'), type: 'success' })
      setCreateForm({ username: '', password: '', email: '', role: 'admin' })
      setShowCreate(false)
      loadUsers()
    } catch (err) {
      const detail = err.response?.data?.detail || t('settings.admin.createFail')
      setToast({ message: detail, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await authApi.updateRole(userId, { role: newRole })
      setToast({ message: t('settings.admin.roleOk'), type: 'success' })
      loadUsers()
    } catch (err) {
      const detail = err.response?.data?.detail || t('settings.admin.roleFail')
      setToast({ message: detail, type: 'error' })
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setChangingPwd(true)
    try {
      await authApi.updatePassword(passwordModal.userId, { new_password: newPassword })
      setToast({ message: t('settings.admin.pwdOk'), type: 'success' })
      setPasswordModal(null)
      setNewPassword('')
    } catch (err) {
      const detail = err.response?.data?.detail || t('settings.admin.pwdFail')
      setToast({ message: detail, type: 'error' })
    } finally {
      setChangingPwd(false)
    }
  }

  async function handleDelete(userId) {
    try {
      await authApi.deleteUser(userId)
      setToast({ message: t('settings.admin.deleteOk'), type: 'success' })
      setDeleteConfirm(null)
      loadUsers()
    } catch (err) {
      const detail = err.response?.data?.detail || t('settings.admin.deleteFail')
      setToast({ message: detail, type: 'error' })
    }
  }

  async function handleMfaReset(userId) {
    setResettingMfaId(userId)
    try {
      await authApi.mfaResetUser(userId)
      setToast({ message: t('settings.admin.mfaResetOk'), type: 'success' })
      loadUsers()
    } catch (err) {
      const detail = err.response?.data?.detail || t('settings.admin.mfaResetFail')
      setToast({ message: detail, type: 'error' })
    } finally {
      setResettingMfaId(null)
    }
  }

  return (
    <div>

      {/* Create Form */}
      {canManage && showCreate && (
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 mb-4">{t('settings.admin.newUser')}</p>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.admin.username')}</label>
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.admin.password')}</label>
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('settings.admin.email')}{' '}
                <span className="text-gray-400 font-normal">({t('common.optional')})</span>
              </label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.admin.role')}</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{t(`settings.admin.role.${r}`)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {creating ? t('common.saving') : t('settings.admin.createBtn')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Table */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">{t('common.loading')}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">{t('settings.admin.empty')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('settings.admin.colUsername')}
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('settings.admin.colRole')}
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('settings.admin.colEmail')}
              </th>
              <th className="px-6 py-3 w-36"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-gray-600 uppercase">
                        {u.username.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-gray-800">{u.username}</span>
                    {u.id === currentUser?.id && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                        {t('settings.admin.you')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  {canManage ? (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="text-xs text-gray-700 px-2.5 py-1 rounded-md border border-gray-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`settings.admin.role.${r}`)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-700 px-2.5 py-1 rounded-md border border-gray-200 bg-white">
                      {t(`settings.admin.role.${u.role}`)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3.5 text-gray-500 text-xs">
                  {u.email || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-6 py-3.5">
                  {canManage && (
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => { setPasswordModal({ userId: u.id, username: u.username }); setNewPassword('') }}
                        className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-medium whitespace-nowrap"
                      >
                        {t('settings.admin.changePassword')}
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteConfirm({ id: u.id, username: u.username })}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                        >
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 border border-gray-200">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{t('settings.admin.changePassword')}</h3>
                <p className="text-xs text-gray-400">{passwordModal.username}</p>
              </div>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.admin.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setPasswordModal(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={changingPwd}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {changingPwd ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <ConfirmModal
          title={t('settings.admin.deleteTitle')}
          message={`"${deleteConfirm.username}" ${t('settings.admin.deleteMsg')}`}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Credential Profiles Section
// ──────────────────────────────────────────────

const KEX_ALGS = [
  { name: 'curve25519-sha256', legacy: false },
  { name: 'curve25519-sha256@libssh.org', legacy: false },
  { name: 'ecdh-sha2-nistp256', legacy: false },
  { name: 'ecdh-sha2-nistp384', legacy: false },
  { name: 'ecdh-sha2-nistp521', legacy: false },
  { name: 'diffie-hellman-group16-sha512', legacy: false },
  { name: 'diffie-hellman-group14-sha256', legacy: false },
  { name: 'diffie-hellman-group-exchange-sha256', legacy: false },
  { name: 'diffie-hellman-group14-sha1', legacy: true },
  { name: 'diffie-hellman-group-exchange-sha1', legacy: true },
  { name: 'diffie-hellman-group1-sha1', legacy: true },
]

const HOST_KEY_ALGS = [
  { name: 'ssh-ed25519', legacy: false },
  { name: 'ecdsa-sha2-nistp256', legacy: false },
  { name: 'ecdsa-sha2-nistp384', legacy: false },
  { name: 'ecdsa-sha2-nistp521', legacy: false },
  { name: 'rsa-sha2-512', legacy: false },
  { name: 'rsa-sha2-256', legacy: false },
  { name: 'ssh-rsa', legacy: true },
  { name: 'ssh-dss', legacy: true },
]

const CIPHER_ALGS = [
  { name: 'aes256-ctr', legacy: false },
  { name: 'aes192-ctr', legacy: false },
  { name: 'aes128-ctr', legacy: false },
  { name: 'aes256-gcm@openssh.com', legacy: false },
  { name: 'aes128-gcm@openssh.com', legacy: false },
  { name: 'chacha20-poly1305@openssh.com', legacy: false },
  { name: '3des-cbc', legacy: true },
]

const DEFAULT_KEX = KEX_ALGS.filter(a => !a.legacy).map(a => a.name)
const DEFAULT_HOST_KEY = HOST_KEY_ALGS.filter(a => !a.legacy).map(a => a.name)
const DEFAULT_CIPHER = CIPHER_ALGS.filter(a => !a.legacy).map(a => a.name)

function emptyProfileForm(connType = 'ssh') {
  return {
    name: '',
    description: '',
    connection_type: connType,
    username: '',
    password: '',
    port: connType === 'telnet' ? 23 : 22,
    enable_secret: '',
    kex_algs: DEFAULT_KEX,
    host_key_algs: DEFAULT_HOST_KEY,
    cipher_algs: DEFAULT_CIPHER,
  }
}

function CredentialProfilesSection({ setToast, t, showCreate, setShowCreate }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyProfileForm())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showAlgos, setShowAlgos] = useState(false)

  // showCreate header butonunu da kontrol eder: true=form açık, false=kapalı
  const showForm = showCreate

  async function load() {
    try {
      const { data } = await credentialProfilesApi.list()
      setProfiles(data)
    } catch {
      setToast({ message: t('credProfiles.toast.error'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Header "İptal" → showCreate=false → editingId ve formu temizle
  useEffect(() => {
    if (!showCreate) {
      setEditingId(null)
      setForm(emptyProfileForm())
      setShowAlgos(false)
    }
  }, [showCreate])

  function startEdit(p) {
    setEditingId(p.id)
    setShowCreate(true)  // header butonu "İptal" göstersin
    setForm({
      name: p.name || '',
      description: p.description || '',
      connection_type: p.connection_type || 'ssh',
      username: p.username || '',
      password: '',
      port: p.port ?? 22,
      enable_secret: '',
      kex_algs: p.kex_algs ?? DEFAULT_KEX,
      host_key_algs: p.host_key_algs ?? DEFAULT_HOST_KEY,
      cipher_algs: p.cipher_algs ?? DEFAULT_CIPHER,
    })
    setShowAlgos(false)
  }

  function resetForm() {
    setShowCreate(false)  // useEffect geri kalanı temizler
  }

  function setConnType(ct) {
    setForm(prev => ({
      ...prev,
      connection_type: ct,
      port: (prev.port === 22 && ct === 'telnet') ? 23
           : (prev.port === 23 && ct === 'ssh') ? 22
           : prev.port,
    }))
  }

  function toggleAlg(field, name) {
    setForm(prev => {
      const list = prev[field] || []
      return { ...prev, [field]: list.includes(name) ? list.filter(a => a !== name) : [...list, name] }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const isSsh = form.connection_type === 'ssh'
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        connection_type: form.connection_type,
        username: form.username,
        password: form.password || undefined,
        port: parseInt(form.port) || (isSsh ? 22 : 23),
        enable_secret: form.enable_secret || null,
        kex_algs: isSsh && form.kex_algs.length ? form.kex_algs : null,
        host_key_algs: isSsh && form.host_key_algs.length ? form.host_key_algs : null,
        cipher_algs: isSsh && form.cipher_algs.length ? form.cipher_algs : null,
      }
      if (editingId) {
        if (!payload.password) delete payload.password
        await credentialProfilesApi.update(editingId, payload)
        setToast({ message: t('credProfiles.toast.updated'), type: 'success' })
      } else {
        if (!payload.password) { setToast({ message: t('credProfiles.toast.error'), type: 'error' }); setSaving(false); return }
        await credentialProfilesApi.create(payload)
        setToast({ message: t('credProfiles.toast.created'), type: 'success' })
      }
      resetForm()
      await load()
    } catch (err) {
      const detail = err?.response?.data?.detail || t('credProfiles.toast.error')
      setToast({ message: detail, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await credentialProfilesApi.remove(id)
      setToast({ message: t('credProfiles.toast.deleted'), type: 'success' })
      setDeleteConfirm(null)
      resetForm()
      await load()
    } catch (err) {
      const detail = err?.response?.data?.detail || t('credProfiles.toast.error')
      setToast({ message: detail, type: 'error' })
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
  const isSsh = form.connection_type === 'ssh'

  return (
    <div>
      {/* ── Form (create / edit) — sadece açıkken göster ── */}
      {showForm && (
        <div className="border-b border-gray-200">

          {/* Form sub-header: başlık + SSH/Telnet sekmeleri */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">
              {editingId ? t('credProfiles.editHint') : t('credProfiles.addNew')}
            </span>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
                <button type="button" onClick={() => setConnType('ssh')}
                  className={`px-4 py-1.5 transition-colors ${isSsh ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  SSH
                </button>
                <button type="button" onClick={() => setConnType('telnet')}
                  className={`px-4 py-1.5 border-l border-gray-300 transition-colors ${!isSsh ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  Telnet
                </button>
              </div>
              {editingId && (
                <button onClick={() => setDeleteConfirm({ id: editingId, name: form.name })}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>

          {/* Telnet uyarısı */}
          {!isSsh && (
            <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-50 border-b border-amber-100">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700">{t('credProfiles.telnetNote')}</p>
            </div>
          )}

          {/* Form alanları */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('credProfiles.profileName')} <span className="text-red-500">*</span></label>
                <input type="text" required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isSsh ? 'SSH Port' : 'Telnet Port'}</label>
                <input type="number" min="1" max="65535" value={form.port}
                  onChange={e => setForm(p => ({ ...p, port: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>{t('credProfiles.description')}</label>
              <input type="text" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder={t('credProfiles.descPlaceholder')} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('credProfiles.username')} <span className="text-red-500">*</span></label>
                <input type="text" required value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  {t('credProfiles.password')}
                  {editingId
                    ? <span className="text-gray-400 font-normal ml-1">({t('common.optional')})</span>
                    : <span className="text-red-500"> *</span>}
                </label>
                <input type="password" required={!editingId} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={editingId ? t('editModal.passwordPlaceholder') : ''} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                {t('credProfiles.enableSecret')}
                <span className="text-gray-400 font-normal ml-1">({t('common.optional')})</span>
              </label>
              <input type="password" value={form.enable_secret}
                onChange={e => setForm(p => ({ ...p, enable_secret: e.target.value }))}
                placeholder={editingId ? t('editModal.passwordPlaceholder') : ''} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">{t('credProfiles.enableSecretHint')}</p>
            </div>

            {/* SSH Algoritmaları — sadece SSH'ta */}
            {isSsh && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowAlgos(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <span className="text-sm font-medium text-gray-700">{t('credProfiles.sshAlgos')}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showAlgos ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAlgos && (
                  <div className="p-4 space-y-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400">{t('credProfiles.algosHint')}</p>
                    <AlgGroup label={t('credProfiles.kexAlgos')} algs={KEX_ALGS} selected={form.kex_algs} onToggle={name => toggleAlg('kex_algs', name)} />
                    <AlgGroup label={t('credProfiles.hostKeyAlgos')} algs={HOST_KEY_ALGS} selected={form.host_key_algs} onToggle={name => toggleAlg('host_key_algs', name)} />
                    <AlgGroup label={t('credProfiles.cipherAlgos')} algs={CIPHER_ALGS} selected={form.cipher_algs} onToggle={name => toggleAlg('cipher_algs', name)} />
                  </div>
                )}
              </div>
            )}

            {/* Butonlar — sağ hizalı */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={resetForm}
                className="border border-gray-300 text-gray-600 px-5 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Kayıtlı Profiller listesi ── */}
      <div className="px-6 py-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('credProfiles.savedProfiles')}
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">{t('common.loading')}</p>
        ) : profiles.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg py-10 text-center">
            <p className="text-sm text-gray-400">{t('credProfiles.empty')}</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('credProfiles.profileName')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('credProfiles.colType')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('credProfiles.colUser')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('credProfiles.colPort')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enable</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profiles.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${editingId === p.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        (p.connection_type || 'ssh') === 'ssh' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {(p.connection_type || 'ssh').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.username}</td>
                    <td className="px-4 py-3 text-gray-600">{p.port}</td>
                    <td className="px-4 py-3">
                      {p.enable_secret
                        ? <span className="text-xs text-green-600 font-medium">✓</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(p)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        {t('credProfiles.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <ConfirmModal
          title={t('credProfiles.deleteTitle')}
          message={`"${deleteConfirm.name}" ${t('credProfiles.deleteConfirm')}`}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

function AlgGroup({ label, algs, selected, onToggle }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-1">
        {algs.map(alg => (
          <label key={alg.name} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected?.includes(alg.name) ?? false}
              onChange={() => onToggle(alg.name)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-xs font-mono truncate ${alg.legacy ? 'text-amber-600' : 'text-gray-700'}`}>{alg.name}</span>
            {alg.legacy && <span className="text-xs text-amber-500 flex-shrink-0">(legacy)</span>}
          </label>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function Step({ n, done, fail, title, children }) {
  return (
    <div className="flex gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border text-xs font-bold
        ${fail ? 'bg-red-50 border-red-300 text-red-600'
          : done ? 'bg-green-50 border-green-300 text-green-600'
          : 'bg-white border-gray-300 text-gray-400'}`}
      >
        {fail ? '✕' : done ? '✓' : n}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium mb-0.5 ${done ? 'text-gray-700' : 'text-gray-600'}`}>{title}</p>
        {children}
      </div>
    </div>
  )
}

function StatusPill({ color, label }) {
  const cls = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-500',
  }[color]
  const dot = { green: 'bg-green-500', red: 'bg-red-500', gray: 'bg-gray-400' }[color]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1 ${cls} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`}></span>
      {label}
    </span>
  )
}

function InfoTile({ label, value, valueClass = 'text-gray-800' }) {
  return (
    <div className="px-4 py-2.5 bg-gray-50">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}

function GitHubIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
