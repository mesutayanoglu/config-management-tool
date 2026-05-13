import { useEffect, useState } from 'react'
import { organizationsApi } from '../services/api'
import { useLanguage } from '../i18n'
import ConfirmModal from '../components/ConfirmModal'

export default function OrganizationsPage() {
  const { t } = useLanguage()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  const [showOrgForm, setShowOrgForm] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgDesc, setOrgDesc] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgError, setOrgError] = useState('')

  const [subeFormOrgId, setSubeFormOrgId] = useState(null)
  const [subeName, setSubeName] = useState('')
  const [subeLocation, setSubeLocation] = useState('')
  const [savingSube, setSavingSube] = useState(false)
  const [subeError, setSubeError] = useState('')

  const [confirm, setConfirm] = useState(null)

  async function load() {
    try {
      const { data } = await organizationsApi.list()
      setOrgs(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreateOrg(e) {
    e.preventDefault()
    if (!orgName.trim()) return
    setSavingOrg(true)
    setOrgError('')
    try {
      await organizationsApi.create({ name: orgName.trim(), description: orgDesc.trim() || null })
      setOrgName(''); setOrgDesc(''); setShowOrgForm(false)
      load()
    } catch (err) {
      setOrgError(err?.response?.data?.detail || t('orgs.saveFailed'))
    } finally {
      setSavingOrg(false)
    }
  }

  function askDeleteOrg(org) {
    setConfirm({
      title: t('orgs.confirm.deleteLocTitle'),
      message: `"${org.name}" ${t('orgs.confirm.deleteLoc')}`,
      onConfirm: async () => {
        setConfirm(null)
        await organizationsApi.remove(org.id)
        load()
      },
    })
  }

  function openSubeForm(orgId) {
    setSubeFormOrgId(orgId)
    setSubeName('')
    setSubeLocation('')
    setSubeError('')
  }

  async function handleCreateSube(e, orgId) {
    e.preventDefault()
    if (!subeName.trim()) return
    setSavingSube(true)
    setSubeError('')
    try {
      await organizationsApi.createSite(orgId, { name: subeName.trim(), location: subeLocation.trim() || null })
      setSubeFormOrgId(null)
      load()
    } catch (err) {
      setSubeError(err?.response?.data?.detail || t('orgs.saveFailed'))
    } finally {
      setSavingSube(false)
    }
  }

  function askDeleteSube(org, site) {
    setConfirm({
      title: t('orgs.confirm.deleteBranchTitle'),
      message: `"${site.name}" ${t('orgs.confirm.deleteBranch')}`,
      onConfirm: async () => {
        setConfirm(null)
        await organizationsApi.removeSite(org.id, site.id)
        load()
      },
    })
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('orgs.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('orgs.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowOrgForm(true); setOrgError('') }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {t('orgs.addButton')}
        </button>
      </div>

      {showOrgForm && (
        <div className="bg-white border border-blue-200 rounded-lg p-5 mb-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('orgs.newLocation')}</h2>
          <form onSubmit={handleCreateOrg} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('orgs.nameLabel')} <span className="text-red-500">*</span></label>
              <input
                type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required autoFocus
                placeholder={t('orgs.namePlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('orgs.descLabel')}</label>
              <input
                type="text" value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)}
                placeholder={t('common.optional')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {orgError && <p className="text-xs text-red-600">{orgError}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={savingOrg}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingOrg ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" onClick={() => setShowOrgForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-sm">{t('orgs.empty')}</p>
          <p className="text-xs mt-1">{t('orgs.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => (
            <div key={org.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{org.name}</p>
                    {org.description && <p className="text-xs text-gray-500">{org.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{org.sites?.length || 0} {t('orgs.branches')}</span>
                  <button onClick={() => askDeleteOrg(org)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {(org.sites || []).map((site) => (
                  <div key={site.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-700 font-medium">{site.name}</p>
                        {site.location && <p className="text-xs text-gray-400">{site.location}</p>}
                      </div>
                    </div>
                    <button onClick={() => askDeleteSube(org, site)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                      {t('common.delete')}
                    </button>
                  </div>
                ))}

                {subeFormOrgId === org.id ? (
                  <div className="px-5 py-4 bg-blue-50 border-t border-blue-100">
                    <form onSubmit={(e) => handleCreateSube(e, org.id)} className="space-y-3">
                      <p className="text-xs font-semibold text-blue-700">{t('orgs.newBranch')}</p>
                      <div className="flex gap-2">
                        <input
                          type="text" value={subeName} onChange={(e) => setSubeName(e.target.value)}
                          placeholder={`${t('orgs.branchName')} *`} required autoFocus
                          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text" value={subeLocation} onChange={(e) => setSubeLocation(e.target.value)}
                          placeholder={t('orgs.branchLocation')}
                          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {subeError && <p className="text-xs text-red-600">{subeError}</p>}
                      <div className="flex gap-2">
                        <button type="submit" disabled={savingSube}
                          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                          {savingSube ? t('common.saving') : t('common.save')}
                        </button>
                        <button type="button" onClick={() => setSubeFormOrgId(null)}
                          className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-md text-xs hover:bg-white">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="px-5 py-3">
                    <button onClick={() => openSubeForm(org.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {t('orgs.addBranch')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
