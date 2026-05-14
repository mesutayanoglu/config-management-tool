import { useState } from 'react'
import { useLanguage } from '../../i18n'

const VENDOR_COLORS = {
  fortigate: 'bg-red-100 text-red-600',
  cisco: 'bg-blue-100 text-blue-600',
  huawei: 'bg-orange-100 text-orange-700',
  aruba: 'bg-purple-100 text-purple-600',
  aruba_cx: 'bg-purple-100 text-purple-600',
}

function DeviceRow({ device }) {
  const color = VENDOR_COLORS[device.vendor?.toLowerCase()] || 'bg-gray-100 text-gray-500'
  return (
    <div className="flex items-center gap-2 py-1.5 pl-4">
      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{device.hostname}</span>
      <span className="text-xs text-gray-400 flex-shrink-0 font-mono">{device.ip_address}</span>
      {device.vendor && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${color}`}>
          {device.vendor}
        </span>
      )}
    </div>
  )
}

function SiteGroup({ siteName, devices }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-gray-100 transition-colors text-left"
      >
        <svg
          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
        <span className="text-xs font-semibold text-gray-600 flex-1 truncate">{siteName}</span>
        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full font-medium flex-shrink-0">
          {devices.length}
        </span>
      </button>
      {expanded && (
        <div className="border-l-2 border-gray-100 ml-4">
          {devices.map(d => <DeviceRow key={d.id} device={d} />)}
        </div>
      )}
    </div>
  )
}

export default function DeviceHierarchyPreview({ mode, devices, orgId, siteId }) {
  const { t } = useLanguage()

  if (mode === 'org') {
    if (!orgId) return null
    const included = devices.filter(d => d.org_id === Number(orgId))

    if (included.length === 0) {
      return (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">{t('schedulers.form.noDevicesInOrg')}</p>
        </div>
      )
    }

    const siteMap = {}
    for (const d of included) {
      const key = d.site_id ?? 0
      if (!siteMap[key]) siteMap[key] = { name: d.site_name || '—', devices: [] }
      siteMap[key].devices.push(d)
    }

    return (
      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-blue-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-blue-700">{t('schedulers.form.devicesIncluded')}</span>
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">{included.length}</span>
        </div>
        <div className="p-1.5 max-h-52 overflow-y-auto">
          {Object.entries(siteMap).map(([key, { name, devices }]) => (
            <SiteGroup key={key} siteName={name} devices={devices} />
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'site') {
    if (!siteId) return null
    const included = devices.filter(d => d.site_id === Number(siteId))

    if (included.length === 0) {
      return (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">{t('schedulers.form.noDevicesInSite')}</p>
        </div>
      )
    }

    return (
      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-blue-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-blue-700">{t('schedulers.form.devicesIncluded')}</span>
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">{included.length}</span>
        </div>
        <div className="p-1.5 max-h-52 overflow-y-auto">
          {included.map(d => <DeviceRow key={d.id} device={d} />)}
        </div>
      </div>
    )
  }

  return null
}
