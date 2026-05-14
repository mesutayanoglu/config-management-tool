import { useEffect, useState, useMemo } from 'react'
import { devicesApi, configsApi, organizationsApi } from '../services/api'
import { useLanguage } from '../i18n'
import ConfigViewer from '../components/Configs/ConfigViewer'
import SideBySideDiff from '../components/Configs/SideBySideDiff'

export default function ConfigsPage() {
  const { t } = useLanguage()
  const [devices, setDevices] = useState([])
  const [orgs, setOrgs] = useState([])
  const [sites, setSites] = useState([])
  const [filterOrg, setFilterOrg] = useState('')
  const [filterSite, setFilterSite] = useState('')

  const [selectedDevice, setSelectedDevice] = useState(null)
  const [commits, setCommits] = useState([])
  const [loadingCommits, setLoadingCommits] = useState(false)

  const [panelMode, setPanelMode] = useState('idle')
  const [viewedCommit, setViewedCommit] = useState(null)
  const [compareCommit, setCompareCommit] = useState(null)
  const [diffData, setDiffData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    devicesApi.list().then(({ data }) => setDevices(data)).catch(() => {})
    organizationsApi.list().then(({ data }) => setOrgs(data)).catch(() => {})
  }, [])

  useEffect(() => {
    setSites([])
    setFilterSite('')
    if (!filterOrg) return
    organizationsApi.listSites(filterOrg).then(({ data }) => setSites(data)).catch(() => {})
  }, [filterOrg])

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (filterOrg && String(d.org_id) !== String(filterOrg)) return false
      if (filterSite && String(d.site_id) !== String(filterSite)) return false
      return true
    })
  }, [devices, filterOrg, filterSite])

  async function selectDevice(device) {
    setSelectedDevice(device)
    setCommits([])
    setPanelMode('idle')
    setViewedCommit(null)
    setCompareCommit(null)
    setDiffData(null)
    setLoadingCommits(true)
    try {
      const { data } = await configsApi.list(device.device_uid)
      setCommits(data.configs || [])
    } finally {
      setLoadingCommits(false)
    }
  }

  async function openCommit(sha) {
    setPanelMode('viewing')
    setCompareCommit(null)
    setDiffData(null)
    setLoading(true)
    try {
      const { data } = await configsApi.atSha(selectedDevice.device_uid, sha)
      setViewedCommit({ sha, content: data.content })
    } finally {
      setLoading(false)
    }
  }

  function startCompare() { setPanelMode('picking') }
  function cancelCompare() { setPanelMode('viewing'); setCompareCommit(null); setDiffData(null) }

  async function pickForCompare(sha) {
    if (sha === viewedCommit?.sha) return
    setLoading(true)
    setPanelMode('comparing')
    try {
      const dateViewed = new Date(commits.find(c => c.sha === viewedCommit.sha)?.date ?? 0)
      const datePicked = new Date(commits.find(c => c.sha === sha)?.date ?? 0)
      const [olderSha, newerSha] = dateViewed <= datePicked
        ? [viewedCommit.sha, sha]
        : [sha, viewedCommit.sha]
      const { data } = await configsApi.compare(selectedDevice.device_uid, olderSha, newerSha)
      setCompareCommit({ sha })
      setDiffData({ contentA: data.content_a, contentB: data.content_b, shaA: data.sha_a, shaB: data.sha_b })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>

      {/* Sol: Filtre + Cihaz listesi */}
      <div className="w-56 flex-shrink-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-gray-100 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('configs.filter')}</p>
          <select
            value={filterOrg}
            onChange={(e) => { setFilterOrg(e.target.value); setSelectedDevice(null) }}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">{t('configs.allOrgs')}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select
            value={filterSite}
            onChange={(e) => { setFilterSite(e.target.value); setSelectedDevice(null) }}
            disabled={!filterOrg}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
          >
            <option value="">{t('configs.allSites')}</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500">{t('configs.devices')}</p>
          <span className="text-xs text-gray-400">{filteredDevices.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filteredDevices.length === 0
            ? <p className="text-xs text-gray-400 px-3 py-3">{t('configs.noDevices')}</p>
            : filteredDevices.map((d) => (
              <button
                key={d.id}
                onClick={() => selectDevice(d)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                  selectedDevice?.id === d.id ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 ${selectedDevice?.id === d.id ? 'text-blue-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${selectedDevice?.id === d.id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {d.hostname}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{d.site_name || d.vendor}</p>
                </div>
              </button>
            ))
          }
        </div>
      </div>

      {/* Orta: Commit geçmişi */}
      <div className="w-64 flex-shrink-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">
            {selectedDevice ? selectedDevice.hostname : t('configs.history')}
          </p>
          <p className="text-xs text-gray-400">
            {panelMode === 'picking'
              ? t('configs.pickHint')
              : selectedDevice ? `${commits.length} ${t('configs.tagLatest')}` : t('configs.selectDevice')}
          </p>
        </div>

        {panelMode === 'picking' && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <span className="text-xs text-amber-700 font-medium">{t('configs.compareMode')}</span>
            <button onClick={cancelCompare} className="text-xs text-gray-500 hover:text-gray-700">{t('configs.cancelCompare')}</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingCommits && <p className="text-xs text-gray-400 px-4 py-3">{t('common.loading')}</p>}
          {!loadingCommits && selectedDevice && commits.length === 0 && (
            <p className="text-xs text-gray-400 px-4 py-3">{t('configs.noConfigs')}</p>
          )}
          {commits.map((c, i) => {
            const isViewed = viewedCommit?.sha === c.sha
            const isCompared = compareCommit?.sha === c.sha
            const isPicking = panelMode === 'picking'
            const isBase = isPicking && isViewed

            function handleRowClick() {
              if (isPicking) { if (!isBase) pickForCompare(c.sha) }
              else { openCommit(c.sha) }
            }

            return (
              <div
                key={c.sha}
                onClick={handleRowClick}
                className={`px-3 py-2.5 border-b border-gray-50 last:border-0 flex items-start justify-between gap-2 ${
                  isBase ? 'cursor-default' : 'cursor-pointer'
                } ${isCompared ? 'bg-amber-50 hover:bg-amber-100' : isViewed ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <code className="text-xs font-mono text-blue-600">{c.sha.slice(0, 7)}</code>
                    {i === 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">{t('configs.tagLatest')}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400">{new Date(c.date).toLocaleString('tr-TR')}</p>
                </div>
                {isPicking ? (
                  isBase
                    ? <span className="text-[10px] text-gray-400 flex-shrink-0">{t('configs.tagBase')}</span>
                    : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex-shrink-0">{t('configs.btnSelect')}</span>
                ) : (
                  isViewed && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex-shrink-0">{t('configs.tagOpen')}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Sağ: İçerik / Diff */}
      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {panelMode === 'comparing' && diffData ? (
              <>
                <span className="text-sm font-semibold text-gray-700">{t('configs.compareTitle')}</span>
                <code className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">{diffData.shaA.slice(0, 7)}</code>
                <span className="text-gray-400">→</span>
                <code className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">{diffData.shaB.slice(0, 7)}</code>
              </>
            ) : viewedCommit ? (
              <>
                <span className="text-sm font-semibold text-gray-700">Config</span>
                <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{viewedCommit.sha.slice(0, 7)}</code>
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-500">{t('configs.contentTitle')}</span>
            )}
          </div>
          <div className="flex gap-2">
            {panelMode === 'comparing' && (
              <button onClick={cancelCompare}
                className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50">
                {t('common.close')}
              </button>
            )}
            {panelMode === 'viewing' && viewedCommit && (
              <button onClick={startCompare}
                className="text-xs border border-gray-300 text-gray-600 bg-white px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {t('configs.btnCompare')}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">{t('common.loading')}</p>
            </div>
          )}
          {!loading && panelMode === 'comparing' && diffData && (
            <SideBySideDiff contentA={diffData.contentA} contentB={diffData.contentB} shaA={diffData.shaA} shaB={diffData.shaB} />
          )}
          {!loading && (panelMode === 'viewing' || panelMode === 'picking') && viewedCommit && (
            <>
              <ConfigViewer content={viewedCommit.content} />
              {panelMode === 'picking' && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-medium">{t('configs.compareModeHint')}</p>
                </div>
              )}
            </>
          )}
          {!loading && panelMode === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {selectedDevice ? t('configs.idleHintDevice') : t('configs.idleHintNoDevice')}
              </p>
              {selectedDevice && (
                <p className="text-xs text-gray-400">{t('configs.idleSubHint')}</p>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
