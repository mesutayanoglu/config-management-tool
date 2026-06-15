import { useEffect, useState } from 'react'
import { configletsApi } from '../services/api'
import { useLanguage } from '../i18n'
import useAuthStore from '../store/authStore'
import ConfigletModal from '../components/Configlets/ConfigletModal'
import ConfigletExecuteModal from '../components/Configlets/ConfigletExecuteModal'
import ConfigletHistoryModal from '../components/Configlets/ConfigletHistoryModal'
import ConfirmModal from '../components/ConfirmModal'
import Toast from '../components/Toast'

const thCls = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 tracking-wide uppercase'
const tdCls = 'px-4 py-3 text-sm text-gray-700'

function useScheduleLabel(t) {
  return function describeSchedule(c) {
    if (!c.schedule_enabled || !c.schedule_type) return null
    const days = c.days_of_week
      ? c.days_of_week.split(',').map((d) => t(`day.${d.trim()}`)).join(', ')
      : ''
    const at = c.time_of_day ? ` ${c.time_of_day}` : ''
    switch (c.schedule_type) {
      case 'interval':
        return `${t('schedulers.form.every')} ${c.interval_value} ${t(`schedulers.form.${c.interval_unit}`)}`
      case 'daily':
        return `${t('schedulers.form.typeDaily')}${at}`
      case 'weekly':
        return `${days}${at}`
      case 'monthly':
        return `${t('schedulers.form.typeMonthly')} — ${c.day_of_month}. gün${at}`
      default:
        return '—'
    }
  }
}

function VarChip({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 mr-1 mb-0.5">
      {`{{${label}}}`}
    </span>
  )
}

export default function ConfigletsPage() {
  const { t } = useLanguage()
  const { isReadOnly } = useAuthStore()
  const describeSchedule = useScheduleLabel(t)

  const [configlets, setConfiglets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingConfiglet, setEditingConfiglet] = useState(null)
  const [executingConfiglet, setExecutingConfiglet] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  async function load() {
    try {
      const { data } = await configletsApi.list()
      setConfiglets(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(payload) {
    await configletsApi.create(payload)
    setShowCreateModal(false)
    load()
    setToast({ message: t('configlets.toast.created'), type: 'success' })
  }

  async function handleEdit(payload) {
    await configletsApi.update(editingConfiglet.id, payload)
    setEditingConfiglet(null)
    load()
    setToast({ message: t('configlets.toast.updated'), type: 'success' })
  }

  function handleDeleteConfirm(c) {
    setConfirm({
      title: t('configlets.confirm.deleteTitle'),
      message: `"${c.name}" ${t('configlets.confirm.deleteMsg')}`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await configletsApi.remove(c.id)
          load()
          setToast({ message: t('configlets.toast.deleted'), type: 'info' })
        } catch {
          setToast({ message: t('configlets.toast.deleteFail'), type: 'error' })
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('configlets.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('configlets.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-1.5 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('configlets.history.button')}
          </button>
          {!isReadOnly() && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('configlets.addButton')}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : configlets.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <p className="text-gray-500 text-sm font-medium">{t('configlets.empty')}</p>
            {!isReadOnly() && (
              <p className="text-gray-400 text-xs mt-1">{t('configlets.emptyHint')}</p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={thCls}>{t('configlets.col.name')}</th>
                <th className={thCls}>{t('configlets.col.schedule')}</th>
                <th className={thCls}>{t('configlets.col.devices')}</th>
                <th className={thCls}>{t('configlets.col.lastRun')}</th>
                <th className={thCls}>{t('configlets.col.description')}</th>
                <th className={`${thCls} text-right`}>{t('configlets.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {configlets.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdCls}>
                    <span className="font-semibold text-gray-900">{c.name}</span>
                  </td>
                  <td className={tdCls}>
                    {c.schedule_enabled && c.schedule_type ? (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-gray-700">{describeSchedule(c)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className={tdCls}>
                    {c.device_ids?.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                        </svg>
                        {c.device_ids.length} cihaz
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className={tdCls}>
                    {c.last_run_at
                      ? new Date(c.last_run_at).toLocaleString('tr-TR')
                      : <span className="text-gray-400 text-xs">{t('schedulers.neverRun')}</span>}
                  </td>
                  <td className={tdCls}>
                    <span className="text-gray-500 text-sm">
                      {c.description || <span className="text-gray-300 italic">{t('configlets.noDescription')}</span>}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      {/* Run button */}
                      <button
                        onClick={() => setExecutingConfiglet(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                        title={t('configlets.actions.run')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('configlets.actions.run')}
                      </button>

                      {!isReadOnly() && (
                        <>
                          {/* Edit button */}
                          <button
                            onClick={() => setEditingConfiglet(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                            title={t('common.edit')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t('common.edit')}
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteConfirm(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            title={t('common.delete')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ConfigletModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
        />
      )}

      {editingConfiglet && (
        <ConfigletModal
          configlet={editingConfiglet}
          onClose={() => setEditingConfiglet(null)}
          onSave={handleEdit}
        />
      )}

      {executingConfiglet && (
        <ConfigletExecuteModal
          configlet={executingConfiglet}
          onClose={() => setExecutingConfiglet(null)}
        />
      )}

      {showHistory && (
        <ConfigletHistoryModal onClose={() => setShowHistory(false)} />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
