import { useEffect, useState } from 'react'
import { schedulersApi } from '../services/api'
import { useLanguage } from '../i18n'
import SchedulerForm from '../components/Schedulers/SchedulerForm'
import SchedulerEditModal from '../components/Schedulers/SchedulerEditModal'
import ConfirmModal from '../components/ConfirmModal'
import Toast from '../components/Toast'

function useScheduleLabel(t) {
  return function describeSchedule(s) {
    const days = s.days_of_week
      ? s.days_of_week.split(',').map((d) => t(`day.${d.trim()}`)).join(', ')
      : ''
    const at = s.time_of_day ? ` ${s.time_of_day}` : ''

    switch (s.schedule_type) {
      case 'interval':
        return `${t('schedulers.form.every')} ${s.interval_value} ${t(`schedulers.form.${s.interval_unit}`)}`
      case 'daily':
        return `${t('schedulers.form.typeDaily')}${at}`
      case 'weekly':
        return `${days}${at}`
      case 'monthly':
        return `${t('schedulers.form.typeMonthly')} — ${s.day_of_month}. gün${at}`
      default:
        return '—'
    }
  }
}

function describeTarget(s, t) {
  if (s.target_type === 'org') return `${s.target_org_name || '—'} (${t('schedulers.form.targetOrg')})`
  if (s.target_type === 'site') return `${s.target_site_name || '—'}`
  return `${s.devices?.length ?? 0} cihaz`
}

const thCls = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide'
const tdCls = 'px-4 py-3 text-sm text-gray-700'

export default function SchedulersPage() {
  const { t } = useLanguage()
  const describeSchedule = useScheduleLabel(t)

  const [schedulers, setSchedulers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingScheduler, setEditingScheduler] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const { data } = await schedulersApi.list()
      setSchedulers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(payload) {
    await schedulersApi.create(payload)
    setShowForm(false)
    load()
    setToast({ message: t('schedulers.toast.created'), type: 'success' })
  }

  async function handleEditSave(payload) {
    await schedulersApi.update(editingScheduler.id, payload)
    setEditingScheduler(null)
    load()
    setToast({ message: t('schedulers.toast.updated'), type: 'success' })
  }

  function handleDelete(s) {
    setConfirm({
      title: t('schedulers.confirm.deleteTitle'),
      message: `"${s.name}" ${t('schedulers.confirm.delete')}`,
      onConfirm: async () => {
        setConfirm(null)
        await schedulersApi.remove(s.id)
        load()
        setToast({ message: t('schedulers.toast.deleted'), type: 'info' })
      },
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('schedulers.title')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {t('schedulers.addButton')}
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-5">{t('schedulers.newTitle')}</h2>
          <SchedulerForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 px-4 py-6">{t('common.loading')}</p>
        ) : schedulers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium">{t('schedulers.empty')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className={thCls}>{t('schedulers.col.name')}</th>
                <th className={thCls}>{t('schedulers.col.schedule')}</th>
                <th className={thCls}>{t('schedulers.col.target')}</th>
                <th className={thCls}>{t('schedulers.col.lastRun')}</th>
                <th className={thCls}>{t('schedulers.col.status')}</th>
                <th className={`${thCls} text-right`}>{t('schedulers.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedulers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdCls}>
                    <p className="font-medium text-gray-800">{s.name}</p>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <ScheduleIcon type={s.schedule_type} />
                      <span>{describeSchedule(s)}</span>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <TargetBadge s={s} t={t} />
                  </td>
                  <td className={tdCls}>
                    {s.last_run_at
                      ? new Date(s.last_run_at).toLocaleString('tr-TR')
                      : <span className="text-gray-400 text-xs">{t('schedulers.neverRun')}</span>}
                  </td>
                  <td className={tdCls}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {s.is_active ? t('schedulers.active') : t('schedulers.passive')}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingScheduler(s)}
                        className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingScheduler && (
        <SchedulerEditModal
          scheduler={editingScheduler}
          onSave={handleEditSave}
          onClose={() => setEditingScheduler(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function ScheduleIcon({ type }) {
  const icons = {
    interval: (
      <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    daily: (
      <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    weekly: (
      <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    monthly: (
      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  }
  return icons[type] || null
}

function TargetBadge({ s, t }) {
  if (s.target_type === 'org') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
        </svg>
        {s.target_org_name || '—'}
      </span>
    )
  }
  if (s.target_type === 'site') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
        {s.target_site_name || '—'}
      </span>
    )
  }
  const count = s.devices?.length ?? 0
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
      {count} {t('schedulers.form.selectedCount')}
    </span>
  )
}
