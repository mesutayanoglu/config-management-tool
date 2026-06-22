import { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { devicesApi, schedulersApi, configletsApi } from '../services/api'

function relativeTime(dateStr, lang) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (lang === 'tr') {
    if (mins < 1) return 'Az önce'
    if (mins < 60) return `${mins} dakika önce`
    if (hours < 24) return `${hours} saat önce`
    if (days < 30) return `${days} gün önce`
    return new Date(dateStr).toLocaleDateString('tr-TR')
  }
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  return new Date(dateStr).toLocaleDateString('en-US')
}

function fullDateTime(dateStr, lang) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-none">
          {value === null ? <span className="text-slate-300">—</span> : value}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ── Scheduler Runs Table ───────────────────────────────────────────────────────

function SchedulerRunsTable({ schedulers, loading, t, lang }) {
  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-6">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-sm">{t('common.loading')}</span>
    </div>
  )
  if (schedulers.length === 0) return (
    <p className="text-sm text-slate-400 py-6 text-center">{t('dashboard.noSchedulers')}</p>
  )

  const sorted = [...schedulers]
    .sort((a, b) => {
      if (!a.last_run_at && !b.last_run_at) return 0
      if (!a.last_run_at) return 1
      if (!b.last_run_at) return -1
      return new Date(b.last_run_at) - new Date(a.last_run_at)
    })
    .slice(0, 5)

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2.5 pr-4">
            {t('dashboard.schedulerName')}
          </th>
          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2.5 pr-4">
            {t('dashboard.lastRunAt')}
          </th>
          <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2.5">
            {t('dashboard.statusCol')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {sorted.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
            <td className="py-3 pr-4">
              <p className="font-medium text-slate-700 truncate max-w-[140px]">{s.name}</p>
            </td>
            <td className="py-3 pr-4">
              {s.last_run_at ? (
                <span className="text-slate-600 text-xs">
                  {fullDateTime(s.last_run_at, lang)}
                  <span className="text-slate-400 ml-1">({relativeTime(s.last_run_at, lang)})</span>
                </span>
              ) : (
                <span className="text-slate-400 italic text-xs">{t('dashboard.neverRun')}</span>
              )}
            </td>
            <td className="py-3 text-right">
              {s.is_active ? (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {t('dashboard.active')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {t('dashboard.inactive')}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Configlet Runs Table ───────────────────────────────────────────────────────

function ConfigletRunsTable({ executions, loading, t, lang }) {
  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-6">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-sm">{t('common.loading')}</span>
    </div>
  )
  if (executions.length === 0) return (
    <p className="text-sm text-slate-400 py-6 text-center">{t('dashboard.noConfigletRuns')}</p>
  )

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2.5 pr-4">
            {t('dashboard.configletName')}
          </th>
          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2.5 pr-4">
            {t('dashboard.lastRunAt')}
          </th>
          <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2.5">
            {t('dashboard.statusCol')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {executions.slice(0, 5).map((e) => (
          <tr key={e.id} className="hover:bg-slate-50 transition-colors">
            <td className="py-3 pr-4">
              <p className="font-medium text-slate-700 truncate max-w-[140px]">{e.configlet_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {e.trigger_type === 'auto'
                  ? (lang === 'tr' ? 'Otomatik' : 'Auto')
                  : (e.triggered_by_username || '—')}
              </p>
            </td>
            <td className="py-3 pr-4">
              <span className="text-slate-600 text-xs">
                {fullDateTime(e.started_at, lang)}
                <span className="text-slate-400 ml-1">({relativeTime(e.started_at, lang)})</span>
              </span>
            </td>
            <td className="py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                {e.ok_count > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full border border-green-200">
                    ✓ {e.ok_count}
                  </span>
                )}
                {e.fail_count > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full border border-red-200">
                    ✗ {e.fail_count}
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t, lang } = useLanguage()
  const [devices, setDevices] = useState([])
  const [schedulers, setSchedulers] = useState([])
  const [executions, setExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [execLoading, setExecLoading] = useState(true)

  useEffect(() => {
    Promise.all([devicesApi.list(), schedulersApi.list()])
      .then(([dRes, sRes]) => {
        setDevices(dRes.data)
        setSchedulers(sRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    configletsApi.listExecutions()
      .then(({ data }) => setExecutions(data))
      .catch(() => {})
      .finally(() => setExecLoading(false))
  }, [])

  const totalDevices = devices.length
  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const offlineDevices = devices.filter((d) => d.status === 'offline')
  const offlineCount = offlineDevices.length

  const lastBackup = schedulers
    .map((s) => s.last_run_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] ?? null

  const today = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{t('dashboard.title')}</h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{today}</p>
      </div>

      {/* Stat cards — 4 col */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>}
          label={t('dashboard.totalDevices')}
          value={loading ? null : totalDevices}
        />
        <StatCard
          iconBg="bg-green-50"
          icon={<svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>}
          label={t('dashboard.onlineDevices')}
          value={loading ? null : onlineDevices}
        />
        <StatCard
          iconBg={!loading && offlineCount > 0 ? 'bg-red-50' : 'bg-slate-50'}
          icon={<svg className={`w-5 h-5 ${!loading && offlineCount > 0 ? 'text-red-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 17.657a9 9 0 010-12.728M9.172 15.536a5 5 0 010-7.072M12 12h.01" />
          </svg>}
          label={t('dashboard.offlineDevices2')}
          value={loading ? null : offlineCount}
        />
        <StatCard
          iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>}
          label={t('dashboard.lastBackup')}
          value={loading ? null : lastBackup ? relativeTime(lastBackup, lang) : '—'}
          sub={!loading && lastBackup ? fullDateTime(lastBackup, lang) : undefined}
        />
      </div>

      {/* Bottom row — 2 equal columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Scheduler runs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">{t('dashboard.recentRuns')}</p>
          <SchedulerRunsTable schedulers={schedulers} loading={loading} t={t} lang={lang} />
        </div>

        {/* Configlet runs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">{t('dashboard.recentConfigletRuns')}</p>
          <ConfigletRunsTable executions={executions} loading={execLoading} t={t} lang={lang} />
        </div>
      </div>
    </div>
  )
}
