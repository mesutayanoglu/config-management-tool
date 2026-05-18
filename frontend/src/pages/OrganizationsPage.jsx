import { useEffect, useState } from 'react'
import { organizationsApi } from '../services/api'
import { useLanguage } from '../i18n'
import useAuthStore from '../store/authStore'
import ConfirmModal from '../components/ConfirmModal'

export default function OrganizationsPage() {
  const { t } = useLanguage()
  const { isReadOnly } = useAuthStore()
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
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t('orgs.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('orgs.subtitle')}</p>
        </div>
        {!isReadOnly() && (
          <button
            onClick={() => { setShowOrgForm(true); setOrgError('') }}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('orgs.addButton')}
          </button>
        )}
      </div>

      {/* New org form */}
      {showOrgForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 mb-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-700">{t('orgs.newLocation')}</h2>
          </div>
          <form onSubmit={handleCreateOrg} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t('orgs.nameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                  required autoFocus placeholder={t('orgs.namePlaceholder')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('orgs.descLabel')}</label>
                <input
                  type="text" value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)}
                  placeholder={t('common.optional')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {orgError && <p className="text-xs text-red-600">{orgError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={savingOrg}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingOrg ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" onClick={() => setShowOrgForm(false)}
                className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600">{t('orgs.empty')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('orgs.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <OrgCard
              key={org.id}
              org={org}
              t={t}
              isReadOnly={isReadOnly}
              subeFormOrgId={subeFormOrgId}
              subeName={subeName}
              subeLocation={subeLocation}
              savingSube={savingSube}
              subeError={subeError}
              onDeleteOrg={askDeleteOrg}
              onOpenSubeForm={openSubeForm}
              onSubeNameChange={setSubeName}
              onSubeLocationChange={setSubeLocation}
              onCreateSube={handleCreateSube}
              onCancelSube={() => setSubeFormOrgId(null)}
              onDeleteSube={askDeleteSube}
            />
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

function OrgCard({
  org, t, isReadOnly,
  subeFormOrgId, subeName, subeLocation, savingSube, subeError,
  onDeleteOrg, onOpenSubeForm,
  onSubeNameChange, onSubeLocationChange,
  onCreateSube, onCancelSube, onDeleteSube,
}) {
  const siteCount = org.sites?.length || 0
  const isAddingBranch = subeFormOrgId === org.id

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-[18px] w-[18px] text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{org.name}</p>
              {org.description
                ? <p className="text-xs text-slate-400 truncate mt-0.5">{org.description}</p>
                : <p className="text-xs text-slate-300 mt-0.5 italic">—</p>
              }
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              {siteCount}
            </span>
            {!isReadOnly() && (
              <button
                onClick={() => onDeleteOrg(org)}
                title={t('common.delete')}
                className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 mx-5" />

      {/* Sites list */}
      <div className="flex-1 px-5 py-3 space-y-0.5 min-h-0">
        {siteCount === 0 ? (
          <p className="text-xs text-slate-400 py-2 text-center italic">{t('orgs.noSites') || 'Henüz şube yok'}</p>
        ) : (
          org.sites.map((site) => (
            <div
              key={site.id}
              className="group flex items-center justify-between py-1.5 rounded-lg px-1 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 font-medium truncate">{site.name}</p>
                  {site.location && (
                    <p className="text-xs text-slate-400 truncate">{site.location}</p>
                  )}
                </div>
              </div>
              {!isReadOnly() && (
                <button
                  onClick={() => onDeleteSube(org, site)}
                  title={t('common.delete')}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-0.5 flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add branch section */}
      {!isReadOnly() && (
        <div className="border-t border-slate-100 px-5 py-3">
          {isAddingBranch ? (
            <form onSubmit={(e) => onCreateSube(e, org.id)} className="space-y-2.5">
              <p className="text-xs font-semibold text-blue-600">{t('orgs.newBranch')}</p>
              <input
                type="text" value={subeName} onChange={(e) => onSubeNameChange(e.target.value)}
                placeholder={`${t('orgs.branchName')} *`} required autoFocus
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text" value={subeLocation} onChange={(e) => onSubeLocationChange(e.target.value)}
                placeholder={t('orgs.branchLocation')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {subeError && <p className="text-xs text-red-600">{subeError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={savingSube}
                  className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {savingSube ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" onClick={onCancelSube}
                  className="flex-1 border border-slate-300 text-slate-600 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => onOpenSubeForm(org.id)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('orgs.addBranch')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
