import { useRef, useEffect, useState } from 'react'
import { useLanguage } from '../../i18n'

const VENDOR_COLOR = {
  fortigate: 'text-red-500',
  cisco: 'text-blue-500',
  huawei: 'text-orange-500',
  aruba: 'text-purple-500',
  aruba_cx: 'text-purple-500',
}

function Checkbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !checked && indeterminate
  })
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer flex-shrink-0"
    />
  )
}

function DeviceRow({ device, selected, onToggle, indent = 'pl-16' }) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-2.5 ${indent} pr-3 py-1.5 border-b border-gray-50 last:border-0 cursor-pointer select-none transition-colors ${
        selected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 accent-blue-600 cursor-pointer flex-shrink-0"
      />
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        device.status === 'online' ? 'bg-green-500' :
        device.status === 'offline' ? 'bg-red-400' : 'bg-gray-300'
      }`} />
      <span className="text-xs font-medium text-gray-700 flex-1 truncate min-w-0">{device.hostname}</span>
      <span className="text-xs text-gray-400 font-mono flex-shrink-0 hidden sm:block">{device.ip_address}</span>
      {device.vendor && (
        <span className={`text-xs flex-shrink-0 font-medium ${VENDOR_COLOR[device.vendor?.toLowerCase()] || 'text-gray-400'}`}>
          {device.vendor}
        </span>
      )}
    </div>
  )
}

export default function HierarchicalDeviceSelector({ devices, orgs, selectedIds, onChange }) {
  const { t } = useLanguage()
  const [collapsedOrgs, setCollapsedOrgs] = useState(new Set())
  const [collapsedSites, setCollapsedSites] = useState(new Set())

  const tree = orgs
    .map(org => ({
      ...org,
      orgSites: (org.sites || [])
        .map(site => ({ ...site, devices: devices.filter(d => d.site_id === site.id) }))
        .filter(s => s.devices.length > 0),
    }))
    .filter(o => o.orgSites.length > 0)

  const ungrouped = devices.filter(d => !d.org_id)

  function selState(devList) {
    const n = devList.filter(d => selectedIds.includes(d.id)).length
    return { checked: n === devList.length && devList.length > 0, partial: n > 0 && n < devList.length, n }
  }

  function toggleDevice(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  function toggleBulk(devList) {
    const ids = devList.map(d => d.id)
    if (selState(devList).checked) {
      onChange(selectedIds.filter(x => !ids.includes(x)))
    } else {
      onChange([...new Set([...selectedIds, ...ids])])
    }
  }

  function toggleOrg(id) {
    setCollapsedOrgs(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleSite(id) {
    setCollapsedSites(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>

        {tree.length === 0 && ungrouped.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">{t('schedulers.form.noDevices')}</p>
        )}

        {tree.map(org => {
          const orgDevs = org.orgSites.flatMap(s => s.devices)
          const os = selState(orgDevs)
          const orgOpen = !collapsedOrgs.has(org.id)

          return (
            <div key={org.id}>
              {/* Org row */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 select-none">
                <button type="button" onClick={() => toggleOrg(org.id)}
                  className="flex-shrink-0 w-4 h-4 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">
                  <svg className={`w-3.5 h-3.5 transition-transform ${orgOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <Checkbox checked={os.checked} indeterminate={os.partial} onChange={() => toggleBulk(orgDevs)} />
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{org.name}</span>
                <span className="text-xs tabular-nums text-gray-400 flex-shrink-0">
                  {os.n > 0 ? `${os.n}/` : ''}{orgDevs.length}
                </span>
              </div>

              {orgOpen && org.orgSites.map(site => {
                const ss = selState(site.devices)
                const siteOpen = !collapsedSites.has(site.id)

                return (
                  <div key={site.id}>
                    {/* Site row */}
                    <div className="flex items-center gap-2 pl-8 pr-3 py-1.5 bg-white border-b border-gray-50 select-none">
                      <button type="button" onClick={() => toggleSite(site.id)}
                        className="flex-shrink-0 w-4 h-4 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">
                        <svg className={`w-3 h-3 transition-transform ${siteOpen ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <Checkbox checked={ss.checked} indeterminate={ss.partial} onChange={() => toggleBulk(site.devices)} />
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                      </svg>
                      <span className="text-xs font-medium text-gray-600 flex-1 truncate">{site.name}</span>
                      <span className="text-xs tabular-nums text-gray-400 flex-shrink-0">
                        {ss.n > 0 ? `${ss.n}/` : ''}{site.devices.length}
                      </span>
                    </div>

                    {siteOpen && site.devices.map(dev => (
                      <DeviceRow
                        key={dev.id}
                        device={dev}
                        selected={selectedIds.includes(dev.id)}
                        onToggle={() => toggleDevice(dev.id)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}

        {ungrouped.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 select-none">
              <div className="w-4 flex-shrink-0" />
              <Checkbox
                checked={selState(ungrouped).checked}
                indeterminate={selState(ungrouped).partial}
                onChange={() => toggleBulk(ungrouped)}
              />
              <span className="text-xs font-medium text-gray-500">{t('schedulers.form.ungrouped')}</span>
            </div>
            {ungrouped.map(dev => (
              <DeviceRow
                key={dev.id}
                device={dev}
                selected={selectedIds.includes(dev.id)}
                onToggle={() => toggleDevice(dev.id)}
                indent="pl-9"
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        {selectedIds.length > 0 ? (
          <>
            <span className="text-xs font-medium text-blue-600">
              {selectedIds.length} {t('schedulers.form.selectedCount')}
            </span>
            <button type="button" onClick={() => onChange([])}
              className="text-xs text-red-400 hover:text-red-600 transition-colors">
              {t('schedulers.form.removeAll')}
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400">{t('schedulers.form.noneSelected')}</span>
        )}
      </div>
    </div>
  )
}
