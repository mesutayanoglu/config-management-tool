import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useLanguage } from '../i18n'
import useAuthStore from '../store/authStore'
import { topologyApi } from '../services/api'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import TopologyNode from '../components/Topology/TopologyNode'
import TopologyEdge from '../components/Topology/TopologyEdge'

const NODE_TYPES = { deviceNode: TopologyNode }
const EDGE_TYPES = { deviceEdge: TopologyEdge }
const LS_POS_KEY = 'topology_node_positions'

function loadSavedPositions() {
  try {
    return JSON.parse(localStorage.getItem(LS_POS_KEY) || '{}')
  } catch {
    return {}
  }
}

function savePositions(nodes) {
  const pos = {}
  nodes.forEach((n) => { pos[n.id] = n.position })
  localStorage.setItem(LS_POS_KEY, JSON.stringify(pos))
}

// Panel bölümü: seçili cihaz yokken özet, varsa filtrelenmiş liste
function NeighborPanel({
  neighbors, nodes, selectedNodeId, onSelectNode,
  onDeleteNeighbor, readOnly, t,
}) {
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
    [selectedNodeId, nodes]
  )

  // Seçili node için ilgili komşuları hesapla
  const panelItems = useMemo(() => {
    if (!selectedNodeId) return null

    if (selectedNodeId.startsWith('d_')) {
      const deviceId = parseInt(selectedNodeId.replace('d_', ''), 10)
      return {
        type: 'known',
        device: selectedNode?.data,
        outgoing: neighbors.filter((nb) => nb.device_id === deviceId),
      }
    }

    // Ghost node → bu ghost'u keşfeden komşuları bul
    const ghostKey = selectedNodeId.replace('g_', '')
    const foundBy = neighbors.filter(
      (nb) =>
        !nb.discovered_device_id &&
        (nb.neighbor_ip === ghostKey ||
          nb.neighbor_hostname === ghostKey ||
          String(nb.id) === ghostKey)
    )
    return {
      type: 'ghost',
      device: selectedNode?.data,
      foundBy,
    }
  }, [selectedNodeId, selectedNode, neighbors])

  // Seçili cihaz yoksa özet göster
  if (!panelItems) {
    const knownCount = nodes.filter((n) => n.data?.known).length
    const ghostCount = nodes.filter((n) => !n.data?.known).length
    return (
      <div className="p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          {t('topology.neighbors')}
        </h3>
        {nodes.length === 0 ? (
          <p className="text-xs text-slate-400">{t('topology.noNeighbors')}</p>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">{t('topology.clickToSelect')}</p>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-blue-700">{knownCount}</p>
                <p className="text-[10px] text-blue-500 uppercase tracking-wide font-semibold">Cihaz</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-slate-600">{ghostCount}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Bilinmeyen</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-slate-600">{neighbors.length}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Bağlantı</p>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  if (panelItems.type === 'known') {
    const { device, outgoing } = panelItems
    return (
      <div className="p-4">
        <button
          onClick={() => onSelectNode(null)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-3 block"
        >
          {t('topology.back')}
        </button>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-800">{device?.hostname}</h3>
          <p className="text-xs text-slate-400 font-mono">{device?.ip}</p>
          {device?.vendor && (
            <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
              {device.vendor}
            </span>
          )}
        </div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          {t('topology.deviceConnections')} ({outgoing.length})
        </h4>
        {outgoing.length === 0 ? (
          <p className="text-xs text-slate-400">{t('topology.noOutgoingLldp')}</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((nb) => (
              <div
                key={nb.id}
                className="bg-slate-50 rounded-lg p-2.5 group relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate" title={nb.neighbor_hostname || nb.neighbor_ip}>
                      {nb.neighbor_hostname || nb.neighbor_ip || '?'}
                    </p>
                    {nb.neighbor_ip && (
                      <p className="text-[10px] text-slate-400 font-mono">{nb.neighbor_ip}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                        <span className="font-bold">{nb.local_port || '?'}</span>
                        {nb.neighbor_port && (
                          <>
                            <span className="text-blue-300">↔</span>
                            <span className="font-bold">{nb.neighbor_port}</span>
                          </>
                        )}
                      </span>
                      <span className={`text-[10px] px-1 py-0.5 rounded font-semibold uppercase ${
                        nb.protocol === 'cdp' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {nb.protocol}
                      </span>
                      {nb.discovered_device_id ? (
                        <span className="text-[10px] text-blue-500 font-medium">● Bilinen</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">○ Bilinmeyen</span>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => onDeleteNeighbor(nb)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex-shrink-0 p-0.5 mt-0.5"
                      title={t('topology.deleteNeighbor')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Ghost node paneli
  const { device, foundBy } = panelItems
  return (
    <div className="p-4">
      <button
        onClick={() => onSelectNode(null)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-3 block"
      >
        {t('topology.back')}
      </button>
      <div className="mb-4">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase mb-1 inline-block">
          {t('topology.unknownDevice')}
        </span>
        <h3 className="text-sm font-bold text-gray-700">{device?.hostname || '?'}</h3>
        <p className="text-xs text-slate-400 font-mono">{device?.ip !== '?' ? device?.ip : ''}</p>
      </div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        {t('topology.discoveredBy')}
      </h4>
      <div className="space-y-2">
        {foundBy.map((nb) => (
          <div key={nb.id} className="bg-slate-50 rounded-lg p-2.5 group relative">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">{nb.device_hostname}</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 mt-1">
                  <span className="font-bold">{nb.local_port || '?'}</span>
                  {nb.neighbor_port && (
                    <>
                      <span className="text-blue-300">↔</span>
                      <span className="font-bold">{nb.neighbor_port}</span>
                    </>
                  )}
                </span>
              </div>
              {!readOnly && (
                <button
                  onClick={() => onDeleteNeighbor(nb)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex-shrink-0 p-0.5 mt-0.5"
                  title={t('topology.deleteNeighbor')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TopologyPage() {
  const { t } = useLanguage()
  const { isSuperAdmin, isReadOnly } = useAuthStore()
  const isSA = isSuperAdmin()
  const readOnly = isReadOnly()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [neighbors, setNeighbors] = useState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [discovering, setDiscovering] = useState(false)
  const [lastDiscovered, setLastDiscovered] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [showPanel, setShowPanel] = useState(true)
  const [autoSettings, setAutoSettings] = useState({ auto_enabled: false, interval_hours: 6 })
  const [savingSettings, setSavingSettings] = useState(false)
  const loadedOnce = useRef(false)

  const showToast = useCallback((type, msg) => {
    setToast({ type, message: msg })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const applyGraphData = useCallback((graphData, neighborList) => {
    const saved = loadSavedPositions()
    const nodesWithPos = (graphData.nodes || []).map((n) => ({
      ...n,
      position: saved[n.id] || n.position,
    }))
    setNodes(nodesWithPos)
    setEdges(graphData.edges || [])
    setNeighbors(neighborList || [])
    if ((neighborList || []).length > 0) {
      const latest = neighborList.reduce((acc, nb) => {
        if (!acc || nb.last_discovered_at > acc) return nb.last_discovered_at
        return acc
      }, null)
      if (latest) setLastDiscovered(new Date(latest).toLocaleString('tr-TR'))
    }
  }, [setNodes, setEdges])

  const loadGraph = useCallback(async () => {
    try {
      const [graphRes, nbRes] = await Promise.all([
        topologyApi.graph(),
        topologyApi.neighbors(),
      ])
      applyGraphData(graphRes.data, nbRes.data)
    } catch {
      // Henüz veri yok — boş sayfa göster
    }
  }, [applyGraphData])

  useEffect(() => {
    if (!loadedOnce.current) {
      loadedOnce.current = true
      loadGraph()
    }
  }, [loadGraph])

  useEffect(() => {
    topologyApi.getSettings().then((res) => setAutoSettings(res.data)).catch(() => {})
  }, [])

  const handleDiscover = useCallback(async () => {
    if (discovering) return
    setDiscovering(true)
    try {
      const res = await topologyApi.discover()
      const { discovered, failed } = res.data
      const parts = t('topology.discoverySummary').split(',')
      showToast('success', `${t('topology.toast.discovered')} (${discovered} ${parts[0]}, ${failed}${parts[1] || ''})`)
      await loadGraph()
    } catch {
      showToast('error', t('topology.toast.discoverError'))
    } finally {
      setDiscovering(false)
    }
  }, [discovering, showToast, loadGraph, t])

  const handleDeleteNeighbor = useCallback((nb) => {
    setConfirm({
      title: t('topology.confirmDeleteTitle'),
      message: `"${nb.neighbor_hostname || nb.neighbor_ip}" ${t('topology.confirmDeleteMsg')}`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await topologyApi.deleteNeighbor(nb.id)
          showToast('success', t('topology.toast.deleted'))
          await loadGraph()
        } catch {
          showToast('error', t('topology.toast.deleteError'))
        }
      },
      onCancel: () => setConfirm(null),
    })
  }, [t, showToast, loadGraph])

  const handleSaveSettings = useCallback(async () => {
    setSavingSettings(true)
    try {
      await topologyApi.saveSettings(autoSettings)
      showToast('success', t('topology.toast.settingsSaved'))
    } catch {
      showToast('error', t('topology.toast.settingsError'))
    } finally {
      setSavingSettings(false)
    }
  }, [autoSettings, showToast, t])

  const onNodesChangeWithSave = useCallback((changes) => {
    onNodesChange(changes)
    setNodes((nds) => {
      savePositions(nds)
      return nds
    })
  }, [onNodesChange, setNodes])

  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      {/* Üst araç çubuğu */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('topology.title')}</h1>
          {lastDiscovered && (
            <p className="text-xs text-slate-400 mt-0.5">
              {t('topology.lastDiscovered')}: {lastDiscovered}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPanel((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {t('topology.neighbors')}
          </button>
          {!readOnly && (
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {discovering ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('topology.discovering')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {t('topology.discover')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* İçerik alanı */}
      <div className="flex flex-1 overflow-hidden">
        {/* React Flow canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeWithSave}
            onEdgesChange={onEdgesChange}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={3}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                if (!n.data?.known) return '#94a3b8'
                const v = n.data?.vendor?.toLowerCase()
                const colors = {
                  cisco: '#3b82f6', fortigate: '#ef4444',
                  huawei: '#f43f5e', aruba: '#f97316', aruba_cx: '#f59e0b',
                }
                return colors[v] || '#3b82f6'
              }}
              maskColor="rgba(241,245,249,0.8)"
              className="!bg-white !border !border-slate-200 !rounded-xl"
            />
          </ReactFlow>
          {nodes.length === 0 && !discovering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
                </svg>
                <p className="text-slate-400 text-sm max-w-xs">{t('topology.noNeighbors')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sağ panel */}
        {showPanel && (
          <div className="w-72 bg-white border-l border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              <NeighborPanel
                neighbors={neighbors}
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onDeleteNeighbor={handleDeleteNeighbor}
                readOnly={readOnly}
                t={t}
              />

              {/* Otomatik keşif ayarları — sadece super admin */}
              {isSA && (
                <div className="p-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    {t('topology.settingsSection')}
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-gray-700">{t('topology.autoDiscover')}</span>
                      <button
                        onClick={() => setAutoSettings((s) => ({ ...s, auto_enabled: !s.auto_enabled }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoSettings.auto_enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${autoSettings.auto_enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>
                    {autoSettings.auto_enabled && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">{t('topology.intervalHours')}</label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={autoSettings.interval_hours}
                          onChange={(e) => setAutoSettings((s) => ({ ...s, interval_hours: parseInt(e.target.value) || 6 }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {savingSettings ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}
    </div>
  )
}
