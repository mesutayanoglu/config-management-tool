import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { devicesApi } from '../services/api'
import { useLanguage } from '../i18n'
import useAuthStore from '../store/authStore'
import useCredentialProfiles from '../hooks/useCredentialProfiles'
import DeviceList from '../components/Devices/DeviceList'
import DeviceFilterBar from '../components/Devices/DeviceFilterBar'
import DeviceAddModal from '../components/Devices/DeviceAddModal'
import DeviceEditModal from '../components/Devices/DeviceEditModal'
import CredentialProfileModal from '../components/Devices/CredentialProfileModal'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'

export default function DevicesPage() {
  const { t } = useLanguage()
  const { isReadOnly } = useAuthStore()
  const { profiles, add: addProfile, update: updateProfile, remove: removeProfile } = useCredentialProfiles()

  // ── Sunucu verisi ──────────────────────────────────────────────────────────
  const [devices, setDevices] = useState([])

  // ── UI durumu ─────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [showProfileManager, setShowProfileManager] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [editingDevice, setEditingDevice] = useState(null)
  const [collectingIds, setCollectingIds] = useState(new Set())

  // ── Filtre durumu ─────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ search: '', vendors: [], statuses: [] })

  const devicesRef = useRef([])

  // ── Türetilmiş: filtrelenmiş cihaz listesi ────────────────────────────────
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!d.hostname.toLowerCase().includes(q) && !d.ip_address.toLowerCase().includes(q)) return false
      }
      if (filters.vendors.length > 0 && !filters.vendors.includes(d.vendor)) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(d.status)) return false
      return true
    })
  }, [devices, filters])

  // ── Veri yükleme ──────────────────────────────────────────────────────────

  const loadDevices = useCallback(async () => {
    const { data } = await devicesApi.list()
    setDevices(data)
    devicesRef.current = data
  }, [])

  const pingAll = useCallback(async () => {
    for (const d of devicesRef.current) {
      try {
        const { data } = await devicesApi.ping(d.id)
        setDevices(prev =>
          prev.map(dev => dev.id === d.id ? { ...dev, status: data.status } : dev)
        )
      } catch {}
    }
  }, [])

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 30000)
    return () => clearInterval(interval)
  }, [loadDevices])

  useEffect(() => {
    const first    = setTimeout(pingAll, 1500)
    const interval = setInterval(pingAll, 10000)
    return () => { clearTimeout(first); clearInterval(interval) }
  }, [pingAll])

  // ── Yardımcı ──────────────────────────────────────────────────────────────

  function showToast(message, type = 'success') {
    setToast({ message, type })
  }

  // ── CRUD işlemleri ────────────────────────────────────────────────────────

  async function handleCreate(form) {
    await devicesApi.create(form)
    setShowAddModal(false)
    loadDevices()
    showToast(t('devices.toast.created'))
  }

  async function handleCollect(id) {
    if (collectingIds.has(id)) return
    setCollectingIds(prev => new Set([...prev, id]))
    try {
      await devicesApi.collect(id)
      showToast(t('devices.toast.configOk'))
      loadDevices()
    } catch (err) {
      const detail = err?.response?.data?.detail
      showToast(detail || t('devices.toast.configFail'), 'error')
    } finally {
      setCollectingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function handleDelete(id) {
    const name = devices.find(d => d.id === id)?.hostname || '?'
    setConfirm({
      title: t('devices.confirm.deleteTitle'),
      message: `"${name}" ${t('devices.confirm.deleteMsg')}`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await devicesApi.remove(id)
          loadDevices()
          showToast(t('devices.toast.deleted'), 'info')
        } catch (err) {
          const detail = err?.response?.data?.detail
          if (detail === 'scheduler_conflict') {
            showToast(t('devices.toast.deleteSchedulerError'), 'error')
          } else {
            showToast(detail || t('devices.toast.configFail'), 'error')
          }
        }
      },
    })
  }

  async function handleEditSave(payload) {
    await devicesApi.update(editingDevice.id, payload)
    setEditingDevice(null)
    loadDevices()
    showToast(t('devices.toast.updated'))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Sayfa başlığı + aksiyonlar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('devices.title')}</h1>
        {!isReadOnly() && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfileManager(true)}
              className="border border-gray-300 text-gray-600 px-3 py-2 rounded-md text-sm hover:bg-gray-50 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              {t('credProfiles.manageBtn')}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              {t('devices.addButton')}
            </button>
          </div>
        )}
      </div>

      {/* Ana kart: filtre çubuğu + tablo */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <DeviceFilterBar
          totalCount={devices.length}
          filteredCount={filteredDevices.length}
          filters={filters}
          onChange={setFilters}
        />
        <DeviceList
          devices={filteredDevices}
          allCount={devices.length}
          onCollect={handleCollect}
          onDelete={handleDelete}
          onEdit={setEditingDevice}
          collectingIds={collectingIds}
          readOnly={isReadOnly()}
        />
      </div>

      {/* Cihaz ekleme modalı */}
      {showAddModal && (
        <DeviceAddModal
          onSubmit={handleCreate}
          onClose={() => setShowAddModal(false)}
          profiles={profiles}
          onOpenProfileManager={() => setShowProfileManager(true)}
        />
      )}

      {/* Credential Profile yönetim modalı */}
      {showProfileManager && (
        <CredentialProfileModal
          profiles={profiles}
          onAdd={addProfile}
          onUpdate={updateProfile}
          onDelete={removeProfile}
          onClose={() => setShowProfileManager(false)}
        />
      )}

      {/* Toast bildirimi */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Silme onay modalı */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
        />
      )}

      {/* Cihaz düzenleme modalı */}
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          onSave={handleEditSave}
          onClose={() => setEditingDevice(null)}
          profiles={profiles}
          onOpenProfileManager={() => { setEditingDevice(null); setShowProfileManager(true) }}
        />
      )}

    </div>
  )
}
