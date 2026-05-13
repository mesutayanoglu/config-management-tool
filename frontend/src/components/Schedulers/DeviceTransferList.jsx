import { useState } from 'react'
import { useLanguage } from '../../i18n'

export default function DeviceTransferList({ devices, selectedIds, onChange }) {
  const { t } = useLanguage()
  const [leftSearch, setLeftSearch] = useState('')
  const [rightSearch, setRightSearch] = useState('')

  const selected = devices.filter((d) => selectedIds.includes(d.id))
  const available = devices.filter((d) => !selectedIds.includes(d.id))

  const filteredAvailable = available.filter((d) =>
    matchSearch(d, leftSearch)
  )
  const filteredSelected = selected.filter((d) =>
    matchSearch(d, rightSearch)
  )

  function add(id) { onChange([...selectedIds, id]) }
  function remove(id) { onChange(selectedIds.filter((x) => x !== id)) }
  function addAll() { onChange(devices.map((d) => d.id)) }
  function removeAll() { onChange([]) }

  return (
    <div className="flex gap-3 items-stretch">

      {/* Sol: Mevcut cihazlar */}
      <Panel
        title={t('schedulers.form.available')}
        count={available.length}
        search={leftSearch}
        onSearch={setLeftSearch}
        items={filteredAvailable}
        t={t}
        action={(d) => (
          <button
            type="button"
            onClick={() => add(d.id)}
            className="ml-auto flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-colors"
            title="Ekle"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        footer={
          available.length > 0 && (
            <button type="button" onClick={addAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5">
              {t('schedulers.form.addAll')} →
            </button>
          )
        }
      />

      {/* Orta: Ok ikonları */}
      <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
        <div className="w-px flex-1 bg-gray-200" />
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4 4m4-4l-4-4" />
          </svg>
        </div>
        <div className="w-px flex-1 bg-gray-200" />
      </div>

      {/* Sağ: Seçilenler */}
      <Panel
        title={t('schedulers.form.selected')}
        count={selected.length}
        search={rightSearch}
        onSearch={setRightSearch}
        items={filteredSelected}
        t={t}
        highlight
        action={(d) => (
          <button
            type="button"
            onClick={() => remove(d.id)}
            className="ml-auto flex-shrink-0 w-6 h-6 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors"
            title="Çıkar"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        footer={
          selected.length > 0 && (
            <button type="button" onClick={removeAll}
              className="text-xs text-red-400 hover:text-red-600 font-medium py-1.5">
              ← {t('schedulers.form.removeAll')}
            </button>
          )
        }
        emptyIcon={
          <div className="text-center py-6 text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-xs">{t('schedulers.form.noneSelected')}</p>
          </div>
        }
      />

    </div>
  )
}

function matchSearch(d, q) {
  if (!q) return true
  const lower = q.toLowerCase()
  return d.hostname.toLowerCase().includes(lower) || d.ip_address.includes(lower)
}

function Panel({ title, count, search, onSearch, items, action, footer, highlight, t, emptyIcon }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-3 py-2.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0 ${highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
        <span className={`text-xs font-semibold ${highlight ? 'text-blue-700' : 'text-gray-600'}`}>{title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${highlight ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('schedulers.form.searchDevices')}
            className="w-full text-xs focus:outline-none text-gray-600 placeholder-gray-300 bg-transparent"
          />
          {search && (
            <button type="button" onClick={() => onSearch('')} className="text-gray-300 hover:text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 160, maxHeight: 220 }}>
        {items.length === 0
          ? (emptyIcon || <p className="text-xs text-gray-400 px-3 py-4 text-center">{t('schedulers.form.noDevices')}</p>)
          : items.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${highlight ? 'bg-blue-400' : 'bg-gray-300'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 truncate">{d.hostname}</p>
                <p className="text-xs text-gray-400 truncate">{d.ip_address} · {d.vendor}</p>
              </div>
              {action(d)}
            </div>
          ))
        }
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-3 border-t border-gray-100 flex justify-center flex-shrink-0">
          {footer}
        </div>
      )}
    </div>
  )
}
