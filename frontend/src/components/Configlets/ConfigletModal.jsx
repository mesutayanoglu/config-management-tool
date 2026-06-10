import { useEffect, useRef, useState } from 'react'
import { devicesApi, organizationsApi } from '../../services/api'
import { useLanguage } from '../../i18n'
import HierarchicalDeviceSelector from '../Schedulers/HierarchicalDeviceSelector'

function extractVariables(content) {
  const matches = [...content.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
  const seen = new Set()
  return matches.map((m) => m[1]).filter((v) => { if (seen.has(v)) return false; seen.add(v); return true })
}

// ── Tab: Temel Bilgiler ──────────────────────────────────────────────────────
function TabGeneral({ name, setName, description, setDescription, content, setContent, varDefaults, setVarDefaults, notificationEmail, setNotificationEmail, t }) {
  const textareaRef = useRef(null)
  const variables = extractVariables(content)

  useEffect(() => { textareaRef.current?.focus() }, [])

  function handleTabKey(e) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = content.substring(0, start) + '  ' + content.substring(end)
    setContent(newVal)
    requestAnimationFrame(() => { el.selectionStart = start + 2; el.selectionEnd = start + 2 })
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('configlets.form.name')}
        </label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t('configlets.form.namePlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('configlets.form.description')}
          <span className="ml-1 font-normal normal-case text-gray-400">({t('common.optional')})</span>
        </label>
        <input
          type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder={t('configlets.form.descPlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('configlets.form.content')}
        </label>
        <textarea
          ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleTabKey} rows={9} spellCheck={false}
          className="w-full border border-gray-300 rounded-lg bg-white text-gray-900 font-mono text-sm px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={'! Komutlarınızı buraya yazın\nhostname {{hostname}}\ninterface {{interface_id}}\n description {{description}}'}
        />
        <p className="mt-1 text-xs text-gray-400">{t('configlets.form.variableHint')}</p>
      </div>

      {/* Variables with default values — auto-detected from content */}
      {variables.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('configlets.form.defaultValues')}
          </label>
          <p className="text-xs text-gray-400 mb-3">{t('configlets.form.defaultValuesHint')}</p>
          <div className="space-y-2">
            {variables.map((v) => (
              <div key={v} className="flex items-center gap-3">
                <code className="flex-shrink-0 w-40 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 font-mono truncate">{`{{${v}}}`}</code>
                <span className="text-gray-400 text-sm flex-shrink-0">:</span>
                <input
                  type="text"
                  value={varDefaults[v] || ''}
                  onChange={(e) => setVarDefaults((prev) => ({ ...prev, [v]: e.target.value }))}
                  placeholder={`${v} değeri...`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification email */}
      <div className="pt-2 border-t border-gray-100">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('configlets.form.notificationEmail')}
          <span className="ml-1 font-normal normal-case text-gray-400">({t('common.optional')})</span>
        </label>
        <input
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          placeholder={t('configlets.form.notificationEmailPlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">{t('configlets.form.notificationEmailHint')}</p>
      </div>
    </div>
  )
}

// ── Tab: Cihaz Seçimi ────────────────────────────────────────────────────────
function TabDevices({ selectedIds, setSelectedIds, t }) {
  const [devices, setDevices] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([devicesApi.list(), organizationsApi.list()])
      .then(([devRes, orgRes]) => { setDevices(devRes.data); setOrgs(orgRes.data) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t('configlets.form.deviceSection')}
        </label>
      </div>
      <p className="text-xs text-gray-400">{t('configlets.form.deviceSectionHint')}</p>
      {loading ? (
        <div className="py-6 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : (
        <HierarchicalDeviceSelector
          devices={devices}
          orgs={orgs}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      )}
    </div>
  )
}

// ── Tab: Zamanlayıcı ─────────────────────────────────────────────────────────
function TabSchedule({ schedule, setSchedule, selectedDeviceCount, t }) {
  const { enabled, type, intervalValue, intervalUnit, timeOfDay, daysOfWeek, dayOfMonth } = schedule
  const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

  function toggleDay(d) {
    const days = daysOfWeek ? daysOfWeek.split(',').filter(Boolean) : []
    const updated = days.includes(String(d)) ? days.filter((x) => x !== String(d)) : [...days, String(d)]
    setSchedule((s) => ({ ...s, daysOfWeek: updated.join(',') }))
  }

  const activeDays = daysOfWeek ? daysOfWeek.split(',').filter(Boolean) : []

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setSchedule((s) => ({ ...s, enabled: !s.enabled }))}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <div>
          <p className="text-sm font-medium text-gray-900">{t('configlets.form.scheduleEnabled')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('configlets.form.scheduleEnabledHint')}</p>
        </div>
      </div>

      {enabled && selectedDeviceCount === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠ {t('configlets.form.scheduleRequiresDevices')}
        </p>
      )}

      {enabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t('configlets.form.scheduleType')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['interval', 'daily', 'weekly', 'monthly'].map((tp) => (
                <button key={tp} type="button"
                  onClick={() => setSchedule((s) => ({ ...s, type: tp }))}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${type === tp ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}
                >
                  {t(`schedulers.form.type${tp.charAt(0).toUpperCase() + tp.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {type === 'interval' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{t('schedulers.form.every')}</span>
              <input type="number" min={1} max={9999} value={intervalValue || ''}
                onChange={(e) => setSchedule((s) => ({ ...s, intervalValue: parseInt(e.target.value) || 1 }))}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                {['minutes', 'hours'].map((u) => (
                  <button key={u} type="button"
                    onClick={() => setSchedule((s) => ({ ...s, intervalUnit: u }))}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${intervalUnit === u ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                  >
                    {t(`schedulers.form.${u}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(type === 'daily' || type === 'weekly' || type === 'monthly') && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{t('schedulers.form.atTime')}</span>
              <input type="time" value={timeOfDay || '00:00'}
                onChange={(e) => setSchedule((s) => ({ ...s, timeOfDay: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {type === 'weekly' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {t('schedulers.form.onDays')}
              </label>
              <div className="flex gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`w-10 h-10 text-xs font-semibold rounded-full border transition-colors ${activeDays.includes(String(i)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'monthly' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{t('schedulers.form.onDay')}</span>
              <input type="number" min={1} max={31} value={dayOfMonth || ''}
                onChange={(e) => setSchedule((s) => ({ ...s, dayOfMonth: parseInt(e.target.value) || 1 }))}
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export default function ConfigletModal({ configlet, onClose, onSave }) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(configlet?.name || '')
  const [description, setDescription] = useState(configlet?.description || '')
  const [content, setContent] = useState(configlet?.content || '')
  const [selectedIds, setSelectedIds] = useState(configlet?.device_ids || [])
  const [varDefaults, setVarDefaults] = useState(configlet?.variable_defaults || {})
  const [notificationEmail, setNotificationEmail] = useState(configlet?.notification_email || '')
  const [schedule, setSchedule] = useState({
    enabled: configlet?.schedule_enabled || false,
    type: configlet?.schedule_type || 'interval',
    intervalValue: configlet?.interval_value || 60,
    intervalUnit: configlet?.interval_unit || 'minutes',
    timeOfDay: configlet?.time_of_day || '00:00',
    daysOfWeek: configlet?.days_of_week || '0',
    dayOfMonth: configlet?.day_of_month || 1,
  })

  const isEdit = Boolean(configlet)

  const TABS = [
    { key: 'general', label: t('configlets.modal.tab.general'), icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { key: 'devices', label: t('configlets.modal.tab.devices'), badge: selectedIds.length > 0 ? selectedIds.length : null, icon: 'M3 9a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
    { key: 'schedule', label: t('configlets.modal.tab.schedule'), badge: schedule.enabled ? '●' : null, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError(t('configlets.form.nameRequired')); setActiveTab('general'); return }
    if (!content.trim()) { setError(t('configlets.form.contentRequired')); setActiveTab('general'); return }

    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        content: content.trim(),
        device_ids: selectedIds,
        variable_defaults: varDefaults,
        schedule_enabled: schedule.enabled,
        schedule_type: schedule.enabled ? schedule.type : null,
        interval_value: schedule.enabled && schedule.type === 'interval' ? (schedule.intervalValue || 60) : null,
        interval_unit: schedule.enabled && schedule.type === 'interval' ? (schedule.intervalUnit || 'minutes') : null,
        time_of_day: schedule.enabled && schedule.type !== 'interval' ? (schedule.timeOfDay || '00:00') : null,
        days_of_week: schedule.enabled && schedule.type === 'weekly' ? (schedule.daysOfWeek || '0') : null,
        day_of_month: schedule.enabled && schedule.type === 'monthly' ? (schedule.dayOfMonth || 1) : null,
        notification_email: notificationEmail.trim() || null,
      })
    } catch (err) {
      setError(err.response?.data?.detail || t('configlets.form.saveFail'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? t('configlets.modal.editTitle') : t('configlets.modal.createTitle')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-200 flex-shrink-0 px-2">
          {TABS.map(({ key, label, badge, icon }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
              </svg>
              {label}
              {badge !== null && badge !== undefined && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold rounded-full ${key === 'schedule' ? 'text-blue-600' : 'bg-blue-600 text-white'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 flex-1 overflow-y-auto">
            {activeTab === 'general' && (
              <TabGeneral
                name={name} setName={setName}
                description={description} setDescription={setDescription}
                content={content} setContent={setContent}
                varDefaults={varDefaults} setVarDefaults={setVarDefaults}
                notificationEmail={notificationEmail} setNotificationEmail={setNotificationEmail}
                t={t}
              />
            )}
            {activeTab === 'devices' && (
              <TabDevices selectedIds={selectedIds} setSelectedIds={setSelectedIds} t={t} />
            )}
            {activeTab === 'schedule' && (
              <TabSchedule schedule={schedule} setSchedule={setSchedule} selectedDeviceCount={selectedIds.length} t={t} />
            )}
            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
            <div className="flex gap-2 text-xs">
              {selectedIds.length > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{selectedIds.length} cihaz</span>
              )}
              {schedule.enabled && (
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full">⏱ Zamanlı</span>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
