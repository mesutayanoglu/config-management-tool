import { useEffect, useRef, useState } from 'react'
import { devicesApi, organizationsApi } from '../../services/api'
import { useLanguage } from '../../i18n'
import HierarchicalDeviceSelector from './HierarchicalDeviceSelector'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES_OPTS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const DAYS_IN_MONTH = Array.from({ length: 31 }, (_, i) => i + 1)
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6]

const inputCls = 'border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function computeTargetPayload(selectedIds, devices, orgs) {
  if (selectedIds.length === 0) {
    return { target_type: 'manual', target_org_id: null, target_site_id: null, device_ids: [] }
  }

  for (const org of orgs) {
    const orgDevs = devices.filter(d => d.org_id === org.id)
    if (
      orgDevs.length > 0 &&
      orgDevs.length === selectedIds.length &&
      orgDevs.every(d => selectedIds.includes(d.id))
    ) {
      return { target_type: 'org', target_org_id: org.id, target_site_id: null, device_ids: [] }
    }
  }

  const allSites = orgs.flatMap(o => o.sites || [])
  for (const site of allSites) {
    const siteDevs = devices.filter(d => d.site_id === site.id)
    if (
      siteDevs.length > 0 &&
      siteDevs.length === selectedIds.length &&
      siteDevs.every(d => selectedIds.includes(d.id))
    ) {
      return { target_type: 'site', target_site_id: site.id, target_org_id: null, device_ids: [] }
    }
  }

  return { target_type: 'manual', target_org_id: null, target_site_id: null, device_ids: selectedIds }
}

export default function SchedulerForm({ initial = {}, onSubmit, onCancel, submitLabel }) {
  const { t } = useLanguage()

  const [name, setName] = useState(initial.name || '')
  const [scheduleType, setScheduleType] = useState(initial.schedule_type || 'interval')
  const [intervalValue, setIntervalValue] = useState(initial.interval_value || 30)
  const [intervalUnit, setIntervalUnit] = useState(initial.interval_unit || 'minutes')
  const [timeHour, setTimeHour] = useState((initial.time_of_day || '02:00').split(':')[0])
  const [timeMin, setTimeMin] = useState((initial.time_of_day || '02:00').split(':')[1] || '00')
  const [selectedDays, setSelectedDays] = useState(
    initial.days_of_week ? initial.days_of_week.split(',').map(Number) : [0, 1, 2, 3, 4]
  )
  const [dayOfMonth, setDayOfMonth] = useState(initial.day_of_month || 1)

  const [selectedDeviceIds, setSelectedDeviceIds] = useState([])
  const [devices, setDevices] = useState([])
  const [orgs, setOrgs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const initDone = useRef(false)

  useEffect(() => {
    Promise.all([devicesApi.list(), organizationsApi.list()])
      .then(([devRes, orgRes]) => {
        setDevices(devRes.data)
        setOrgs(orgRes.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (devices.length === 0 || initDone.current) return
    initDone.current = true

    if (initial.target_type === 'org' && initial.target_org_id) {
      setSelectedDeviceIds(devices.filter(d => d.org_id === initial.target_org_id).map(d => d.id))
    } else if (initial.target_type === 'site' && initial.target_site_id) {
      setSelectedDeviceIds(devices.filter(d => d.site_id === initial.target_site_id).map(d => d.id))
    } else if (initial.devices) {
      setSelectedDeviceIds(initial.devices.map(d => d.id))
    }
  }, [devices])

  function toggleDay(d) {
    setSelectedDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const target = computeTargetPayload(selectedDeviceIds, devices, orgs)
      const payload = {
        name,
        schedule_type: scheduleType,
        interval_value: Number(intervalValue),
        interval_unit: intervalUnit,
        time_of_day: scheduleType !== 'interval' ? `${timeHour}:${timeMin}` : null,
        days_of_week: scheduleType === 'weekly' ? selectedDays.sort().join(',') : null,
        day_of_month: scheduleType === 'monthly' ? Number(dayOfMonth) : null,
        ...target,
      }
      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  const scheduleTypes = [
    { key: 'interval', label: t('schedulers.form.typeInterval') },
    { key: 'daily', label: t('schedulers.form.typeDaily') },
    { key: 'weekly', label: t('schedulers.form.typeWeekly') },
    { key: 'monthly', label: t('schedulers.form.typeMonthly') },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('schedulers.form.name')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)} required
          className={`w-full ${inputCls}`}
        />
      </div>

      {/* Schedule */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">{t('schedulers.form.scheduleSection')}</p>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
          {scheduleTypes.map(({ key, label }) => (
            <button
              key={key} type="button"
              onClick={() => setScheduleType(key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                scheduleType === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {scheduleType === 'interval' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 whitespace-nowrap">{t('schedulers.form.every')}</span>
              <input
                type="number" min={1} max={999}
                value={intervalValue} onChange={e => setIntervalValue(e.target.value)}
                className={`w-24 ${inputCls}`}
              />
              <select value={intervalUnit} onChange={e => setIntervalUnit(e.target.value)} className={inputCls}>
                <option value="minutes">{t('schedulers.form.minutes')}</option>
                <option value="hours">{t('schedulers.form.hours')}</option>
              </select>
            </div>
          )}

          {scheduleType === 'daily' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{t('schedulers.form.atTime')}</span>
              <select value={timeHour} onChange={e => setTimeHour(e.target.value)} className={inputCls}>
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-gray-400 font-bold">:</span>
              <select value={timeMin} onChange={e => setTimeMin(e.target.value)} className={inputCls}>
                {MINUTES_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {scheduleType === 'weekly' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-2">{t('schedulers.form.onDays')}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEK_DAYS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                        selectedDays.includes(d)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'
                      }`}>
                      {t(`day.${d}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{t('schedulers.form.atTime')}</span>
                <select value={timeHour} onChange={e => setTimeHour(e.target.value)} className={inputCls}>
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-gray-400 font-bold">:</span>
                <select value={timeMin} onChange={e => setTimeMin(e.target.value)} className={inputCls}>
                  {MINUTES_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}

          {scheduleType === 'monthly' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{t('schedulers.form.onDay')}</span>
                <select value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className={inputCls}>
                  {DAYS_IN_MONTH.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{t('schedulers.form.atTime')}</span>
                <select value={timeHour} onChange={e => setTimeHour(e.target.value)} className={inputCls}>
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-gray-400 font-bold">:</span>
                <select value={timeMin} onChange={e => setTimeMin(e.target.value)} className={inputCls}>
                  {MINUTES_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Device selection */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">{t('schedulers.form.deviceSection')}</p>
        <HierarchicalDeviceSelector
          devices={devices}
          orgs={orgs}
          selectedIds={selectedDeviceIds}
          onChange={setSelectedDeviceIds}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit" disabled={submitting}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? t('common.saving') : (submitLabel || t('common.save'))}
        </button>
        <button
          type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-md text-sm hover:bg-gray-50 transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
