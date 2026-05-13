import { useEffect, useState, useCallback, useRef } from 'react'
import { devicesApi } from '../services/api'
import { useLanguage } from '../i18n'
import DeviceList from '../components/Devices/DeviceList'
import DeviceForm from '../components/Devices/DeviceForm'
import DeviceEditModal from '../components/Devices/DeviceEditModal'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'

export default function DevicesPage() {
  const { t } = useLanguage()
  const [devices, setDevices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState(null)
  const [collectingIds, setCollectingIds] = useState(new Set())
  const [confirm, setConfirm] = useState(null)
  const [editingDevice, setEditingDevice] = useState(null)

  const devicesRef = useRef([])

  const loadDevices = useCallback(async () => {
    const { data } = await devicesApi.list()
    setDevices(data)
    devicesRef.current = data
  }, [])

  const pingAll = useCallback(async () => {
    for (const d of devicesRef.current) {
      try {
        const { data } = await devicesApi.ping(d.id)
        setDevices((prev) =>
          prev.map((dev) => dev.id === d.id ? { ...dev, status: data.status } : dev)
        )
      } catch {}
    }
  }, [])

  useEffect(() => {
    loadDevices()
    const loadInterval = setInterval(loadDevices, 30000)
    return () => clearInterval(loadInterval)
  }, [loadDevices])

  useEffect(() => {
    const first = setTimeout(pingAll, 1500)
    const interval = setInterval(pingAll, 10000)
    return () => { clearTimeout(first); clearInterval(interval) }
  }, [pingAll])

  function showToast(message, type = 'success') {
    setToast({ message, type })
  }

  async function handleCreate(form) {
    await devicesApi.create(form)
    setShowForm(false)
    loadDevices()
    showToast(t('devices.toast.created'))
  }

  async function handleCollect(id) {
    if (collectingIds.has(id)) return
    setCollectingIds((prev) => new Set([...prev, id]))
    try {
      await devicesApi.collect(id)
      showToast(t('devices.toast.configOk'), 'success')
      loadDevices()
    } catch (err) {
      const detail = err?.response?.data?.detail
      showToast(detail || t('devices.toast.configFail'), 'error')
    } finally {
      setCollectingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function handleDelete(id) {
    const device = devices.find((d) => d.id === id)
    const name = device?.hostname || '?'
    setConfirm({
      title: t('devices.confirm.deleteTitle'),
      message: `"${name}" ${t('devices.confirm.deleteMsg')}`,
      onConfirm: async () => {
        setConfirm(null)
        await devicesApi.remove(id)
        loadDevices()
        showToast(t('devices.toast.deleted'), 'info')
      },
    })
  }

  async function handleEditSave(payload) {
    await devicesApi.update(editingDevice.id, payload)
    setEditingDevice(null)
    loadDevices()
    showToast(t('devices.toast.updated'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('devices.title')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {t('devices.addButton')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 max-w-lg">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('devices.newDevice')}</h2>
          <DeviceForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        <DeviceList
          devices={devices}
          onCollect={handleCollect}
          onDelete={handleDelete}
          onEdit={setEditingDevice}
          collectingIds={collectingIds}
        />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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

      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          onSave={handleEditSave}
          onClose={() => setEditingDevice(null)}
        />
      )}
    </div>
  )
}
