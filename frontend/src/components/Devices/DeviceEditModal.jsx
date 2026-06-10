import { useEffect, useState } from 'react'
import { organizationsApi } from '../../services/api'
import { useLanguage } from '../../i18n'

const VENDORS = ['cisco', 'fortigate', 'huawei', 'aruba']

export default function DeviceEditModal({ device, onSave, onClose, profiles = [] }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    hostname: device.hostname || '',
    ip_address: device.ip_address || '',
    vendor: device.vendor || 'cisco',
    ssh_username: device.ssh_username || '',
    ssh_password: '',
    org_id: String(device.org_id || ''),
    site_id: String(device.site_id || ''),
    credential_profile_id: device.credential_profile_id || null,
  })
  const [selectedProfileId, setSelectedProfileId] = useState(
    device.credential_profile_id ? String(device.credential_profile_id) : ''
  )
  const [orgs, setOrgs] = useState([])
  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    organizationsApi.list().then(({ data }) => {
      setOrgs(data)
      if (device.org_id) {
        const org = data.find((o) => o.id === device.org_id)
        if (org) setSites(org.sites || [])
      }
    }).catch(() => {})
  }, [device.org_id])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
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
    if (name === 'ssh_username' || name === 'ssh_password') {
      setSelectedProfileId('')
    }
  }

  function handleProfileSelect(e) {
    const id = e.target.value
    setSelectedProfileId(id)
    setForm(prev => ({
      ...prev,
      credential_profile_id: id ? parseInt(id) : null,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        hostname: form.hostname,
        ip_address: form.ip_address,
        vendor: form.vendor,
        ssh_username: form.ssh_username || null,
        site_id: form.site_id ? parseInt(form.site_id) : null,
        credential_profile_id: form.credential_profile_id || null,
      }
      if (form.ssh_password) payload.ssh_password = form.ssh_password
      await onSave(payload)
    } catch (err) {
      setError(err?.response?.data?.detail || t('editModal.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
  const profileActive = !!selectedProfileId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('editModal.title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{device.hostname}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('deviceForm.location')}</label>
              <select name="org_id" value={form.org_id} onChange={handleChange} className={inputCls}>
                <option value="">— {t('common.select')} —</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('deviceForm.branch')}</label>
              <select name="site_id" value={form.site_id} onChange={handleChange}
                disabled={!form.org_id || loadingSites}
                className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}>
                <option value="">{loadingSites ? t('common.loading') : `— ${t('common.select')} —`}</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('deviceForm.hostname')} <span className="text-red-500">*</span></label>
              <input type="text" name="hostname" value={form.hostname} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('deviceForm.ip')} <span className="text-red-500">*</span></label>
              <input type="text" name="ip_address" value={form.ip_address} onChange={handleChange} required className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('deviceForm.brand')}</label>
            <select name="vendor" value={form.vendor} onChange={handleChange} className={inputCls}>
              {VENDORS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>

          <hr className="border-gray-100" />

          <div>
            <label className={labelCls}>{t('credProfiles.selectLabel')}</label>
            <select value={selectedProfileId} onChange={handleProfileSelect} className={inputCls}>
              <option value="">— {t('credProfiles.selectPlaceholder')} —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({(p.connection_type || 'ssh').toUpperCase()} · {p.username} · port {p.port})
                </option>
              ))}
            </select>
            {selectedProfileId && (
              <p className="text-xs text-blue-600 mt-1">{t('credProfiles.profileActiveHint')}</p>
            )}
          </div>

          {!selectedProfileId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('deviceForm.sshUser')}</label>
                <input
                  type="text" name="ssh_username" value={form.ssh_username} onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('deviceForm.sshPass')}</label>
                <input
                  type="password" name="ssh_password" value={form.ssh_password} onChange={handleChange}
                  placeholder={t('editModal.passwordPlaceholder')}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
