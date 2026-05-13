import { useEffect, useState } from 'react'
import { organizationsApi } from '../../services/api'
import { useLanguage } from '../../i18n'

const VENDORS = ['cisco', 'fortigate', 'huawei', 'aruba', 'aruba_cx']
const DEFAULT_COMMANDS = {
  cisco: 'show running-config',
  fortigate: 'show full-configuration',
  huawei: 'display current-configuration',
  aruba: 'show running-config',
  aruba_cx: 'show running-config',
}

export default function DeviceForm({ onSubmit, onCancel }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    hostname: '',
    ip_address: '',
    vendor: 'cisco',
    config_command: DEFAULT_COMMANDS.cisco,
    ssh_username: '',
    ssh_password: '',
    org_id: '',
    site_id: '',
  })
  const [orgs, setOrgs] = useState([])
  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    organizationsApi.list().then(({ data }) => setOrgs(data)).catch(() => {})
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'vendor' ? { config_command: DEFAULT_COMMANDS[value] || '' } : {}),
      ...(name === 'org_id' ? { site_id: '' } : {}),
    }))
    if (name === 'org_id' && value) {
      setLoadingSites(true)
      organizationsApi.listSites(value)
        .then(({ data }) => setSites(data))
        .catch(() => setSites([]))
        .finally(() => setLoadingSites(false))
    } else if (name === 'org_id') {
      setSites([])
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.org_id) { alert(t('deviceForm.location') + ' ' + t('common.select')); return }
    if (!form.site_id) { alert(t('deviceForm.branch') + ' ' + t('common.select')); return }
    setSubmitting(true)
    try {
      const { org_id, ...payload } = form
      await onSubmit({ ...payload, site_id: parseInt(form.site_id) })
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('deviceForm.location')} <span className="text-red-500">*</span>
        </label>
        <select name="org_id" value={form.org_id} onChange={handleChange} required className={inputCls}>
          <option value="">— {t('common.select')} —</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {orgs.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">{t('deviceForm.noOrgs')}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('deviceForm.branch')} <span className="text-red-500">*</span>
        </label>
        <select
          name="site_id" value={form.site_id} onChange={handleChange} required
          disabled={!form.org_id || loadingSites}
          className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">{loadingSites ? t('common.loading') : `— ${t('deviceForm.selectFirst')} —`}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {form.org_id && !loadingSites && sites.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">{t('deviceForm.noSites')}</p>
        )}
      </div>

      <hr className="border-gray-100" />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviceForm.hostname')} <span className="text-red-500">*</span></label>
        <input type="text" name="hostname" value={form.hostname} onChange={handleChange} required className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviceForm.ip')} <span className="text-red-500">*</span></label>
        <input type="text" name="ip_address" value={form.ip_address} onChange={handleChange} required className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviceForm.brand')} <span className="text-red-500">*</span></label>
        <select name="vendor" value={form.vendor} onChange={handleChange} className={inputCls}>
          {VENDORS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviceForm.configCmd')} <span className="text-red-500">*</span></label>
        <input type="text" name="config_command" value={form.config_command} onChange={handleChange} required className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviceForm.sshUser')}</label>
          <input type="text" name="ssh_username" value={form.ssh_username} onChange={handleChange} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviceForm.sshPass')}</label>
          <input type="password" name="ssh_password" value={form.ssh_password} onChange={handleChange} className={inputCls} />
        </div>
      </div>

      <p className="text-xs text-gray-400">{t('deviceForm.autoFill')}</p>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={submitting}
          className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {submitting ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
