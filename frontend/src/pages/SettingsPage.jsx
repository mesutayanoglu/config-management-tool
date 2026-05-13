import { useEffect, useState } from 'react'
import { settingsApi } from '../services/api'
import { useLanguage } from '../i18n'
import Toast from '../components/Toast'

export default function SettingsPage() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ github_token: '', github_repo: '' })
  const [saved, setSaved] = useState(null)
  const [toast, setToast] = useState(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [repoInfo, setRepoInfo] = useState(null)

  const isConnected = saved?.github_token === '***' && saved?.github_repo

  useEffect(() => {
    settingsApi.get().then(({ data }) => {
      setSaved(data)
      setForm({ github_token: '', github_repo: data.github_repo || '' })
    }).catch(() => {})

    settingsApi.testGithub().then(({ data }) => {
      setRepoInfo(data)
      setTestResult('ok')
    }).catch(() => {
      setRepoInfo(null)
    })
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('settings.title')}</h1>

      <div className="flex gap-6 items-start">

        <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">{t('settings.githubConn')}</h2>
            {testResult === 'ok' ? (
              <StatusPill color="green" label={t('settings.connected')} />
            ) : testResult === 'fail' ? (
              <StatusPill color="red" label={t('settings.error')} />
            ) : isConnected ? (
              <StatusPill color="green" label={t('settings.connected')} />
            ) : (
              <StatusPill color="gray" label={t('settings.noConn')} />
            )}
          </div>

          <div className="px-6 py-5 space-y-6">

            <Step n={1} done={isConnected} title={t('settings.step1Title')}>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t('settings.step1Desc')}
                <br />{t('settings.step1Perm')} <strong>Contents — Read and Write</strong>
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
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('settings.repoLabel')}</label>
                  <input
                    type="text"
                    value={form.github_repo}
                    onChange={(e) => { setForm((p) => ({ ...p, github_repo: e.target.value })); setHasSaved(false) }}
                    placeholder="username/config-backups"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('settings.repoHint')}</p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </form>
            </Step>

            <Step n={3} done={testResult === 'ok'} fail={testResult === 'fail'} title={t('settings.step3Title')}>
              <p className="text-xs text-gray-500 mb-3">
                {hasSaved
                  ? t('settings.step3Saved')
                  : !isConnected
                  ? t('settings.step3NoConn')
                  : t('settings.step3HasConn')}
              </p>
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
            </Step>

          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settings.connectedAccounts')}</h2>

          {repoInfo ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 truncate">{repoInfo.repo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${repoInfo.private ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                      {repoInfo.private ? t('settings.private') : t('settings.public')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{t('settings.repoDesc')}</p>
                  <a
                    href={`https://github.com/${repoInfo.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    {t('settings.viewOnGithub')}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span className="text-xs text-green-600 font-medium">{t('settings.active')}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                <InfoTile label={t('settings.tilePlatform')} value="GitHub" />
                <InfoTile label={t('settings.tileStatus')} value={t('settings.connected')} valueClass="text-green-600" />
                <InfoTile label={t('settings.tileRepo')} value={repoInfo.private ? t('settings.private') : t('settings.public')} />
                <InfoTile label={t('settings.tileUsage')} value={t('settings.tileUsageVal')} />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-gray-400">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">{t('settings.noAccount')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('settings.noAccountHint')}</p>
            </div>
          )}
        </div>

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function Step({ n, done, fail, title, children }) {
  return (
    <div className="flex gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border text-xs font-bold
        ${fail ? 'bg-red-50 border-red-300 text-red-600'
          : done ? 'bg-green-50 border-green-300 text-green-600'
          : 'bg-gray-50 border-gray-300 text-gray-500'}`}
      >
        {fail ? '✕' : done ? '✓' : n}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
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
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1 ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {label}
    </span>
  )
}

function InfoTile({ label, value, valueClass = 'text-gray-800' }) {
  return (
    <div className="bg-gray-50 rounded-md px-3 py-2">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}
